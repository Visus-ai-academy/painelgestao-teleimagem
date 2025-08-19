import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🧹 LIMPEZA AUTOMÁTICA DE DADOS ANTIGOS NO STAGING
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🧹 [LIMPEZA] Iniciando limpeza de dados antigos...');
    
    // 1. Limpar staging processado há mais de 2 horas
    const { count: stagingLimpos, error: stagingError } = await supabaseClient
      .from('volumetria_staging')
      .delete({ count: 'exact' })
      .lt('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());
    
    if (stagingError) {
      console.error('❌ [LIMPEZA] Erro ao limpar staging:', stagingError);
    } else {
      console.log(`✅ [LIMPEZA] ${stagingLimpos || 0} registros removidos do staging`);
    }
    
    // 2. Limpar uploads com erro há mais de 24 horas
    const { count: uploadsLimpos, error: uploadsError } = await supabaseClient
      .from('processamento_uploads')
      .delete({ count: 'exact' })
      .eq('status', 'erro')
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    
    if (uploadsError) {
      console.error('❌ [LIMPEZA] Erro ao limpar uploads:', uploadsError);
    } else {
      console.log(`✅ [LIMPEZA] ${uploadsLimpos || 0} uploads com erro removidos`);
    }
    
    // 3. Limpar arquivos temporários no storage
    const { data: files } = await supabaseClient.storage
      .from('uploads')
      .list('volumetria_uploads', { limit: 100 });
    
    let arquivosRemovidos = 0;
    if (files && files.length > 0) {
      const arquivosAntigos = files.filter(file => {
        const fileAge = Date.now() - new Date(file.created_at).getTime();
        return fileAge > 2 * 60 * 60 * 1000; // Mais de 2 horas
      });
      
      if (arquivosAntigos.length > 0) {
        const pathsParaRemover = arquivosAntigos.map(file => `volumetria_uploads/${file.name}`);
        
        const { error: removeError } = await supabaseClient.storage
          .from('uploads')
          .remove(pathsParaRemover);
        
        if (removeError) {
          console.error('❌ [LIMPEZA] Erro ao remover arquivos:', removeError);
        } else {
          arquivosRemovidos = pathsParaRemover.length;
          console.log(`✅ [LIMPEZA] ${arquivosRemovidos} arquivos temporários removidos`);
        }
      }
    }

    const resultado = {
      success: true,
      message: 'Limpeza automática concluída',
      staging_limpos: stagingLimpos || 0,
      uploads_limpos: uploadsLimpos || 0,
      arquivos_removidos: arquivosRemovidos,
      timestamp: new Date().toISOString()
    };

    console.log('✅ [LIMPEZA] Limpeza concluída:', resultado);

    return new Response(
      JSON.stringify(resultado),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 [LIMPEZA] Erro na limpeza:', error);
    
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