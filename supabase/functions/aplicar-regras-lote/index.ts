import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { arquivo_fonte, periodo_referencia } = await req.json();
    
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`🔄 APLICANDO REGRAS EM LOTE PARA: ${arquivo_fonte || 'TODOS'}`);

    // Sequência otimizada de regras - De-Para movido para início para garantir execução
    const regras = [
      'aplicar-mapeamento-nome-cliente',        // v035 - Mapeamento Nome Cliente (rápido)
      'aplicar-de-para-prioridades',            // v018 - De-Para Prioridades (PRIORIDADE)
      'aplicar-regras-tratamento',              // v026 - De-Para Valores (PRIORIDADE: exames zerados)
      'aplicar-correcao-modalidade-rx',         // v030 - Correção Modalidade RX
      'aplicar-correcao-modalidade-ot',         // Correção Modalidade OT
      'aplicar-especialidade-automatica',       // v023 - Especialidade Automática
      'aplicar-substituicao-especialidade-categoria', // v033 - Substituição Especialidade/Categoria
      'aplicar-categorias-cadastro',            // v028 - Aplicar Categorias baseado no Cadastro
      'aplicar-regra-colunas-musculo-neuro',    // v034 - Colunas→Músculo/Neuro
      'aplicar-validacao-cliente',              // v021 - Validação Cliente
      'aplicar-regras-quebra-exames',           // v027 - Quebra de Exames
      'aplicar-tipificacao-faturamento',        // f005, f006 - Tipificação Faturamento
      'aplicar-exclusao-clientes-especificos',  // v032 - Exclusão Clientes Específicos
      'aplicar-exclusoes-periodo',              // v002, v003 - Exclusões por período
      'aplicar-filtro-periodo-atual'            // v031 - Filtro de Período Atual (FINAL - mais lento)
    ];

    const resultados = [];
    let totalProcessado = 0;

    for (const regra of regras) {
      try {
        console.log(`🔧 Aplicando regra: ${regra}`);
        
        // Diferentes regras precisam de parâmetros diferentes
        let body = { arquivo_fonte };
        
        if (['aplicar-exclusoes-periodo', 'aplicar-filtro-data-laudo', 'aplicar-filtro-periodo-atual'].includes(regra)) {
          body = { arquivo_fonte, periodo_referencia };
        }
        
        // Timeout específico por regra (mais tempo para filtros complexos)
        const timeoutMs = regra.includes('filtro-periodo') ? 45000 : 15000;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        try {
          const { data, error } = await supabaseClient.functions.invoke(regra, { 
            body,
            signal: controller.signal 
          });
          
          clearTimeout(timeoutId);

          if (error) {
            console.error(`❌ Erro na regra ${regra}:`, error);
            resultados.push({
              regra,
              status: 'erro',
              erro: error.message,
              timestamp: new Date().toISOString()
            });
            // CONTINUAR mesmo com erro - não interromper o lote
          } else {
            console.log(`✅ Regra ${regra} aplicada com sucesso:`, data);
            resultados.push({
              regra,
              status: 'sucesso',
              resultado: data,
              timestamp: new Date().toISOString()
            });
            
            if (data?.registros_processados) {
              totalProcessado += data.registros_processados;
            }
          }
        } catch (invokeError) {
          clearTimeout(timeoutId);
          if (invokeError.name === 'AbortError') {
            console.error(`⏰ Timeout na regra ${regra} após ${timeoutMs}ms`);
            resultados.push({
              regra,
              status: 'timeout',
              erro: `Timeout após ${timeoutMs}ms`,
              timestamp: new Date().toISOString()
            });
          } else {
            throw invokeError; // Re-lançar se não for timeout
          }
        }

        // Pequena pausa entre regras para evitar sobrecarga
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (err) {
        console.error(`💥 Falha crítica na regra ${regra}:`, err);
        resultados.push({
          regra,
          status: 'falha_critica',
          erro: err.message,
          timestamp: new Date().toISOString()
        });
        // CONTINUAR processamento mesmo com falha crítica
      }
    }

    // Log final de auditoria
    await supabaseClient
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'APLICAR_REGRAS_LOTE',
        record_id: arquivo_fonte || 'TODOS',
        new_data: {
          total_regras: regras.length,
          total_processado: totalProcessado,
          resultados: resultados,
          arquivo_fonte: arquivo_fonte
        },
        user_email: 'system',
        severity: 'info'
      });

    console.log('🎉 PROCESSAMENTO EM LOTE CONCLUÍDO!');

    return new Response(JSON.stringify({
      success: true,
      total_regras: regras.length,
      total_processado: totalProcessado,
      arquivo_fonte: arquivo_fonte || 'TODOS',
      resultados: resultados,
      data_processamento: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 ERRO CRÍTICO:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Erro interno do servidor',
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});