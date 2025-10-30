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

    const { medico_id_antigo, medico_id_correto } = await req.json();

    if (!medico_id_antigo || !medico_id_correto) {
      throw new Error('IDs do médico antigo e correto são obrigatórios');
    }

    console.log(`🔄 Mapeando médico duplicado...`);
    console.log(`   Antigo: ${medico_id_antigo}`);
    console.log(`   Correto: ${medico_id_correto}`);

    // 1. Atualizar todos os registros de repasse
    const { data: repasseData, error: repasseError } = await supabase
      .from('medicos_valores_repasse')
      .update({ medico_id: medico_id_correto })
      .eq('medico_id', medico_id_antigo)
      .select('id');

    if (repasseError) throw repasseError;

    const registrosAtualizados = repasseData?.length || 0;
    console.log(`✅ ${registrosAtualizados} registros de repasse atualizados`);

    // 2. Inativar o médico antigo (duplicado)
    const { error: inativarError } = await supabase
      .from('medicos')
      .update({ 
        ativo: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', medico_id_antigo);

    if (inativarError) throw inativarError;

    console.log(`✅ Médico duplicado inativado`);

    return new Response(
      JSON.stringify({ 
        success: true,
        registros_repasse_atualizados: registrosAtualizados,
        medico_duplicado_inativado: true
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error: any) {
    console.error('❌ Erro ao mapear médico duplicado:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
