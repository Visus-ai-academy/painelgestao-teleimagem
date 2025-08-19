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
    console.log('🔄 [PENDENTES] Iniciando processamento de dados pendentes...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar uploads travados (processando com contadores zerados)
    const { data: uploadsTravados, error } = await supabaseClient
      .from('processamento_uploads')
      .select('id, arquivo_fonte, periodo_referencia, lote_upload')
      .eq('status_processamento', 'processando')
      .eq('registros_inseridos', 0)
      .eq('registros_processados', 0);

    if (error) {
      console.error('❌ [PENDENTES] Erro ao buscar uploads:', error);
      throw error;
    }

    console.log(`📋 [PENDENTES] ${uploadsTravados?.length || 0} uploads travados encontrados`);

    if (!uploadsTravados || uploadsTravados.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum upload travado encontrado',
          totalProcessados: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalProcessados = 0;
    const resultados = [];

    // Processar cada upload travado
    for (const upload of uploadsTravados) {
      console.log(`🔄 [PENDENTES] Processando upload ${upload.id}`);
      
      try {
        // Chamar a função de staging-background
        const { data: resultado, error: processError } = await supabaseClient.functions.invoke(
          'processar-staging-background',
          {
            body: {
              upload_id: upload.id,
              arquivo_fonte: upload.arquivo_fonte,
              periodo_referencia: upload.periodo_referencia
            }
          }
        );

        if (processError) {
          console.error(`❌ [PENDENTES] Erro no upload ${upload.id}:`, processError);
          resultados.push({
            upload_id: upload.id,
            status: 'erro',
            erro: processError.message
          });
        } else {
          console.log(`✅ [PENDENTES] Upload ${upload.id} processado`);
          totalProcessados++;
          resultados.push({
            upload_id: upload.id,
            status: 'sucesso'
          });
        }
      } catch (error) {
        console.error(`❌ [PENDENTES] Erro inesperado no upload ${upload.id}:`, error);
        resultados.push({
          upload_id: upload.id,
          status: 'erro',
          erro: error.message
        });
      }
    }

    const resultado = {
      success: true,
      message: `${totalProcessados} de ${uploadsTravados.length} uploads processados`,
      totalProcessados,
      totalTravados: uploadsTravados.length,
      resultados
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