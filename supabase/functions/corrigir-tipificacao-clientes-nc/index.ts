import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lista de clientes NC que devem ter tipo_cliente = 'NC'
const CLIENTES_NC = [
  "CDICARDIO",
  "CDIGOIAS",
  "CISP",
  "CLIRAM",
  "CRWANDERLEY",
  "DIAGMAX-PR",
  "GOLD",
  "PRODIMAGEM",
  "TRANSDUSON",
  "ZANELLO",
  "CEMVALENCA",
  "RMPADUA",
  "RADI-IMAGEM"
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { periodo_referencia } = await req.json();

    console.log('🔧 Iniciando correção de tipificação de clientes NC...');

    // 1. Buscar todos os clientes NC com contratos
    const { data: clientesNC, error: clientesError } = await supabase
      .from('clientes')
      .select(`
        id,
        nome,
        nome_fantasia,
        contratos_clientes (
          id,
          tipo_cliente,
          tipo_faturamento,
          status
        )
      `)
      .in('nome', CLIENTES_NC);

    if (clientesError) {
      throw clientesError;
    }

    console.log(`📋 Encontrados ${clientesNC?.length || 0} clientes NC no sistema`);

    // 2. Corrigir contratos com tipo_cliente incorreto
    let contratosCorrigidos = 0;
    const contratosParaCorrigir: string[] = [];

    for (const cliente of clientesNC || []) {
      if (cliente.contratos_clientes) {
        for (const contrato of cliente.contratos_clientes) {
          if (contrato.tipo_cliente !== 'NC' && contrato.status === 'ativo') {
            contratosParaCorrigir.push(contrato.id);
            console.log(`⚠️  ${cliente.nome}: contrato ${contrato.id} com tipo_cliente incorreto (${contrato.tipo_cliente})`);
          }
        }
      }
    }

    if (contratosParaCorrigir.length > 0) {
      console.log(`🔧 Corrigindo ${contratosParaCorrigir.length} contratos...`);
      
      for (const contratoId of contratosParaCorrigir) {
        const { error: updateError } = await supabase
          .from('contratos_clientes')
          .update({ tipo_cliente: 'NC' })
          .eq('id', contratoId);

        if (updateError) {
          console.error(`❌ Erro ao corrigir contrato ${contratoId}:`, updateError);
        } else {
          contratosCorrigidos++;
        }
      }

      console.log(`✅ ${contratosCorrigidos} contratos corrigidos`);
    } else {
      console.log('✅ Todos os contratos já estão corretos');
    }

    // 3. FORÇAR tipificação COMPLETA para clientes NC
    let tipificacaoResult = null;
    
    console.log(`🔄 FORÇANDO tipificação COMPLETA para clientes NC${periodo_referencia ? ` no período ${periodo_referencia}` : ' (todos os períodos)'}...`);
    
    // Buscar TODOS os registros dos clientes NC
    let queryRegistros = supabase
      .from('volumetria_mobilemed')
      .select('id, "EMPRESA", lote_upload, arquivo_fonte')
      .in('EMPRESA', CLIENTES_NC);
    
    // Se houver período, filtrar por ele
    if (periodo_referencia) {
      queryRegistros = queryRegistros.eq('periodo_referencia', periodo_referencia);
    }
    
    const { data: registros, error: registrosError } = await queryRegistros;

    if (registrosError) {
      console.error('❌ Erro ao buscar registros:', registrosError);
      tipificacaoResult = {
        lotes_processados: 0,
        lotes_com_erro: 1,
        registros_tipificados: 0
      };
    } else {
      console.log(`📊 Encontrados ${registros?.length || 0} registros de clientes NC para re-tipificar`);

      if (registros && registros.length > 0) {
          // Agrupar por lote_upload
          const lotesMap = new Map<string, string>();
          registros.forEach(r => {
            if (r.lote_upload && !lotesMap.has(r.lote_upload)) {
              lotesMap.set(r.lote_upload, r.arquivo_fonte);
            }
          });

          console.log(`📦 ${lotesMap.size} lotes para FORÇAR re-tipificação`);

          let totalProcessados = 0;
          let lotesComErro = 0;

          // FORÇAR tipificação de cada lote
          for (const [lote, arquivo] of lotesMap) {
            console.log(`🔄 Processando lote ${lote} (arquivo: ${arquivo})...`);
            
            const { data: tipResult, error: tipError } = await supabase.functions.invoke(
              'aplicar-tipificacao-faturamento',
              {
                body: {
                  arquivo_fonte: arquivo,
                  lote_upload: lote
                }
              }
            );

            if (tipError) {
              console.error(`❌ Erro ao tipificar lote ${lote}:`, tipError);
              lotesComErro++;
            } else {
              console.log(`✅ Lote ${lote} tipificado:`, tipResult);
              totalProcessados += tipResult?.registros_atualizados || 0;
            }
          }

        tipificacaoResult = {
          lotes_processados: lotesMap.size,
          lotes_com_erro: lotesComErro,
          registros_tipificados: totalProcessados
        };
      } else {
        console.log('⚠️ Nenhum registro encontrado');
        tipificacaoResult = {
          lotes_processados: 0,
          lotes_com_erro: 0,
          registros_tipificados: 0
        };
      }
    }

    // 4. Estatísticas finais - buscar do banco APÓS aplicar tipificação (apenas clientes NC)
    let queryStats = supabase
      .from('volumetria_mobilemed')
      .select('"EMPRESA", tipo_cliente, tipo_faturamento')
      .in('EMPRESA', CLIENTES_NC);
    
    if (periodo_referencia) {
      queryStats = queryStats.eq('periodo_referencia', periodo_referencia);
    }
    
    const { data: volumetriaStats } = await queryStats;

    const estatisticas = {
      por_cliente: {} as Record<string, any>
    };

    // Agrupar por cliente mostrando APENAS os valores do contrato
    volumetriaStats?.forEach((record: any) => {
      const empresa = record.EMPRESA;
      const key = `${record.tipo_cliente}_${record.tipo_faturamento}`;
      
      if (!estatisticas.por_cliente[empresa]) {
        estatisticas.por_cliente[empresa] = {};
      }
      
      if (!estatisticas.por_cliente[empresa][key]) {
        estatisticas.por_cliente[empresa][key] = {
          total: 0,
          tipo_cliente: record.tipo_cliente,
          tipo_faturamento: record.tipo_faturamento
        };
      }
      estatisticas.por_cliente[empresa][key].total++;
    });

    const resultado = {
      sucesso: true,
      clientes_nc_cadastrados: CLIENTES_NC.length,
      clientes_nc_encontrados: clientesNC?.length || 0,
      contratos_corrigidos: contratosCorrigidos,
      tipificacao: tipificacaoResult,
      estatisticas: estatisticas,
      timestamp: new Date().toISOString()
    };

    console.log('✅ Correção concluída:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('❌ Erro na correção:', error);
    return new Response(JSON.stringify({
      sucesso: false,
      erro: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
