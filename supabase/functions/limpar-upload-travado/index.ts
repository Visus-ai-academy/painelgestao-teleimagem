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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { uploadId } = await req.json();
    
    if (!uploadId) {
      return new Response(
        JSON.stringify({ error: 'Upload ID é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Iniciando limpeza do upload travado: ${uploadId}`);

    // 1. Buscar dados do upload
    const { data: upload, error: uploadError } = await supabase
      .from('processamento_uploads')
      .select('*')
      .eq('id', uploadId)
      .single();

    if (uploadError || !upload) {
      return new Response(
        JSON.stringify({ error: 'Upload não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Limpar dados processados parcialmente se existirem
    if (upload.periodo_referencia) {
      console.log(`Limpando dados do período: ${upload.periodo_referencia}`);
      
      const { error: deleteError } = await supabase
        .from('volumetria_mobilemed')
        .delete()
        .eq('periodo_referencia', upload.periodo_referencia)
        .eq('arquivo_fonte', upload.tipo_arquivo);

      if (deleteError) {
        console.error('Erro ao limpar dados parciais:', deleteError);
      }
    }

    // 3. Limpar registros rejeitados relacionados
    const { error: rejeitadosError } = await supabase
      .from('registros_rejeitados_processamento')
      .delete()
      .gte('created_at', upload.created_at);

    if (rejeitadosError) {
      console.error('Erro ao limpar registros rejeitados:', rejeitadosError);
    }

    // 4. Resetar status do upload
    const { error: updateError } = await supabase
      .from('processamento_uploads')
      .update({
        status: 'pendente',
        registros_processados: 0,
        registros_inseridos: 0,
        registros_atualizados: 0,
        registros_erro: 0,
        detalhes_erro: JSON.stringify({
          status: 'Reset para reprocessamento',
          reset_at: new Date().toISOString(),
          motivo: 'Upload travado - reiniciando processamento'
        }),
        tempo_processamento: null,
        completed_at: null
      })
      .eq('id', uploadId);

    if (updateError) {
      console.error('Erro ao resetar upload:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao resetar status do upload' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Upload ${uploadId} foi resetado com sucesso`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Upload resetado com sucesso. Você pode reprocessar o arquivo agora.',
        uploadId: uploadId,
        arquivo: upload.arquivo_nome
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro inesperado:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})