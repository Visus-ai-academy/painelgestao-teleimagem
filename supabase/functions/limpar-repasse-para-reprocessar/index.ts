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

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { uploadId } = await req.json();

    if (!uploadId) {
      throw new Error('uploadId é obrigatório');
    }

    console.log(`🧹 Limpando repasses do upload: ${uploadId}`);

    // Buscar informações do upload
    const { data: upload } = await supabase
      .from('processamento_uploads')
      .select('arquivo_nome, created_at')
      .eq('id', uploadId)
      .single();

    if (!upload) {
      throw new Error('Upload não encontrado');
    }

    // Deletar todos os repasses deste upload (baseado no timestamp aproximado)
    const uploadTime = new Date(upload.created_at);
    const timeWindow = new Date(uploadTime.getTime() - 60000); // 1 minuto antes

    const { error: deleteError, count } = await supabase
      .from('medicos_valores_repasse')
      .delete({ count: 'exact' })
      .gte('created_at', timeWindow.toISOString())
      .lte('created_at', new Date(uploadTime.getTime() + 3600000).toISOString()); // 1 hora depois

    if (deleteError) throw deleteError;

    // Limpar duplicados relacionados
    await supabase
      .from('duplicados_repasse_medico')
      .delete()
      .eq('lote_processamento', upload.arquivo_nome);

    // Resetar o status do upload para permitir reprocessamento
    await supabase
      .from('processamento_uploads')
      .update({
        status: 'cancelado',
        registros_processados: 0,
        registros_inseridos: 0,
        registros_atualizados: 0,
        registros_erro: 0,
        detalhes_erro: { 
          mensagem: 'Upload cancelado para reprocessamento sem deduplicação',
          registros_deletados: count || 0
        }
      })
      .eq('id', uploadId);

    console.log(`✅ Limpeza concluída: ${count} registros deletados`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${count} registros deletados com sucesso`,
        registros_deletados: count
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error: any) {
    console.error('❌ Erro ao limpar repasse:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
