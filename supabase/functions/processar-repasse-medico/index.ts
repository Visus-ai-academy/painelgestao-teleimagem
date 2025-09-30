import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import * as XLSX from "https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RepasseRow {
  medico_nome?: string;
  medico_crm?: string;
  modalidade: string;
  especialidade: string;
  categoria?: string;
  prioridade: string;
  valor: number;
  esta_no_escopo?: boolean | string;
  cliente_nome?: string;
  data_inicio_vigencia?: string;
  data_fim_vigencia?: string;
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

    console.log(`📊 Processando arquivo: ${file.name}, tamanho: ${file.size} bytes`);

    // Ler arquivo Excel com opções otimizadas para memória
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, {
      type: 'array',
      cellDates: true,
      cellStyles: false, // Não precisamos de estilos
      sheetStubs: false  // Ignora células vazias
    });
    
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      raw: false,
      defval: null
    }) as RepasseRow[];

    console.log(`Total de linhas encontradas: ${jsonData.length}`);

    let processados = 0;
    let inseridos = 0;
    let atualizados = 0;
    let erros = 0;
    const detalhesErros: any[] = [];

    // Buscar médicos e clientes existentes
    const { data: medicos } = await supabase
      .from('medicos')
      .select('id, nome, crm')
      .eq('ativo', true);

    const { data: clientes } = await supabase
      .from('clientes')
      .select('id, nome, nome_fantasia')
      .eq('ativo', true);

    const medicoMapNome = new Map(medicos?.map(m => [m.nome.toLowerCase(), m.id]) || []);
    const medicoMapCrm = new Map(medicos?.map(m => [m.crm?.toLowerCase(), m.id]) || []);
    const clienteMap = new Map(clientes?.map(c => [c.nome_fantasia?.toLowerCase() || c.nome.toLowerCase(), c.id]) || []);

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      processados++;

      try {
        if (!row.modalidade || !row.especialidade || !row.prioridade || !row.valor) {
          throw new Error('Campos obrigatórios em branco: modalidade, especialidade, prioridade, valor');
        }

        // Buscar médico
        let medico_id = null;
        if (row.medico_crm) {
          medico_id = medicoMapCrm.get(row.medico_crm.toLowerCase().trim());
        } else if (row.medico_nome) {
          medico_id = medicoMapNome.get(row.medico_nome.toLowerCase().trim());
        }

        if (!medico_id && (row.medico_nome || row.medico_crm)) {
          throw new Error(`Médico não encontrado: ${row.medico_nome || row.medico_crm}`);
        }

        // Buscar cliente se especificado
        let cliente_id = null;
        if (row.cliente_nome) {
          cliente_id = clienteMap.get(row.cliente_nome.toLowerCase().trim());
        }

        // Processar esta_no_escopo (aceita sim/não, true/false, 1/0)
        let esta_no_escopo = false;
        if (row.esta_no_escopo) {
          const valorEscopo = String(row.esta_no_escopo).toLowerCase().trim();
          esta_no_escopo = ['sim', 'yes', 'true', '1', 's', 'y'].includes(valorEscopo);
        }

        // Preparar dados do repasse
        const repasseData = {
          medico_id: medico_id || null,
          modalidade: row.modalidade.trim(),
          especialidade: row.especialidade.trim(),
          categoria: row.categoria?.trim() || null,
          prioridade: row.prioridade.trim(),
          valor: Number(row.valor),
          esta_no_escopo,
          cliente_id: cliente_id || null
        };

        // Verificar se já existe
        let queryBuilder = supabase
          .from('medicos_valores_repasse')
          .select('id')
          .eq('modalidade', repasseData.modalidade)
          .eq('especialidade', repasseData.especialidade)
          .eq('prioridade', repasseData.prioridade);

        if (repasseData.medico_id) {
          queryBuilder = queryBuilder.eq('medico_id', repasseData.medico_id);
        } else {
          queryBuilder = queryBuilder.is('medico_id', null);
        }

        let { data: existente } = await queryBuilder.single();

        if (existente) {
          // Atualizar existente
          const { error: updateError } = await supabase
            .from('medicos_valores_repasse')
            .update({ valor: repasseData.valor })
            .eq('id', existente.id);

          if (updateError) throw updateError;
          atualizados++;
        } else {
          // Inserir novo
          const { error: insertError } = await supabase
            .from('medicos_valores_repasse')
            .insert(repasseData);

          if (insertError) throw insertError;
          inseridos++;
        }

        const identificacao = row.medico_nome || row.medico_crm || 'GERAL';
        console.log(`Linha ${i + 1}: Processada com sucesso - ${identificacao} - ${repasseData.modalidade}/${repasseData.especialidade}`);

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
        tipo_arquivo: 'repasse_medico',
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