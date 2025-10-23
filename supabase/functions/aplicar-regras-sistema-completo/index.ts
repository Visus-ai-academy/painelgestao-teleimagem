import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StatusRegra {
  regra: string;
  aplicada: boolean;
  erro?: string;
  detalhes?: any;
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

    let body = {};
    try {
      body = await req.json();
    } catch (jsonError) {
      console.log('Corpo da requisição vazio ou inválido, usando defaults:', jsonError);
    }

    const { arquivo_fonte, periodo_referencia = '2025-06', aplicar_todos_arquivos = false } = body;
    
    const arquivosParaProcessar = aplicar_todos_arquivos 
      ? ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo']
      : [arquivo_fonte];
    
    if (!aplicar_todos_arquivos && !arquivo_fonte) {
      return new Response(
        JSON.stringify({ 
          success: false,
          erro: 'Parâmetro arquivo_fonte é obrigatório quando aplicar_todos_arquivos for false'
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`🎯 NOVA ABORDAGEM: Aplicação de regras sistema completo`);
    console.log(`📁 Arquivos a processar: ${arquivosParaProcessar.join(', ')}`);
    
    const statusRegras: StatusRegra[] = [];
    let totalProcessados = 0;
    let totalCorrigidos = 0;

    // Buscar dados das tabelas de referência uma vez só
    const { data: cadastroExames } = await supabase
      .from('cadastro_exames')
      .select('nome, categoria, especialidade')
      .eq('ativo', true);

    const { data: deParaPrioridades } = await supabase
      .from('valores_prioridade_de_para')
      .select('prioridade_original, nome_final')
      .eq('ativo', true);

    const { data: deParaValores } = await supabase
      .from('valores_referencia_de_para')
      .select('estudo_descricao, valores')
      .eq('ativo', true);

    console.log(`📋 Cadastro exames carregado: ${cadastroExames?.length || 0} registros`);
    console.log(`📋 De-para prioridades: ${deParaPrioridades?.length || 0} registros`);
    console.log(`📋 De-para valores: ${deParaValores?.length || 0} registros`);

    // Criar mapas para busca eficiente
    const mapaCategoriasEspecialidades = new Map();
    cadastroExames?.forEach(exame => {
      if (exame.nome) {
        mapaCategoriasEspecialidades.set(exame.nome.toUpperCase().trim(), {
          categoria: exame.categoria,
          especialidade: exame.especialidade
        });
      }
    });

    const mapaPrioridades = new Map();
    deParaPrioridades?.forEach(dp => {
      if (dp.prioridade_original) {
        mapaPrioridades.set(dp.prioridade_original.toUpperCase().trim(), dp.nome_final);
      }
    });

    const mapaValores = new Map();
    deParaValores?.forEach(dv => {
      if (dv.estudo_descricao) {
        mapaValores.set(dv.estudo_descricao.toUpperCase().trim(), dv.valores);
      }
    });

    // Processar cada arquivo
    for (const arquivo of arquivosParaProcessar) {
      console.log(`\n🔄 Processando arquivo: ${arquivo}`);
      
      // Aplicar agrupamento automático de clientes (inclui CEMVALENCA, DIAGNOSTICA e mapeamento geral)
      try {
        console.log('🔗 Aplicando agrupamento automático de clientes...');
        const { data: agrupamentoResult, error: agrupamentoError } = await supabase.functions.invoke(
          'aplicar-agrupamento-clientes'
        );
        
        if (agrupamentoError) {
          console.warn('⚠️ Erro no agrupamento automático:', agrupamentoError);
        } else {
          console.log('✅ Agrupamento automático concluído:', agrupamentoResult);
        }
      } catch (e) {
        console.warn('⚠️ Agrupamento automático falhou:', e);
      }

      // Buscar TODOS os registros que precisam de correção
      const { data: registros, error: errorFetch } = await supabase
        .from('volumetria_mobilemed')
        .select('id, "ESTUDO_DESCRICAO", "CATEGORIA", "ESPECIALIDADE", "PRIORIDADE", "VALORES", "MODALIDADE"')
        .eq('arquivo_fonte', arquivo);

      if (errorFetch) {
        console.error(`❌ Erro ao buscar registros do ${arquivo}:`, errorFetch);
        continue;
      }

      console.log(`📊 Registros encontrados no ${arquivo}: ${registros?.length || 0}`);

      let correcoesModalidades = 0;
      let correcoesEspecialidades = 0;
      let correcoesCategorias = 0;
      let correcoesPrioridades = 0;
      let correcoesValores = 0;
      let corrrecoesTipificacao = 0;

      // Processar registros em lotes de 100
      const loteSize = 100;
      for (let i = 0; i < (registros?.length || 0); i += loteSize) {
        const lote = registros!.slice(i, i + loteSize);
        
        for (const registro of lote) {
          const updates: any = {};
          let needsUpdate = false;

          // 1. CORREÇÕES DE MODALIDADES
          if (registro.MODALIDADE === 'BMD') {
            updates.MODALIDADE = 'DO';
            needsUpdate = true;
            correcoesModalidades++;
          }
          if (registro.MODALIDADE === 'CR' || registro.MODALIDADE === 'DX') {
            // Verificar se é mamografia
            if (registro.ESTUDO_DESCRICAO?.toLowerCase().includes('mamografia') || 
                registro.ESTUDO_DESCRICAO?.toLowerCase().includes('mamogra')) {
              updates.MODALIDADE = 'MG';
            } else {
              updates.MODALIDADE = 'RX';
            }
            needsUpdate = true;
            correcoesModalidades++;
          }

          // 2. ESPECIALIDADES PROBLEMÁTICAS
          if (registro.ESPECIALIDADE === 'ONCO MEDICINA INTERNA') {
            updates.ESPECIALIDADE = 'MEDICINA INTERNA';
            needsUpdate = true;
            correcoesEspecialidades++;
          }
          if (registro.ESPECIALIDADE === 'CT') {
            updates.ESPECIALIDADE = 'MEDICINA INTERNA';
            needsUpdate = true;
            correcoesEspecialidades++;
          }
          if (registro.ESPECIALIDADE === 'Colunas') {
            updates.ESPECIALIDADE = 'MUSCULO ESQUELETICO';
            needsUpdate = true;
            correcoesEspecialidades++;
          }
          if (registro.ESPECIALIDADE === 'GERAL') {
            updates.ESPECIALIDADE = 'MEDICINA INTERNA';
            needsUpdate = true;
            correcoesEspecialidades++;
          }

          // 3. APLICAR CATEGORIAS E ESPECIALIDADES DO CADASTRO_EXAMES
          if (registro.ESTUDO_DESCRICAO) {
            const dadosExame = mapaCategoriasEspecialidades.get(registro.ESTUDO_DESCRICAO.toUpperCase().trim());
            if (dadosExame) {
              if (dadosExame.categoria && (!registro.CATEGORIA || registro.CATEGORIA === 'SC' || registro.CATEGORIA === '')) {
                updates.CATEGORIA = dadosExame.categoria;
                needsUpdate = true;
                correcoesCategorias++;
              }
              if (dadosExame.especialidade && (!registro.ESPECIALIDADE || registro.ESPECIALIDADE === 'GERAL' || registro.ESPECIALIDADE === '')) {
                updates.ESPECIALIDADE = dadosExame.especialidade;
                needsUpdate = true;
                correcoesEspecialidades++;
              }
            } else {
              // Categoria baseada na modalidade se não encontrou no cadastro
              const modalidadeAtual = updates.MODALIDADE || registro.MODALIDADE;
              if (!registro.CATEGORIA || registro.CATEGORIA === 'SC' || registro.CATEGORIA === '') {
                switch (modalidadeAtual) {
                  case 'MR':
                    updates.CATEGORIA = 'RM';
                    needsUpdate = true;
                    correcoesCategorias++;
                    break;
                  case 'CT':
                    updates.CATEGORIA = 'TC';
                    needsUpdate = true;
                    correcoesCategorias++;
                    break;
                  case 'RX':
                    updates.CATEGORIA = 'RX';
                    needsUpdate = true;
                    correcoesCategorias++;
                    break;
                  case 'MG':
                    updates.CATEGORIA = 'MG';
                    needsUpdate = true;
                    correcoesCategorias++;
                    break;
                  case 'DO':
                    updates.CATEGORIA = 'DO';
                    needsUpdate = true;
                    correcoesCategorias++;
                    break;
                  default:
                    if (!registro.CATEGORIA || registro.CATEGORIA === '') {
                      updates.CATEGORIA = 'SC';
                      needsUpdate = true;
                    }
                }
              }
            }
          }

          // 4. DE-PARA PRIORIDADES
          if (registro.PRIORIDADE) {
            const novaPrioridade = mapaPrioridades.get(registro.PRIORIDADE.toUpperCase().trim());
            if (novaPrioridade && novaPrioridade !== registro.PRIORIDADE) {
              updates.PRIORIDADE = novaPrioridade;
              needsUpdate = true;
              correcoesPrioridades++;
            }
            // Correção específica para AMBULATORIO
            if (registro.PRIORIDADE === 'AMBULATORIO') {
              updates.PRIORIDADE = 'ROTINA';
              needsUpdate = true;
              correcoesPrioridades++;
            }
          }

          // 5. DE-PARA VALORES (apenas se valor for 0 ou null)
          if ((!registro.VALORES || registro.VALORES === 0) && registro.ESTUDO_DESCRICAO) {
            const novoValor = mapaValores.get(registro.ESTUDO_DESCRICAO.toUpperCase().trim());
            if (novoValor && novoValor > 0) {
              updates.VALORES = novoValor;
              needsUpdate = true;
              correcoesValores++;
            }
          }

          // Tipificação de faturamento removida - deve ser feita por regras específicas de negócio

          // Aplicar as atualizações se necessário
          if (needsUpdate) {
            updates.updated_at = new Date().toISOString();
            
            const { error: updateError } = await supabase
              .from('volumetria_mobilemed')
              .update(updates)
              .eq('id', registro.id);

            if (updateError) {
              console.error(`❌ Erro ao atualizar registro ${registro.id}:`, updateError);
            }
          }
        }
      }

      const totalCorrecoesList = [
        correcoesModalidades,
        correcoesEspecialidades, 
        correcoesCategorias,
        correcoesPrioridades,
        correcoesValores,
        corrrecoesTipificacao
      ];

      const totalCorrecoesArquivo = totalCorrecoesList.reduce((sum, count) => sum + count, 0);
      totalCorrigidos += totalCorrecoesArquivo;

      statusRegras.push({
        regra: `Aplicação Completa de Regras - ${arquivo}`,
        aplicada: true,
        detalhes: {
          registros_processados: registros?.length || 0,
          correções_modalidades: correcoesModalidades,
          correções_especialidades: correcoesEspecialidades,
          correções_categorias: correcoesCategorias,
          correções_prioridades: correcoesPrioridades,
          correções_valores: correcoesValores,
          correções_tipificacao: corrrecoesTipificacao,
          total_correções: totalCorrecoesArquivo
        }
      });

      console.log(`✅ ${arquivo} processado: ${totalCorrecoesArquivo} correções aplicadas`);
      console.log(`   - Modalidades: ${correcoesModalidades}`);
      console.log(`   - Especialidades: ${correcoesEspecialidades}`);
      console.log(`   - Categorias: ${correcoesCategorias}`);
      console.log(`   - Prioridades: ${correcoesPrioridades}`);
      console.log(`   - Valores: ${correcoesValores}`);
      console.log(`   - Tipificação: ${corrrecoesTipificacao}`);

      totalProcessados += registros?.length || 0;
    }

    const resultado = {
      success: true,
      total_processados: totalProcessados,
      total_corrigidos: totalCorrigidos,
      status_regras: statusRegras,
      arquivo_fonte: aplicar_todos_arquivos ? 'TODOS_OS_ARQUIVOS' : arquivo_fonte,
      periodo_referencia,
      timestamp: new Date().toISOString(),
      observacao: 'Nova abordagem: aplicação direta registro por registro'
    };

    console.log('🏆 Processamento sistema completo concluído:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('❌ Erro na aplicação de regras sistema completo:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        erro: error.message,
        detalhes: error.stack,
        observacoes: 'Erro interno no processamento das regras'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});