import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { medico_id, periodo } = await req.json();

    if (!medico_id || !periodo) {
      throw new Error('Médico ID e período são obrigatórios');
    }

    console.log('[Repasse] Gerando relatório para médico:', medico_id, 'período:', periodo);

    // Buscar status do demonstrativo
    const { data: status, error: statusError } = await supabase
      .from('relatorios_repasse_status')
      .select('*')
      .eq('medico_id', medico_id)
      .eq('periodo', periodo)
      .single();

    if (statusError || !status) {
      throw new Error('Demonstrativo não encontrado. Gere o demonstrativo primeiro.');
    }

    // Aqui seria a lógica de geração do PDF do relatório
    // Por enquanto, vamos simular o link do relatório
    const linkRelatorio = `https://storage.supabase.co/v1/object/public/relatorios-repasse/${medico_id}_${periodo}.pdf`;

    // Atualizar status
    await supabase
      .from('relatorios_repasse_status')
      .update({
        relatorio_gerado: true,
        link_relatorio: linkRelatorio,
        data_geracao_relatorio: new Date().toISOString()
      })
      .eq('medico_id', medico_id)
      .eq('periodo', periodo);

    console.log('[Repasse] Relatório gerado com sucesso');

    return new Response(
      JSON.stringify({ 
        success: true,
        link_relatorio: linkRelatorio
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Repasse] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
