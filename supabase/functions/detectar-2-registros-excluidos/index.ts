import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 DETECTANDO 2 REGISTROS EXCLUÍDOS - Análise detalhada');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const uploadId = 'd79c9e97-9376-4965-944b-aa2c7b427ffe';
    const loteUploadCompleto = 'volumetria_padrao_1756151371170_d79c9e97';

    // 1. Buscar detalhes do upload
    const { data: uploadInfo, error: uploadError } = await supabaseClient
      .from('processamento_uploads')
      .select('*')
      .eq('id', uploadId)
      .single();

    if (uploadError) {
      console.error('❌ Erro ao buscar upload:', uploadError);
      return new Response(JSON.stringify({ erro: uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('📋 Upload ID:', uploadId);
    console.log('📋 Arquivo:', uploadInfo.arquivo_nome);
    console.log('📋 Lote:', loteUploadCompleto);

    // 2. ANÁLISE CRÍTICA: Números do processamento
    const processados = uploadInfo.registros_processados; // 2500
    const inseridos = uploadInfo.registros_inseridos;     // 2498
    const diferencaExclusao = processados - inseridos;   // 2

    console.log(`📊 NÚMEROS CRÍTICOS: ${processados} processados, ${inseridos} inseridos, ${diferencaExclusao} excluídos`);

    // 3. Contar registros realmente inseridos no banco
    const { data: countReal, error: countError } = await supabaseClient
      .from('volumetria_mobilemed')
      .select('count(*)', { count: 'exact' })
      .eq('lote_upload', loteUploadCompleto);

    const totalInseridoReal = countReal?.[0]?.count || 0;
    console.log(`📊 CONFIRMAÇÃO BD: ${totalInseridoReal} registros realmente inseridos`);

    // 4. BUSCAR TODAS AS POSSÍVEIS REJEIÇÕES
    const possiveisLotes = [
      loteUploadCompleto,
      `volumetria_padrao_${uploadId}`,
      uploadId,
      'volumetria_padrao'
    ];

    let todasRejeicoes = [];
    for (const lote of possiveisLotes) {
      const { data: rejeicoes } = await supabaseClient
        .from('registros_rejeitados_processamento')
        .select('*')
        .or(`lote_upload.eq.${lote},lote_upload.ilike.%${lote}%`)
        .gte('created_at', '2025-08-25T19:49:00Z');
      
      if (rejeicoes && rejeicoes.length > 0) {
        todasRejeicoes = [...todasRejeicoes, ...rejeicoes];
        console.log(`📋 Encontradas ${rejeicoes.length} rejeições para lote: ${lote}`);
      }
    }

    // 5. BUSCAR LOGS DE AUDITORIA DE EXCLUSÕES
    const { data: auditExclusoes } = await supabaseClient
      .from('audit_logs')
      .select('*')
      .eq('table_name', 'volumetria_mobilemed')
      .in('operation', ['DELETE', 'EXCLUSAO', 'REGISTRO_EXCLUIDO_LIMPEZA'])
      .gte('timestamp', '2025-08-25T19:49:00Z')
      .order('timestamp', { ascending: false });

    // 6. INVESTIGAR TRIGGERS QUE PODEM ESTAR EXCLUINDO
    const { data: triggersAtivos } = await supabaseClient
      .rpc('sql_query', { 
        query: `
          SELECT 
            t.tgname as trigger_name,
            t.tgrelid::regclass as table_name,
            t.tgenabled as enabled,
            pg_get_functiondef(t.tgfoid) as function_definition
          FROM pg_trigger t
          WHERE t.tgrelid = 'volumetria_mobilemed'::regclass
            AND t.tgname NOT LIKE 'RI_%'
            AND t.tgname NOT LIKE 'pg_%'
            AND t.tgenabled != 'D'
          ORDER BY t.tgname
        ` 
      });

    // 7. ANÁLISE DOS DETALHES DE DEBUG DO UPLOAD
    const detalhesErro = uploadInfo.detalhes_erro;
    const debugPaciente = detalhesErro?.debug_paciente;

    // 8. BUSCAR AMOSTRA DOS REGISTROS INSERIDOS PARA PADRÃO
    const { data: amostraInseridos } = await supabaseClient
      .from('volumetria_mobilemed')
      .select('"EMPRESA", "NOME_PACIENTE", "VALORES", "DATA_REALIZACAO", "MODALIDADE", "ESPECIALIDADE", "PRIORIDADE"')
      .eq('lote_upload', loteUploadCompleto)
      .order('created_at')
      .limit(10);

    // 9. CRIAR RELATÓRIO FINAL COM HIPÓTESES
    const hipoteses = [];

    // Hipótese 1: Exclusões por triggers ativos
    if (triggersAtivos && triggersAtivos.length > 0) {
      const triggersExclusao = triggersAtivos.filter(t => 
        t.function_definition?.includes('DELETE') || 
        t.function_definition?.includes('RETURN NULL')
      );
      
      if (triggersExclusao.length > 0) {
        hipoteses.push({
          hipotese: 'TRIGGERS_EXCLUINDO_REGISTROS',
          detalhes: `${triggersExclusao.length} triggers ativos podem estar excluindo registros`,
          evidencia: triggersExclusao.map(t => t.trigger_name).join(', '),
          criticidade: 'ALTA'
        });
      }
    }

    // Hipótese 2: Exclusões silenciosas na Edge Function
    if (todasRejeicoes.length === 0 && diferencaExclusao === 2) {
      hipoteses.push({
        hipotese: 'EXCLUSOES_SILENCIOSAS_EDGE_FUNCTION',
        detalhes: '2 registros excluídos na Edge Function sem gerar logs de rejeição',
        evidencia: 'Diferença exata de 2 registros sem rejeições registradas',
        criticidade: 'CRÍTICA'
      });
    }

    // Hipótese 3: Validações específicas no processamento
    if (debugPaciente) {
      const descartadosCampos = debugPaciente.descartados_por_campos_obrigatorios || 0;
      const descartadosData = debugPaciente.descartados_por_corte_data_laudo || 0;
      
      if (descartadosCampos > 0 || descartadosData > 0) {
        hipoteses.push({
          hipotese: 'VALIDACOES_ESPECIFICAS',
          detalhes: `Registros descartados: ${descartadosCampos} por campos, ${descartadosData} por data`,
          evidencia: debugPaciente,
          criticidade: 'MÉDIA'
        });
      }
    }

    const relatorio = {
      investigacao: {
        upload_id: uploadId,
        arquivo: uploadInfo.arquivo_nome,
        lote_upload: loteUploadCompleto,
        timestamp_processamento: uploadInfo.created_at
      },
      numeros_criticos: {
        arquivo_original_registros: 2500,
        processados_edge_function: processados,
        inseridos_declarados: inseridos,
        inseridos_confirmados_bd: totalInseridoReal,
        diferenca_exclusoes: diferencaExclusao,
        consistencia_dados: totalInseridoReal === inseridos ? 'CONSISTENTE' : 'INCONSISTENTE'
      },
      exclusoes_identificadas: {
        total_rejeicoes_registradas: todasRejeicoes.length,
        audit_logs_exclusoes: auditExclusoes?.length || 0,
        triggers_ativos_suspeitos: triggersAtivos?.filter(t => 
          t.function_definition?.includes('DELETE') || 
          t.function_definition?.includes('RETURN NULL')
        ).length || 0
      },
      detalhes_debug: {
        paciente_teste: debugPaciente?.nome,
        encontrados_arquivo: debugPaciente?.encontrados_no_arquivo,
        preparados_insercao: debugPaciente?.preparados_para_insercao,
        inseridos_final: debugPaciente?.inseridos,
        descartados_campos_obrigatorios: debugPaciente?.descartados_por_campos_obrigatorios,
        descartados_data_laudo: debugPaciente?.descartados_por_corte_data_laudo
      },
      hipoteses_exclusao: hipoteses,
      rejeicoes_detalhadas: todasRejeicoes.map(r => ({
        motivo: r.motivo_rejeicao,
        empresa: r.dados_originais?.EMPRESA,
        paciente: r.dados_originais?.NOME_PACIENTE?.substring(0, 30),
        valores: r.dados_originais?.VALORES,
        linha: r.linha_original,
        timestamp: r.created_at
      })),
      amostra_inseridos: amostraInseridos?.slice(0, 5).map(r => ({
        empresa: r.EMPRESA,
        paciente: r.NOME_PACIENTE?.substring(0, 20) + '...',
        valores: r.VALORES,
        modalidade: r.MODALIDADE,
        especialidade: r.ESPECIALIDADE
      })),
      conclusao: {
        status: diferencaExclusao === 2 && todasRejeicoes.length === 0 ? 
          'EXCLUSÕES NÃO IDENTIFICADAS' : 
          'EXCLUSÕES PARCIALMENTE IDENTIFICADAS',
        prioridade: 'CRÍTICA',
        acao_requerida: 'Investigar logs da Edge Function processar-volumetria-otimizado',
        registros_perdidos: diferencaExclusao
      }
    };

    console.log('📄 RELATÓRIO FINAL:', JSON.stringify(relatorio, null, 2));

    return new Response(JSON.stringify(relatorio), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 ERRO na detecção:', error);
    
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