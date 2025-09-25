// @ts-nocheck
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
    
    if (!periodo) {
      throw new Error('Período é obrigatório');
    }

    // Limitar a 20 clientes por vez para evitar timeout
    let clientesQuery = supabase
      .from('clientes')
      .select(`
        id,
        nome,
        nome_fantasia,
        nome_mobilemed,
        parametros_faturamento(
          aplicar_franquia,
          valor_franquia,
          volume_franquia,
          valor_integracao,
          portal_laudos,
          impostos_ab_min,
          percentual_iss,
          simples
        ),
        contratos_clientes(
          tipo_faturamento
        )
      `)
      .eq('ativo', true)
      .limit(20);

    if (Array.isArray(clientesFiltro) && clientesFiltro.length > 0) {
      const looksUuid = typeof clientesFiltro[0] === 'string' && /[0-9a-fA-F-]{36}/.test(clientesFiltro[0]);
      if (looksUuid) {
        clientesQuery = clientesQuery.in('id', clientesFiltro);
      } else {
        clientesQuery = clientesQuery.in('nome', clientesFiltro);
      }
    }

    const { data: clientes, error: clientesError } = await clientesQuery.order('nome');

    if (clientesError) {
      throw clientesError;
    }

    if (!clientes || clientes.length === 0) {
      throw new Error('Nenhum cliente ativo encontrado');
    }

    // Buscar TODOS os preços de uma vez para os clientes selecionados
    const clienteIds = clientes.map(c => c.id);
    const { data: todosPrecos } = await supabase
      .from('precos_servicos')
      .select('cliente_id, modalidade, especialidade, categoria, prioridade, valor_base, valor_urgencia, volume_inicial, volume_final, considera_prioridade_plantao')
      .in('cliente_id', clienteIds)
      .eq('ativo', true);

    // Indexar preços por cliente para acesso rápido
    const precosPorCliente: Record<string, any[]> = {};
    if (todosPrecos) {
      for (const preco of todosPrecos) {
        if (!precosPorCliente[preco.cliente_id]) {
          precosPorCliente[preco.cliente_id] = [];
        }
        precosPorCliente[preco.cliente_id].push(preco);
      }
    }

    // Buscar volumetria em LOTE para TODOS os clientes
    const todosNomes = clientes.flatMap(c => [
      c.nome,
      c.nome_fantasia || c.nome,
      c.nome_mobilemed || c.nome
    ].filter(Boolean));

    const inList = todosNomes.map((n: string) => `"${n}"`).join(',');
    const orFilter = `"EMPRESA".in.(${inList}),"Cliente_Nome_Fantasia".in.(${inList})`;
    
    const { data: todasVolumetrias } = await supabase
      .from('volumetria_mobilemed')
      .select('EMPRESA, "Cliente_Nome_Fantasia", MODALIDADE, ESPECIALIDADE, CATEGORIA, PRIORIDADE, VALORES, tipo_faturamento')
      .eq('periodo_referencia', periodo)
      .or(orFilter);

    const demonstrativos: DemonstrativoCliente[] = [];

    const norm = (s: string) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

    // Função otimizada para selecionar preço
    const selecionarPreco = (precosCliente: any[], modalidade: string, especialidade: string, categoria: string, prioridade: string, volume: number) => {
      if (!precosCliente || precosCliente.length === 0) {
        return { unit: 0, faixa: '', det: { motivo: 'sem_precos_cliente' } };
      }

      const modalidadeN = norm(modalidade);
      const especialidadeN = norm(especialidade);
      const categoriaN = norm(categoria || 'SC') || 'SC';
      const prioridadeN = norm(prioridade || '');

      // Match por MEC
      let candidatos = precosCliente.filter((p: any) =>
        norm(p.modalidade) === modalidadeN &&
        norm(p.especialidade) === especialidadeN &&
        norm((p.categoria || 'SC')) === categoriaN
      );

      if (candidatos.length === 0) return { unit: 0, faixa: '', det: { motivo: 'sem_match_mec' } };

      // Priorizar match exato de prioridade
      const candidatosPrioridade = candidatos.filter((p: any) => norm(p.prioridade) === prioridadeN);
      if (candidatosPrioridade.length > 0) candidatos = candidatosPrioridade;

      // Filtrar por faixa de volume
      let dentroFaixa = candidatos.filter((p: any) =>
        (p.volume_inicial == null || p.volume_inicial <= volume) &&
        (p.volume_final == null || p.volume_final >= volume)
      );

      if (dentroFaixa.length === 0) {
        const abaixo = candidatos.filter((p: any) => p.volume_inicial == null || p.volume_inicial <= volume);
        if (abaixo.length > 0) {
          dentroFaixa = [abaixo.reduce((best: any, cur: any) =>
            ((best.volume_inicial ?? -Infinity) <= (cur.volume_inicial ?? -Infinity) ? cur : best)
          )];
        }
      }

      if (dentroFaixa.length === 0) {
        return { unit: 0, faixa: '', det: { motivo: 'sem_match_volume' } };
      }

      const escolhido = dentroFaixa.length > 1
        ? dentroFaixa.reduce((best: any, cur: any) => ((best.volume_inicial ?? -Infinity) <= (cur.volume_inicial ?? -Infinity) ? cur : best))
        : dentroFaixa[0];

      const prioridadeUrg = prioridadeN === 'URGENCIA' || prioridadeN === 'URGÊNCIA' || prioridadeN === 'URG' || prioridadeN === 'PLANTAO' || prioridadeN === 'PLANTÃO';
      const unit = (prioridadeUrg || (escolhido.considera_prioridade_plantao ?? false))
        ? (escolhido.valor_urgencia ?? escolhido.valor_base ?? 0)
        : (escolhido.valor_base ?? 0);
      const faixa = `${escolhido.volume_inicial ?? 0}-${escolhido.volume_final ?? '∞'}`;
      
      return { unit, faixa, det: {} };
    };

    for (const cliente of clientes) {
      const parametros = cliente.parametros_faturamento?.[0];
      const contrato = cliente.contratos_clientes?.[0];
      const tipoFaturamento = contrato?.tipo_faturamento || 'CO-FT';

      // Buscar volumetria deste cliente na lista carregada
      const nomesBusca = [
        cliente.nome,
        cliente.nome_fantasia || cliente.nome,
        cliente.nome_mobilemed || cliente.nome
      ].filter(Boolean);

      let volumetria = todasVolumetrias?.filter(vol => {
        const empresa = vol.EMPRESA || '';
        const clienteFantasia = vol["Cliente_Nome_Fantasia"] || '';
        return nomesBusca.some(nome => 
          empresa.includes(nome) || clienteFantasia.includes(nome) ||
          nome.includes(empresa) || nome.includes(clienteFantasia)
        );
      }) || [];

      // Aplicar agrupamentos específicos se necessário
      if (volumetria.length === 0) {
        const nomeFantasia = cliente.nome_fantasia || cliente.nome;
        let padroesBusca: string[] = [];
        
        if (nomeFantasia === 'PRN') {
          padroesBusca = ['PRN'];
        } else if (['CEDIDIAG', 'CEDI-RJ', 'CEDI-RO', 'CEDI_RJ', 'CEDI_RO', 'CEDI_RX'].includes(nomeFantasia)) {
          padroesBusca = ['CEDI'];
        } else if (nomeFantasia === 'C.BITTENCOURT') {
          padroesBusca = ['C.BITTENCOURT', 'C_BITTENCOURT', 'C-BITTENCOURT', 'CBITTENCOURT'];
        } else if (nomeFantasia === 'CBU') {
          padroesBusca = ['CBU', 'C_BU', 'C-BU'];
        } else if (nomeFantasia === 'CDATUCURUI' || nomeFantasia === 'CDA TUCURUI') {
          padroesBusca = ['CDATUCURUI', 'CDA_TUCURUI', 'CDA-TUCURUI', 'CDA TUCURUI'];
        }
        
        if (padroesBusca.length > 0) {
          volumetria = todasVolumetrias?.filter(vol => {
            const empresa = vol.EMPRESA || '';
            return padroesBusca.some(padrao => empresa.includes(padrao));
          }) || [];
        }
      }

      // Filtro específico CEDIDIAG
      if ((cliente.nome_fantasia || cliente.nome) === 'CEDIDIAG') {
        volumetria = volumetria.filter(vol => {
          const especialidade = (vol.ESPECIALIDADE || '').toString().toUpperCase();
          const medico = (vol.MEDICO || '').toString();
          const isMedicinaInterna = especialidade.includes('MEDICINA INTERNA');
          const isExcludedDoctor = medico.includes('Rodrigo Vaz') || medico.includes('Rodrigo Lima');
          return isMedicinaInterna && !isExcludedDoctor;
        });
      }

      // Contar exames excluindo NC-NF
      let totalExames = 0;
      for (const vol of volumetria) {
        if (vol.tipo_faturamento !== 'NC-NF') {
          totalExames += vol.VALORES || 0;
        }
      }

      // Calcular valores dos exames
      let valorExamesCalculado = 0;
      const detalhesExames = [];
      const precosCliente = precosPorCliente[cliente.id] || [];

      // Agrupar volumetria
      const gruposExames: Record<string, { modalidade: string; especialidade: string; categoria: string; prioridade: string; quantidade: number }> = {};
      
      for (const vol of volumetria) {
        if (vol.tipo_faturamento === 'NC-NF') continue;
        
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
        const { unit } = selecionarPreco(precosCliente, grupo.modalidade, grupo.especialidade, grupo.categoria, grupo.prioridade, grupo.quantidade);
        const valorTotalGrupo = unit * grupo.quantidade;
        valorExamesCalculado += valorTotalGrupo;

        detalhesExames.push({
          modalidade: grupo.modalidade,
          especialidade: grupo.especialidade,
          categoria: grupo.categoria,
          prioridade: grupo.prioridade,
          quantidade: grupo.quantidade,
          valor_unitario: unit,
          valor_total: valorTotalGrupo,
          status: unit > 0 ? 'com_preco' : 'sem_preco'
        });
      }

      // Calcular faturamento completo
      const { data: calculoCompleto } = await supabase.rpc('calcular_faturamento_completo', {
        p_cliente_id: cliente.id,
        p_periodo: periodo,
        p_volume_total: totalExames
      });

      let valorFranquia = 0;
      let valorPortalLaudos = 0;
      let valorIntegracao = 0;
      let detalhesFranquia = {};

      if (calculoCompleto && calculoCompleto.length > 0) {
        const calculo = calculoCompleto[0];
        valorFranquia = Number(calculo.valor_franquia || 0);
        valorPortalLaudos = Number(calculo.valor_portal_laudos || 0);
        valorIntegracao = Number(calculo.valor_integracao || 0);
        detalhesFranquia = calculo.detalhes_franquia || {};
      }

      // Calcular impostos
      const valorBruto = valorExamesCalculado + valorFranquia + valorPortalLaudos + valorIntegracao;
      let valorISS = 0;
      let valorIRRF = 0;

      if (parametros) {
        if (parametros.simples && parametros.impostos_ab_min) {
          valorISS = Math.max(valorBruto * (parametros.percentual_iss / 100 || 0), parametros.impostos_ab_min);
        } else if (parametros.percentual_iss) {
          valorISS = valorBruto * (parametros.percentual_iss / 100);
        }
        valorIRRF = valorBruto * 0.015;
      }

      const valorTotal = valorBruto + valorISS + valorIRRF;

      // Incluir demonstrativo se houver volumetria ou valor > 0
      if (totalExames > 0 || valorTotal > 0) {
        demonstrativos.push({
          cliente_id: cliente.id,
          cliente_nome: cliente.nome_fantasia || cliente.nome,
          periodo,
          total_exames: totalExames,
          valor_exames: valorExamesCalculado,
          valor_franquia: valorFranquia,
          valor_portal_laudos: valorPortalLaudos,
          valor_integracao: valorIntegracao,
          valor_bruto: valorBruto,
          valor_impostos: valorISS + valorIRRF,
          valor_total: valorTotal,
          detalhes_franquia: detalhesFranquia,
          detalhes_exames: detalhesExames,
          detalhes_tributacao: {
            simples_nacional: parametros?.simples || false,
            percentual_iss: parametros?.percentual_iss,
            valor_iss: valorISS,
            base_calculo: valorBruto,
            impostos_ab_min: parametros?.impostos_ab_min || 0,
            irrf: valorIRRF
          },
          tipo_faturamento: tipoFaturamento
        });
      }
    }

    // Calcular resumo
    const resumo = {
      clientes_processados: demonstrativos.length,
      total_clientes_processados: demonstrativos.length,
      periodo,
      total_exames_geral: demonstrativos.reduce((acc, dem) => acc + (dem.total_exames || 0), 0),
      valor_exames_geral: demonstrativos.reduce((acc, dem) => acc + (dem.valor_exames || 0), 0),
      valor_franquias_geral: demonstrativos.reduce((acc, dem) => acc + (dem.valor_franquia || 0), 0),
      valor_portal_geral: demonstrativos.reduce((acc, dem) => acc + (dem.valor_portal_laudos || 0), 0),
      valor_integracao_geral: demonstrativos.reduce((acc, dem) => acc + (dem.valor_integracao || 0), 0),
      valor_bruto_geral: demonstrativos.reduce((acc, dem) => acc + (dem.valor_bruto || 0), 0),
      valor_impostos_geral: demonstrativos.reduce((acc, dem) => acc + (dem.valor_impostos || 0), 0),
      valor_total_geral: demonstrativos.reduce((acc, dem) => acc + (dem.valor_total || 0), 0),
      clientes_simples_nacional: demonstrativos.filter(dem => dem.detalhes_tributacao?.simples_nacional).length,
      clientes_regime_normal: demonstrativos.filter(dem => !dem.detalhes_tributacao?.simples_nacional).length
    };

    return new Response(
      JSON.stringify({
        success: true,
        demonstrativos,
        resumo
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
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