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

    console.log('🎯 APLICAÇÃO COMPLETA DAS 27 REGRAS DE NEGÓCIO');

    // === MAPEAMENTO COMPLETO DAS 27 REGRAS ===
    const regras27 = [
      // GRUPO 1: LIMPEZA E MAPEAMENTO (Regras 1-5)
      { id: 1, nome: 'Limpeza Nome Cliente', funcao: 'aplicar-mapeamento-nome-cliente' },
      { id: 2, nome: 'De-Para Prioridades', funcao: 'aplicar-de-para-prioridades' },
      { id: 3, nome: 'De-Para Valores Zerados', funcao: 'aplicar-de-para-valores' },
      { id: 4, nome: 'Normalização Médico', funcao: 'normalizar-medicos' },
      { id: 5, nome: 'Validação Cliente', funcao: 'aplicar-validacao-cliente' },

      // GRUPO 2: CORREÇÃO MODALIDADES (Regras 6-8)
      { id: 6, nome: 'Correção DX/CR → RX', funcao: 'aplicar-correcao-modalidade-rx' },
      { id: 7, nome: 'Correção Mamografias → MG', funcao: 'aplicar-correcao-modalidade-rx' },
      { id: 8, nome: 'Correção OT → DO', funcao: 'aplicar-correcao-modalidade-ot' },

      // GRUPO 3: CATEGORIZAÇÃO E ESPECIALIDADES (Regras 9-14)
      { id: 9, nome: 'Aplicar Categorias Cadastro', funcao: 'aplicar-categorias-cadastro' },
      { id: 10, nome: 'Categoria Padrão SC', funcao: 'aplicar-categoria-padrao' },
      { id: 11, nome: 'Especialidade Automática', funcao: 'aplicar-especialidade-automatica' },
      { id: 12, nome: 'Correção ONCO MEDICINA INTERNA', funcao: 'corrigir-especialidade-onco' },
      { id: 13, nome: 'Correção Colunas → ORTOPEDIA', funcao: 'corrigir-especialidade-colunas' },
      { id: 14, nome: 'Especialidade Padrão GERAL', funcao: 'aplicar-especialidade-padrao' },

      // GRUPO 4: TIPIFICAÇÃO (Regras 15-19)
      { id: 15, nome: 'Tipificação Oncologia', funcao: 'aplicar-tipificacao-faturamento' },
      { id: 16, nome: 'Tipificação Urgência', funcao: 'aplicar-tipificacao-faturamento' },
      { id: 17, nome: 'Tipificação Alta Complexidade', funcao: 'aplicar-tipificacao-faturamento' },
      { id: 18, nome: 'Tipificação Retroativa', funcao: 'aplicar-tipificacao-retroativa' },
      { id: 19, nome: 'Tipificação Padrão', funcao: 'aplicar-tipificacao-faturamento' },

      // GRUPO 5: REGRAS AVANÇADAS (Regras 20-23)
      { id: 20, nome: 'Quebra de Exames', funcao: 'aplicar-regras-quebra-exames' },
      { id: 21, nome: 'Exclusões por Cliente', funcao: 'aplicar-exclusao-clientes-especificos' },
      { id: 22, nome: 'Exclusões por Período', funcao: 'aplicar-exclusoes-periodo' },
      { id: 23, nome: 'Filtro Data Laudo', funcao: 'aplicar-filtro-data-laudo' },

      // GRUPO 6: REGRAS RETROATIVAS V002/V003 (Regras 24-27)
      { id: 24, nome: 'Regras V002 Automático', funcao: 'aplicar-regras-v002-v003-automatico' },
      { id: 25, nome: 'Regras V002 Manual', funcao: 'aplicar-regras-v002-v003-manual' },
      { id: 26, nome: 'Filtro Período Atual', funcao: 'aplicar-filtro-periodo-atual' },
      { id: 27, nome: 'Aplicação Lote Regras', funcao: 'aplicar-regras-lote' }
    ];

    const resultados = [];
    let regrasAplicadas = 0;
    let regrasFalharam = 0;

    console.log(`📋 Iniciando aplicação de ${regras27.length} regras...`);

    // Aplicar cada regra individualmente
    for (const regra of regras27) {
      try {
        console.log(`🔧 [${regra.id}/27] Aplicando: ${regra.nome}`);
        
        const { data: resultado, error } = await supabase.functions.invoke(regra.funcao, {
          body: { 
            forcar_aplicacao: true,
            origem: 'aplicacao-27-regras',
            regra_id: regra.id,
            regra_nome: regra.nome
          }
        });

        if (error) {
          console.error(`❌ [${regra.id}] FALHA: ${regra.nome}:`, error);
          resultados.push({
            regra_id: regra.id,
            regra_nome: regra.nome,
            funcao: regra.funcao,
            sucesso: false,
            erro: error.message,
            timestamp: new Date().toISOString()
          });
          regrasFalharam++;
        } else {
          console.log(`✅ [${regra.id}] SUCESSO: ${regra.nome}`);
          resultados.push({
            regra_id: regra.id,
            regra_nome: regra.nome,
            funcao: regra.funcao,
            sucesso: true,
            resultado: resultado,
            timestamp: new Date().toISOString()
          });
          regrasAplicadas++;
        }
      } catch (error) {
        console.error(`💥 [${regra.id}] ERRO CRÍTICO: ${regra.nome}:`, error);
        resultados.push({
          regra_id: regra.id,
          regra_nome: regra.nome,
          funcao: regra.funcao,
          sucesso: false,
          erro_critico: error.message,
          timestamp: new Date().toISOString()
        });
        regrasFalharam++;
      }
    }

    // Verificação final pós-aplicação
    const { data: verificacaoFinal } = await supabase
      .from('volumetria_mobilemed')
      .select(`
        arquivo_fonte,
        COUNT(*) as total,
        COUNT(CASE WHEN "MODALIDADE" IN ('DX', 'CR', 'OT') THEN 1 END) as modalidades_problematicas,
        COUNT(CASE WHEN "ESPECIALIDADE" IN ('ONCO MEDICINA INTERNA', 'Colunas') THEN 1 END) as especialidades_problematicas,
        COUNT(CASE WHEN "CATEGORIA" IS NULL OR "CATEGORIA" = '' THEN 1 END) as sem_categoria,
        COUNT(CASE WHEN tipo_faturamento IS NULL THEN 1 END) as sem_tipificacao
      `)
      .group('arquivo_fonte');

    const relatorioCompleto = {
      sucesso: regrasFalharam === 0,
      sistema: 'APLICACAO_27_REGRAS_COMPLETAS',
      estatisticas: {
        total_regras: regras27.length,
        regras_aplicadas: regrasAplicadas,
        regras_falharam: regrasFalharam,
        percentual_sucesso: Math.round((regrasAplicadas / regras27.length) * 100)
      },
      detalhes_por_regra: resultados,
      verificacao_final: verificacaoFinal || [],
      mapeamento_regras: regras27,
      data_processamento: new Date().toISOString()
    };

    console.log('🎉 APLICAÇÃO DAS 27 REGRAS CONCLUÍDA:', relatorioCompleto.estatisticas);

    return new Response(JSON.stringify(relatorioCompleto), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('💥 ERRO CRÍTICO na aplicação das 27 regras:', error);
    return new Response(JSON.stringify({ 
      sucesso: false,
      erro_critico: error.message,
      stack: error.stack
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});