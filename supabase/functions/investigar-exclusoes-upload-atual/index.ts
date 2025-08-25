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
    console.log('🔍 INVESTIGANDO 2 EXCLUSÕES - Upload d79c9e97-9376-4965-944b-aa2c7b427ffe');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const uploadId = 'd79c9e97-9376-4965-944b-aa2c7b427ffe';
    const loteUpload = `volumetria_padrao_1756151371170_d79c9e97`;

    // 1. Buscar detalhes completos do upload
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

    console.log('📋 Upload encontrado:', uploadInfo);

    // 2. Verificar se há registros rejeitados com diferentes variações do lote
    const possiveisLotes = [
      loteUpload,
      `volumetria_padrao_${uploadId}`,
      uploadId,
      uploadInfo.arquivo_nome,
      'volumetria_padrao'
    ];

    let todasRejeicoes = [];
    for (const lote of possiveisLotes) {
      const { data: rejeicoes } = await supabaseClient
        .from('registros_rejeitados_processamento')
        .select('*')
        .or(`lote_upload.eq.${lote},arquivo_fonte.eq.${lote}`)
        .gte('created_at', '2025-08-25T19:49:00Z');
      
      if (rejeicoes && rejeicoes.length > 0) {
        todasRejeicoes = [...todasRejeicoes, ...rejeicoes];
      }
    }

    console.log(`📊 Total de rejeições encontradas: ${todasRejeicoes.length}`);

    // 3. Buscar na tabela de erros volumetria
    const { data: errosVolumetria } = await supabaseClient
      .from('volumetria_erros')
      .select('*')
      .gte('created_at', '2025-08-25T19:49:00Z');

    // 4. Verificar contagem real inserida
    const { data: countReal } = await supabaseClient
      .from('volumetria_mobilemed')
      .select('count(*)', { count: 'exact' })
      .eq('lote_upload', loteUpload);

    const totalInseridoReal = countReal?.[0]?.count || 0;

    // 5. Analisar detalhes do processamento
    const detalhesProcessamento = uploadInfo.detalhes_erro;
    
    // 6. HIPÓTESES sobre onde estão os 2 registros
    const hipoteses = [];
    
    // Diferença entre processados e inseridos
    const diferenca = uploadInfo.registros_processados - uploadInfo.registros_inseridos;
    if (diferenca === 2) {
      hipoteses.push({
        hipotese: 'EXCLUSAO_NA_EDGE_FUNCTION',
        detalhes: '2 registros foram excluídos durante o processamento na Edge Function',
        evidencia: 'Diferença exata de 2 registros entre processados e inseridos'
      });
    }

    // Verificar se os registros podem ter sido rejeitados por validações básicas
    if (todasRejeicoes.length === 0) {
      hipoteses.push({
        hipotese: 'VALIDACOES_SILENCIOSAS',
        detalhes: 'Registros excluídos por validações que não geram logs de rejeição',
        evidencia: 'Nenhuma rejeição registrada nas tabelas de erro'
      });
    }

    // 7. Buscar padrões nos dados inseridos para entender o que pode ter sido excluído
    const { data: amostrasInseridos } = await supabaseClient
      .from('volumetria_mobilemed')
      .select('"EMPRESA", "NOME_PACIENTE", "VALORES", "DATA_REALIZACAO", "DATA_LAUDO", "MODALIDADE", "ESPECIALIDADE"')
      .eq('lote_upload', loteUpload)
      .order('created_at')
      .limit(10);

    // 8. ANÁLISE DETALHADA DOS DETALHES DO UPLOAD
    const debugPaciente = detalhesProcessamento?.debug_paciente;
    const regrasAplicadas = detalhesProcessamento?.regras_aplicadas;

    const relatorio = {
      investigacao: {
        upload_id: uploadId,
        arquivo: uploadInfo.arquivo_nome,
        lote_upload: loteUpload,
        status: uploadInfo.status
      },
      numeros_criticos: {
        declarado_processados: uploadInfo.registros_processados,
        declarado_inseridos: uploadInfo.registros_inseridos,
        real_inseridos_bd: totalInseridoReal,
        diferenca_misteriosa: diferenca,
        regras_aplicadas: regrasAplicadas
      },
      evidencias_exclusao: {
        rejeicoes_registradas: todasRejeicoes.length,
        erros_volumetria: errosVolumetria?.length || 0,
        detalhes_rejeicoes: todasRejeicoes.map(r => ({
          motivo: r.motivo_rejeicao,
          empresa: r.dados_originais?.EMPRESA,
          paciente: r.dados_originais?.NOME_PACIENTE?.substring(0, 20) + '...',
          valores: r.dados_originais?.VALORES
        }))
      },
      debug_especifico: {
        paciente_debug: debugPaciente?.nome,
        encontrados_arquivo: debugPaciente?.encontrados_no_arquivo,
        preparados_insercao: debugPaciente?.preparados_para_insercao,
        inseridos_final: debugPaciente?.inseridos,
        descartados_campos: debugPaciente?.descartados_por_campos_obrigatorios,
        descartados_data: debugPaciente?.descartados_por_corte_data_laudo
      },
      hipoteses_exclusao: hipoteses,
      amostra_dados_inseridos: amostrasInseridos?.slice(0, 3),
      conclusao: todasRejeicoes.length === 0 && diferenca === 2 ? 
        'EXCLUSÕES SILENCIOSAS CONFIRMADAS - 2 registros excluídos sem logs' :
        `${todasRejeicoes.length} rejeições encontradas de ${diferenca} exclusões totais`,
      proximos_passos: [
        'Verificar logs da Edge Function processar-volumetria-otimizado',
        'Analisar validações que não geram rejeições registradas',
        'Investigar se triggers estão excluindo registros silenciosamente'
      ]
    };

    console.log('📄 RELATÓRIO INVESTIGAÇÃO:', JSON.stringify(relatorio, null, 2));

    return new Response(JSON.stringify(relatorio), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 ERRO na investigação:', error);
    
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