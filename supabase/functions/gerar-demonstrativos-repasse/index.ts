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

    console.log(`[Repasse] ${medicos?.length || 0} médicos ativos encontrados`);

    const demonstrativos = [];

    for (const medico of medicos || []) {
      try {
        console.log(`[Repasse] Processando médico: ${medico.nome}`);

        // 2. Buscar exames do período para o médico na volumetria_mobilemed
        const { data: exames, error: examesError } = await supabase
          .from('volumetria_mobilemed')
          .select('*')
          .eq('MEDICO', medico.nome)
          .eq('periodo_referencia', periodo);

        if (examesError) throw examesError;

        console.log(`[Repasse] ${exames?.length || 0} exames encontrados para ${medico.nome}`);

        // 3. Buscar valores de repasse
        const { data: repasses, error: repasseError } = await supabase
          .from('medicos_valores_repasse')
          .select('*')
          .eq('medico_id', medico.id)
          .eq('ativo', true);

        if (repasseError) throw repasseError;

        console.log(`[Repasse] ${repasses?.length || 0} configurações de repasse para ${medico.nome}`);

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

        // Agrupar exames por arranjo (modalidade, especialidade, categoria, cliente)
        const examesAgrupados = new Map<string, any>();

        for (const exame of exames || []) {
          const clienteNome = exame.EMPRESA || 'Cliente não identificado';
          const modalidade = exame.MODALIDADE || '';
          const especialidade = exame.ESPECIALIDADE || '';
          const categoria = exame.CATEGORIA || '';
          const prioridade = exame.PRIORIDADE || '';
          const quantidade = exame.VALORES || 1;

          const chave = `${modalidade}|${especialidade}|${categoria}|${prioridade}|${clienteNome}`;
          
          if (!examesAgrupados.has(chave)) {
            examesAgrupados.set(chave, {
              modalidade,
              especialidade,
              categoria,
              prioridade,
              cliente: clienteNome,
              quantidade: 0,
              valor_unitario: 0,
              valor_total: 0
            });
          }

          const grupo = examesAgrupados.get(chave)!;
          grupo.quantidade += quantidade;
        }

        console.log(`[Repasse] ${examesAgrupados.size} grupos de exames para ${medico.nome}`);

        // Buscar valor de repasse para cada grupo
        for (const [chave, grupo] of examesAgrupados.entries()) {
          // Buscar valor mais específico possível (com cliente e categoria)
          let valorRepasse = (repasses || []).find(r =>
            r.modalidade === grupo.modalidade &&
            r.especialidade === grupo.especialidade &&
            r.categoria === grupo.categoria &&
            r.prioridade === grupo.prioridade &&
            r.cliente_id != null
          );

          // Se não encontrar com cliente, buscar sem cliente mas com categoria
          if (!valorRepasse) {
            valorRepasse = (repasses || []).find(r =>
              r.modalidade === grupo.modalidade &&
              r.especialidade === grupo.especialidade &&
              r.categoria === grupo.categoria &&
              r.prioridade === grupo.prioridade &&
              r.cliente_id == null
            );
          }

          // Se não encontrar com categoria, buscar sem categoria
          if (!valorRepasse) {
            valorRepasse = (repasses || []).find(r =>
              r.modalidade === grupo.modalidade &&
              r.especialidade === grupo.especialidade &&
              r.prioridade === grupo.prioridade &&
              !r.categoria &&
              r.cliente_id == null
            );
          }

          grupo.valor_unitario = valorRepasse?.valor || 0;
          grupo.valor_total = grupo.quantidade * grupo.valor_unitario;
          valorTotalExames += grupo.valor_total;

          detalhesExames.push(grupo);
        }

        console.log(`[Repasse] Valor total exames: R$ ${valorTotalExames}`);

        // Calcular total de adicionais
        const valorAdicionais = (adicionais || []).reduce((sum, a) => sum + (Number(a.valor_adicional) || 0), 0);

        const totalExames = (exames || []).reduce((sum, e) => sum + (e.VALORES || 1), 0);

        console.log(`[Repasse] Total laudos: ${totalExames}, Adicionais: R$ ${valorAdicionais}`);

        const demonstrativo = {
          medico_id: medico.id,
          medico_nome: medico.nome,
          medico_crm: medico.crm || '',
          medico_cpf: medico.cpf || '',
          total_laudos: totalExames,
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
