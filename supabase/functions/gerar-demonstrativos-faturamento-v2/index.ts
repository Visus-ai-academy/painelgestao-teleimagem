// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Buscar TODOS os clientes ativos
    let clientesQuery = supabase
      .from('clientes')
      .select(`
        id,
        nome,
        nome_fantasia,
        nome_mobilemed,
        ativo,
        parametros_faturamento(
          id,
          aplicar_franquia,
          valor_franquia,
          volume_franquia,
          frequencia_continua,
          frequencia_por_volume,
          valor_acima_franquia,
          valor_integracao,
          portal_laudos,
          cobrar_integracao,
          impostos_ab_min,
          percentual_iss,
          simples
        ),
        contratos_clientes(
          tipo_faturamento,
          numero_contrato
        )
      `)
      .eq('ativo', true);

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

    const demonstrativos: DemonstrativoCliente[] = [];

    for (const cliente of clientes) {
      const parametros = cliente.parametros_faturamento?.[0];
      const contrato = cliente.contratos_clientes?.[0];
      const tipoFaturamento = contrato?.tipo_faturamento || 'CO-FT';

      // Buscar volumetria para este cliente no período
      const nomesBusca = [
        cliente.nome,
        cliente.nome_fantasia || cliente.nome,
        cliente.nome_mobilemed || cliente.nome
      ].filter(Boolean);

      // Buscar dados de volumetria
      let volumetria: any[] = [];
      
      // Estratégia 1: Busca por EMPRESA
      const { data: volumetriaEmpresa } = await supabase
        .from('volumetria_mobilemed')
        .select('EMPRESA, "Cliente_Nome_Fantasia", MODALIDADE, ESPECIALIDADE, CATEGORIA, PRIORIDADE, VALORES, ESTUDO_DESCRICAO, MEDICO, tipo_faturamento')
        .eq('periodo_referencia', periodo)
        .in('EMPRESA', nomesBusca);
      
      // Estratégia 2: Busca por Cliente_Nome_Fantasia
      const { data: volumetriaFantasia } = await supabase
        .from('volumetria_mobilemed')
        .select('EMPRESA, "Cliente_Nome_Fantasia", MODALIDADE, ESPECIALIDADE, CATEGORIA, PRIORIDADE, VALORES, ESTUDO_DESCRICAO, MEDICO, tipo_faturamento')
        .eq('periodo_referencia', periodo)
        .in('"Cliente_Nome_Fantasia"', nomesBusca);
      
      // Combinar resultados únicos
      const volumetriaMap = new Map();
      [...(volumetriaEmpresa || []), ...(volumetriaFantasia || [])].forEach(item => {
        const key = `${item.EMPRESA}_${item.ESTUDO_DESCRICAO || ''}_${item.VALORES}_${item.MEDICO || ''}`;
        volumetriaMap.set(key, item);
      });
      volumetria = Array.from(volumetriaMap.values());

      // Contar exames totais (apenas registros faturáveis)
      let totalExames = 0;
      for (const vol of volumetria) {
        if (vol.tipo_faturamento === 'NC-NF' || vol.tipo_faturamento === 'EXCLUSAO') {
          continue;
        }
        totalExames += vol.VALORES || 0;
      }

      // Calcular valores dos exames usando preços do banco
      let valorExamesCalculado = 0;
      const detalhesExames = [];

      // Agrupar volumetria por modalidade/especialidade/categoria/prioridade
      const gruposExames: Record<string, { modalidade: string; especialidade: string; categoria: string; prioridade: string; quantidade: number }> = {};
      
      for (const vol of volumetria) {
        if (vol.tipo_faturamento === 'NC-NF' || vol.tipo_faturamento === 'EXCLUSAO') {
          continue;
        }
        
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

      // Preparar preços do cliente
      const { data: precosCliente } = await supabase
        .from('precos_servicos')
        .select('modalidade, especialidade, categoria, prioridade, valor_base, valor_urgencia, volume_inicial, volume_final, considera_prioridade_plantao, ativo')
        .eq('cliente_id', cliente.id)
        .eq('ativo', true);

      // Calcular preços para cada grupo
      for (const [key, grupo] of Object.entries(gruposExames)) {
        let valorUnitario = 0;
        
        if (precosCliente && precosCliente.length > 0) {
          // Buscar preço correspondente
          const preco = precosCliente.find(p => 
            p.modalidade === grupo.modalidade &&
            p.especialidade === grupo.especialidade &&
            p.categoria === (grupo.categoria || 'SC') &&
            p.prioridade === grupo.prioridade
          );
          
          if (preco) {
            const isUrgencia = grupo.prioridade.includes('URGENCIA') || grupo.prioridade.includes('URGÊNCIA');
            valorUnitario = isUrgencia ? (preco.valor_urgencia || preco.valor_base || 0) : (preco.valor_base || 0);
          }
        }

        const valorTotalGrupo = valorUnitario * grupo.quantidade;
        valorExamesCalculado += valorTotalGrupo;

        detalhesExames.push({
          modalidade: grupo.modalidade,
          especialidade: grupo.especialidade,
          categoria: grupo.categoria,
          prioridade: grupo.prioridade,
          quantidade: grupo.quantidade,
          valor_unitario: valorUnitario,
          valor_total: valorTotalGrupo,
          faixa_volume: '',
          detalhes_calculo: valorUnitario > 0 ? {} : { motivo: 'sem_precos_cliente' },
          status: valorUnitario > 0 ? 'com_preco' : 'sem_preco'
        });
      }

      // Calcular faturamento completo usando função do banco
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

      // Calcular impostos baseado no contrato
      const valorBruto = valorExamesCalculado + valorFranquia + valorPortalLaudos + valorIntegracao;
      let valorISS = 0;
      let valorIRRF = 0;

      if (parametros) {
        if (parametros.simples && parametros.impostos_ab_min) {
          valorISS = Math.max(valorBruto * (parametros.percentual_iss / 100 || 0), parametros.impostos_ab_min);
        } else if (parametros.percentual_iss) {
          valorISS = valorBruto * (parametros.percentual_iss / 100);
        }
        
        valorIRRF = valorBruto * 0.015; // 1,5% padrão
      }

      const totalImpostos = valorISS + valorIRRF;
      const valorLiquido = valorBruto - totalImpostos;

      const demonstrativo: DemonstrativoCliente = {
        cliente_id: cliente.id,
        cliente_nome: cliente.nome_fantasia || cliente.nome,
        periodo,
        total_exames: totalExames,
        valor_exames: valorExamesCalculado,
        valor_franquia: valorFranquia,
        valor_portal_laudos: valorPortalLaudos,
        valor_integracao: valorIntegracao,
        valor_bruto: valorBruto,
        valor_impostos: totalImpostos,
        valor_total: valorLiquido,
        detalhes_franquia: detalhesFranquia,
        detalhes_exames: detalhesExames,
        detalhes_tributacao: {
          simples_nacional: parametros?.simples || false,
          percentual_iss: parametros?.percentual_iss,
          valor_iss: valorISS,
          valor_irrf: valorIRRF,
          base_calculo: valorBruto,
          impostos_ab_min: parametros?.impostos_ab_min || 0,
          total_impostos: totalImpostos,
          valor_liquido: valorLiquido
        },
        tipo_faturamento: tipoFaturamento
      };

      // Incluir no demonstrativo se houver volumetria (exames) OU valor líquido > 0
      if (totalExames > 0 || valorLiquido > 0) {
        demonstrativos.push(demonstrativo);
      }
    }

    // Calcular resumo completo dos demonstrativos
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
      valor_liquido_geral: demonstrativos.reduce((acc, dem) => acc + (dem.valor_total || 0), 0),
      clientes_simples_nacional: demonstrativos.filter(dem => dem.detalhes_tributacao?.simples_nacional).length,
      clientes_regime_normal: demonstrativos.filter(dem => !dem.detalhes_tributacao?.simples_nacional).length
    };

    // Salvar status de cada cliente para geração de relatórios
    for (const demonstrativo of demonstrativos) {
      try {
        await supabase
          .from('relatorios_faturamento_status')
          .upsert({
            cliente_id: demonstrativo.cliente_id,
            cliente_nome: demonstrativo.cliente_nome,
            periodo: demonstrativo.periodo,
            relatorio_gerado: false,
            email_enviado: false,
            email_destino: '', // Será preenchido pela busca dos emails do cliente
            link_relatorio: null,
            erro: null,
            erro_email: null,
            data_processamento: null,
            data_geracao_relatorio: null,
            data_envio_email: null,
            detalhes_relatorio: null
          }, {
            onConflict: 'cliente_id,periodo'
          });
      } catch (error) {
        console.error(`Erro ao salvar status do cliente ${demonstrativo.cliente_nome}:`, error);
      }
    }

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