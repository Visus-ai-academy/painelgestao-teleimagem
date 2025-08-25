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
    console.log('🔍 Iniciando investigação das exclusões específicas...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Buscar detalhes do upload mais recente
    const { data: uploadInfo, error: uploadError } = await supabaseClient
      .from('processamento_uploads')
      .select('*')
      .eq('arquivo_nome', 'relatorio_exames_especialidade_junho_padraoV1.b.xlsx')
      .order('created_at', { ascending: false })
      .limit(1);

    if (uploadError) {
      console.error('❌ Erro ao buscar info do upload:', uploadError);
      return new Response(JSON.stringify({ erro: uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const upload = uploadInfo?.[0];
    console.log('📋 Upload encontrado:', upload?.id, 'Status:', upload?.status);

    // 2. Buscar rejeições específicas deste lote
    const loteUpload = upload?.detalhes_erro?.lote_upload || `volumetria_padrao_${upload?.id}`;
    console.log('🎯 Buscando rejeições do lote:', loteUpload);

    const { data: rejeicoes, error: rejeicoesError } = await supabaseClient
      .from('registros_rejeitados_processamento')
      .select('*')
      .eq('lote_upload', loteUpload)
      .order('created_at', { ascending: false });

    if (rejeicoesError) {
      console.error('❌ Erro ao buscar rejeições:', rejeicoesError);
    }

    console.log(`📊 Total de rejeições encontradas: ${rejeicoes?.length || 0}`);

    // 3. Buscar registros inseridos com sucesso deste lote
    const { data: registrosInseridos, error: inseridosError } = await supabaseClient
      .from('volumetria_mobilemed')
      .select('count(*)')
      .eq('lote_upload', loteUpload.replace('volumetria_padrao_', 'volumetria_padrao_').slice(0, 50));

    if (inseridosError) {
      console.error('❌ Erro ao contar inseridos:', inseridosError);
    }

    // 4. Investigar se há triggers ativos que podem estar causando exclusões
    const { data: triggers, error: triggersError } = await supabaseClient
      .rpc('sql', { 
        query: `SELECT tgname as trigger_name, tgrelid::regclass as table_name, tgenabled 
                FROM pg_trigger 
                WHERE tgrelid = 'volumetria_mobilemed'::regclass 
                AND tgname NOT LIKE 'RI_%'` 
      });

    if (triggersError) {
      console.error('❌ Erro ao buscar triggers:', triggersError);
    }

    // 5. Verificar se há logs de auditoria relacionados
    const { data: auditLogs, error: auditError } = await supabaseClient
      .from('audit_logs')
      .select('*')
      .eq('table_name', 'volumetria_mobilemed')
      .gte('timestamp', '2025-08-25T19:25:00Z')
      .order('timestamp', { ascending: false })
      .limit(10);

    if (auditError) {
      console.error('❌ Erro ao buscar audit logs:', auditError);
    }

    console.log(`📋 Audit logs encontrados: ${auditLogs?.length || 0}`);

    // 6. Análise detalhada dos detalhes do erro
    const detalhesErro = upload?.detalhes_erro;
    const debugPaciente = detalhesErro?.debug_paciente;

    console.log('🔍 Análise dos detalhes de erro:');
    console.log('- Total processado:', detalhesErro?.total_processado);
    console.log('- Total inserido:', detalhesErro?.total_inserido);
    console.log('- Total erros:', detalhesErro?.total_erros);
    console.log('- Debug paciente nome:', debugPaciente?.nome);
    console.log('- Descartados por campos obrigatórios:', debugPaciente?.descartados_por_campos_obrigatorios);
    console.log('- Descartados por corte data laudo:', debugPaciente?.descartados_por_corte_data_laudo);

    // 7. Criar relatório final
    const relatorio = {
      upload_analisado: {
        id: upload?.id,
        arquivo: upload?.arquivo_nome,
        status: upload?.status,
        total_processado: detalhesErro?.total_processado,
        total_inserido: detalhesErro?.total_inserido,
        total_erros: detalhesErro?.total_erros,
        lote_upload: loteUpload
      },
      investigacao_exclusoes: {
        rejeicoes_encontradas: rejeicoes?.length || 0,
        registros_inseridos: registrosInseridos?.[0]?.count || 0,
        triggers_ativos: triggers?.length || 0,
        audit_logs: auditLogs?.length || 0
      },
      debug_especifico: {
        paciente_debug: debugPaciente?.nome,
        encontrados_arquivo: debugPaciente?.encontrados_no_arquivo,
        preparados_insercao: debugPaciente?.preparados_para_insercao,
        inseridos: debugPaciente?.inseridos,
        descartados_campos_obrigatorios: debugPaciente?.descartados_por_campos_obrigatorios,
        descartados_corte_data: debugPaciente?.descartados_por_corte_data_laudo
      },
      detalhes_rejeicoes: rejeicoes?.map(r => ({
        motivo: r.motivo_rejeicao,
        detalhes: r.detalhes_erro,
        empresa: r.dados_originais?.EMPRESA,
        paciente: r.dados_originais?.NOME_PACIENTE,
        valores: r.dados_originais?.VALORES,
        linha: r.linha_original
      })) || [],
      conclusao: rejeicoes?.length === 0 ? 
        'NENHUMA REJEIÇÃO REGISTRADA - As 2 exclusões podem ter ocorrido em validações na Edge Function que não registram rejeições' :
        `${rejeicoes.length} rejeições registradas encontradas`,
      recomendacao: rejeicoes?.length === 0 ?
        'Investigar validações na Edge Function processar-volumetria-otimizado que podem estar excluindo registros sem registrar rejeições' :
        'Analisar motivos das rejeições registradas'
    };

    console.log('📄 Relatório final gerado:', JSON.stringify(relatorio, null, 2));

    return new Response(JSON.stringify(relatorio), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 ERRO na investigação:', error);
    
    return new Response(JSON.stringify({ 
      erro: true, 
      mensagem: error.message,
      detalhes: 'Erro ao investigar exclusões específicas'
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});