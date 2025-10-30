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

    const { medicos_nomes } = await req.json();

    if (!medicos_nomes || !Array.isArray(medicos_nomes)) {
      throw new Error('Lista de nomes de médicos é obrigatória');
    }

    console.log(`📋 Inativando ${medicos_nomes.length} médicos...`);

    // Atualizar status para inativo
    const { data, error } = await supabase
      .from('medicos')
      .update({ 
        ativo: false,
        updated_at: new Date().toISOString()
      })
      .in('nome', medicos_nomes)
      .select('id, nome, ativo');

    if (error) throw error;

    console.log(`✅ ${data?.length || 0} médicos inativados com sucesso`);

    return new Response(
      JSON.stringify({ 
        success: true,
        medicos_inativados: data?.length || 0,
        medicos: data
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error: any) {
    console.error('❌ Erro ao inativar médicos:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
