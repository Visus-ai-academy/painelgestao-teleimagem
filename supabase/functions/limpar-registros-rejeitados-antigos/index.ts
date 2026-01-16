import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { data_limite = '2026-01-01' } = await req.json();
    
    console.log(`🧹 Limpando registros rejeitados anteriores a: ${data_limite}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Contar registros antes da limpeza
    const { count: totalAntes } = await supabase
      .from('registros_rejeitados_processamento')
      .select('*', { count: 'exact', head: true });

    // Contar registros que serão removidos
    const { count: aRemover } = await supabase
      .from('registros_rejeitados_processamento')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', data_limite);

    console.log(`📊 Total de registros: ${totalAntes}`);
    console.log(`🗑️ Registros a remover (anteriores a ${data_limite}): ${aRemover}`);

    // Deletar em lotes para evitar timeout
    let totalDeletados = 0;
    const BATCH_SIZE = 500;
    
    while (true) {
      const { data: idsToDelete, error: selectError } = await supabase
        .from('registros_rejeitados_processamento')
        .select('id')
        .lt('created_at', data_limite)
        .limit(BATCH_SIZE);

      if (selectError) {
        console.error('❌ Erro ao selecionar IDs:', selectError);
        throw selectError;
      }

      if (!idsToDelete || idsToDelete.length === 0) {
        break;
      }

      const idsArray = idsToDelete.map(row => row.id);
      const { error: deleteError, count } = await supabase
        .from('registros_rejeitados_processamento')
        .delete({ count: 'exact' })
        .in('id', idsArray);

      if (deleteError) {
        console.error('❌ Erro ao deletar:', deleteError);
        throw deleteError;
      }

      totalDeletados += count || 0;
      console.log(`✅ Lote deletado: ${count} registros (Total: ${totalDeletados})`);

      if (idsToDelete.length < BATCH_SIZE) break;
      
      // Pequena pausa entre lotes
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Contar registros após a limpeza
    const { count: totalDepois } = await supabase
      .from('registros_rejeitados_processamento')
      .select('*', { count: 'exact', head: true });

    // Log de auditoria
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'registros_rejeitados_processamento',
        operation: 'LIMPEZA_REGISTROS_ANTIGOS',
        record_id: 'BATCH',
        new_data: {
          data_limite,
          total_antes: totalAntes,
          registros_removidos: totalDeletados,
          total_depois: totalDepois,
          timestamp: new Date().toISOString()
        },
        user_email: 'system',
        severity: 'info'
      });

    console.log(`🎯 Limpeza concluída!`);
    console.log(`   Total antes: ${totalAntes}`);
    console.log(`   Removidos: ${totalDeletados}`);
    console.log(`   Total depois: ${totalDepois}`);

    return new Response(JSON.stringify({
      sucesso: true,
      data_limite,
      total_antes: totalAntes,
      registros_removidos: totalDeletados,
      total_depois: totalDepois,
      mensagem: `Limpeza concluída! ${totalDeletados} registros antigos removidos.`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Erro na limpeza:', error);
    return new Response(JSON.stringify({
      sucesso: false,
      erro: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
