import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tipos de Faturamento Definidos:
// CO-FT: CO com faturamento
// NC-FT: NC faturado
// NC-NF: NC não faturado
type TipoFaturamento = "CO-FT" | "NC-FT" | "NC-NF";

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
      .select('id, "EMPRESA", "ESPECIALIDADE", "PRIORIDADE", "MEDICO", "ESTUDO_DESCRICAO"');

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

    // 2. Buscar configurações de contratos dos clientes
    const { data: contratos, error: contratosError } = await supabaseClient
      .from('contratos_clientes')
      .select(`
        tipo_cliente,
        tipo_faturamento,
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

    // 3. Criar mapa de configurações por cliente
    const configClientes = new Map<string, { tipo_cliente: string, tipo_faturamento: string }>();
    
    contratos?.forEach(contrato => {
      // Mapear pelos diferentes nomes possíveis do cliente
      const nomes = [
        contrato.clientes?.nome,
        contrato.clientes?.nome_mobilemed, 
        contrato.clientes?.nome_fantasia
      ].filter(Boolean);
      
      nomes.forEach(nome => {
        configClientes.set(nome, {
          tipo_cliente: contrato.tipo_cliente || 'CO',
          tipo_faturamento: contrato.tipo_faturamento || 'CO-FT'
        });
      });
    });

    console.log(`📋 Carregados ${configClientes.size} configurações de clientes dos contratos`);

    // 4. Função para determinar tipo de faturamento baseado no contrato
    function determinarTipoFaturamento(nomeCliente: string): TipoFaturamento {
      const config = configClientes.get(nomeCliente);
      
      if (config) {
        // Usar configuração do contrato
        return config.tipo_faturamento as TipoFaturamento;
      } else {
        // Fallback: Cliente sem contrato = CO-FT (padrão)
        console.log(`⚠️ Cliente sem contrato encontrado: ${nomeCliente} - Aplicando CO-FT (padrão)`);
        return "CO-FT";
      }
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
        const tipoFaturamento = determinarTipoFaturamento(registro.EMPRESA);
        
        // Rastrear clientes sem contrato
        if (!configClientes.has(registro.EMPRESA)) {
          clientesSemContrato.add(registro.EMPRESA);
        }

        registrosProcessados++;

        return {
          id: registro.id,
          tipo_faturamento: tipoFaturamento
        };
      });

      // Executar atualizações em paralelo (grupos de 50)
      const PARALLEL_SIZE = 50;
      for (let j = 0; j < updates.length; j += PARALLEL_SIZE) {
        const parallelUpdates = updates.slice(j, j + PARALLEL_SIZE);
        
        const updatePromises = parallelUpdates.map(async (update) => {
          const { error } = await supabaseClient
            .from('volumetria_mobilemed')
            .update({ tipo_faturamento: update.tipo_faturamento })
            .eq('id', update.id);

          if (error) {
            console.error(`❌ Erro ao atualizar registro ${update.id}:`, error);
            return false;
          }
          return true;
        });

        const results = await Promise.all(updatePromises);
        registrosAtualizados += results.filter(Boolean).length;
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
        'Fallback: Clientes sem contrato = CO-FT (padrão)'
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