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
    const { nome_origem, origem, medico_id } = await req.json();

    console.log('🔄 Criando mapeamento:', { nome_origem, origem, medico_id });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar nome do médico cadastrado
    const { data: medico, error: erroMedico } = await supabase
      .from('medicos')
      .select('nome')
      .eq('id', medico_id)
      .single();

    if (erroMedico) throw erroMedico;

    // Inserir ou atualizar mapeamento
    const { error: erroMapeamento } = await supabase
      .from('mapeamento_nomes_medicos')
      .upsert({
        nome_original: nome_origem,
        nome_normalizado: medico.nome,
        medico_id: medico_id,
        origem: origem,
        ativo: true
      }, {
        onConflict: 'nome_original,origem'
      });

    if (erroMapeamento) throw erroMapeamento;

    console.log('✅ Mapeamento criado com sucesso');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Mapeamento criado com sucesso'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error: any) {
    console.error('❌ Erro ao criar mapeamento:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
