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

    const { arquivo_fonte, periodo_referencia = '2025-06' } = await req.json();
    
    if (!arquivo_fonte) {
      throw new Error('Parâmetro arquivo_fonte é obrigatório');
    }

    console.log(`🎯 Iniciando aplicação unificada de regras para: ${arquivo_fonte}`);

    const statusRegras: StatusRegra[] = [];
    let totalProcessados = 0;
    let totalCorrigidos = 0;

    // ============================================================================
    // ETAPA 1: CORREÇÃO DE MODALIDADES
    // ============================================================================
    
    console.log('🔄 [1/6] Corrigindo modalidades...');
    try {
      // 1.1. BMD → DO
      const { data: bmdRegistros, error: errorBMD } = await supabase
        .from('volumetria_mobilemed')
        .update({ "MODALIDADE": 'DO', updated_at: new Date().toISOString() })
        .eq('arquivo_fonte', arquivo_fonte)
        .eq('MODALIDADE', 'BMD')
        .select('id');

      const correcoesBMD = bmdRegistros?.length || 0;

      // 1.2. CR/DX → RX (sem mamografias) - usando RPC para contornar problema do column
      const { data: rxResult, error: errorRX } = await supabase
        .rpc('update_modalidade_cr_dx_to_rx', {
          p_arquivo_fonte: arquivo_fonte
        });

      const correcoesRX = rxResult || 0;

      // 1.3. Mamografias CR/DX → MG - usando RPC para contornar problema do column  
      const { data: mgResult, error: errorMG } = await supabase
        .rpc('update_modalidade_mamografia_to_mg', {
          p_arquivo_fonte: arquivo_fonte
        });

      const correcoesMG = mgResult || 0;
      const totalModalidades = correcoesBMD + correcoesRX + correcoesMG;

      statusRegras.push({
        regra: 'Correção de Modalidades',
        aplicada: !errorBMD && !errorRX && !errorMG,
        erro: errorBMD?.message || errorRX?.message || errorMG?.message,
        detalhes: { BMD_para_DO: correcoesBMD, CRDX_para_RX: correcoesRX, CRDX_para_MG: correcoesMG }
      });

      totalCorrigidos += totalModalidades;
      console.log(`✅ Modalidades corrigidas: ${totalModalidades} registros`);
    } catch (error: any) {
      statusRegras.push({
        regra: 'Correção de Modalidades',
        aplicada: false,
        erro: error.message
      });
    }

    // ============================================================================
    // ETAPA 2: CORREÇÃO DE ESPECIALIDADES PROBLEMÁTICAS
    // ============================================================================
    
    console.log('🔄 [2/6] Corrigindo especialidades problemáticas...');
    try {
      // 2.1. ONCO MEDICINA INTERNA → MEDICINA INTERNA
      const { data: oncoCorrigidos, error: errorOnco } = await supabase
        .from('volumetria_mobilemed')
        .update({ "ESPECIALIDADE": 'MEDICINA INTERNA', updated_at: new Date().toISOString() })
        .eq('arquivo_fonte', arquivo_fonte)
        .eq('ESPECIALIDADE', 'ONCO MEDICINA INTERNA')
        .select('id');

      // 2.2. CT → GERAL (CT não é especialidade, é modalidade)  
      const { data: ctCorrigidos, error: errorCT } = await supabase
        .from('volumetria_mobilemed')
        .update({ "ESPECIALIDADE": 'GERAL', updated_at: new Date().toISOString() })
        .eq('arquivo_fonte', arquivo_fonte)
        .eq('ESPECIALIDADE', 'CT')
        .select('id');

      // 2.3. Colunas → MUSCULOESQUELETICO
      const { data: colunasCorrigidos, error: errorColunas } = await supabase
        .from('volumetria_mobilemed')
        .update({ "ESPECIALIDADE": 'MUSCULOESQUELETICO', updated_at: new Date().toISOString() })
        .eq('arquivo_fonte', arquivo_fonte)
        .eq('ESPECIALIDADE', 'Colunas')
        .select('id');

      const totalEspecialidades = (oncoCorrigidos?.length || 0) + (ctCorrigidos?.length || 0) + (colunasCorrigidos?.length || 0);

      statusRegras.push({
        regra: 'Correção de Especialidades',
        aplicada: !errorOnco && !errorCT && !errorColunas,
        erro: errorOnco?.message || errorCT?.message || errorColunas?.message,
        detalhes: { 
          ONCO_MEDICINA_INTERNA: oncoCorrigidos?.length || 0,
          CT_para_GERAL: ctCorrigidos?.length || 0,
          Colunas_para_MUSCULO: colunasCorrigidos?.length || 0
        }
      });

      totalCorrigidos += totalEspecialidades;
      console.log(`✅ Especialidades corrigidas: ${totalEspecialidades} registros`);
    } catch (error: any) {
      statusRegras.push({
        regra: 'Correção de Especialidades',
        aplicada: false,
        erro: error.message
      });
    }

    // ============================================================================
    // ETAPA 3: CORREÇÃO DE PRIORIDADES
    // ============================================================================
    
    console.log('🔄 [3/6] Corrigindo prioridades...');
    try {
      // AMBULATORIO → ROTINA
      const { data: ambulatorioCorrigidos, error: errorAmbulatorio } = await supabase
        .from('volumetria_mobilemed')
        .update({ "PRIORIDADE": 'ROTINA', updated_at: new Date().toISOString() })
        .eq('arquivo_fonte', arquivo_fonte)
        .eq('PRIORIDADE', 'AMBULATORIO')
        .select('id');

      const totalPrioridades = ambulatorioCorrigidos?.length || 0;

      statusRegras.push({
        regra: 'Correção de Prioridades',
        aplicada: !errorAmbulatorio,
        erro: errorAmbulatorio?.message,
        detalhes: { AMBULATORIO_para_ROTINA: totalPrioridades }
      });

      totalCorrigidos += totalPrioridades;
      console.log(`✅ Prioridades corrigidas: ${totalPrioridades} registros`);
    } catch (error: any) {
      statusRegras.push({
        regra: 'Correção de Prioridades',
        aplicada: false,
        erro: error.message
      });
    }

    // ============================================================================
    // ETAPA 4: APLICAÇÃO DE CATEGORIAS - PROCESSAMENTO EM LOTES
    // ============================================================================
    
    console.log('🔄 [4/6] Aplicando categorias em lotes...');
    try {
      // Buscar cadastro de exames para referência
      const { data: cadastroExames } = await supabase
        .from('cadastro_exames')
        .select('nome, categoria')
        .eq('ativo', true)
        .not('categoria', 'is', null)
        .neq('categoria', '');

      const mapeamentoCategorias = new Map();
      cadastroExames?.forEach(exame => {
        const nomeNormalizado = exame.nome.toUpperCase().trim();
        mapeamentoCategorias.set(nomeNormalizado, exame.categoria);
      });

      // Categorias padrão por modalidade (corrigidas)
      const categoriasPadrao: Record<string, string> = {
        'TC': 'TC', 
        'CT': 'TC',  // CT é modalidade, categoria é TC
        'MR': 'RM',  // MR é modalidade, categoria é RM  
        'RM': 'RM', 
        'RX': 'RX', 
        'MG': 'MG', 
        'US': 'US', 
        'DO': 'DO', 
        'MN': 'MN', 
        'CR': 'RX', 
        'DX': 'RX', 
        'BMD': 'DO', 
        'OT': 'GERAL'
      };

      let totalCategorias = 0;
      let offset = 0;
      const loteSize = 2000; // Processar em lotes de 2000

      console.log(`📊 Buscando registros sem categoria para arquivo: ${arquivo_fonte}`);

      while (true) {
        // Buscar registros sem categoria em lotes
        const { data: registrosSemCategoria, error: errorBusca } = await supabase
          .from('volumetria_mobilemed')
          .select('id, "ESTUDO_DESCRICAO", "MODALIDADE"')
          .eq('arquivo_fonte', arquivo_fonte)
          .or('"CATEGORIA".is.null,"CATEGORIA".eq.""')
          .range(offset, offset + loteSize - 1);

        console.log(`📊 Lote ${Math.floor(offset/loteSize) + 1}: ${registrosSemCategoria?.length || 0} registros sem categoria`);

        if (errorBusca || !registrosSemCategoria || registrosSemCategoria.length === 0) {
          break;
        }

        // Agrupar atualizações por categoria
        const atualizacoesPorCategoria: Record<string, string[]> = {};

        for (const registro of registrosSemCategoria) {
          let categoria = '';
          
          // Buscar no cadastro de exames
          const estudoNormalizado = registro.ESTUDO_DESCRICAO?.toUpperCase().trim() || '';
          
          if (mapeamentoCategorias.has(estudoNormalizado)) {
            categoria = mapeamentoCategorias.get(estudoNormalizado);
          } else {
            // Busca por palavras-chave
            let encontrado = false;
            for (const [nomeExame, cat] of mapeamentoCategorias) {
              if (estudoNormalizado.includes(nomeExame) || nomeExame.includes(estudoNormalizado)) {
                categoria = cat;
                encontrado = true;
                break;
              }
            }
            
            // Se não encontrou, usar categoria padrão por modalidade
            if (!encontrado) {
              categoria = categoriasPadrao[registro.MODALIDADE] || 'GERAL';
              console.log(`📋 Usando categoria padrão: ${registro.MODALIDADE} -> ${categoria} para "${estudoNormalizado}"`);
            }
          }

          if (categoria) {
            if (!atualizacoesPorCategoria[categoria]) {
              atualizacoesPorCategoria[categoria] = [];
            }
            atualizacoesPorCategoria[categoria].push(registro.id);
          }
        }

        // Executar atualizações em bulk por categoria
        for (const [categoria, ids] of Object.entries(atualizacoesPorCategoria)) {
          if (ids.length > 0) {
            console.log(`🔄 Aplicando categoria "${categoria}" em ${ids.length} registros`);
            
            const { error: updateError } = await supabase
              .from('volumetria_mobilemed')
              .update({ 
                "CATEGORIA": categoria,
                updated_at: new Date().toISOString()
              })
              .in('id', ids);

            if (updateError) {
              console.error(`❌ Erro ao aplicar categoria "${categoria}":`, updateError);
            } else {
              totalCategorias += ids.length;
              console.log(`✅ Categoria "${categoria}" aplicada com sucesso em ${ids.length} registros`);
            }
          }
        }

        offset += loteSize;
        
        // Se o lote retornou menos registros que o tamanho do lote, terminamos
        if (registrosSemCategoria.length < loteSize) {
          break;
        }
      }

      statusRegras.push({
        regra: 'Aplicação de Categorias',
        aplicada: true,
        detalhes: { 
          total_categorias_aplicadas: totalCategorias,
          mapeamentos_disponveis: mapeamentoCategorias.size
        }
      });

      totalCorrigidos += totalCategorias;
      console.log(`✅ Categorias aplicadas: ${totalCategorias} registros`);
    } catch (error: any) {
      statusRegras.push({
        regra: 'Aplicação de Categorias',
        aplicada: false,
        erro: error.message
      });
    }

    // ============================================================================
    // ETAPA 5: TIPIFICAÇÃO DE FATURAMENTO
    // ============================================================================
    
    console.log('🔄 [5/6] Aplicando tipificação de faturamento...');
    try {
      // Alta complexidade
      const { error: errorAltaComplexidade } = await supabase
        .from('volumetria_mobilemed')
        .update({ 
          tipo_faturamento: 'alta_complexidade',
          updated_at: new Date().toISOString()
        })
        .eq('arquivo_fonte', arquivo_fonte)
        .in('MODALIDADE', ['TC', 'RM', 'DO'])
        .or('tipo_faturamento.is.null,tipo_faturamento.eq.""');

      // Padrão
      const { error: errorPadrao } = await supabase
        .from('volumetria_mobilemed')
        .update({ 
          tipo_faturamento: 'padrao',
          updated_at: new Date().toISOString()
        })
        .eq('arquivo_fonte', arquivo_fonte)
        .not('MODALIDADE', 'in', '("TC","RM","DO")')
        .or('tipo_faturamento.is.null,tipo_faturamento.eq.""');

      statusRegras.push({
        regra: 'Tipificação de Faturamento',
        aplicada: !errorAltaComplexidade && !errorPadrao,
        erro: errorAltaComplexidade?.message || errorPadrao?.message
      });

      console.log(`✅ Tipificação de faturamento aplicada`);
    } catch (error: any) {
      statusRegras.push({
        regra: 'Tipificação de Faturamento',
        aplicada: false,
        erro: error.message
      });
    }

    // ============================================================================
    // ETAPA 6: CONTAGEM FINAL
    // ============================================================================
    
    console.log('🔄 [6/6] Finalizando processamento...');
    const { count: totalRegistros } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', arquivo_fonte);

    totalProcessados = totalRegistros || 0;

    // Log da operação
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'APLICACAO_REGRAS_UNIFICADA',
        record_id: arquivo_fonte,
        new_data: {
          arquivo_fonte,
          periodo_referencia,
          total_processados: totalProcessados,
          total_corrigidos: totalCorrigidos,
          status_regras: statusRegras,
          timestamp: new Date().toISOString()
        },
        user_email: 'system',
        severity: 'info'
      });

    const resultado = {
      success: statusRegras.every(r => r.aplicada),
      total_processados: totalProcessados,
      total_corrigidos: totalCorrigidos,
      status_regras: statusRegras,
      arquivo_fonte,
      periodo_referencia,
      timestamp: new Date().toISOString()
    };

    console.log('🏆 Processamento unificado concluído:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('❌ Erro no processamento unificado:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});