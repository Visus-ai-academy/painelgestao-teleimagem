import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RollbackRequest {
  upload_id: string;
  motivo: string;
  forcar_rollback?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { upload_id, motivo, forcar_rollback = false }: RollbackRequest = await req.json();
    
    console.log(`🔄 [ROLLBACK] Iniciando rollback para upload ${upload_id}. Motivo: ${motivo}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Verificar se o upload existe
    const { data: uploadInfo, error: uploadError } = await supabase
      .from('processamento_uploads')
      .select('*')
      .eq('id', upload_id)
      .single();

    if (uploadError || !uploadInfo) {
      throw new Error(`Upload não encontrado: ${uploadError?.message}`);
    }

    // 2. Verificar se já foi feito rollback
    if (uploadInfo.status === 'rollback_executado' && !forcar_rollback) {
      return new Response(JSON.stringify({
        sucesso: false,
        erro: 'Rollback já foi executado anteriormente',
        upload_id: upload_id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Verificar validação de integridade se não forçado
    if (!forcar_rollback) {
      const { data: validacao } = await supabase
        .from('validacao_integridade')
        .select('*')
        .eq('upload_id', upload_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (validacao && !validacao.requer_rollback) {
        return new Response(JSON.stringify({
          sucesso: false,
          erro: 'Upload passou na validação de integridade. Use forcar_rollback=true se necessário',
          pontuacao_integridade: validacao.pontuacao_integridade
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const loteUpload = uploadInfo.detalhes_erro?.lote_upload || uploadInfo.id;

    // 4. Remover dados relacionados
    console.log(`🗑️ [ROLLBACK] Removendo dados do lote ${loteUpload}...`);
    
    const { count: registrosRemovidos, error: removeError } = await supabase
      .from('volumetria_mobilemed')
      .delete({ count: 'exact' })
      .eq('lote_upload', loteUpload);

    if (removeError) {
      console.error('❌ Erro ao remover dados:', removeError);
      throw new Error(`Erro ao remover dados: ${removeError.message}`);
    }

    console.log(`🗑️ [ROLLBACK] ${registrosRemovidos} registros removidos`);

    // 5. Remover dados do staging se existirem
    const { count: stagingRemovido } = await supabase
      .from('volumetria_staging')
      .delete({ count: 'exact' })
      .eq('lote_upload', loteUpload);

    console.log(`🗑️ [ROLLBACK] ${stagingRemovido} registros de staging removidos`);

    // 6. Atualizar status do upload
    const { error: updateError } = await supabase
      .from('processamento_uploads')
      .update({
        status: 'rollback_executado',
        detalhes_erro: {
          ...uploadInfo.detalhes_erro,
          motivo_rollback: motivo,
          registros_removidos: registrosRemovidos,
          staging_removido: stagingRemovido,
          rollback_executado_em: new Date().toISOString(),
          forcado: forcar_rollback
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', upload_id);

    if (updateError) {
      console.error('❌ Erro ao atualizar status:', updateError);
      throw new Error(`Erro ao atualizar status: ${updateError.message}`);
    }

    // 7. Registrar no log de auditoria
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        table_name: 'processamento_uploads',
        operation: 'ROLLBACK',
        record_id: upload_id,
        new_data: {
          motivo: motivo,
          registros_removidos: registrosRemovidos,
          staging_removido: stagingRemovido,
          forcado: forcar_rollback
        },
        user_email: 'system',
        severity: 'warning'
      });

    if (auditError) {
      console.warn('⚠️ Erro no log de auditoria:', auditError);
    }

    const resultado = {
      sucesso: true,
      upload_id: upload_id,
      registros_removidos: registrosRemovidos,
      staging_removido: stagingRemovido,
      motivo: motivo,
      forcado: forcar_rollback,
      executado_em: new Date().toISOString(),
      mensagem: `Rollback executado com sucesso. ${registrosRemovidos} registros removidos.`
    };

    console.log(`✅ [ROLLBACK] Concluído:`, resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [ROLLBACK] Erro crítico:', error);
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        erro: error.message,
        upload_id: req.body?.upload_id || 'unknown'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});