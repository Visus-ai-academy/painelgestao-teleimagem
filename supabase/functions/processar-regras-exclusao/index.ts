import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import * as XLSX from "https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegraRow {
  nome: string;
  descricao?: string;
  tipo_regra: string;
  criterios: string; // JSON string
  prioridade?: number;
  data_inicio?: string;
  data_fim?: string;
  aplicar_legado?: boolean;
  aplicar_incremental?: boolean;
  ativo?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      throw new Error('Nenhum arquivo foi enviado');
    }

    console.log(`Processando arquivo: ${file.name}, tamanho: ${file.size} bytes`);

    // Ler arquivo Excel
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet) as RegraRow[];

    console.log(`Total de linhas encontradas: ${jsonData.length}`);

    let processados = 0;
    let inseridos = 0;
    let atualizados = 0;
    let erros = 0;
    const detalhesErros: any[] = [];

    const tiposValidos = ['cliente', 'modalidade', 'especialidade', 'categoria', 'medico', 'periodo', 'valor'];

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      processados++;

      try {
        if (!row.nome || !row.tipo_regra || !row.criterios) {
          throw new Error('Campos obrigatórios em branco: nome, tipo_regra, criterios');
        }

        if (!tiposValidos.includes(row.tipo_regra.toLowerCase())) {
          throw new Error(`Tipo de regra inválido: ${row.tipo_regra}. Tipos válidos: ${tiposValidos.join(', ')}`);
        }

        // Validar e parsear critérios JSON
        let criteriosParsed;
        try {
          criteriosParsed = JSON.parse(row.criterios);
        } catch (e) {
          throw new Error(`Critérios devem estar em formato JSON válido: ${row.criterios}`);
        }

        // Preparar dados da regra
        const regraData = {
          nome: row.nome.trim(),
          descricao: row.descricao?.trim() || null,
          tipo_regra: row.tipo_regra.toLowerCase(),
          criterios: criteriosParsed,
          prioridade: row.prioridade ? Number(row.prioridade) : 0,
          data_inicio: row.data_inicio ? new Date(row.data_inicio).toISOString().split('T')[0] : null,
          data_fim: row.data_fim ? new Date(row.data_fim).toISOString().split('T')[0] : null,
          aplicar_legado: row.aplicar_legado !== false,
          aplicar_incremental: row.aplicar_incremental !== false,
          ativo: row.ativo !== false
        };

        // Verificar se já existe (por nome)
        let { data: existente } = await supabase
          .from('regras_exclusao_faturamento')
          .select('id')
          .eq('nome', regraData.nome)
          .single();

        if (existente) {
          // Atualizar existente
          const { error: updateError } = await supabase
            .from('regras_exclusao_faturamento')
            .update(regraData)
            .eq('id', existente.id);

          if (updateError) throw updateError;
          atualizados++;
        } else {
          // Inserir novo
          const { error: insertError } = await supabase
            .from('regras_exclusao_faturamento')
            .insert(regraData);

          if (insertError) throw insertError;
          inseridos++;
        }

        console.log(`Linha ${i + 1}: Processada com sucesso - ${regraData.nome} (${regraData.tipo_regra})`);

      } catch (error: any) {
        erros++;
        const detalheErro = {
          linha: i + 1,
          dados: row,
          erro: error.message
        };
        detalhesErros.push(detalheErro);
        console.error(`Erro na linha ${i + 1}:`, error.message);
      }
    }

    // Registrar processamento
    const { error: logError } = await supabase
      .from('processamento_uploads')
      .insert({
        arquivo_nome: file.name,
        tipo_arquivo: 'regras_exclusao',
        tipo_dados: 'configuracao',
        status: erros === processados ? 'erro' : 'concluido',
        registros_processados: processados,
        registros_inseridos: inseridos,
        registros_atualizados: atualizados,
        registros_erro: erros,
        detalhes_erro: detalhesErros.length > 0 ? detalhesErros : null,
        tamanho_arquivo: file.size
      });

    if (logError) {
      console.error('Erro ao registrar log:', logError);
    }

    const resultado = {
      sucesso: true,
      arquivo: file.name,
      processados,
      inseridos,
      atualizados,
      erros,
      detalhes_erros: detalhesErros,
      exemplos_criterios: {
        cliente: '{"cliente_nome": "HOSPITAL ABC", "operador": "igual"}',
        modalidade: '{"modalidade": "TC", "operador": "igual"}',
        valor: '{"valor_minimo": 100, "valor_maximo": 500, "operador": "entre"}',
        periodo: '{"data_inicio": "2024-01-01", "data_fim": "2024-12-31"}'
      }
    };

    console.log('Processamento concluído:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Erro geral:', error);
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        erro: error.message,
        detalhes: error.stack 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});