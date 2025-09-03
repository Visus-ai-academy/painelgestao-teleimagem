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
    console.log('🔍 INVESTIGANDO EXAME ESPECÍFICO - RM CRANIO Dr. Pericles');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Buscar uploads recentes do arquivo 1 (tipo_arquivo = volumetria_padrao)
    const { data: uploads, error: uploadsError } = await supabaseClient
      .from('processamento_uploads')
      .select('*')
      .eq('tipo_arquivo', 'volumetria_padrao')
      .gte('created_at', '2024-12-01')
      .order('created_at', { ascending: false })
      .limit(5);

    if (uploadsError) {
      console.error('❌ Erro ao buscar uploads:', uploadsError);
    }

    console.log('📋 Uploads encontrados:', uploads?.length || 0);

    // 2. Buscar por registros rejeitados relacionados ao Dr. Pericles
    const { data: rejeicoesPericles } = await supabaseClient
      .from('registros_rejeitados_processamento')
      .select('*')
      .or(`dados_originais->>MEDICO.ilike.%PERICLES%,dados_originais->>NOME_PACIENTE.ilike.%CLEIDE%`)
      .gte('created_at', '2024-12-01')
      .order('created_at', { ascending: false });

    console.log('📊 Rejeições Dr. Pericles/Cleide:', rejeicoesPericles?.length || 0);

    // 3. Buscar no staging por registros similares
    const { data: stagingPericles } = await supabaseClient
      .from('volumetria_staging')
      .select('*')
      .or(`dados_originais->>MEDICO.ilike.%PERICLES%,dados_originais->>NOME_PACIENTE.ilike.%CLEIDE%`)
      .gte('created_at', '2024-12-01');

    console.log('📈 Staging Dr. Pericles/Cleide:', stagingPericles?.length || 0);

    // 4. Buscar na volumetria final
    const { data: volumetriaPericles } = await supabaseClient
      .from('volumetria_mobilemed')
      .select('*')
      .or(`"MEDICO".ilike.%PERICLES%,"NOME_PACIENTE".ilike.%CLEIDE%`)
      .gte('created_at', '2024-12-01');

    console.log('📊 Volumetria final Dr. Pericles/Cleide:', volumetriaPericles?.length || 0);

    // 5. Investigar padrões específicos para DATA_LAUDO = 07/07/2025
    const { data: dataLaudo0707 } = await supabaseClient
      .from('volumetria_mobilemed')
      .select('*')
      .eq('"DATA_LAUDO"', '07/07/2025')
      .gte('created_at', '2024-12-01');

    // 6. Buscar por registros similares com diferentes datas
    const { data: rmCranio } = await supabaseClient
      .from('volumetria_mobilemed')
      .select('*')
      .eq('"ESTUDO_DESCRICAO"', 'RM CRANIO')
      .eq('"EMPRESA"', 'CEMED')
      .gte('created_at', '2024-12-01');

    console.log('🧠 RM CRANIO CEMED encontrados:', rmCranio?.length || 0);

    // 7. Verificar se há algum trigger ativo que possa estar excluindo
    const { data: triggers } = await supabaseClient
      .rpc('pg_get_functiondef', { funcid: 'trigger_volumetria_processamento' })
      .single();

    const relatorio = {
      investigacao: {
        exame_procurado: 'RM CRANIO - Dr. Pericles - Cleide - DATA_LAUDO 07/07/2025',
        data_investigacao: new Date().toISOString()
      },
      uploads_recentes: uploads?.map(u => ({
        id: u.id,
        arquivo: u.arquivo_nome,
        tipo: u.tipo_arquivo,
        status: u.status,
        processados: u.registros_processados,
        inseridos: u.registros_inseridos,
        diferenca: u.registros_processados - u.registros_inseridos,
        created_at: u.created_at
      })),
      rejeicoes_encontradas: {
        total: rejeicoesPericles?.length || 0,
        detalhes: rejeicoesPericles?.map(r => ({
          motivo: r.motivo_rejeicao,
          paciente: r.dados_originais?.NOME_PACIENTE,
          medico: r.dados_originais?.MEDICO,
          data_laudo: r.dados_originais?.DATA_LAUDO,
          empresa: r.dados_originais?.EMPRESA,
          created_at: r.created_at
        }))
      },
      staging_encontrado: {
        total: stagingPericles?.length || 0,
        detalhes: stagingPericles?.slice(0, 5)?.map(s => ({
          paciente: s.dados_originais?.NOME_PACIENTE,
          medico: s.dados_originais?.MEDICO,
          status: s.status_processamento,
          created_at: s.created_at
        }))
      },
      volumetria_final: {
        pericles_cleide: volumetriaPericles?.length || 0,
        data_laudo_0707: dataLaudo0707?.length || 0,
        rm_cranio_cemed: rmCranio?.length || 0
      },
      conclusoes: {
        encontrado_em_rejeicoes: (rejeicoesPericles?.length || 0) > 0,
        encontrado_em_staging: (stagingPericles?.length || 0) > 0,
        encontrado_em_volumetria: (volumetriaPericles?.length || 0) > 0,
        possivel_exclusao_silenciosa: (rejeicoesPericles?.length || 0) === 0 && 
                                      (stagingPericles?.length || 0) === 0 && 
                                      (volumetriaPericles?.length || 0) === 0
      },
      proximos_passos: [
        'Verificar logs da Edge Function processar-volumetria-otimizado',
        'Analisar se há triggers ativos excluindo registros',
        'Verificar se o registro passou pelo staging mas foi perdido na transferência',
        'Investigar validações que excluem registros sem gerar logs de rejeição'
      ]
    };

    console.log('📄 RELATÓRIO INVESTIGAÇÃO ESPECÍFICA:', JSON.stringify(relatorio, null, 2));

    return new Response(JSON.stringify(relatorio), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 ERRO na investigação específica:', error);
    
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