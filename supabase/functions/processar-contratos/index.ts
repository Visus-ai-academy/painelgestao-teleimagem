import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Cliente {
  id: string;
  nome: string;
  cnpj?: string;
  endereco?: string;
  telefone?: string;
  email?: string;
  razao_social?: string;
  nome_fantasia?: string;
  data_inicio_contrato?: string;
  data_termino_contrato?: string;
  dia_faturamento?: number;
}

interface ParametroFaturamento {
  cliente_id: string;
  valor_integracao?: number;
  cobrar_integracao?: boolean;
  valor_franquia?: number;
  volume_franquia?: number;
  frequencia_continua?: boolean;
  frequencia_por_volume?: boolean;
  valor_acima_franquia?: number;
  aplicar_franquia?: boolean;
  percentual_urgencia?: number;
  aplicar_adicional_urgencia?: boolean;
  tipo_cliente?: string;
  periodicidade_reajuste?: string;
  data_aniversario_contrato?: string;
  indice_reajuste?: string;
  percentual_reajuste_fixo?: number;
}

interface PrecoServico {
  cliente_id: string;
  modalidade: string;
  especialidade: string;
  categoria: string;
  prioridade?: string;
  valor_base: number;
  valor_urgencia?: number;
  volume_inicial?: number;
  volume_final?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { headers: corsHeaders });
  }

  try {
    console.log('🚀 Iniciando processamento de contratos...');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔄 Iniciando geração de contratos em lote...');

    // 1. Buscar todos os clientes ativos
    const { data: clientes, error: clientesError } = await supabaseClient
      .from('clientes')
      .select('*')
      .eq('ativo', true);

    if (clientesError) {
      throw new Error(`Erro ao buscar clientes: ${clientesError.message}`);
    }

    console.log(`📋 Encontrados ${clientes?.length || 0} clientes ativos`);

    // 2. Buscar contratos existentes para evitar duplicatas
    const { data: contratosExistentes, error: contratosError } = await supabaseClient
      .from('contratos_clientes')
      .select('cliente_id');

    if (contratosError) {
      throw new Error(`Erro ao buscar contratos existentes: ${contratosError.message}`);
    }

    const clientesComContrato = new Set(contratosExistentes?.map(c => c.cliente_id) || []);
    const clientesSemContrato = clientes?.filter(cliente => !clientesComContrato.has(cliente.id)) || [];

    console.log(`🔍 ${clientesSemContrato.length} clientes sem contrato encontrados`);

    if (clientesSemContrato.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Todos os clientes já possuem contratos',
          contratos_criados: 0,
          erros: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Buscar parâmetros de faturamento
    const { data: parametros, error: parametrosError } = await supabaseClient
      .from('parametros_faturamento')
      .select('*');

    if (parametrosError) {
      console.warn('⚠️ Erro ao buscar parâmetros:', parametrosError.message);
    }

    const parametrosPorCliente = new Map<string, ParametroFaturamento>();
    parametros?.forEach(p => {
      parametrosPorCliente.set(p.cliente_id, p);
    });

    // 4. Buscar preços de serviços
    const { data: precos, error: precosError } = await supabaseClient
      .from('precos_servicos')
      .select('*');

    if (precosError) {
      console.warn('⚠️ Erro ao buscar preços:', precosError.message);
    }

    const precosPorCliente = new Map<string, PrecoServico[]>();
    precos?.forEach(p => {
      if (!precosPorCliente.has(p.cliente_id)) {
        precosPorCliente.set(p.cliente_id, []);
      }
      precosPorCliente.get(p.cliente_id)?.push(p);
    });

    // 5. Processar cada cliente e criar contrato
    let contratosCreados = 0;
    let erros = 0;
    const detalhes: string[] = [];

    for (const cliente of clientesSemContrato) {
      try {
        console.log(`📝 Processando contrato para: ${cliente.nome}`);

        const parametroCliente = parametrosPorCliente.get(cliente.id);
        const precosCliente = precosPorCliente.get(cliente.id) || [];

        // Calcular data de início e fim do contrato
        const dataInicio = cliente.data_inicio_contrato || new Date().toISOString().split('T')[0];
        const dataFim = cliente.data_termino_contrato || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0];

        // Extrair modalidades e especialidades dos preços
        const modalidades = [...new Set(precosCliente.map(p => p.modalidade))];
        const especialidades = [...new Set(precosCliente.map(p => p.especialidade))];

        // Configurar faixas de volume baseado nos preços
        const faixasVolume = precosCliente
          .filter(p => p.volume_inicial !== null || p.volume_final !== null)
          .map(p => ({
            volume_inicial: p.volume_inicial || 0,
            volume_final: p.volume_final || 999999,
            modalidade: p.modalidade,
            especialidade: p.especialidade,
            categoria: p.categoria
          }));

        // Calcular dia de vencimento
        let diaVencimento = 10; // Padrão
        if (cliente.dia_faturamento) {
          diaVencimento = cliente.dia_faturamento;
        } else if (parametroCliente?.data_aniversario_contrato) {
          try {
            diaVencimento = new Date(parametroCliente.data_aniversario_contrato).getDate();
          } catch (e) {
            diaVencimento = 10;
          }
        }

        // Criar contrato
        const contratoData = {
          cliente_id: cliente.id,
          numero_contrato: `CT-${cliente.nome.substring(0, 3).toUpperCase()}-${Date.now()}-${contratosCreados}`,
          data_inicio: dataInicio,
          data_fim: dataFim,
          dia_vencimento: diaVencimento,
          status: 'ativo',
          forma_pagamento: 'mensal',
          modalidades: modalidades,
          especialidades: especialidades,
          faixas_volume: faixasVolume,
          
          // Configurações de plantão
          considera_plantao: parametroCliente?.aplicar_adicional_urgencia || false,
          
          // Configurações de franquia
          configuracoes_franquia: {
            tem_franquia: parametroCliente?.aplicar_franquia || false,
            valor_franquia: parametroCliente?.valor_franquia || 0,
            volume_franquia: parametroCliente?.volume_franquia || 0,
            frequencia_continua: parametroCliente?.frequencia_continua || false,
            frequencia_por_volume: parametroCliente?.frequencia_por_volume || false,
            valor_acima_franquia: parametroCliente?.valor_acima_franquia || 0
          },
          
          // Configurações de integração
          configuracoes_integracao: {
            cobra_integracao: parametroCliente?.cobrar_integracao || false,
            valor_integracao: parametroCliente?.valor_integracao || 0
          },
          
          // Configurações de reajuste
          desconto_percentual: 0,
          acrescimo_percentual: parametroCliente?.percentual_urgencia || 0,
          
          // Tipo de cliente
          tipo_cliente: parametroCliente?.tipo_cliente || 'CO',
          
          // Preços configurados
          tem_precos_configurados: precosCliente.length > 0,
          tem_parametros_configurados: !!parametroCliente,
          
          // Serviços padrão
          servicos_contratados: ['Laudos médicos', 'Portal de laudos', 'Suporte técnico'],
          
          // Observações
          observacoes: `Contrato gerado automaticamente com base nos dados cadastrais, parâmetros e preços configurados.`,
          observacoes_contratuais: parametroCliente ? 
            `Parâmetros aplicados: Tipo cliente: ${parametroCliente.tipo_cliente || 'N/A'}, Franquia: ${parametroCliente.aplicar_franquia ? 'Sim' : 'Não'}, Integração: ${parametroCliente.cobrar_integracao ? 'Sim' : 'Não'}, Urgência: ${parametroCliente.aplicar_adicional_urgencia ? 'Sim' : 'Não'}` : 'Contrato básico sem parâmetros específicos'
        };

        const { error: insertError } = await supabaseClient
          .from('contratos_clientes')
          .insert([contratoData]);

        if (insertError) {
          throw new Error(`Erro ao inserir contrato: ${insertError.message}`);
        }

        contratosCreados++;
        detalhes.push(`✅ ${cliente.nome} - Contrato criado com ${precosCliente.length} preços e ${parametroCliente ? 'com' : 'sem'} parâmetros`);
        console.log(`✅ Contrato criado para: ${cliente.nome}`);

      } catch (error: any) {
        erros++;
        detalhes.push(`❌ ${cliente.nome} - Erro: ${error.message}`);
        console.error(`❌ Erro ao criar contrato para ${cliente.nome}:`, error);
      }
    }

    console.log(`🏁 Processamento concluído: ${contratosCreados} contratos criados, ${erros} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processamento concluído: ${contratosCreados} contratos criados`,
        contratos_criados: contratosCreados,
        erros: erros,
        detalhes: detalhes,
        clientes_processados: clientesSemContrato.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro na edge function:', error);
    console.error('❌ Stack trace:', error.stack);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido',
        stack: error.stack || 'Stack não disponível'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});