import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import { corsHeaders } from "../_shared/cors.ts";

interface DemonstrativoCliente {
  cliente_id: string;
  cliente_nome: string;
  periodo: string;
  total_exames: number;
  valor_exames: number;
  valor_franquia: number;
  valor_portal_laudos: number;
  valor_integracao: number;
  valor_bruto: number;
  valor_impostos: number;
  valor_total: number;
  detalhes_franquia: any;
  detalhes_exames: any[];
  detalhes_tributacao: any;
  tipo_faturamento?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { periodo, clientes: clientesFiltro } = await req.json();
    console.log('Período recebido:', periodo);
    
    if (!periodo) {
      throw new Error('Período é obrigatório');
    }

    // Buscar clientes ativos
    const { data: clientes, error: clientesError } = await supabase
      .from('clientes')
      .select(`
        id,
        nome,
        nome_fantasia,
        nome_mobilemed,
        ativo,
        parametros_faturamento(
          status,
          tipo_faturamento
        )
      `)
      .eq('ativo', true)
      .order('nome');

    if (clientesError) {
      throw new Error(`Erro ao buscar clientes: ${clientesError.message}`);
    }

    console.log(`Total de clientes ativos: ${clientes?.length || 0}`);

    // Aplicar filtro opcional de clientes
    const clientesProcessar = (clientesFiltro && Array.isArray(clientesFiltro) && clientesFiltro.length > 0)
      ? (clientes || []).filter((c: any) => {
          const nomes = [c.nome, c.nome_fantasia, c.nome_mobilemed]
            .filter(Boolean)
            .map((n: string) => n.trim());
          return clientesFiltro.some((f: string) => nomes.includes(f));
        })
      : (clientes || []);

    const demonstrativos: DemonstrativoCliente[] = [];

    for (const cliente of clientesProcessar) {
      console.log(`Processando cliente: ${cliente.nome_fantasia || cliente.nome}`);

      // Buscar parâmetros ativos
      const paramList = Array.isArray(cliente.parametros_faturamento)
        ? cliente.parametros_faturamento
        : (cliente.parametros_faturamento ? [cliente.parametros_faturamento] : []);
      const parametroAtivo = paramList.find((p: any) => p && p.status === 'A');
      const tipoFaturamento = parametroAtivo?.tipo_faturamento || 'CO-FT';

      // Pular clientes NC-NF
      if (tipoFaturamento === 'NC-NF') {
        console.log(`Pulando cliente NC-NF: ${cliente.nome}`);
        continue;
      }

      // Buscar volumetria do cliente
      const nomesBusca = [cliente.nome, cliente.nome_fantasia, cliente.nome_mobilemed]
        .filter(Boolean)
        .map(n => n?.trim())
        .filter(n => n && n.length > 0);

      let { data: volumetria } = await supabase
        .from('volumetria_mobilemed')
        .select('*')
        .eq('periodo_referencia', periodo)
        .in('"EMPRESA"', nomesBusca);

      if (!volumetria || volumetria.length === 0) {
        const { data: volumetriaAlt } = await supabase
          .from('volumetria_mobilemed')
          .select('*')
          .eq('periodo_referencia', periodo)
          .in('"Cliente_Nome_Fantasia"', nomesBusca);
        if (!volumetriaAlt || volumetriaAlt.length === 0) {
          console.log(`Sem volumetria para ${cliente.nome} nas chaves:`, nomesBusca);
          continue;
        }
        volumetria = volumetriaAlt;
      }

      console.log(`Encontrada volumetria: ${volumetria.length} registros`);

      // Contar exames totais
      let totalExames = 0;
      for (const vol of volumetria) {
        totalExames += vol.VALORES || 0;
      }

      // Calcular valores dos exames usando preços do banco
      let valorExamesCalculado = 0;
      const detalhesExames = [];

      // Agrupar volumetria por modalidade/especialidade/categoria/prioridade
      const gruposExames: Record<string, { modalidade: string; especialidade: string; categoria: string; prioridade: string; quantidade: number }> = {};
      
      for (const vol of volumetria) {
        const modalidade = (vol.MODALIDADE || '').toString();
        const especialidade = (vol.ESPECIALIDADE || '').toString();
        const categoria = (vol.CATEGORIA || 'SC').toString();
        const prioridade = (vol.PRIORIDADE || '').toString();
        const key = `${modalidade}|${especialidade}|${categoria}|${prioridade}`;
        const qtd = Number(vol.VALORES || 0) || 0;
        
        if (!gruposExames[key]) {
          gruposExames[key] = { modalidade, especialidade, categoria, prioridade, quantidade: 0 };
        }
        gruposExames[key].quantidade += qtd;
      }

      // Calcular preços para cada grupo
      for (const [key, grupo] of Object.entries(gruposExames)) {
        try {
          const { data: preco, error } = await supabase.rpc('calcular_preco_exame', {
            p_cliente_id: cliente.id,
            p_modalidade: grupo.modalidade,
            p_especialidade: grupo.especialidade,
            p_prioridade: grupo.prioridade,
            p_categoria: grupo.categoria,
            p_volume_total: grupo.quantidade,
            p_is_plantao: grupo.prioridade.includes('PLANTAO') || grupo.prioridade.includes('PLANTÃO'),
          });
          
          const precoUnitario = Number(preco || 0);
          const valorTotal = precoUnitario * grupo.quantidade;
          valorExamesCalculado += valorTotal;
          
          if (valorTotal > 0) {
            detalhesExames.push({
              modalidade: grupo.modalidade,
              especialidade: grupo.especialidade,
              categoria: grupo.categoria,
              prioridade: grupo.prioridade,
              quantidade: grupo.quantidade,
              valor_unitario: precoUnitario,
              valor_total: valorTotal
            });
          }
        } catch (error) {
          console.error(`Erro ao calcular preço para ${key}:`, error);
        }
      }

      // Buscar parâmetros de faturamento para calcular franquia, portal e integração
      const { data: parametros } = await supabase
        .from('parametros_faturamento')
        .select('*')
        .eq('cliente_id', cliente.id)
        .eq('status', 'A')
        .maybeSingle();

      let valorFranquia = 0;
      let valorPortal = 0;
      let valorIntegracao = 0;

      if (parametros) {
        // Calcular franquia
        if (parametros.aplicar_franquia) {
          if (parametros.frequencia_continua) {
            valorFranquia = parametros.frequencia_por_volume && totalExames > (parametros.volume_franquia || 0)
              ? (parametros.valor_acima_franquia || parametros.valor_franquia || 0)
              : (parametros.valor_franquia || 0);
          } else if (totalExames > 0) {
            valorFranquia = parametros.frequencia_por_volume && totalExames > (parametros.volume_franquia || 0)
              ? (parametros.valor_acima_franquia || parametros.valor_franquia || 0)
              : (parametros.valor_franquia || 0);
          }
        }

        // Calcular portal de laudos
        if (parametros.portal_laudos) {
          valorPortal = parametros.valor_integracao || 0;
        }

        // Calcular integração
        if (parametros.cobrar_integracao) {
          valorIntegracao = parametros.valor_integracao || 0;
        }
      }

      const valorBruto = valorExamesCalculado + valorFranquia + valorPortal + valorIntegracao;
      const valorImpostos = valorBruto * 0.0615; // 6.15% de impostos
      const valorTotal = valorBruto - valorImpostos;

      // Criar demonstrativo com valores calculados
      const demonstrativo: DemonstrativoCliente = {
        cliente_id: cliente.id,
        cliente_nome: cliente.nome_fantasia || cliente.nome,
        periodo,
        total_exames: totalExames,
        valor_exames: valorExamesCalculado,
        valor_franquia: valorFranquia,
        valor_portal_laudos: valorPortal,
        valor_integracao: valorIntegracao,
        valor_bruto: valorBruto,
        valor_impostos: valorImpostos,
        valor_total: valorTotal,
        detalhes_franquia: {
          aplicar: parametros?.aplicar_franquia || false,
          valor_base: parametros?.valor_franquia || 0,
          frequencia_continua: parametros?.frequencia_continua || false
        },
        detalhes_exames: detalhesExames,
        detalhes_tributacao: {
          percentual_total: 6.15,
          pis: valorBruto * 0.0065,
          cofins: valorBruto * 0.03,
          csll: valorBruto * 0.01,
          irrf: valorBruto * 0.015
        },
        tipo_faturamento: tipoFaturamento
      };

      demonstrativos.push(demonstrativo);
      console.log(`Demonstrativo criado para ${cliente.nome}: ${totalExames} exames, R$ ${valorTotal.toFixed(2)}`);
    }

    console.log(`Total de demonstrativos gerados: ${demonstrativos.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        demonstrativos,
        resumo: {
          clientes_processados: demonstrativos.length,
          total_clientes_processados: demonstrativos.length,
          periodo
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Erro na geração de demonstrativos:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Erro ao gerar demonstrativos de faturamento'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});