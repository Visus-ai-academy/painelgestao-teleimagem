import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🧹 Limpando uploads travados...');

    // Limpar uploads que estão em "processando" há mais de 30 minutos
    const cutoffTime = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: uploadsAntigos, error: selectError } = await supabaseClient
      .from('processamento_uploads')
      .select('*')
      .eq('status', 'processando')
      .lt('created_at', cutoffTime);

    if (selectError) {
      console.error('❌ Erro ao buscar uploads antigos:', selectError);
      throw selectError;
    }

    console.log(`📋 Encontrados ${uploadsAntigos?.length || 0} uploads travados`);

    if (uploadsAntigos && uploadsAntigos.length > 0) {
      // Atualizar status para erro
      const { error: updateError } = await supabaseClient
        .from('processamento_uploads')
        .update({
          status: 'erro',
          detalhes_erro: JSON.stringify({
            erro: 'Timeout durante processamento - automaticamente marcado como erro',
            timestamp_limpeza: new Date().toISOString(),
            duracao_travado: '30+ minutos'
          })
        })
        .eq('status', 'processando')
        .lt('created_at', cutoffTime);

      if (updateError) {
        console.error('❌ Erro ao atualizar uploads:', updateError);
        throw updateError;
      }

      console.log(`✅ ${uploadsAntigos.length} uploads marcados como erro`);
    }

    // Também limpar uploads muito antigos (mais de 24 horas) que falharam
    const cutoffTimeDelete = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { error: deleteError } = await supabaseClient
      .from('processamento_uploads')
      .delete()
      .in('status', ['erro', 'processando'])
      .lt('created_at', cutoffTimeDelete);

    if (deleteError) {
      console.warn('⚠️ Erro ao deletar uploads antigos:', deleteError);
    } else {
      console.log('🗑️ Uploads muito antigos removidos');
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Uploads travados limpos com sucesso',
      uploads_corrigidos: uploadsAntigos?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 ERRO:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});