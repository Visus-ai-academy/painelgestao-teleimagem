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

    // Buscar TODOS os clientes ativos (processamento completo em uma única chamada)
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

      // Busca única por nomes com múltiplas estratégias
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

      // Estratégia 3: Para clientes específicos, fazer busca por padrão (agrupamento)
      const nomeFantasia = cliente.nome_fantasia || cliente.nome;
      
      if ((!volumetria || volumetria.length === 0)) {
        let padroesBusca: string[] = [];
        
        // Agrupamento específico por padrão - TODAS as regras mantidas
        if (nomeFantasia === 'PRN') {
          padroesBusca = ['PRN%'];
        } else if (['CEDIDIAG', 'CEDI-RJ', 'CEDI-RO', 'CEDI_RJ', 'CEDI_RO', 'CEDI_RX'].includes(nomeFantasia)) {
          padroesBusca = ['CEDI%'];
        }
        // Agrupamentos por sufixos comuns  
        else if (nomeFantasia === 'CDI_HCMINEIROS') {
          padroesBusca = ['CDI_HCMINEIROS%'];
        } else if (nomeFantasia === 'CDMINEIROS') {
          padroesBusca = ['CDMINEIROS%'];
        } else if (nomeFantasia === 'GDI') {
          padroesBusca = ['GDI%'];
        } else if (nomeFantasia === 'RADIOCOR') {
          padroesBusca = ['RADIOCOR%', 'NL_RADIOCOR%'];
        } else if (nomeFantasia === 'NL_RADIOCOR') {
          padroesBusca = ['NL_RADIOCOR%'];
        } else if (nomeFantasia === 'INTERCOR') {
          padroesBusca = ['INTERCOR%'];
        } else if (nomeFantasia === 'RMPADUA') {
          padroesBusca = ['PADUA%'];
        } else if (nomeFantasia === 'VIVERCLIN') {
          padroesBusca = ['VIVERCLIN%'];
        } else if (nomeFantasia === 'C.BITTENCOURT') {
          padroesBusca = ['C.BITTENCOURT%', 'C_BITTENCOURT%', 'C-BITTENCOURT%', 'CBITTENCOURT%'];
        } else if (nomeFantasia === 'CBU') {
          padroesBusca = ['CBU%', 'C_BU%', 'C-BU%'];
        } else if (nomeFantasia === 'CDATUCURUI' || nomeFantasia === 'CDA TUCURUI') {
          padroesBusca = ['CDATUCURUI%', 'CDA_TUCURUI%', 'CDA-TUCURUI%', 'CDA TUCURUI%'];
        }
        // Agrupamento genérico: se nome_fantasia é diferente do nome, buscar variações
        else if (cliente.nome_fantasia && cliente.nome_fantasia !== cliente.nome) {
          // Tentar buscar variações do nome fantasia
          padroesBusca = [
            `${nomeFantasia}%`, 
            `${nomeFantasia}_%`, 
            `${nomeFantasia}-%`
          ];
        }
        
        if (padroesBusca.length > 0) {
          for (const padrao of padroesBusca) {
            const { data: volumetriaAgrupada } = await supabase
              .from('volumetria_mobilemed')
              .select('*')
              .eq('periodo_referencia', periodo)
              .like('"EMPRESA"', padrao);
            
            if (volumetriaAgrupada && volumetriaAgrupada.length > 0) {
              volumetria = (volumetria || []).concat(volumetriaAgrupada);
            }
          }
        }
      }

      // REGRA ESPECÍFICA CEDIDIAG: apenas Medicina Interna, excluindo médico específico
      if (nomeFantasia === 'CEDIDIAG' && volumetria && volumetria.length > 0) {
        volumetria = volumetria.filter(vol => {
          const especialidade = (vol.ESPECIALIDADE || '').toString().toUpperCase();
          const medico = (vol.MEDICO || '').toString();
          
          // Apenas Medicina Interna
          const isMedicinaInterna = especialidade.includes('MEDICINA INTERNA') || especialidade.includes('MEDICINA_INTERNA');
          
          // Excluir Dr. Rodrigo Vaz Lima (verificar variações do nome)
          const isExcludedDoctor = medico.includes('Rodrigo Vaz') || medico.includes('Rodrigo Lima') || 
                                  medico.includes('RODRIGO VAZ') || medico.includes('RODRIGO LIMA');
          
          return isMedicinaInterna && !isExcludedDoctor;
        });
      }

      // Contar exames totais (apenas registros faturáveis) - APLICANDO TODOS OS FILTROS DE EXCLUSÃO
      let totalExames = 0;
      for (const vol of volumetria) {
        // APLICAR FILTROS DE EXCLUSÃO: Excluir registros que não devem ser faturados
        if (vol.tipo_faturamento === 'NC-NF' || vol.tipo_faturamento === 'EXCLUSAO') {
          continue; // Pular este registro do total
        }
        
        // FILTRO ESPECÍFICO CBU: Excluir exames com ESTUDO_DESCRICAO que indica exclusão
        if (nomeFantasia === 'CBU') {
          const estudoDesc = (vol.ESTUDO_DESCRICAO || '').toString().toUpperCase();
          const medico = (vol.MEDICO || '').toString().toUpperCase();
          
          // Excluir exames que não devem ser faturados para CBU
          if (estudoDesc.includes('EXCLUSAO') || estudoDesc.includes('NAO FATURAR') || 
              estudoDesc.includes('SEM COBRANCA') || estudoDesc.includes('CORTESIA') ||
              estudoDesc.includes('CANCELADO') || estudoDesc.includes('TESTE')) {
            continue;
          }
          
          // Outros filtros específicos para CBU se necessário
          if (medico.includes('TESTE') || medico.includes('DEMO')) {
            continue;
          }
        }
        
        totalExames += vol.VALORES || 0;
      }

      // Calcular valores dos exames usando preços do banco
      let valorExamesCalculado = 0;
      const detalhesExames = [];

      // Agrupar volumetria por modalidade/especialidade/categoria/prioridade
      const gruposExames: Record<string, { modalidade: string; especialidade: string; categoria: string; prioridade: string; quantidade: number }> = {};
      
      for (const vol of volumetria) {
        // APLICAR FILTROS DE EXCLUSÃO: Excluir registros que não devem ser faturados
        if (vol.tipo_faturamento === 'NC-NF' || vol.tipo_faturamento === 'EXCLUSAO') {
          continue; // Pular este registro
        }
        
        // FILTRO ESPECÍFICO CBU: Excluir exames com ESTUDO_DESCRICAO que indica exclusão
        if (nomeFantasia === 'CBU') {
          const estudoDesc = (vol.ESTUDO_DESCRICAO || '').toString().toUpperCase();
          const medico = (vol.MEDICO || '').toString().toUpperCase();
          
          // Excluir exames que não devem ser faturados para CBU
          if (estudoDesc.includes('EXCLUSAO') || estudoDesc.includes('NAO FATURAR') || 
              estudoDesc.includes('SEM COBRANCA') || estudoDesc.includes('CORTESIA') ||
              estudoDesc.includes('CANCELADO') || estudoDesc.includes('TESTE')) {
            continue;
          }
          
          // Outros filtros específicos para CBU se necessário
          if (medico.includes('TESTE') || medico.includes('DEMO')) {
            continue;
          }
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

      // Preparar preços do cliente (busca única)
      const { data: precosCliente, error: errPrecos } = await supabase
        .from('precos_servicos')
        .select('modalidade, especialidade, categoria, prioridade, valor_base, valor_urgencia, volume_inicial, volume_final, considera_prioridade_plantao, ativo')
        .eq('cliente_id', cliente.id)
        .eq('ativo', true);

      if (errPrecos) {
        console.error('Erro buscando precos_servicos:', errPrecos);
      }

      const norm = (s: string) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

      // Função COMPLETA de seleção de preços - MANTENDO TODAS as condições
      const selecionarPreco = (grupo: { modalidade: string; especialidade: string; categoria: string; prioridade: string; quantidade: number }) => {
        if (!precosCliente || precosCliente.length === 0) {
          return { unit: 0, faixa: '', det: { motivo: 'sem_precos_cliente' } };
        }

        const modalidadeN = norm(grupo.modalidade);
        const especialidadeN = norm(grupo.especialidade);
        const categoriaN = norm(grupo.categoria || 'SC') || 'SC';
        const prioridadeN = norm(grupo.prioridade || '');
        const volume = grupo.quantidade || 0;

        // Candidatos por MEC (modalidade, especialidade, categoria)
        let candidatos = precosCliente.filter((p: any) =>
          norm(p.modalidade) === modalidadeN &&
          norm(p.especialidade) === especialidadeN &&
          norm((p.categoria || 'SC')) === categoriaN
        );

        // Priorizar match exato de prioridade
        const candidatosPrioridade = candidatos.filter((p: any) => norm(p.prioridade) === prioridadeN);
        if (candidatosPrioridade.length > 0) candidatos = candidatosPrioridade;

        // Filtrar por faixa de volume (limites nulos permitem faixa aberta)
        let dentroFaixa = candidatos.filter((p: any) =>
          (p.volume_inicial == null || p.volume_inicial <= volume) &&
          (p.volume_final == null || p.volume_final >= volume)
        );

        // Se nenhuma faixa encaixa, pegar a de maior volume_inicial abaixo do volume
        if (dentroFaixa.length === 0 && candidatos.length > 0) {
          const abaixo = candidatos.filter((p: any) => p.volume_inicial == null || p.volume_inicial <= volume);
          if (abaixo.length > 0) {
            dentroFaixa = [abaixo.reduce((best: any, cur: any) =>
              ((best.volume_inicial ?? -Infinity) <= (cur.volume_inicial ?? -Infinity) ? cur : best)
            )];
          }
        }

        if (dentroFaixa.length === 0) {
          return { unit: 0, faixa: '', det: { motivo: 'sem_match', prioridadeN } };
        }

        // Em empate, escolher a maior volume_inicial
        const escolhido = dentroFaixa.length > 1
          ? dentroFaixa.reduce((best: any, cur: any) => ((best.volume_inicial ?? -Infinity) <= (cur.volume_inicial ?? -Infinity) ? cur : best))
          : dentroFaixa[0];

        const prioridadeUrg = prioridadeN === 'URGENCIA' || prioridadeN === 'URGÊNCIA' || prioridadeN === 'URG' || prioridadeN === 'PLANTAO' || prioridadeN === 'PLANTÃO';
        const unit = (prioridadeUrg || (escolhido.considera_prioridade_plantao ?? false))
          ? (escolhido.valor_urgencia ?? escolhido.valor_base ?? 0)
          : (escolhido.valor_base ?? 0);
        const faixa = `${escolhido.volume_inicial ?? 0}-${escolhido.volume_final ?? '∞'}`;
        const det = { prioridadeN, considera_prioridade_plantao: !!escolhido.considera_prioridade_plantao };
        return { unit, faixa, det };
      };

      // Calcular preços para cada grupo usando precificação local (sem RPC por grupo)
      for (const [key, grupo] of Object.entries(gruposExames)) {
        try {
          const { unit, faixa, det } = selecionarPreco(grupo as any);
          const valorTotalGrupo = unit * (grupo as any).quantidade;
          valorExamesCalculado += valorTotalGrupo;

          detalhesExames.push({
            modalidade: (grupo as any).modalidade,
            especialidade: (grupo as any).especialidade,
            categoria: (grupo as any).categoria,
            prioridade: (grupo as any).prioridade,
            quantidade: (grupo as any).quantidade,
            valor_unitario: unit,
            valor_total: valorTotalGrupo,
            faixa_volume: faixa,
            detalhes_calculo: det,
            status: unit > 0 ? 'com_preco' : 'sem_preco'
          });

        } catch (error) {
          console.error(`Erro no cálculo de preço de ${key}:`, error);
        }
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
      const valorLiquido = valorBruto - totalImpostos; // VALOR LÍQUIDO = BRUTO - IMPOSTOS

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
        valor_total: valorLiquido, // VALOR LÍQUIDO (bruto - impostos)
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
      valor_liquido_geral: demonstrativos.reduce((acc, dem) => acc + (dem.valor_total || 0), 0), // valor_total agora é líquido
      clientes_simples_nacional: demonstrativos.filter(dem => dem.detalhes_tributacao?.simples_nacional).length,
      clientes_regime_normal: demonstrativos.filter(dem => !dem.detalhes_tributacao?.simples_nacional).length
    };

    // Gerar relatórios PDF automaticamente para cada cliente
    let relatoriosGerados = 0;
    let relatoriosComErro = 0;

    for (const demonstrativo of demonstrativos) {
      try {
        // Chamar a função que gera o PDF do relatório
        const { error: pdfError } = await supabase.functions.invoke('gerar-relatorio-faturamento', {
          body: {
            cliente_id: demonstrativo.cliente_id,
            periodo: demonstrativo.periodo,
            demonstrativo_data: demonstrativo
          }
        });

        if (pdfError) {
          console.error(`Erro ao gerar PDF para cliente ${demonstrativo.cliente_nome}:`, pdfError);
          relatoriosComErro++;
        } else {
          relatoriosGerados++;
        }
      } catch (error) {
        console.error(`Erro ao gerar relatório para ${demonstrativo.cliente_nome}:`, error);
        relatoriosComErro++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        demonstrativos,
        resumo: {
          ...resumo,
          relatorios_gerados: relatoriosGerados,
          relatorios_com_erro: relatoriosComErro
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