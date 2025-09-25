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
      .eq('ativo', true)
      .order('nome');

    if (clientesError) {
      console.error('Erro ao buscar clientes:', clientesError);
      throw clientesError;
    }

    if (!clientes || clientes.length === 0) {
      throw new Error('Nenhum cliente ativo encontrado');
    }

    console.log(`Total de clientes ativos: ${clientes.length}`);

    const demonstrativos: DemonstrativoCliente[] = [];

    for (const cliente of clientes) {
      const parametros = cliente.parametros_faturamento?.[0];
      const contrato = cliente.contratos_clientes?.[0];
      const tipoFaturamento = contrato?.tipo_faturamento || 'CO-FT';

      console.log(`Processando cliente: ${cliente.nome}`);

      // Buscar volumetria para este cliente no período com agrupamento
      const nomesBusca = [
        cliente.nome,
        cliente.nome_fantasia || cliente.nome,
        cliente.nome_mobilemed || cliente.nome
      ].filter(Boolean);

      console.log(`Buscando volumetria para ${cliente.nome} com nomes:`, nomesBusca);

      // Estratégia 1: Busca exata pelos nomes cadastrados
      let { data: volumetria } = await supabase
        .from('volumetria_mobilemed')
        .select('*')
        .eq('periodo_referencia', periodo)
        .in('"EMPRESA"', nomesBusca);

      // Estratégia 2: Busca por Cliente_Nome_Fantasia
      if (!volumetria || volumetria.length === 0) {
        const { data: volumetriaAlt } = await supabase
          .from('volumetria_mobilemed')
          .select('*')
          .eq('periodo_referencia', periodo)
          .in('"Cliente_Nome_Fantasia"', nomesBusca);
        volumetria = volumetriaAlt || [];
      }

      // Estratégia 3: Para clientes específicos, fazer busca por padrão (agrupamento)
      const nomeFantasia = cliente.nome_fantasia || cliente.nome;
      
      if ((!volumetria || volumetria.length === 0)) {
        console.log(`Verificando se ${nomeFantasia} precisa de agrupamento...`);
        
        let padroesBusca: string[] = [];
        
        // Agrupamento específico por padrão
        if (nomeFantasia === 'PRN') {
          padroesBusca = ['PRN%'];
        } else if (['CEDIDIAG', 'CEDI-RJ', 'CEDI-RO', 'CEDI_RJ', 'CEDI_RO'].includes(nomeFantasia)) {
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
          console.log(`Aplicando agrupamento para ${nomeFantasia} com padrões:`, padroesBusca);
          
          for (const padrao of padroesBusca) {
            const { data: volumetriaAgrupada } = await supabase
              .from('volumetria_mobilemed')
              .select('*')
              .eq('periodo_referencia', periodo)
              .like('"EMPRESA"', padrao);
            
            if (volumetriaAgrupada && volumetriaAgrupada.length > 0) {
              volumetria = (volumetria || []).concat(volumetriaAgrupada);
              console.log(`Encontrados ${volumetriaAgrupada.length} registros com padrão ${padrao}`);
            }
          }
        }
      }

      // REGRA ESPECÍFICA CEDIDIAG: apenas Medicina Interna, excluindo médico específico
      if (nomeFantasia === 'CEDIDIAG' && volumetria && volumetria.length > 0) {
        console.log(`Aplicando filtro específico CEDIDIAG: apenas Medicina Interna`);
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
        console.log(`CEDIDIAG: Após filtro específico: ${volumetria.length} registros`);
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

      // Calcular preços para cada grupo usando função calcular_preco_exame que aplica volumes
      for (const [key, grupo] of Object.entries(gruposExames)) {
        try {
          let precoUnitario = 0;
          let faixaVolume = '';
          let detalhesCalculo: any = {};
          
          // Usar função calcular_preco_exame que implementa corretamente Vol. Inicial/Final
          const isPlantao = grupo.prioridade === 'PLANTÃO';
          const { data: precoCalculado, error: precoError } = await supabase.rpc('calcular_preco_exame', {
            p_cliente_id: cliente.id,
            p_modalidade: grupo.modalidade,
            p_especialidade: grupo.especialidade,
            p_categoria: grupo.categoria,
            p_prioridade: grupo.prioridade,
            p_volume_total: grupo.quantidade,
            p_is_plantao: isPlantao
          });
          
          if (precoError) {
            console.error(`Erro ao calcular preço para ${key}:`, precoError);
          } else if (precoCalculado && precoCalculado.length > 0) {
            const resultado = precoCalculado[0];
            precoUnitario = Number(resultado.valor_unitario || 0);
            faixaVolume = resultado.faixa_volume || '';
            detalhesCalculo = resultado.detalhes_calculo || {};
            
            console.log(`Preço calculado para ${key}: R$ ${precoUnitario} (faixa: ${faixaVolume}) - VOLUMES IMPLEMENTADOS`);
          } else {
            console.log(`Nenhum preço encontrado para ${key} - Verificar tabela de preços`);
          }
          
          const valorTotal = precoUnitario * grupo.quantidade;
          valorExamesCalculado += valorTotal;
          
          detalhesExames.push({
            modalidade: grupo.modalidade,
            especialidade: grupo.especialidade,
            categoria: grupo.categoria,
            prioridade: grupo.prioridade,
            quantidade: grupo.quantidade,
            valor_unitario: precoUnitario,
            valor_total: valorTotal,
            faixa_volume: faixaVolume,
            detalhes_calculo: detalhesCalculo,
            status: precoUnitario > 0 ? 'com_preco' : 'sem_preco'
          });
          
          console.log(`Calculado para ${key}: ${grupo.quantidade} x R$ ${precoUnitario} = R$ ${valorTotal}`);
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

      const valorTotal = valorBruto + valorISS + valorIRRF;

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
          irrf: valorBruto * 0.015
        },
        tipo_faturamento: tipoFaturamento
      };

      demonstrativos.push(demonstrativo);
      console.log(`Demonstrativo criado para ${cliente.nome}: ${totalExames} exames, R$ ${valorTotal.toFixed(2)}`);
    }

    console.log(`Total de demonstrativos gerados: ${demonstrativos.length}`);

    // Calcular resumo completo dos demonstrativos
    const resumo = {
      clientes_processados: demonstrativos.length,
      total_clientes_processados: demonstrativos.length,
      periodo,
      // Calcular totais agregados
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

    console.log('Resumo calculado:', resumo);

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