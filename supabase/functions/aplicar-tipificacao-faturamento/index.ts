import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tipos de Faturamento Definidos:
// CO-FT: CO com faturamento
// CO-NF: CO não faturado
// NC-FT: NC faturado
// NC-NF: NC não faturado
// NC1-NF: NC1 não faturado
type TipoFaturamento = "CO-FT" | "CO-NF" | "NC-FT" | "NC-NF" | "NC1-NF";

// Tipos de Cliente Definidos:
// CO: Cliente do tipo CO
// NC: Cliente do tipo NC
// NC1: Cliente do tipo NC1
type TipoCliente = "CO" | "NC" | "NC1";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { arquivo_fonte, lote_upload } = await req.json();

    console.log(`🔄 Aplicando tipificação de faturamento - Arquivo: ${arquivo_fonte}, Lote: ${lote_upload}`);

    // 1. Buscar registros que precisam de tipificação
    let query = supabaseClient
      .from('volumetria_mobilemed')
      .select('id, "EMPRESA", "MODALIDADE", "ESPECIALIDADE", "PRIORIDADE"');

    // Aplicar filtros conforme parâmetros
    if (arquivo_fonte && lote_upload) {
      query = query.eq('arquivo_fonte', arquivo_fonte).eq('lote_upload', lote_upload);
    } else if (arquivo_fonte) {
      query = query.eq('arquivo_fonte', arquivo_fonte);
    } else if (lote_upload) {
      query = query.eq('lote_upload', lote_upload);
    } else {
      // Buscar apenas registros sem tipo de faturamento
      query = query.is('tipo_faturamento', null);
    }

    const { data: registros, error: selectError } = await query;

    if (selectError) {
      console.error('❌ Erro ao buscar registros:', selectError);
      throw selectError;
    }

    if (!registros || registros.length === 0) {
      console.log('ℹ️ Nenhum registro encontrado para tipificação');
      return new Response(JSON.stringify({
        sucesso: true,
        registros_processados: 0,
        message: 'Nenhum registro encontrado para tipificação'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`📊 Processando ${registros.length} registros para tipificação`);

    // 2. Buscar configurações de contratos dos clientes (TODOS os contratos para considerar faturamento misto)
    const { data: contratos, error: contratosError } = await supabaseClient
      .from('contratos_clientes')
      .select(`
        id,
        tipo_cliente,
        tipo_faturamento,
        modalidades,
        especialidades,
        considera_plantao,
        clientes (
          nome,
          nome_mobilemed,
          nome_fantasia
        )
      `)
      .eq('status', 'ativo');

    if (contratosError) {
      console.error('❌ Erro ao buscar contratos:', contratosError);
      throw contratosError;
    }

    console.log(`📋 Carregados ${contratos?.length || 0} contratos ativos`);

    // 3. Criar mapa de configurações por cliente
    // Agrupamos contratos por nome_fantasia para detectar faturamento misto
    const configClientes = new Map<string, Array<{
      tipo_cliente: string;
      tipo_faturamento: string;
      modalidades: string[];
      especialidades: string[];
      considera_plantao: boolean;
    }>>();
    
    contratos?.forEach(contrato => {
      if (contrato.clientes?.nome_fantasia) {
        const nomeFantasia = contrato.clientes.nome_fantasia;
        if (!configClientes.has(nomeFantasia)) {
          configClientes.set(nomeFantasia, []);
        }
        configClientes.get(nomeFantasia)!.push({
          tipo_cliente: contrato.tipo_cliente || 'CO',
          tipo_faturamento: contrato.tipo_faturamento || 'CO-FT',
          modalidades: contrato.modalidades || [],
          especialidades: contrato.especialidades || [],
          considera_plantao: contrato.considera_plantao || false
        });
      }
    });

    console.log(`📋 Configurações de ${configClientes.size} clientes carregadas`);

    // 4. Função para determinar tipo de faturamento baseado em regras do contrato
    function determinarTipoFaturamento(
      nomeCliente: string,
      modalidade: string,
      especialidade: string,
      prioridade: string
    ): { tipo_faturamento: TipoFaturamento, tipo_cliente: TipoCliente } {
      const configs = configClientes.get(nomeCliente);
      
      if (!configs || configs.length === 0) {
        // Fallback: Cliente sem contrato
        console.warn(`⚠️ Cliente sem contrato: ${nomeCliente}`);
        return { tipo_faturamento: 'CO-FT', tipo_cliente: 'CO' };
      }

      // Se há apenas um contrato, usar diretamente
      if (configs.length === 1) {
        return {
          tipo_faturamento: configs[0].tipo_faturamento as TipoFaturamento,
          tipo_cliente: configs[0].tipo_cliente as TipoCliente
        };
      }

      // Faturamento misto: múltiplos contratos para o mesmo cliente
      // Verificar qual contrato se aplica baseado em modalidade, especialidade e prioridade
      for (const config of configs) {
        // Verificar modalidade
        const modalidadeMatch = config.modalidades.length === 0 || 
                               config.modalidades.includes(modalidade);
        
        // Verificar especialidade
        const especialidadeMatch = config.especialidades.length === 0 || 
                                  config.especialidades.includes(especialidade);
        
        // Verificar plantão
        const prioridadeUpper = (prioridade || '').toUpperCase();
        const isPlantao = prioridadeUpper.includes('PLANTAO') || prioridadeUpper.includes('PLANTÃO');
        const plantaoMatch = !isPlantao || config.considera_plantao;
        
        // Se todos os critérios correspondem, usar este contrato
        if (modalidadeMatch && especialidadeMatch && plantaoMatch) {
          return {
            tipo_faturamento: config.tipo_faturamento as TipoFaturamento,
            tipo_cliente: config.tipo_cliente as TipoCliente
          };
        }
      }

      // Se nenhum contrato específico se aplica, usar o primeiro
      console.warn(`⚠️ Múltiplos contratos para ${nomeCliente}, usando primeiro contrato`);
      return {
        tipo_faturamento: configs[0].tipo_faturamento as TipoFaturamento,
        tipo_cliente: configs[0].tipo_cliente as TipoCliente
      };
    }

    // 5. Processar registros em lotes de 500
    const BATCH_SIZE = 500;
    let registrosProcessados = 0;
    let registrosAtualizados = 0;
    let clientesSemContrato = new Set<string>();

    for (let i = 0; i < registros.length; i += BATCH_SIZE) {
      const lote = registros.slice(i, i + BATCH_SIZE);
      
      console.log(`🔄 Processando lote ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(registros.length/BATCH_SIZE)} - ${lote.length} registros`);

      // Preparar atualizações em massa
      const updates = lote.map(registro => {
        const { tipo_faturamento, tipo_cliente } = determinarTipoFaturamento(
          registro.EMPRESA || '',
          registro.MODALIDADE || '',
          registro.ESPECIALIDADE || '',
          registro.PRIORIDADE || ''
        );
        
        // Rastrear clientes sem contrato
        if (!configClientes.has(registro.EMPRESA)) {
          clientesSemContrato.add(registro.EMPRESA);
        }

        registrosProcessados++;

        return {
          id: registro.id,
          tipo_faturamento,
          tipo_cliente
        };
      });

      // Executar atualizações em paralelo (grupos de 50)
      const PARALLEL_SIZE = 50;
      for (let j = 0; j < updates.length; j += PARALLEL_SIZE) {
        const parallelUpdates = updates.slice(j, j + PARALLEL_SIZE);
        
        const updatePromises = parallelUpdates.map(async (update) => {
          const { error } = await supabaseClient
            .from('volumetria_mobilemed')
            .update({ 
              tipo_faturamento: update.tipo_faturamento,
              tipo_cliente: update.tipo_cliente
            })
            .eq('id', update.id);

          if (error) {
            console.error(`❌ Erro ao atualizar registro ${update.id}:`, error);
          } else {
            registrosAtualizados++;
          }
        });

        await Promise.all(updatePromises);
      }
    }

    // 6. Estatísticas finais
    const { data: stats, error: statsError } = await supabaseClient
      .from('volumetria_mobilemed')
      .select('tipo_faturamento')
      .not('tipo_faturamento', 'is', null);

    let estatisticas = {};
    if (!statsError && stats) {
      const contadores = stats.reduce((acc: any, record: any) => {
        acc[record.tipo_faturamento] = (acc[record.tipo_faturamento] || 0) + 1;
        return acc;
      }, {});
      estatisticas = contadores;
    }

    const resultado = {
      sucesso: true,
      registros_encontrados: registros.length,
      registros_processados: registrosProcessados,
      registros_atualizados: registrosAtualizados,
      clientes_sem_contrato: Array.from(clientesSemContrato),
      total_clientes_sem_contrato: clientesSemContrato.size,
      configuracoes_carregadas: configClientes.size,
      estatisticas_tipos: estatisticas,
      regras_aplicadas: [
        'Tipificação baseada nos CONTRATOS dos clientes',
        'tipo_cliente: CO (cliente do tipo CO) / NC (Cliente do tipo NC)',
        'tipo_faturamento: CO-FT (CO com faturamento) / NC-FT (NC faturado) / NC-NF (NC não faturado)',
        'Fallback: Clientes sem contrato = "Sem informação"'
      ],
      data_processamento: new Date().toISOString()
    };

    console.log('✅ Tipificação de faturamento concluída:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('❌ Erro na tipificação de faturamento:', error);

    return new Response(JSON.stringify({
      sucesso: false,
      erro: error.message,
      detalhes: 'Erro ao aplicar tipificação de faturamento baseada em contratos'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});