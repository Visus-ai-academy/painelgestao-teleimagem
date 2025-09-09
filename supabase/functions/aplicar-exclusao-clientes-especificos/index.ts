import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lista de clientes que devem ser excluídos do processamento da volumetria
const CLIENTES_PARA_EXCLUIR = [
  'RADIOCOR_LOCAL',
  'CLINICADIA_TC', 
  'CLINICA RADIOCOR',
  'CLIRAM_LOCAL'
];

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { arquivo_fonte } = await req.json();
    
    console.log(`🚫 Aplicando exclusão de clientes específicos para arquivo: ${arquivo_fonte || 'TODOS'}`);
    console.log(`📋 Clientes a serem excluídos: ${CLIENTES_PARA_EXCLUIR.join(', ')}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let totalExcluidos = 0;
    const detalhes = [] as string[];

    // Tipos de arquivo que processamos (arquivos 1, 2, 3, 4)
    const tiposArquivo = arquivo_fonte ? [arquivo_fonte] : [
      'volumetria_padrao',
      'volumetria_fora_padrao', 
      'volumetria_padrao_retroativo',
      'volumetria_fora_padrao_retroativo'
    ];

    // Aplicar exclusão para cada tipo de arquivo
    for (const tipo of tiposArquivo) {
      console.log(`🗂️ Processando exclusões em ${tipo}...`);
      
      // Primeiro buscar registros que serão excluídos para salvar na tabela de rejeições
      const { data: registrosParaExcluir } = await supabase
        .from('volumetria_mobilemed')
        .select('*')
        .eq('arquivo_fonte', tipo)
        .in('"EMPRESA"', CLIENTES_PARA_EXCLUIR);

      if (registrosParaExcluir && registrosParaExcluir.length > 0) {
        // Salvar registros rejeitados
        const rejectionsToInsert = registrosParaExcluir.map((record, index) => ({
          arquivo_fonte: tipo,
          lote_upload: record.lote_upload || 'exclusao_clientes_especificos',
          linha_original: index + 1,
          dados_originais: record,
          motivo_rejeicao: 'CLIENTE_ESPECIFICO_EXCLUIDO',
          detalhes_erro: `Cliente ${record.EMPRESA} está na lista de exclusão específica`
        }));

        const { error: rejectionsError } = await supabase
          .from('registros_rejeitados_processamento')
          .insert(rejectionsToInsert);

        if (rejectionsError) {
          console.error(`❌ Erro ao salvar rejeições em ${tipo}:`, rejectionsError);
        } else {
          console.log(`✅ ${registrosParaExcluir.length} rejeições salvas para ${tipo}`);
        }
      }
      
      // Excluir registros onde EMPRESA está na lista de clientes para excluir
      const { error, count } = await supabase
        .from('volumetria_mobilemed')
        .delete({ count: 'exact' })
        .eq('arquivo_fonte', tipo)
        .in('"EMPRESA"', CLIENTES_PARA_EXCLUIR);

      if (error) {
        console.error(`❌ Erro ao excluir clientes em ${tipo}:`, error);
        detalhes.push(`Erro em ${tipo}: ${error.message}`);
      } else {
        const deletedCount = count || 0;
        totalExcluidos += deletedCount;
        detalhes.push(`${tipo}: ${deletedCount} registros excluídos`);
        console.log(`✅ ${tipo}: ${deletedCount} registros de clientes específicos excluídos`);
      }
    }

    console.log(`🎯 Total de registros excluídos por cliente específico: ${totalExcluidos}`);

    // Log da operação para auditoria
    const logData = {
      funcao: 'aplicar_exclusao_clientes_especificos',
      arquivo_fonte: arquivo_fonte || 'TODOS',
      clientes_excluidos: CLIENTES_PARA_EXCLUIR,
      total_registros_excluidos: totalExcluidos,
      detalhes: detalhes,
      timestamp: new Date().toISOString()
    };

    // Inserir log de auditoria
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'EXCLUSAO_CLIENTES_ESPECIFICOS',
        record_id: arquivo_fonte || 'BATCH',
        new_data: logData,
        user_email: 'system',
        severity: 'info'
      });

    return new Response(JSON.stringify({
      success: true,
      arquivo_fonte: arquivo_fonte || 'TODOS',
      total_excluidos: totalExcluidos,
      clientes_processados: CLIENTES_PARA_EXCLUIR,
      detalhes,
      regra_aplicada: 'v032 - Exclusão de Clientes Específicos'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Erro ao aplicar exclusão de clientes específicos:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      regra: 'v032 - Exclusão de Clientes Específicos'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}