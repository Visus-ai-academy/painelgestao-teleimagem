import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🧪 FUNÇÃO DE TESTE PARA DEBUG DO PIPELINE
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🧪 [TEST] Iniciando diagnóstico do pipeline...');

    // 1. Verificar uploads recentes
    const { data: uploads } = await supabaseClient
      .from('processamento_uploads')
      .select('*')
      .eq('tipo_arquivo', 'volumetria_padrao')
      .order('created_at', { ascending: false })
      .limit(3);

    console.log('📋 [TEST] Uploads recentes:', uploads?.map(u => ({
      id: u.id,
      status: u.status,
      registros: u.registros_inseridos,
      lote: u.detalhes_erro?.lote_upload
    })));

    // 2. Verificar dados no staging
    const latestUpload = uploads?.[0];
    if (latestUpload) {
      const lote_upload = latestUpload.detalhes_erro?.lote_upload;
      
      if (lote_upload) {
        const { data: stagingData, count: stagingCount } = await supabaseClient
          .from('volumetria_staging')
          .select('*', { count: 'exact' })
          .eq('lote_upload', lote_upload)
          .limit(5);

        console.log('📥 [TEST] Dados no staging:', {
          count: stagingCount,
          exemplos: stagingData?.map(s => ({
            id: s.id,
            empresa: s.EMPRESA,
            status: s.status_processamento
          }))
        });

        // 3. Verificar dados na tabela final
        const { data: volumetriaData, count: volumetriaCount } = await supabaseClient
          .from('volumetria_mobilemed')
          .select('*', { count: 'exact' })
          .eq('lote_upload', lote_upload)
          .limit(5);

        console.log('📊 [TEST] Dados na volumetria final:', {
          count: volumetriaCount,
          exemplos: volumetriaData?.map(v => ({
            id: v.id,
            empresa: v.EMPRESA,
            valores: v.VALORES
          }))
        });
      }
    }

    // 4. Verificar conectividade das funções
    console.log('🔌 [TEST] Testando conectividade das funções...');
    
    const { data: stagingTest, error: stagingError } = await supabaseClient.functions.invoke('processar-volumetria-staging', {
      body: {
        test: true
      }
    });

    console.log('📡 [TEST] Teste staging function:', {
      success: !stagingError,
      error: stagingError?.message
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Diagnóstico completo',
        uploads_recentes: uploads?.length || 0,
        staging_records: latestUpload ? 'verificado' : 'sem_upload',
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 [TEST] Erro no diagnóstico:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})