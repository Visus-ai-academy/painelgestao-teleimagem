import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 [PENDENTES] Iniciando processamento simplificado...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar uploads que estão travados
    const { data: uploads, error } = await supabaseClient
      .from('processamento_uploads')
      .select('*')
      .eq('status', 'processando')
      .eq('registros_inseridos', 0);

    if (error) {
      console.error('❌ [PENDENTES] Erro ao buscar uploads:', error);
      throw error;
    }

    console.log(`📋 [PENDENTES] ${uploads?.length || 0} uploads encontrados`);

    if (!uploads || uploads.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum upload pendente encontrado',
          totalProcessados: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Para uploads simples que estão travados, vamos resetá-los para permitir novo processamento
    let processados = 0;
    
    for (const upload of uploads) {
      try {
        // Resetar status para permitir reprocessamento
        const { error: updateError } = await supabaseClient
          .from('processamento_uploads')
          .update({ 
            status: 'pendente',
            detalhes_erro: {
              ...upload.detalhes_erro,
              reset_em: new Date().toISOString(),
              motivo: 'Resetado por processamento pendentes'
            }
          })
          .eq('id', upload.id);

        if (updateError) {
          console.error(`❌ [PENDENTES] Erro ao resetar upload ${upload.id}:`, updateError);
        } else {
          console.log(`✅ [PENDENTES] Upload ${upload.id} resetado`);
          processados++;
        }
      } catch (error) {
        console.error(`❌ [PENDENTES] Erro no upload ${upload.id}:`, error);
      }
    }

    const resultado = {
      success: true,
      message: `${processados} uploads resetados para reprocessamento`,
      totalProcessados: processados,
      totalEncontrados: uploads.length
    };

    console.log('✅ [PENDENTES] Processamento concluído:', resultado);

    return new Response(
      JSON.stringify(resultado),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [PENDENTES] Erro geral:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});