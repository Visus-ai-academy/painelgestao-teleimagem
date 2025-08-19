import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[RESET-UPLOADS] INICIANDO RESET COMPLETO DO SISTEMA');

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let resultado = {
      uploads_resetados: 0,
      staging_limpo: 0,
      upload_logs_limpos: 0,
      mensagem: 'Sistema resetado com sucesso'
    };

    // 1. RESETAR APENAS UPLOADS REALMENTE TRAVADOS (mais de 30 minutos)
    console.log('🔄 Resetando uploads realmente travados...');
    
    const { data: uploadsTravados, error: selectError } = await supabase
      .from('processamento_uploads')
      .select('*')
      .in('status', ['processando', 'pendente'])
      .lt('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()); // Mais de 30 minutos

    if (selectError) {
      console.error('❌ Erro ao buscar uploads:', selectError);
      throw selectError;
    }

    console.log(`📋 Encontrados ${uploadsTravados?.length || 0} uploads para resetar`);

    if (uploadsTravados && uploadsTravados.length > 0) {
      // Atualizar status para erro
      const { error: updateError } = await supabase
        .from('processamento_uploads')
        .update({
          status: 'erro',
          detalhes_erro: JSON.stringify({
            erro: 'Sistema resetado - upload travado detectado',
            timestamp_reset: new Date().toISOString(),
            acao: 'reset_automatico'
          })
        })
        .in('id', uploadsTravados.map(u => u.id));

      if (updateError) {
        console.error('❌ Erro ao resetar uploads:', updateError);
        throw updateError;
      }

      resultado.uploads_resetados = uploadsTravados.length;
      console.log(`✅ ${uploadsTravados.length} uploads resetados`);
    }

    // 2. LIMPAR STAGING PROCESSADO (mais de 2 horas)
    console.log('🧹 Limpando staging processado...');
    
    const { count: stagingCount, error: stagingError } = await supabase
      .from('volumetria_staging')
      .delete({ count: 'exact' })
      .eq('status_processamento', 'concluido')
      .lt('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()); // Mais de 2 horas

    if (stagingError) {
      console.warn('⚠️ Erro ao limpar staging:', stagingError);
    } else {
      resultado.staging_limpo = stagingCount || 0;
      console.log(`🗑️ ${stagingCount || 0} registros removidos do staging`);
    }

    // 3. LIMPAR UPLOAD_LOGS ANTIGOS
    console.log('🧹 Limpando upload_logs antigos...');
    
    const { count: logsCount, error: logsError } = await supabase
      .from('upload_logs')
      .delete({ count: 'exact' })
      .in('status', ['processing', 'failed'])
      .lt('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()); // Mais de 30 minutos

    if (logsError) {
      console.warn('⚠️ Erro ao limpar logs:', logsError);
    } else {
      resultado.upload_logs_limpos = logsCount || 0;
      console.log(`🗑️ ${logsCount || 0} upload_logs removidos`);
    }

    // 4. VERIFICAR ESTADO FINAL
    const { count: uploadsRestantes, error: verificacaoError } = await supabase
      .from('processamento_uploads')
      .select('*', { count: 'exact', head: true })
      .in('status', ['processando', 'pendente']);

    if (!verificacaoError) {
      console.log(`📊 Verificação final: ${uploadsRestantes || 0} uploads ainda em processamento`);
    }

    // 5. LOG DE AUDITORIA
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'sistema_uploads',
        operation: 'RESET_COMPLETO',
        record_id: 'sistema',
        new_data: resultado,
        user_email: 'system',
        severity: 'warning'
      });

    console.log('✅ RESET COMPLETO FINALIZADO:', resultado);

    return new Response(JSON.stringify({
      success: true,
      ...resultado,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('💥 ERRO NO RESET:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});