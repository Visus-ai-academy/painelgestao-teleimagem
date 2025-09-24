import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Iniciando limpeza de uploads antigos...');

    // Cancelar uploads antigos que estão em processamento há mais de 10 minutos
    const dataLimite = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data: uploadsAntigos, error: selectError } = await supabase
      .from('upload_logs')
      .select('id, filename, created_at')
      .eq('status', 'processing')
      .eq('file_type', 'faturamento')
      .lt('created_at', dataLimite);

    if (selectError) {
      throw new Error(`Erro ao buscar uploads: ${selectError.message}`);
    }

    console.log(`Encontrados ${uploadsAntigos?.length || 0} uploads antigos para cancelar`);

    if (uploadsAntigos && uploadsAntigos.length > 0) {
      const idsParaCancelar = uploadsAntigos.map(u => u.id);
      
      const { error: updateError } = await supabase
        .from('upload_logs')
        .update({
          status: 'cancelled',
          error_message: 'Cancelado automaticamente - timeout de processamento',
          updated_at: new Date().toISOString()
        })
        .in('id', idsParaCancelar);

      if (updateError) {
        throw new Error(`Erro ao cancelar uploads: ${updateError.message}`);
      }

      console.log(`${idsParaCancelar.length} uploads cancelados com sucesso`);
    }

    // Buscar status atual
    const { data: statusAtual, error: statusError } = await supabase
      .from('upload_logs')
      .select('status, COUNT(*)')
      .eq('file_type', 'faturamento')
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        uploads_cancelados: uploadsAntigos?.length || 0,
        status_atual: statusAtual,
        message: 'Limpeza concluída com sucesso'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Erro na limpeza:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

serve(handler);