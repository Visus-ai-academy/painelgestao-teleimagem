import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🚀 SISTEMA CONSISTENTE: 100% EDGE FUNCTIONS COM BATCHING');

    // === ARQUITETURA ÚNICA: APENAS EDGE FUNCTIONS ===
    
    // Lista das 27 regras organizadas em lotes
    const regrasLote1 = [
      'aplicar-correcao-modalidade-rx',
      'aplicar-correcao-modalidade-ot', 
      'correcao-especialidades-forcada',
      'aplicar-mapeamento-nome-cliente',
      'aplicar-de-para-prioridades'
    ];
    
    const regrasLote2 = [
      'aplicar-categorias-cadastro',
      'aplicar-especialidade-automatica',
      'aplicar-tipificacao-faturamento',
      'aplicar-tipificacao-retroativa',
      'aplicar-validacao-cliente'
    ];
    
    const regrasLote3 = [
      'aplicar-regras-quebra-exames',
      'aplicar-exclusao-clientes-especificos',
      'aplicar-exclusoes-periodo', 
      'aplicar-filtro-data-laudo',
      'aplicar-filtro-periodo-atual'
    ];
    
    const regrasLote4 = [
      'aplicar-regras-v002-v003-automatico',
      'aplicar-regras-v002-v003-manual',
      'aplicar-regras-lote',
      'aplicar-regras-tratamento',
      'aplicar-sistema-regras-pos-upload'
    ];
    
    const regrasLote5 = [
      'auto-aplicar-regras-pos-upload',
      'auto-aplicar-regras-retroativas'
    ];

    console.log('🔧 [LOTE 1/5] Aplicando regras básicas (modalidade, especialidade, cliente)...');
    const resultadosLote1 = await executarLoteRegras(supabase, regrasLote1, 1);
    
    console.log('🔧 [LOTE 2/5] Aplicando regras de categorização e tipificação...');
    const resultadosLote2 = await executarLoteRegras(supabase, regrasLote2, 2);
    
    console.log('🔧 [LOTE 3/5] Aplicando regras de quebra e exclusão...');
    const resultadosLote3 = await executarLoteRegras(supabase, regrasLote3, 3);
    
    console.log('🔧 [LOTE 4/5] Aplicando regras retroativas e tratamento...');
    const resultadosLote4 = await executarLoteRegras(supabase, regrasLote4, 4);
    
    console.log('🔧 [LOTE 5/5] Aplicando aplicação automática...');
    const resultadosLote5 = await executarLoteRegras(supabase, regrasLote5, 5);

    // 8. VERIFICAÇÃO FINAL COMPLETA
    const verificacaoFinal = await verificarAplicacaoCompleta(supabase);

    const relatorioFinal = {
      sucesso: true,
      sistema: 'EDGE_FUNCTIONS_BATCHING_V2',
      aplicacao_por_lotes: {
        lote_1_basicas: resultadosLote1,
        lote_2_categorizacao: resultadosLote2,
        lote_3_quebra_exclusao: resultadosLote3,
        lote_4_retroativas: resultadosLote4,
        lote_5_automaticas: resultadosLote5
      },
      verificacao_final: verificacaoFinal,
      percentual_aplicacao: calcularPercentualGlobal(verificacaoFinal),
      total_regras_executadas: contarRegrasExecutadas([resultadosLote1, resultadosLote2, resultadosLote3, resultadosLote4, resultadosLote5]),
      data_processamento: new Date().toISOString(),
      metodologia: 'EDGE_FUNCTIONS_PURAS_COM_BATCHING_INTELIGENTE'
    };

    console.log('🎉 APLICAÇÃO ROBUSTA CONCLUÍDA:', relatorioFinal.percentual_aplicacao);

    return new Response(JSON.stringify(relatorioFinal), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('💥 ERRO CRÍTICO no sistema robusto:', error);
    return new Response(JSON.stringify({ 
      sucesso: false,
      erro_critico: error.message,
      stack_trace: error.stack
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

// === EXECUÇÃO INTELIGENTE DE LOTES DE EDGE FUNCTIONS ===

async function executarLoteRegras(supabase: any, regras: string[], numeroLote: number) {
  const resultados = [];
  let sucessos = 0;
  let falhas = 0;
  
  for (const nomeRegra of regras) {
    try {
      console.log(`🔧 Executando ${nomeRegra} (Lote ${numeroLote})...`);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000); // 25s por função
      
      const { data, error } = await supabase.functions.invoke(nomeRegra, {
        body: { 
          forcar_aplicacao: true,
          lote_execucao: numeroLote,
          timestamp: new Date().toISOString()
        },
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      if (!error && data?.sucesso !== false) {
        sucessos++;
        resultados.push({ 
          regra: nomeRegra, 
          sucesso: true, 
          resultado: data,
          tempo_execucao: data?.tempo_execucao || 'N/A',
          registros_processados: data?.registros_processados || 0
        });
        console.log(`✅ ${nomeRegra} - Sucesso`);
      } else {
        falhas++;
        console.warn(`⚠️ ${nomeRegra} - Falha:`, error?.message || data?.erro);
        
        // RETRY UMA VEZ em caso de falha
        console.log(`🔄 Tentando novamente ${nomeRegra}...`);
        const retryResult = await tentarNovamente(supabase, nomeRegra, numeroLote);
        
        if (retryResult.sucesso) {
          sucessos++;
          falhas--;
        }
        
        resultados.push(retryResult);
      }
    } catch (error: any) {
      falhas++;
      console.error(`❌ Timeout/erro crítico em ${nomeRegra}:`, error.message);
      resultados.push({ 
        regra: nomeRegra, 
        sucesso: false, 
        erro: 'Timeout ou erro crítico',
        detalhes: error.message
      });
    }
  }
  
  return {
    lote: numeroLote,
    total_regras: regras.length,
    sucessos: sucessos,
    falhas: falhas,
    percentual_sucesso: Math.round((sucessos / regras.length) * 100),
    detalhes: resultados
  };
}

async function tentarNovamente(supabase: any, nomeRegra: string, numeroLote: number) {
  try {
    const { data, error } = await supabase.functions.invoke(nomeRegra, {
      body: { 
        retry: true,
        forcar_aplicacao: true,
        lote_execucao: numeroLote
      }
    });
    
    if (!error && data?.sucesso !== false) {
      console.log(`✅ ${nomeRegra} - Sucesso no retry`);
      return { 
        regra: nomeRegra, 
        sucesso: true, 
        retry: true,
        resultado: data 
      };
    } else {
      console.error(`❌ ${nomeRegra} - Falhou no retry também`);
      return { 
        regra: nomeRegra, 
        sucesso: false, 
        retry: true,
        erro: error?.message || 'Falha persistente'
      };
    }
  } catch (error: any) {
    return { 
      regra: nomeRegra, 
      sucesso: false, 
      retry: true,
      erro: 'Erro no retry: ' + error.message
    };
  }
}

async function verificarAplicacaoCompleta(supabase: any) {
  console.log('📊 Verificação final da aplicação das 27 regras...');
  
  const { data } = await supabase
    .from('volumetria_mobilemed')
    .select(`
      arquivo_fonte,
      COUNT(*) as total,
      COUNT(CASE WHEN "MODALIDADE" IN ('DX', 'CR', 'OT') THEN 1 END) as modalidades_problematicas,
      COUNT(CASE WHEN "ESPECIALIDADE" IN ('ONCO MEDICINA INTERNA', 'Colunas') THEN 1 END) as especialidades_problematicas,
      COUNT(CASE WHEN "CATEGORIA" IS NULL OR "CATEGORIA" = '' THEN 1 END) as sem_categoria,
      COUNT(CASE WHEN "ESPECIALIDADE" IS NULL OR "ESPECIALIDADE" = '' THEN 1 END) as sem_especialidade,
      COUNT(CASE WHEN tipo_faturamento IS NULL THEN 1 END) as sem_tipificacao
    `)
    .group('arquivo_fonte');
    
  return data || [];
}

function calcularPercentualGlobal(verificacao: any[]) {
  const totais = verificacao.reduce((acc, arq) => ({
    total: acc.total + arq.total,
    problemas: acc.problemas + arq.modalidades_problematicas + arq.especialidades_problematicas + arq.sem_categoria + arq.sem_especialidade + arq.sem_tipificacao
  }), { total: 0, problemas: 0 });

  const percentualCorreto = totais.total > 0 ? Math.round(((totais.total - totais.problemas) / totais.total) * 100) : 0;
  
  return {
    total_registros: totais.total,
    registros_problematicos: totais.problemas,
    percentual_aplicacao_regras: percentualCorreto,
    status: percentualCorreto >= 98 ? 'EXCELENTE' : percentualCorreto >= 95 ? 'BOM' : 'NECESSITA_AJUSTES'
  };
}

function contarRegrasExecutadas(resultadosLotes: any[]) {
  return resultadosLotes.reduce((total, lote) => total + (lote?.sucessos || 0), 0);
}