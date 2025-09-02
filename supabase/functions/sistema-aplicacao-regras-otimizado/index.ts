import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sistema otimizado com regras organizadas em batches menores para evitar timeouts
const REGRAS_BATCH_1 = [
  'aplicar-filtro-periodo-atual',
  'aplicar-exclusoes-periodo',
  'aplicar-correcao-modalidade-rx',
  'aplicar-correcao-modalidade-ot',
  'aplicar-mapeamento-nome-cliente'
];

const REGRAS_BATCH_2 = [
  'aplicar-de-para-prioridades', 
  'aplicar-de-para-automatico',
  'aplicar-tipificacao-faturamento',
  'aplicar-categorias-cadastro',
  'aplicar-especialidade-automatica'
];

const REGRAS_BATCH_3 = [
  'aplicar-quebras-automatico',
  'aplicar-substituicao-especialidade-categoria',
  'aplicar-regra-colunas-musculo-neuro',
  'buscar-valor-onco'
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

    const { arquivo_fonte, lote_upload, periodo_referencia = 'jun/25', forcar_aplicacao = false } = await req.json();

    console.log(`🚀 SISTEMA OTIMIZADO DE REGRAS - BATCHES MENORES`);
    console.log(`📁 Arquivo: ${arquivo_fonte}, Lote: ${lote_upload}, Período: ${periodo_referencia}`);

    if (!arquivo_fonte) {
      throw new Error('arquivo_fonte é obrigatório');
    }

    const resultados = {
      batch_1: { aplicadas: 0, erros: [] },
      batch_2: { aplicadas: 0, erros: [] },
      batch_3: { aplicadas: 0, erros: [] }
    };

    const aplicarBatch = async (regras: string[], nomeBatch: string) => {
      console.log(`\n🔄 Aplicando ${nomeBatch} (${regras.length} regras)...`);
      
      for (const regra of regras) {
        try {
          console.log(`   🔧 Aplicando: ${regra}`);
          
          let parametros: any = { arquivo_fonte };
          if (lote_upload) parametros.lote_upload = lote_upload;
          if (periodo_referencia) parametros.periodo_referencia = periodo_referencia;
          if (forcar_aplicacao) parametros.forcar_aplicacao = true;

          // Timeout menor por função individual
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout de 30s')), 30000)
          );

          const functionPromise = supabase.functions.invoke(regra, {
            body: parametros
          });

          const { data: resultado, error } = await Promise.race([
            functionPromise,
            timeoutPromise
          ]) as any;

          if (error) {
            throw new Error(`${regra}: ${error.message}`);
          }

          console.log(`   ✅ ${regra}: Sucesso`);
          
          // Incrementar contador do batch correto
          if (nomeBatch === 'BATCH 1') resultados.batch_1.aplicadas++;
          else if (nomeBatch === 'BATCH 2') resultados.batch_2.aplicadas++;
          else if (nomeBatch === 'BATCH 3') resultados.batch_3.aplicadas++;

          // Pequena pausa entre regras para evitar sobrecarga
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error: any) {
          console.error(`   ❌ ${regra}: ${error.message}`);
          
          // Adicionar erro ao batch correto
          if (nomeBatch === 'BATCH 1') resultados.batch_1.erros.push(`${regra}: ${error.message}`);
          else if (nomeBatch === 'BATCH 2') resultados.batch_2.erros.push(`${regra}: ${error.message}`);
          else if (nomeBatch === 'BATCH 3') resultados.batch_3.erros.push(`${regra}: ${error.message}`);
        }
      }
    };

    // Aplicar batches sequencialmente para evitar sobrecarga
    await aplicarBatch(REGRAS_BATCH_1, 'BATCH 1');
    await aplicarBatch(REGRAS_BATCH_2, 'BATCH 2'); 
    await aplicarBatch(REGRAS_BATCH_3, 'BATCH 3');

    // Calcular estatísticas finais
    const totalRegras = REGRAS_BATCH_1.length + REGRAS_BATCH_2.length + REGRAS_BATCH_3.length;
    const totalAplicadas = resultados.batch_1.aplicadas + resultados.batch_2.aplicadas + resultados.batch_3.aplicadas;
    const totalErros = resultados.batch_1.erros.length + resultados.batch_2.erros.length + resultados.batch_3.erros.length;
    const percentualSucesso = Math.round((totalAplicadas / totalRegras) * 100);

    const sucesso = percentualSucesso >= 80; // Considerar sucesso se 80%+ das regras funcionaram

    console.log(`\n📊 RESUMO FINAL:`);
    console.log(`   📈 Total: ${totalAplicadas}/${totalRegras} regras (${percentualSucesso}%)`);
    console.log(`   ✅ BATCH 1: ${resultados.batch_1.aplicadas}/${REGRAS_BATCH_1.length}`);
    console.log(`   ✅ BATCH 2: ${resultados.batch_2.aplicadas}/${REGRAS_BATCH_2.length}`);
    console.log(`   ✅ BATCH 3: ${resultados.batch_3.aplicadas}/${REGRAS_BATCH_3.length}`);
    console.log(`   ❌ Erros: ${totalErros}`);

    const relatorioFinal = {
      success: sucesso,
      arquivo_fonte,
      lote_upload: lote_upload || 'N/A',
      periodo_referencia,
      total_regras: totalRegras,
      regras_aplicadas: totalAplicadas,
      regras_falharam: totalErros,
      percentual_sucesso: percentualSucesso,
      detalhes_batches: {
        batch_1: {
          regras: REGRAS_BATCH_1,
          aplicadas: resultados.batch_1.aplicadas,
          erros: resultados.batch_1.erros
        },
        batch_2: {
          regras: REGRAS_BATCH_2,
          aplicadas: resultados.batch_2.aplicadas,
          erros: resultados.batch_2.erros
        },
        batch_3: {
          regras: REGRAS_BATCH_3,
          aplicadas: resultados.batch_3.aplicadas,
          erros: resultados.batch_3.erros
        }
      },
      recomendacao: sucesso 
        ? "Sistema otimizado aplicou regras com sucesso"
        : `Sistema parcial: ${totalErros} regras falharam. Verifique os logs para detalhes.`,
      otimizado: true,
      data_processamento: new Date().toISOString()
    };

    console.log(`🏆 Status: ${sucesso ? 'SUCESSO' : 'PARCIAL'}`);

    return new Response(JSON.stringify(relatorioFinal), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('💥 Erro no sistema otimizado:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        otimizado: true,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});