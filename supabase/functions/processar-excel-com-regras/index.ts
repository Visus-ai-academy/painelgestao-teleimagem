import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('📊 [EXCEL-V6] Delegando processamento para coordenador (evitar memory limit)');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_path, arquivo_fonte, periodo_referencia } = await req.json();
    
    console.log('📊 [EXCEL-V6] Parâmetros:', { file_path, arquivo_fonte, periodo_referencia });
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Registrar upload inicial
    const lote_upload = crypto.randomUUID();
    const arquivoNome = file_path.includes('/') ? file_path.split('/').pop() : file_path;
    
    console.log('📊 [EXCEL-V6] Registrando upload:', arquivoNome);
    
    const { data: uploadRecord, error: uploadError } = await supabase
      .from('processamento_uploads')
      .insert({
        tipo_arquivo: arquivo_fonte,
        arquivo_nome: arquivoNome || 'arquivo.xlsx',
        status: 'processando',
        periodo_referencia: periodo_referencia || 'jun/25',
        detalhes_erro: { 
          lote_upload, 
          etapa: 'delegando_coordenador', 
          versao: 'v6_coordenador' 
        }
      })
      .select()
      .single();

    if (uploadError) throw uploadError;
    console.log('✅ [EXCEL-V6] Upload registrado:', uploadRecord?.id);

    // Delegar para o coordenador
    console.log('🚀 [EXCEL-V6] Delegando para coordenador (sem background)...');
    
    const { data: coordenadorResult, error: coordenadorError } = await supabase.functions.invoke(
      'processar-volumetria-coordenador',
      {
        body: {
          file_path,
          arquivo_fonte,
          periodo_referencia,
          upload_id: uploadRecord.id
        }
      }
    );

    if (coordenadorError) {
      console.error('❌ [EXCEL-V6] Erro no coordenador:', coordenadorError);
      
      await supabase
        .from('processamento_uploads')
        .update({
          status: 'erro',
          completed_at: new Date().toISOString(),
          detalhes_erro: {
            lote_upload,
            etapa: 'erro_coordenador',
            versao: 'v6_coordenador_fixed',
            erro: coordenadorError.message
          }
        })
        .eq('id', uploadRecord.id);
      
      throw coordenadorError;
    }

    console.log('✅ [EXCEL-V6] Coordenador executado:', coordenadorResult);

    // Atualizar status baseado no resultado do coordenador
    const finalStatus = coordenadorResult?.success ? 'sucesso' : 'erro';
    const stats = coordenadorResult?.stats || {};
    
    await supabase
      .from('processamento_uploads')
      .update({
        status: finalStatus,
        registros_processados: stats.staging_processados || 0,
        registros_inseridos: stats.staging_inseridos || 0,
        registros_erro: 0,
        completed_at: new Date().toISOString(),
        detalhes_erro: {
          lote_upload,
          etapa: 'sucesso_coordenador_fixed',
          versao: 'v6_coordenador_fixed'
        }
      })
      .eq('id', uploadRecord.id);

    console.log(`🎉 [EXCEL-V6] PROCESSAMENTO CONCLUÍDO: Status ${finalStatus}`);

    return new Response(
      JSON.stringify({
        success: coordenadorResult?.success || false,
        message: coordenadorResult?.message || 'Upload processado com sucesso',
        upload_id: uploadRecord?.id,
        stats: {
          processados: stats.staging_processados || 0,
          inseridos: stats.staging_inseridos || 0,
          erros: 0
        },
        processamento_completo_com_regras: true,
        versao: 'v6_coordenador_fixed'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 [EXCEL-V6] ERRO CAPTURADO:', error.message);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: `Erro no processamento: ${error.message}`,
        versao: 'v6_erro'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
