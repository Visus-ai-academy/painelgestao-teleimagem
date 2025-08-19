import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🧹 Iniciando cancelamento de uploads travados...');

    // Cancelar uploads que estão processando há mais de 2 horas
    const { data: uploadsCancelados, error: cancelError } = await supabaseClient
      .from('processamento_uploads')
      .update({
        status: 'cancelado',
        detalhes_erro: {
          status: 'cancelado',
          motivo: 'Upload travado há mais de 2 horas - cancelado automaticamente',
          timestamp: new Date().toISOString(),
          dados_anteriores: null
        },
        completed_at: new Date().toISOString()
      })
      .eq('status', 'processando')
      .lt('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()) // 2 horas atrás
      .select();

    if (cancelError) {
      throw new Error(`Erro ao cancelar uploads: ${cancelError.message}`);
    }

    console.log(`✅ ${uploadsCancelados?.length || 0} uploads cancelados`);

    return new Response(
      JSON.stringify({
        success: true,
        uploads_cancelados: uploadsCancelados?.length || 0,
        uploads_cancelados_detalhes: uploadsCancelados,
        message: 'Uploads travados cancelados com sucesso'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro ao cancelar uploads:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});