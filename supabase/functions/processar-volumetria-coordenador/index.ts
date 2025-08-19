import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_path, arquivo_fonte, periodo_referencia, upload_id, force_staging } = await req.json();
    
    console.log('🎯 [COORDENADOR] Iniciando orquestração:', {
      file_path,
      arquivo_fonte,
      upload_id,
      force_staging
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. ESTRATÉGIA: Usar staging-light para processar o arquivo
    console.log('🚀 [COORDENADOR] Delegando para staging-light...');
    
    const { data: stagingResult, error: stagingError } = await supabase.functions.invoke(
      'processar-volumetria-staging-light',
      {
        body: {
          file_path,
          arquivo_fonte,
          periodo_referencia: periodo_referencia || 'jun/25'
        }
      }
    );

    if (stagingError) {
      console.error('❌ [COORDENADOR] Erro no staging:', stagingError);
      throw stagingError;
    }

    console.log('✅ [COORDENADOR] Staging concluído:', stagingResult);

    // 2. Se staging foi bem-sucedido, processar background
    if (stagingResult?.success && stagingResult?.lote_upload) {
      console.log('🏗️ [COORDENADOR] Iniciando background processing...');
      
      // Usar EdgeRuntime.waitUntil para processar em background
      const processBackground = async () => {
        try {
          const { data: backgroundResult, error: backgroundError } = await supabase.functions.invoke(
            'processar-staging-background',
            {
              body: {
                upload_id: stagingResult.upload_id || upload_id,
                arquivo_fonte,
                periodo_referencia: periodo_referencia || 'jun/25'
              }
            }
          );

          if (backgroundError) {
            console.error('❌ [COORDENADOR] Erro no background:', backgroundError);
            // Atualizar status para erro
            await supabase
              .from('processamento_uploads')
              .update({
                status: 'erro',
                detalhes_erro: {
                  etapa: 'background_erro',
                  erro: backgroundError.message
                }
              })
              .eq('id', stagingResult.upload_id || upload_id);
          } else {
            console.log('✅ [COORDENADOR] Background concluído:', backgroundResult);
          }
        } catch (error) {
          console.error('💥 [COORDENADOR] Erro crítico no background:', error);
        }
      };

      // Executar background sem bloquear resposta
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        EdgeRuntime.waitUntil(processBackground());
      } else {
        // Fallback para ambientes que não suportam EdgeRuntime
        processBackground();
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Coordenação iniciada com sucesso',
          staging_result: stagingResult,
          background: 'iniciado',
          upload_id: stagingResult.upload_id || upload_id,
          stats: {
            inseridos: stagingResult.registros_inseridos_staging || 0,
            erros: stagingResult.registros_erro_staging || 0,
            processados: stagingResult.registros_inseridos_staging || 0
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se staging falhou
    throw new Error('Staging não foi concluído com sucesso');

  } catch (error) {
    console.error('💥 [COORDENADOR] Erro crítico:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: `Erro no coordenador: ${error.message}`
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});