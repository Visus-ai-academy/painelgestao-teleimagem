import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import * as XLSX from "https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParametroRow {
  cliente_nome?: string;
  tipo_cliente?: string;
  aplicar_franquia?: boolean;
  volume_franquia?: number;
  valor_franquia?: number;
  valor_acima_franquia?: number;
  aplicar_adicional_urgencia?: boolean;
  percentual_adicional_urgencia?: number;
  cobrar_integracao?: boolean;
  valor_integracao?: number;
  dia_fechamento?: number;
  forma_cobranca?: string;
  data_aniversario_contrato?: string;
  observacoes?: string;
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
    const jsonData = XLSX.utils.sheet_to_json(worksheet) as ParametroRow[];

    console.log(`Total de linhas encontradas: ${jsonData.length}`);

    let processados = 0;
    let inseridos = 0;
    let atualizados = 0;
    let erros = 0;
    const detalhesErros: any[] = [];

    // Buscar clientes
    const { data: clientes } = await supabase.from('clientes').select('id, nome');
    const clienteMap = new Map(clientes?.map(c => [c.nome.toLowerCase(), c.id]) || []);

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      processados++;

      try {
        if (!row.cliente_nome) {
          throw new Error('Campo cliente_nome é obrigatório');
        }

        // Preparar dados do parâmetro
        const parametroData = {
          cliente_id: clienteMap.get(row.cliente_nome.toLowerCase().trim()),
          tipo_cliente: row.tipo_cliente?.trim() || 'CO',
          aplicar_franquia: row.aplicar_franquia !== false,
          volume_franquia: row.volume_franquia ? Number(row.volume_franquia) : null,
          valor_franquia: row.valor_franquia ? Number(row.valor_franquia) : null,
          valor_acima_franquia: row.valor_acima_franquia ? Number(row.valor_acima_franquia) : null,
          aplicar_adicional_urgencia: row.aplicar_adicional_urgencia !== false,
          percentual_adicional_urgencia: row.percentual_adicional_urgencia ? Number(row.percentual_adicional_urgencia) : 50,
          cobrar_integracao: row.cobrar_integracao !== false,
          valor_integracao: row.valor_integracao ? Number(row.valor_integracao) : null,
          dia_fechamento: row.dia_fechamento ? Number(row.dia_fechamento) : 7,
          forma_cobranca: row.forma_cobranca?.trim() || 'mensal',
          data_aniversario_contrato: row.data_aniversario_contrato ? new Date(row.data_aniversario_contrato).toISOString().split('T')[0] : null,
          observacoes: row.observacoes?.trim() || null,
          ativo: true
        };

        if (!parametroData.cliente_id) {
          throw new Error(`Cliente não encontrado: ${row.cliente_nome}`);
        }

        // Verificar se já existe
        const { data: existente } = await supabase
          .from('parametros_faturamento')
          .select('id')
          .eq('cliente_id', parametroData.cliente_id)
          .single();

        if (existente) {
          // Atualizar existente
          const { error: updateError } = await supabase
            .from('parametros_faturamento')
            .update(parametroData)
            .eq('id', existente.id);

          if (updateError) throw updateError;
          atualizados++;
        } else {
          // Inserir novo
          const { error: insertError } = await supabase
            .from('parametros_faturamento')
            .insert(parametroData);

          if (insertError) throw insertError;
          inseridos++;
        }

        console.log(`Linha ${i + 1}: Processada com sucesso - ${row.cliente_nome}`);

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
        tipo_arquivo: 'parametros_faturamento',
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
      detalhes_erros: detalhesErros
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