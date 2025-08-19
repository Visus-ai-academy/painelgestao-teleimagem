import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import * as XLSX from "https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('📊 [EXCEL-PROCESSAMENTO-V4] Função para arquivos GRANDES (35k+ linhas)');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_path, arquivo_fonte, periodo_referencia } = await req.json();
    
    console.log('📊 [EXCEL-V4] Parâmetros recebidos:', { file_path, arquivo_fonte, periodo_referencia });
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Registrar upload inicial
    const lote_upload = crypto.randomUUID();
    const arquivoNome = file_path.includes('/') ? file_path.split('/').pop() : file_path;
    
    console.log('📊 [EXCEL-V4] Registrando upload para arquivo:', arquivoNome);
    
    const { data: uploadRecord } = await supabaseClient
      .from('processamento_uploads')
      .insert({
        tipo_arquivo: arquivo_fonte,
        arquivo_nome: arquivoNome || 'arquivo.xlsx',
        status: 'processando',
        periodo_referencia: periodo_referencia || 'jun/25',
        detalhes_erro: { lote_upload, etapa: 'processamento_v4_GRANDES_ARQUIVOS', versao: 'v4' }
      })
      .select()
      .single();

    console.log('✅ [EXCEL-V4] Upload registrado com ID:', uploadRecord?.id);

    // Para arquivos grandes, usar sistema de staging existente
    console.log('📊 [EXCEL-V4] Delegando para função de staging otimizada para arquivos grandes');
    
    const { data: stagingResult, error: stagingError } = await supabaseClient.functions.invoke('processar-volumetria-staging-light', {
      body: {
        file_path: file_path,
        arquivo_fonte: arquivo_fonte,
        periodo_referencia: periodo_referencia
      }
    });

    if (stagingError) {
      console.error('❌ [EXCEL-V4] Erro na função de staging:', stagingError);
      throw new Error(`Erro no staging: ${stagingError.message}`);
    }

    console.log('📊 [EXCEL-V4] Staging concluído:', stagingResult);

    // Aguardar um pouco para o staging ser processado
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Chamar processamento em background
    console.log('📊 [EXCEL-V4] Iniciando processamento em background');
    
    const { data: backgroundResult, error: backgroundError } = await supabaseClient.functions.invoke('processar-staging-background', {
      body: {
        lote_upload: lote_upload,
        arquivo_fonte: arquivo_fonte,
        periodo_referencia: periodo_referencia
      }
    });

    if (backgroundError) {
      console.log('⚠️ [EXCEL-V4] Erro no processamento background (não crítico):', backgroundError);
    } else {
      console.log('✅ [EXCEL-V4] Background processamento iniciado:', backgroundResult);
    }

    // Atualizar status do upload
    if (uploadRecord?.id) {
      await supabaseClient
        .from('processamento_uploads')
        .update({
          status: 'staging_concluido',
          registros_processados: stagingResult?.stats?.inserted_count || 0,
          registros_inseridos: stagingResult?.stats?.inserted_count || 0,
          registros_erro: stagingResult?.stats?.error_count || 0,
          completed_at: new Date().toISOString(),
          detalhes_erro: {
            etapa: 'processamento_v4_STAGING_COMPLETO',
            lote_upload: lote_upload,
            staging_result: stagingResult,
            versao: 'v4_staging'
          }
        })
        .eq('id', uploadRecord.id);
    }

    console.log(`🎉 [EXCEL-V4] PROCESSAMENTO INICIADO: ${stagingResult?.stats?.inserted_count || 0} registros no staging`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Arquivo grande processado via staging! ${stagingResult?.stats?.inserted_count || 0} registros em processamento`,
        upload_id: uploadRecord?.id || 'temp-' + Date.now(),
        stats: {
          inserted_count: stagingResult?.stats?.inserted_count || 0,
          total_rows: stagingResult?.stats?.total_rows || 0,
          error_count: stagingResult?.stats?.error_count || 0,
          regras_aplicadas: 0
        },
        processamento_completo_com_regras: false,
        processamento_em_background: true,
        versao: 'v4_staging',
        observacao: 'Arquivo grande processado via sistema de staging. Os dados aparecerão gradualmente na volumetria.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 [EXCEL-PROCESSAMENTO-V3] ERRO CAPTURADO:', error.message);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: `Erro no processamento: ${error.message}`,
        versao: 'v3_erro'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
