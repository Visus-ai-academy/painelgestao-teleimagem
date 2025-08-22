import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧹 Iniciando limpeza de cache de volumetria e relatório de exclusões...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let totalLimpo = 0;
    const detalhes = [] as string[];

    // 1. Limpar registros rejeitados antigos (cache do relatório de exclusões)
    console.log('🗑️ Limpando registros rejeitados antigos...');
    const { error: errorRejeitados, count: countRejeitados } = await supabase
      .from('registros_rejeitados_processamento')
      .delete({ count: 'exact' })
      .lt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Mais de 1 hora

    if (!errorRejeitados) {
      const deletedRejeitados = countRejeitados || 0;
      totalLimpo += deletedRejeitados;
      detalhes.push(`Registros rejeitados antigos: ${deletedRejeitados} removidos`);
      console.log(`✅ ${deletedRejeitados} registros rejeitados antigos removidos`);
    } else {
      console.error('❌ Erro ao limpar registros rejeitados:', errorRejeitados);
      detalhes.push(`Erro ao limpar registros rejeitados: ${errorRejeitados.message}`);
    }

    // 2. Limpar staging processado (cache de processamento)
    console.log('🗑️ Limpando staging processado...');
    const { error: errorStaging, count: countStaging } = await supabase
      .from('volumetria_staging')
      .delete({ count: 'exact' })
      .eq('status_processamento', 'concluido')
      .lt('processado_em', new Date(Date.now() - 60 * 60 * 1000).toISOString());

    if (!errorStaging) {
      const deletedStaging = countStaging || 0;
      totalLimpo += deletedStaging;
      detalhes.push(`Staging processado: ${deletedStaging} removidos`);
      console.log(`✅ ${deletedStaging} registros de staging processado removidos`);
    } else {
      console.error('❌ Erro ao limpar staging:', errorStaging);
      detalhes.push(`Erro ao limpar staging: ${errorStaging.message}`);
    }

    // 3. Resetar contadores de erro nos uploads
    console.log('🔄 Resetando contadores de erro...');
    const { error: errorUploads, count: countUploads } = await supabase
      .from('processamento_uploads')
      .update({ 
        registros_erro: 0,
        detalhes_erro: null,
        updated_at: new Date().toISOString()
      })
      .gt('registros_erro', 0);

    if (!errorUploads) {
      const updatedUploads = countUploads || 0;
      detalhes.push(`Contadores de upload resetados: ${updatedUploads} atualizados`);
      console.log(`✅ ${updatedUploads} contadores de upload resetados`);
    } else {
      console.error('❌ Erro ao resetar contadores:', errorUploads);
      detalhes.push(`Erro ao resetar contadores: ${errorUploads.message}`);
    }

    // 4. Limpar logs de auditoria antigos relacionados a volumetria
    console.log('🗑️ Limpando logs de auditoria antigos...');
    const { error: errorAudit, count: countAudit } = await supabase
      .from('audit_logs')
      .delete({ count: 'exact' })
      .eq('table_name', 'volumetria_mobilemed')
      .lt('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Mais de 24 horas

    if (!errorAudit) {
      const deletedAudit = countAudit || 0;
      totalLimpo += deletedAudit;
      detalhes.push(`Logs de auditoria antigos: ${deletedAudit} removidos`);
      console.log(`✅ ${deletedAudit} logs de auditoria antigos removidos`);
    } else {
      console.error('❌ Erro ao limpar logs de auditoria:', errorAudit);
      detalhes.push(`Erro ao limpar logs de auditoria: ${errorAudit.message}`);
    }

    // Log da operação
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'cache_sistema',
        operation: 'LIMPEZA_CACHE',
        record_id: 'volumetria_exclusoes',
        new_data: {
          total_registros_limpos: totalLimpo,
          detalhes: detalhes,
          timestamp: new Date().toISOString()
        },
        user_email: 'system',
        severity: 'info'
      });

    console.log(`🎉 Limpeza de cache concluída! Total limpo: ${totalLimpo} registros`);

    return new Response(JSON.stringify({
      success: true,
      total_limpo: totalLimpo,
      detalhes: detalhes,
      timestamp: new Date().toISOString(),
      message: 'Cache de volumetria e relatório de exclusões limpo com sucesso'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Erro na limpeza de cache:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}