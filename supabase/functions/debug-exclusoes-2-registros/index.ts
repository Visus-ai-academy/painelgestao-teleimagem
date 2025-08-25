import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 DEBUG: Investigando as 2 exclusões misteriosas...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Buscar detalhes completos do upload específico
    const { data: uploadInfo, error: uploadError } = await supabaseClient
      .from('processamento_uploads')
      .select('*')
      .eq('arquivo_nome', 'relatorio_exames_especialidade_junho_padraoV1.b.xlsx')
      .order('created_at', { ascending: false })
      .limit(1);

    if (uploadError || !uploadInfo?.[0]) {
      console.error('❌ Erro ao buscar upload:', uploadError);
      return new Response(JSON.stringify({ erro: 'Upload não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const upload = uploadInfo[0];
    const loteUpload = `volumetria_padrao_${upload.id}`;
    
    console.log('📋 Upload analisado:', {
      id: upload.id,
      arquivo: upload.arquivo_nome,
      status: upload.status,
      processados: upload.registros_processados,
      inseridos: upload.registros_inseridos,
      erros: upload.registros_erro,
      lote: loteUpload
    });

    // 2. Contar registros realmente inseridos na volumetria_mobilemed
    const { data: countInseridos, error: countError } = await supabaseClient
      .from('volumetria_mobilemed')
      .select('count(*)', { count: 'exact' })
      .eq('lote_upload', loteUpload);

    if (countError) {
      console.error('❌ Erro ao contar inseridos:', countError);
    }

    const totalInseridosReal = countInseridos?.[0]?.count || 0;
    console.log(`📊 Registros realmente inseridos: ${totalInseridosReal}`);

    // 3. Buscar amostra dos registros inseridos para análise
    const { data: amostrasInseridos, error: amostraError } = await supabaseClient
      .from('volumetria_mobilemed')
      .select('*')
      .eq('lote_upload', loteUpload)
      .limit(5);

    if (amostraError) {
      console.error('❌ Erro ao buscar amostras:', amostraError);
    }

    // 4. Buscar ALL possíveis rejeições/erros relacionados
    const { data: todasRejeicoes, error: rejError } = await supabaseClient
      .from('registros_rejeitados_processamento')
      .select('*')
      .or(`lote_upload.ilike.%${upload.id}%,arquivo_fonte.eq.volumetria_padrao`)
      .gte('created_at', '2025-08-25T19:00:00Z');

    const { data: errosVolumetria, error: errVolError } = await supabaseClient
      .from('volumetria_erros')
      .select('*')
      .or(`arquivo_fonte.eq.volumetria_padrao`)
      .gte('created_at', '2025-08-25T19:00:00Z');

    // 5. Buscar logs de auditoria específicos
    const { data: auditLogs, error: auditError } = await supabaseClient
      .from('audit_logs')
      .select('*')
      .eq('table_name', 'volumetria_mobilemed')
      .gte('timestamp', '2025-08-25T19:25:00Z')
      .order('timestamp', { ascending: false });

    // 6. Verificar se há triggers ativos que podem estar causando exclusões
    const { data: triggers, error: triggerError } = await supabaseClient
      .rpc('sql_query', { 
        query: `
          SELECT 
            t.tgname as trigger_name,
            t.tgrelid::regclass as table_name,
            t.tgenabled,
            pg_get_functiondef(t.tgfoid) as trigger_function
          FROM pg_trigger t
          WHERE t.tgrelid = 'volumetria_mobilemed'::regclass
            AND t.tgname NOT LIKE 'RI_%'
            AND t.tgname NOT LIKE 'pg_%'
          ORDER BY t.tgname
        ` 
      });

    if (triggerError) {
      console.error('❌ Erro ao buscar triggers:', triggerError);
    }

    // 7. INVESTIGAR PADRÃO DOS REGISTROS EXCLUÍDOS
    const detalhesUpload = upload.detalhes_erro;
    const debugInfo = detalhesUpload?.debug_paciente;

    console.log('🔍 ANÁLISE DOS DETALHES:');
    console.log('- Total processado:', detalhesUpload?.total_processado);
    console.log('- Total inserido:', detalhesUpload?.total_inserido);
    console.log('- Total erros:', detalhesUpload?.total_erros);
    console.log('- Regras aplicadas:', detalhesUpload?.regras_aplicadas);

    // 8. CRIAR HIPÓTESES SOBRE AS EXCLUSÕES
    const hipoteses = [];
    
    // Hipótese 1: Diferença entre registros processados e inseridos
    const diferencaProcessamentoInsercao = upload.registros_processados - upload.registros_inseridos;
    if (diferencaProcessamentoInsercao > 0) {
      hipoteses.push({
        hipotese: 'DIFERENCA_PROCESSAMENTO_INSERCAO',
        detalhes: `${diferencaProcessamentoInsercao} registros foram processados mas não inseridos`,
        evidencia: `${upload.registros_processados} processados vs ${upload.registros_inseridos} inseridos`
      });
    }

    // Hipótese 2: Exclusão por triggers
    if (triggers && triggers.length > 0) {
      hipoteses.push({
        hipotese: 'TRIGGERS_ATIVOS',
        detalhes: `${triggers.length} triggers ativos podem estar excluindo registros`,
        evidencia: triggers.map(t => t.trigger_name).join(', ')
      });
    }

    // Hipótese 3: Rejeições não registradas
    if ((todasRejeicoes?.length || 0) === 0 && (errosVolumetria?.length || 0) === 0) {
      hipoteses.push({
        hipotese: 'EXCLUSOES_SILENCIOSAS',
        detalhes: 'Registros excluídos sem gerar logs de rejeição',
        evidencia: 'Nenhuma rejeição encontrada nas tabelas de erro'
      });
    }

    // 9. RELATÓRIO FINAL
    const relatorio = {
      investigacao: {
        upload_id: upload.id,
        arquivo: upload.arquivo_nome,
        lote_upload: loteUpload,
        timestamp_investigacao: new Date().toISOString()
      },
      numeros: {
        declarado_processados: upload.registros_processados,
        declarado_inseridos: upload.registros_inseridos,
        declarado_erros: upload.registros_erro,
        real_inseridos_bd: totalInseridosReal,
        diferenca_misteriosa: upload.registros_processados - upload.registros_inseridos
      },
      evidencias: {
        rejeicoes_encontradas: todasRejeicoes?.length || 0,
        erros_volumetria: errosVolumetria?.length || 0,
        audit_logs: auditLogs?.length || 0,
        triggers_ativos: triggers?.length || 0
      },
      hipoteses_exclusao: hipoteses,
      debug_upload: {
        paciente_debug: debugInfo?.nome,
        encontrados_arquivo: debugInfo?.encontrados_no_arquivo,
        preparados_insercao: debugInfo?.preparados_para_insercao,
        inseridos: debugInfo?.inseridos,
        descartados_campos: debugInfo?.descartados_por_campos_obrigatorios,
        descartados_data: debugInfo?.descartados_por_corte_data_laudo
      },
      amostra_registros_inseridos: amostrasInseridos?.slice(0, 2).map(r => ({
        empresa: r.EMPRESA,
        paciente: r.NOME_PACIENTE?.substring(0, 20) + '...',
        valores: r.VALORES,
        data_realizacao: r.DATA_REALIZACAO,
        data_laudo: r.DATA_LAUDO,
        lote_upload: r.lote_upload
      })) || [],
      conclusao: hipoteses.length === 0 ? 
        'MISTÉRIO SEM HIPÓTESES - Nenhuma evidência clara encontrada' :
        `${hipoteses.length} hipóteses identificadas para investigação`
    };

    console.log('📄 RELATÓRIO COMPLETO:', JSON.stringify(relatorio, null, 2));

    return new Response(JSON.stringify(relatorio), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 ERRO no debug:', error);
    
    return new Response(JSON.stringify({ 
      erro: true, 
      mensagem: error.message,
      stack: error.stack
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});