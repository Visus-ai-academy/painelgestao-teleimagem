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

    const { periodo } = await req.json();

    if (!periodo) {
      throw new Error('Período não informado');
    }

    console.log('[Repasse] Gerando demonstrativos para período:', periodo);

    // 1. Buscar médicos ativos
    const { data: medicos, error: medicosError } = await supabase
      .from('medicos')
      .select('id, nome, crm, cpf, email')
      .eq('ativo', true);

    if (medicosError) throw medicosError;

    const demonstrativos = [];

    for (const medico of medicos || []) {
      try {
        // 2. Buscar volumetria do período para o médico
        const { data: volumetria, error: volError } = await supabase
          .from('volumetria')
          .select('*')
          .eq('periodo_referencia', periodo)
          .eq('medico_nome', medico.nome);

        if (volError) throw volError;

        // 3. Buscar valores de repasse
        const { data: repasses, error: repasseError } = await supabase
          .from('repasse_medico')
          .select('*')
          .eq('medico_id', medico.id);

        if (repasseError) throw repasseError;

        // 4. Buscar valores adicionais
        const { data: adicionais, error: adicionaisError } = await supabase
          .from('medicos_valores_adicionais')
          .select('*')
          .eq('medico_id', medico.id)
          .eq('periodo', periodo);

        if (adicionaisError) throw adicionaisError;

        // 5. Calcular demonstrativo
        const detalhesExames: any[] = [];
        let valorTotalExames = 0;

        // Agrupar volumetria por arranjo (modalidade, especialidade, categoria, prioridade, cliente)
        const volumetriaAgrupada = new Map<string, any>();

        for (const vol of volumetria || []) {
          const chave = `${vol.modalidade}|${vol.especialidade}|${vol.categoria}|${vol.prioridade}|${vol.cliente_nome}`;
          
          if (!volumetriaAgrupada.has(chave)) {
            volumetriaAgrupada.set(chave, {
              modalidade: vol.modalidade,
              especialidade: vol.especialidade,
              categoria: vol.categoria,
              prioridade: vol.prioridade,
              cliente: vol.cliente_nome,
              quantidade: 0,
              valor_unitario: 0,
              valor_total: 0
            });
          }

          const grupo = volumetriaAgrupada.get(chave)!;
          grupo.quantidade += 1;
        }

        // Buscar valor de repasse para cada grupo
        for (const [chave, grupo] of volumetriaAgrupada.entries()) {
          const valorRepasse = (repasses || []).find(r =>
            r.modalidade === grupo.modalidade &&
            r.especialidade === grupo.especialidade &&
            (r.categoria === grupo.categoria || !r.categoria) &&
            (r.prioridade === grupo.prioridade || !r.prioridade) &&
            (r.cliente_nome === grupo.cliente || !r.cliente_nome)
          );

          grupo.valor_unitario = valorRepasse?.valor || 0;
          grupo.valor_total = grupo.quantidade * grupo.valor_unitario;
          valorTotalExames += grupo.valor_total;

          detalhesExames.push(grupo);
        }

        // Calcular total de adicionais
        const valorAdicionais = (adicionais || []).reduce((sum, a) => sum + (Number(a.valor_adicional) || 0), 0);

        const demonstrativo = {
          medico_id: medico.id,
          medico_nome: medico.nome,
          medico_crm: medico.crm || '',
          medico_cpf: medico.cpf || '',
          total_laudos: volumetria?.length || 0,
          valor_exames: valorTotalExames,
          valor_adicionais: valorAdicionais,
          valor_total: valorTotalExames + valorAdicionais,
          detalhes_exames: detalhesExames,
          adicionais: (adicionais || []).map(a => ({
            data: a.data_adicional,
            valor: a.valor_adicional,
            descricao: a.descricao
          }))
        };

        demonstrativos.push(demonstrativo);

        // 6. Atualizar status
        await supabase
          .from('relatorios_repasse_status')
          .upsert({
            medico_id: medico.id,
            medico_nome: medico.nome,
            periodo: periodo,
            demonstrativo_gerado: true,
            email_destino: medico.email,
            detalhes_relatorio: demonstrativo
          }, {
            onConflict: 'medico_id,periodo'
          });

      } catch (error) {
        console.error(`[Repasse] Erro ao processar médico ${medico.nome}:`, error);
        
        await supabase
          .from('relatorios_repasse_status')
          .upsert({
            medico_id: medico.id,
            medico_nome: medico.nome,
            periodo: periodo,
            demonstrativo_gerado: false,
            erro: `Erro ao calcular: ${error.message}`
          }, {
            onConflict: 'medico_id,periodo'
          });
      }
    }

    console.log(`[Repasse] ${demonstrativos.length} demonstrativos gerados`);

    return new Response(
      JSON.stringify({ 
        success: true,
        demonstrativos,
        total: demonstrativos.length
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
