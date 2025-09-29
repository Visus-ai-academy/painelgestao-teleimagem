import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🧹 Iniciando limpeza de médicos duplicados...');

    // Buscar duplicados por CPF
    const { data: duplicados, error: queryError } = await supabaseClient
      .from('medicos')
      .select('cpf, nome, id, created_at, crm')
      .not('cpf', 'is', null)
      .order('cpf')
      .order('created_at', { ascending: false });

    if (queryError) throw queryError;

    const cpfGroups = new Map<string, any[]>();
    
    // Agrupar por CPF
    duplicados?.forEach(medico => {
      if (!cpfGroups.has(medico.cpf)) {
        cpfGroups.set(medico.cpf, []);
      }
      cpfGroups.get(medico.cpf)!.push(medico);
    });

    let removidos = 0;
    const detalhes: any[] = [];

    // Para cada CPF com duplicados
    for (const [cpf, medicos] of cpfGroups.entries()) {
      if (medicos.length > 1) {
        // Manter o mais recente (primeiro da lista por causa do order by created_at desc)
        const manter = medicos[0];
        const remover = medicos.slice(1);

        console.log(`CPF ${cpf}: mantendo "${manter.nome}", removendo ${remover.length} duplicados`);

        for (const medico of remover) {
          const { error: deleteError } = await supabaseClient
            .from('medicos')
            .delete()
            .eq('id', medico.id);

          if (deleteError) {
            console.error('Erro ao remover:', deleteError);
          } else {
            removidos++;
            detalhes.push({
              cpf,
              mantido: manter.nome,
              removido: medico.nome
            });
          }
        }
      }
    }

    console.log(`✅ Limpeza concluída: ${removidos} registros duplicados removidos`);

    return new Response(
      JSON.stringify({
        sucesso: true,
        registros_removidos: removidos,
        detalhes,
        mensagem: `${removidos} médicos duplicados removidos com sucesso`
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('❌ ERRO:', error);
    
    return new Response(
      JSON.stringify({ 
        erro: true, 
        mensagem: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
