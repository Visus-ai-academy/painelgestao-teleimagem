// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AuditoriaItem {
  cliente_id?: string;
  cliente_nome?: string;
  nome_fantasia?: string;
  nome_mobilemed?: string;
  periodo: string;
  volumes: {
    total_exames: number;
  };
  parametros?: any;
  demonstrativo?: any;
  franquia_calculada_preview: {
    valor_esperado: number;
    regra: string;
  };
  conformidade: {
    ok: boolean;
    motivo?: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { periodo, clientes } = await req.json();
    if (!periodo) {
      return new Response(
        JSON.stringify({ error: "Parâmetro 'periodo' é obrigatório (YYYY-MM)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Buscar clientes ativos com parâmetros + contrato básico
    let clientesQuery = supabase
      .from("clientes")
      .select(
        `id, nome, nome_fantasia, nome_mobilemed, ativo,
         parametros_faturamento(
           id, aplicar_franquia, valor_franquia, volume_franquia, frequencia_continua,
           frequencia_por_volume, valor_acima_franquia, valor_integracao, portal_laudos,
           cobrar_integracao, impostos_ab_min, percentual_iss, simples, updated_at
         ),
         contratos_clientes(tipo_faturamento)`
      )
      .eq("ativo", true);

    if (Array.isArray(clientes) && clientes.length > 0) {
      clientesQuery = clientesQuery.in("nome", clientes);
    }

    const { data: listaClientes, error: clientesError } = await clientesQuery.order("nome");
    if (clientesError) throw clientesError;

    const resultados: AuditoriaItem[] = [];

    for (const cliente of (listaClientes || [])) {
      const nomeFantasia = cliente.nome_fantasia || cliente.nome;
      const aliasSet = new Set<string>([
        cliente.nome?.trim(),
        cliente.nome_fantasia?.trim() || cliente.nome?.trim(),
        cliente.nome_mobilemed?.trim() || cliente.nome?.trim(),
      ].filter(Boolean) as string[]);

      // Buscar volumetria do período (mesmo critério do gerador)
      const { data: volEmp } = await supabase
        .from('volumetria_mobilemed')
        .select('id, EMPRESA, Cliente_Nome_Fantasia, VALORES, ESPECIALIDADE, MEDICO')
        .eq('periodo_referencia', periodo)
        .in('EMPRESA', Array.from(aliasSet));

      const fantasiaBusca = cliente.nome_fantasia ? [cliente.nome_fantasia] : [];
      const { data: volFant } = fantasiaBusca.length > 0
        ? await supabase
            .from('volumetria_mobilemed')
            .select('id, EMPRESA, Cliente_Nome_Fantasia, VALORES, ESPECIALIDADE, MEDICO')
            .eq('periodo_referencia', periodo)
            .in('Cliente_Nome_Fantasia', fantasiaBusca)
        : { data: [] } as any;

      const volMap = new Map<string, any>();
      [...(volEmp || []), ...(volFant || [])].forEach((v) => {
        const k = v.id ? v.id.toString() : `${v.EMPRESA}_${v.Cliente_Nome_Fantasia}_${Math.random()}`;
        volMap.set(k, v);
      });
      let volumetria = Array.from(volMap.values());

      // Regras específicas (ex.: CEDIDIAG)
      const nomeUpper = (nomeFantasia || '').toUpperCase();
      if (nomeUpper === 'CEDIDIAG' && volumetria.length > 0) {
        volumetria = volumetria.filter((vol) => {
          const esp = (vol.ESPECIALIDADE || '').toString().toUpperCase();
          const medico = (vol.MEDICO || '').toString();
          const isMedicinaInterna = esp.includes('MEDICINA INTERNA');
          const isExcludedDoctor = medico.includes('Rodrigo Vaz') || medico.includes('Rodrigo Lima');
          return isMedicinaInterna && !isExcludedDoctor;
        });
      }

      // Total de exames
      const totalExames = volumetria.reduce((acc, v) => acc + (Number(v.VALORES) || 0), 0);

      // Demonstrativo salvo
      const { data: demo } = await supabase
        .from('demonstrativos_faturamento_calculados')
        .select('cliente_id, cliente_nome, valor_franquia, detalhes_franquia, parametros_utilizados')
        .eq('periodo_referencia', periodo)
        .or(`cliente_id.eq.${cliente.id},cliente_nome.eq.${nomeFantasia}`)
        .order('created_at', { ascending: false })
        .limit(1);

      const demonstrativo = demo && demo.length > 0 ? demo[0] : null;

      // Parametrização vigente
      const parametros = (cliente.parametros_faturamento || [])[0] || null;

      // Pré-cálculo de franquia (replicando a regra principal)
      let valorFranquiaPrev = 0;
      let regra = 'nao_aplica';
      if (parametros?.aplicar_franquia) {
        const volumeFranquia = Number(parametros.volume_franquia || 0);
        const valorFranquiaBase = Number(parametros.valor_franquia || 0);
        const valorAcimaFranquia = Number(parametros.valor_acima_franquia || 0);
        const frequenciaContinua = parametros.frequencia_continua === true;
        const frequenciaPorVolume = parametros.frequencia_por_volume === true; // default explícito

        if (frequenciaContinua) {
          if (frequenciaPorVolume) {
            if (totalExames < volumeFranquia) {
              valorFranquiaPrev = valorFranquiaBase;
              regra = 'continua_sim_volume_sim_abaixo';
            } else {
              valorFranquiaPrev = valorAcimaFranquia > 0 ? valorAcimaFranquia : 0;
              regra = valorAcimaFranquia > 0 ? 'continua_sim_volume_sim_acima' : 'continua_sim_volume_sim_acima_sem_valor';
            }
          } else {
            valorFranquiaPrev = valorFranquiaBase;
            regra = 'continua_sim_volume_nao';
          }
        } else {
          if (frequenciaPorVolume) {
            if (totalExames < volumeFranquia) {
              valorFranquiaPrev = valorFranquiaBase;
              regra = 'continua_nao_volume_sim_abaixo';
            } else {
              valorFranquiaPrev = 0;
              regra = 'continua_nao_volume_sim_acima';
            }
          } else {
            if (totalExames < volumeFranquia) {
              valorFranquiaPrev = valorFranquiaBase;
              regra = 'continua_nao_volume_nao_abaixo';
            } else {
              valorFranquiaPrev = 0;
              regra = 'continua_nao_volume_nao_acima';
            }
          }
        }
      }

      const valorDemo = Number(demonstrativo?.valor_franquia || 0);
      const ok = valorDemo === valorFranquiaPrev;

      resultados.push({
        cliente_id: cliente.id,
        cliente_nome: cliente.nome,
        nome_fantasia: nomeFantasia,
        nome_mobilemed: cliente.nome_mobilemed,
        periodo,
        volumes: { total_exames: totalExames },
        parametros,
        demonstrativo,
        franquia_calculada_preview: {
          valor_esperado: valorFranquiaPrev,
          regra,
        },
        conformidade: {
          ok,
          motivo: ok ? undefined : `Divergência: demonstrativo=${valorDemo} x esperado=${valorFranquiaPrev}`,
        },
      });
    }

    return new Response(JSON.stringify({ periodo, total_clientes: resultados.length, resultados }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error('Erro auditoria franquias:', e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
