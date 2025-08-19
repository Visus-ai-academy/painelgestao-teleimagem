import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🔍 FUNÇÃO DEBUG PARA TESTAR FLUXO COMPLETO DE UPLOAD
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔍 [DEBUG] Iniciando debug do fluxo de upload...');
    
    // 1. Verificar buckets disponíveis
    const { data: buckets, error: bucketsError } = await supabaseClient.storage.listBuckets();
    console.log('🪣 [DEBUG] Buckets disponíveis:', buckets?.map(b => ({ name: b.name, public: b.public })));
    
    // 2. Verificar arquivos no bucket uploads
    const { data: uploadFiles, error: uploadError } = await supabaseClient.storage
      .from('uploads')
      .list('', { limit: 10 });
    console.log('📁 [DEBUG] Arquivos na raiz do uploads:', uploadFiles?.slice(0, 5));
    
    // 3. Verificar subpasta volumetria_uploads
    const { data: volumetriaFiles, error: volumetriaError } = await supabaseClient.storage
      .from('uploads')
      .list('volumetria_uploads', { limit: 10 });
    console.log('📁 [DEBUG] Arquivos em volumetria_uploads:', volumetriaFiles?.slice(0, 5));
    
    // 4. Testar conectividade das funções principais
    console.log('🔌 [DEBUG] Testando conectividade das funções...');
    
    // Teste staging (com dados mock)
    try {
      const { data: stagingTest, error: stagingTestError } = await supabaseClient.functions.invoke('processar-volumetria-staging', {
        body: {
          file_path: 'teste_debug.xlsx',
          arquivo_fonte: 'volumetria_padrao',
          periodo_referencia: 'jun/25'
        }
      });
      console.log('📡 [DEBUG] Teste staging function:', {
        success: !stagingTestError,
        error: stagingTestError?.message || 'N/A'
      });
    } catch (stagingCallError) {
      console.log('📡 [DEBUG] Erro ao chamar staging:', stagingCallError.message);
    }
    
    // 5. Verificar status das tabelas
    const { data: uploadsCount } = await supabaseClient
      .from('processamento_uploads')
      .select('*', { count: 'exact' })
      .limit(0);
      
    const { data: stagingCount } = await supabaseClient
      .from('volumetria_staging')
      .select('*', { count: 'exact' })
      .limit(0);
      
    const { data: volumetriaCount } = await supabaseClient
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact' })
      .limit(0);
    
    console.log('📊 [DEBUG] Status das tabelas:', {
      uploads: uploadsCount?.length || 0,
      staging: stagingCount?.length || 0,
      volumetria: volumetriaCount?.length || 0
    });
    
    // 6. Verificar uploads recentes
    const { data: recentUploads } = await supabaseClient
      .from('processamento_uploads')
      .select('id, status, arquivo_nome, created_at')
      .order('created_at', { ascending: false })
      .limit(3);
    
    console.log('📋 [DEBUG] Uploads recentes:', recentUploads);

    const resultado = {
      success: true,
      timestamp: new Date().toISOString(),
      buckets: {
        available: buckets?.map(b => b.name) || [],
        uploads_files: uploadFiles?.length || 0,
        volumetria_files: volumetriaFiles?.length || 0
      },
      database: {
        uploads_count: uploadsCount?.length || 0,
        staging_count: stagingCount?.length || 0,
        volumetria_count: volumetriaCount?.length || 0
      },
      recent_uploads: recentUploads || [],
      status: 'Sistema operacional',
      recommendation: uploadsCount?.length === 0 && stagingCount?.length === 0 
        ? 'Sistema limpo - pronto para novos uploads'
        : 'Verificar uploads pendentes'
    };
    
    console.log('✅ [DEBUG] Diagnóstico completo:', resultado);

    return new Response(
      JSON.stringify(resultado, null, 2),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 [DEBUG] Erro no diagnóstico:', error);
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