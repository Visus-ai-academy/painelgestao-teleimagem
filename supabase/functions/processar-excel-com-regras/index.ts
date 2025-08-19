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

    // Delegar para o coordenador que tem estratégias otimizadas para arquivos grandes
    console.log('🚀 [EXCEL-V6] Delegando para coordenador...');
    
    const { data: coordenadorResult, error: coordenadorError } = await supabase.functions.invoke(
      'processar-volumetria-coordenador',
      {
        body: {
          file_path,
          arquivo_fonte,
          periodo_referencia,
          periodo_processamento: periodo_referencia,
          upload_id: uploadRecord.id,
          force_staging: true // Forçar uso de staging para arquivos grandes
        }
      }
    );

    if (coordenadorError) {
      console.error('❌ [EXCEL-V6] Erro no coordenador:', coordenadorError);
      
      // Atualizar status para erro
      await supabase
        .from('processamento_uploads')
        .update({
          status: 'erro',
          completed_at: new Date().toISOString(),
          detalhes_erro: {
            lote_upload,
            etapa: 'erro_coordenador',
            versao: 'v6_coordenador',
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
        registros_processados: stats.processados || 0,
        registros_inseridos: stats.inseridos || 0,
        registros_erro: stats.erros || 0,
        completed_at: new Date().toISOString(),
        detalhes_erro: finalStatus === 'erro' ? {
          lote_upload,
          etapa: 'erro_final_coordenador',
          versao: 'v6_coordenador',
          resultado_coordenador: coordenadorResult
        } : {
          lote_upload,
          etapa: 'sucesso_coordenador',
          versao: 'v6_coordenador'
        }
      })
      .eq('id', uploadRecord.id);

    console.log(`🎉 [EXCEL-V6] DELEGAÇÃO CONCLUÍDA: Status ${finalStatus}`);

    return new Response(
      JSON.stringify({
        success: coordenadorResult?.success || false,
        message: coordenadorResult?.message || 'Processamento delegado ao coordenador',
        upload_id: uploadRecord?.id,
        stats: stats,
        processamento_completo_com_regras: true,
        processamento_em_background: coordenadorResult?.background || false,
        versao: 'v6_coordenador',
        coordenador_result: coordenadorResult
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
