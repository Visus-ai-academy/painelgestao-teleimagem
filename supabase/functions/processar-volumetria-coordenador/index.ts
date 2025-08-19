import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🎯 COORDENADOR DE PROCESSAMENTO - Orquestra todo o fluxo de staging
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // VALIDAR REQUEST BODY
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (jsonError) {
      console.error('❌ [COORDENADOR] Erro ao fazer parse do JSON:', jsonError);
      throw new Error('Request body inválido - não é JSON válido');
    }

    console.log('📨 [COORDENADOR] Request body recebido:', JSON.stringify(requestBody, null, 2));

    const { file_path, arquivo_fonte, periodo_referencia, periodo_processamento } = requestBody;
    
    console.log('🔍 [COORDENADOR] Valores extraídos:', {
      file_path: file_path,
      file_path_type: typeof file_path,
      arquivo_fonte: arquivo_fonte,
      periodo_referencia: periodo_referencia
    });
    
    // VALIDAÇÕES OBRIGATÓRIAS
    if (!file_path) {
      console.error('❌ [COORDENADOR] file_path está vazio ou undefined');
      throw new Error('ERRO: file_path é obrigatório');
    }
    if (!arquivo_fonte) {
      console.error('❌ [COORDENADOR] arquivo_fonte está vazio ou undefined');
      throw new Error('ERRO: arquivo_fonte é obrigatório');  
    }
    
    console.log('🎯 [COORDENADOR] Iniciando orquestração validada:', {
      file_path,
      arquivo_fonte,
      periodo_referencia
    });

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. ETAPA STAGING OTIMIZADA - Para arquivos grandes
    console.log('📋 [COORDENADOR] Etapa 1: Processando com staging otimizado...');
    
    // VALIDAÇÃO CRÍTICA ANTES DE MONTAR PAYLOAD
    console.log('🔍 [COORDENADOR] Validando dados antes de criar payload:', {
      file_path_recebido: file_path,
      file_path_tipo: typeof file_path,
      file_path_length: file_path ? file_path.length : 0,
      arquivo_fonte_recebido: arquivo_fonte,
      periodo_referencia_recebido: periodo_referencia
    });
    
    if (!file_path || typeof file_path !== 'string') {
      console.error('💥 [COORDENADOR] ERRO CRÍTICO: file_path inválido antes de criar payload');
      throw new Error('file_path inválido no coordenador');
    }
    
    const stagingPayload = { 
      file_path: file_path,
      arquivo_fonte: arquivo_fonte,
      periodo_referencia: periodo_referencia || 'jun/25'
    };
    
    console.log('📤 [COORDENADOR] Payload para staging otimizado:', JSON.stringify(stagingPayload, null, 2));
    console.log('🔍 [COORDENADOR] Verificação final do payload:', {
      payload_file_path: stagingPayload.file_path,
      payload_file_path_tipo: typeof stagingPayload.file_path,
      payload_arquivo_fonte: stagingPayload.arquivo_fonte
    });
    
    // Tentar primeiro com staging otimizado (para arquivos grandes)
    let stagingResult, stagingError;
    
    // Log crítico antes da chamada
    console.log('🚨 [COORDENADOR] ANTES DE CHAMAR STAGING-LIGHT - Dados finais:', {
      stagingPayload_completo: stagingPayload,
      file_path_no_payload: stagingPayload.file_path,
      arquivo_fonte_no_payload: stagingPayload.arquivo_fonte
    });
    
    try {
      const { data, error } = await supabaseClient.functions.invoke('processar-volumetria-staging-light', {
        body: stagingPayload
      });
      stagingResult = data;
      stagingError = error;
      
      if (error) {
        console.error('❌ [COORDENADOR] Staging otimizado retornou erro:', error);
        throw error;
      }
      
      console.log('✅ [COORDENADOR] Staging otimizado usado com sucesso');
    } catch (lightError) {
      console.log('⚠️ [COORDENADOR] Staging otimizado falhou, tentando staging padrão:', lightError.message);
      console.log('🚨 [COORDENADOR] ANTES DE CHAMAR STAGING PADRÃO - Dados finais:', {
        stagingPayload_completo: stagingPayload,
        file_path_no_payload: stagingPayload.file_path,
        arquivo_fonte_no_payload: stagingPayload.arquivo_fonte
      });
      
      // Fallback para staging padrão
      try {
        const { data, error } = await supabaseClient.functions.invoke('processar-volumetria-staging', {
          body: stagingPayload
        });
        stagingResult = data;
        stagingError = error;
        
        if (error) {
          console.error('❌ [COORDENADOR] Staging padrão retornou erro:', error);
          throw error;
        }
        
        console.log('✅ [COORDENADOR] Staging padrão usado como fallback');
      } catch (standardError) {
        console.error('❌ [COORDENADOR] Ambos stagings falharam:', standardError);
        stagingError = standardError;
      }
    }

    if (stagingError) {
      console.error('❌ [COORDENADOR] Erro na etapa de staging:', stagingError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro no processamento de staging',
          details: stagingError 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [COORDENADOR] Staging completado:', stagingResult);

    // 2. ETAPA BACKGROUND - Aplicar regras e mover para tabela final
    console.log('🔄 [COORDENADOR] Etapa 2: Processamento em background...');
    
    const { data: backgroundResult, error: backgroundError } = await supabaseClient.functions.invoke('processar-staging-background', {
      body: {
        upload_id: stagingResult.upload_id,
        arquivo_fonte,
        periodo_referencia
      }
    });

    if (backgroundError) {
      console.error('❌ [COORDENADOR] Erro no processamento background:', backgroundError);
      
      // Atualizar status do upload como erro
      await supabaseClient
        .from('processamento_uploads')
        .update({
          status: 'error',
          detalhes_erro: {
            etapa: 'background',
            erro: backgroundError.message,
            timestamp: new Date().toISOString()
          },
          completed_at: new Date().toISOString()
        })
        .eq('id', stagingResult.upload_id);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro no processamento background',
          upload_id: stagingResult.upload_id,
          details: backgroundError 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [COORDENADOR] Background completado:', backgroundResult);

    // 3. RESULTADO FINAL
    const resultado = {
      success: true,
      message: 'Processamento completo via arquitetura de staging',
      upload_id: stagingResult.upload_id,
      staging_stats: {
        registros_staging: stagingResult.registros_inseridos_staging,
        registros_erro_staging: stagingResult.registros_erro_staging
      },
      background_stats: {
        registros_processados: backgroundResult.registros_processados,
        registros_inseridos: backgroundResult.registros_inseridos,
        registros_erro: backgroundResult.registros_erro,
        regras_aplicadas: backgroundResult.regras_aplicadas
      },
      total_stats: {
        total_registros: stagingResult.registros_inseridos_staging,
        registros_finais: backgroundResult.registros_inseridos,
        taxa_sucesso: backgroundResult.registros_inseridos / stagingResult.registros_inseridos_staging * 100
      }
    };

    console.log('🎯 [COORDENADOR] Processamento completo:', resultado);

    return new Response(
      JSON.stringify(resultado),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 [COORDENADOR] Erro crítico:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});