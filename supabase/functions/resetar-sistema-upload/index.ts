import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🔄 RESET COMPLETO DO SISTEMA DE UPLOAD
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 [RESET] Iniciando reset completo do sistema...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Limpar uploads travados ou com erro
    const { data: uploadsLimpos, error: uploadError } = await supabaseClient
      .from('processamento_uploads')
      .update({
        status: 'erro',
        detalhes_erro: {
          etapa: 'reset_sistema',
          motivo: 'Reset manual do sistema - arquivo pode estar corrompido ou processamento travado',
          resetado_em: new Date().toISOString()
        },
        completed_at: new Date().toISOString()
      })
      .in('status', ['processando', 'pendente', 'staging_concluido'])
      .select();

    console.log('🧹 [RESET] Uploads limpos:', uploadsLimpos?.length || 0);

    // 2. Limpar dados pendentes no staging
    const { data: stagingLimpo, error: stagingError } = await supabaseClient
      .from('volumetria_staging')
      .delete()
      .eq('status_processamento', 'pendente');

    console.log('🗑️ [RESET] Staging limpo');

    // 3. Verificar estado final do sistema
    const { data: statusSistema } = await supabaseClient
      .from('processamento_uploads')
      .select('status, COUNT(*)')
      .group('status');

    const { count: stagingCount } = await supabaseClient
      .from('volumetria_staging')
      .select('*', { count: 'exact', head: true });

    const { count: volumetriaCount } = await supabaseClient
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true });

    const resultado = {
      success: true,
      message: 'Sistema resetado com sucesso',
      uploads_limpos: uploadsLimpos?.length || 0,
      sistema_status: {
        uploads_por_status: statusSistema || [],
        staging_pendente: stagingCount || 0,
        volumetria_total: volumetriaCount || 0
      },
      pronto_para_uploads: true,
      timestamp: new Date().toISOString()
    };

    console.log('✅ [RESET] Sistema resetado:', resultado);

    return new Response(
      JSON.stringify(resultado),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 [RESET] Erro:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});