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

    const { arquivo_fonte, periodo_referencia = '2025-06', aplicar_todos_arquivos = false } = await req.json();
    
    // Se aplicar_todos_arquivos for true, processar todos os arquivos
    const arquivosParaProcessar = aplicar_todos_arquivos 
      ? ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo']
      : [arquivo_fonte];
    
    if (!aplicar_todos_arquivos && !arquivo_fonte) {
      throw new Error('Parâmetro arquivo_fonte é obrigatório quando aplicar_todos_arquivos for false');
    }

    console.log(`🎯 Iniciando aplicação unificada de regras para: ${aplicar_todos_arquivos ? 'TODOS OS ARQUIVOS' : arquivo_fonte}`);
    console.log(`📊 Período de referência: ${periodo_referencia}`);
    console.log(`📁 Arquivos a processar: ${arquivosParaProcessar.join(', ')}`);
    
    const statusRegras: StatusRegra[] = [];
    let totalProcessados = 0;
    let totalCorrigidos = 0;

    // Loop para processar cada arquivo
    for (const arquivo of arquivosParaProcessar) {
      console.log(`\n🔄 Processando arquivo: ${arquivo}`);
      
      // Primeiro, vamos verificar quantos registros sem categoria existem
      const { count: registrosSemCategoriaCount } = await supabase
        .from('volumetria_mobilemed')
        .select('*', { count: 'exact', head: true })
        .eq('arquivo_fonte', arquivo)
        .or('"CATEGORIA".is.null,"CATEGORIA".eq.""');
      
      console.log(`📊 Total de registros sem categoria encontrados no ${arquivo}: ${registrosSemCategoriaCount}`);

      // ============================================================================
      // ETAPA 1: CORREÇÃO DE MODALIDADES
      // ============================================================================
      
      console.log(`🔄 [1/6] Corrigindo modalidades no ${arquivo}...`);
      try {
        // 1.1. BMD → DO
        const { data: bmdRegistros, error: errorBMD } = await supabase
          .from('volumetria_mobilemed')
          .update({ "MODALIDADE": 'DO', updated_at: new Date().toISOString() })
          .eq('arquivo_fonte', arquivo)
          .eq('MODALIDADE', 'BMD')
          .select('id');

        const correcoesBMD = bmdRegistros?.length || 0;

        // 1.2. CR/DX → RX (sem mamografias) - usando RPC
        const { data: rxResult, error: errorRX } = await supabase
          .rpc('update_modalidade_cr_dx_to_rx', {
            p_arquivo_fonte: arquivo
          });

        const correcoesRX = rxResult || 0;

        // 1.3. Mamografias CR/DX → MG - usando RPC
        const { data: mgResult, error: errorMG } = await supabase
          .rpc('update_modalidade_mamografia_to_mg', {
            p_arquivo_fonte: arquivo
          });

        const correcoesMG = mgResult || 0;
        const totalModalidades = correcoesBMD + correcoesRX + correcoesMG;

        const arquivoModalidadeStatus = {
          regra: `Correção de Modalidades - ${arquivo}`,
          aplicada: !errorBMD && !errorRX && !errorMG,
          erro: errorBMD?.message || errorRX?.message || errorMG?.message,
          detalhes: { BMD_para_DO: correcoesBMD, CRDX_para_RX: correcoesRX, CRDX_para_MG: correcoesMG }
        };

        statusRegras.push(arquivoModalidadeStatus);
        totalCorrigidos += totalModalidades;
        console.log(`✅ Modalidades corrigidas no ${arquivo}: ${totalModalidades} registros`);
      } catch (error: any) {
        statusRegras.push({
          regra: `Correção de Modalidades - ${arquivo}`,
          aplicada: false,
          erro: error.message
        });
      }

      // ============================================================================
      // ETAPA 2: CORREÇÃO DE ESPECIALIDADES PROBLEMÁTICAS
      // ============================================================================
      
      console.log(`🔄 [2/6] Corrigindo especialidades problemáticas no ${arquivo}...`);
      try {
        // 2.1. ONCO MEDICINA INTERNA → MEDICINA INTERNA
        const { data: oncoCorrigidos, error: errorOnco } = await supabase
          .from('volumetria_mobilemed')
          .update({ "ESPECIALIDADE": 'MEDICINA INTERNA', updated_at: new Date().toISOString() })
          .eq('arquivo_fonte', arquivo)
          .eq('ESPECIALIDADE', 'ONCO MEDICINA INTERNA')
          .select('id');

        // 2.2. CT → MEDICINA INTERNA (CT não é especialidade, é modalidade)  
        const { data: ctCorrigidos, error: errorCT } = await supabase
          .from('volumetria_mobilemed')
          .update({ "ESPECIALIDADE": 'MEDICINA INTERNA', updated_at: new Date().toISOString() })
          .eq('arquivo_fonte', arquivo)
          .eq('ESPECIALIDADE', 'CT')
          .select('id');

        // 2.3. Colunas → MUSCULO ESQUELETICO
        const { data: colunasCorrigidos, error: errorColunas } = await supabase
          .from('volumetria_mobilemed')
          .update({ "ESPECIALIDADE": 'MUSCULO ESQUELETICO', updated_at: new Date().toISOString() })
          .eq('arquivo_fonte', arquivo)
          .eq('ESPECIALIDADE', 'Colunas')
          .select('id');

        // 2.4. GERAL → MEDICINA INTERNA (GERAL não é especialidade válida)
        const { data: geralCorrigidos, error: errorGeral } = await supabase
          .from('volumetria_mobilemed')
          .update({ "ESPECIALIDADE": 'MEDICINA INTERNA', updated_at: new Date().toISOString() })
          .eq('arquivo_fonte', arquivo)
          .eq('ESPECIALIDADE', 'GERAL')
          .select('id');

        const totalEspecialidades = (oncoCorrigidos?.length || 0) + (ctCorrigidos?.length || 0) + (colunasCorrigidos?.length || 0) + (geralCorrigidos?.length || 0);

        statusRegras.push({
          regra: `Correção de Especialidades - ${arquivo}`,
          aplicada: !errorOnco && !errorCT && !errorColunas && !errorGeral,
          erro: errorOnco?.message || errorCT?.message || errorColunas?.message || errorGeral?.message,
          detalhes: { 
            ONCO_MEDICINA_INTERNA: oncoCorrigidos?.length || 0,
            CT_para_MEDICINA_INTERNA: ctCorrigidos?.length || 0,
            Colunas_para_MUSCULO: colunasCorrigidos?.length || 0,
            GERAL_para_MEDICINA_INTERNA: geralCorrigidos?.length || 0
          }
        });

        totalCorrigidos += totalEspecialidades;
        console.log(`✅ Especialidades corrigidas no ${arquivo}: ${totalEspecialidades} registros`);
      } catch (error: any) {
        statusRegras.push({
          regra: `Correção de Especialidades - ${arquivo}`,
          aplicada: false,
          erro: error.message
        });
      }

      // ============================================================================
      // ETAPA 3: CORREÇÃO DE PRIORIDADES
      // ============================================================================
      
      console.log(`🔄 [3/6] Corrigindo prioridades no ${arquivo}...`);
      try {
        // AMBULATORIO → ROTINA
        const { data: ambulatorioCorrigidos, error: errorAmbulatorio } = await supabase
          .from('volumetria_mobilemed')
          .update({ "PRIORIDADE": 'ROTINA', updated_at: new Date().toISOString() })
          .eq('arquivo_fonte', arquivo)
          .eq('PRIORIDADE', 'AMBULATORIO')
          .select('id');

        const totalPrioridades = ambulatorioCorrigidos?.length || 0;

        statusRegras.push({
          regra: `Correção de Prioridades - ${arquivo}`,
          aplicada: !errorAmbulatorio,
          erro: errorAmbulatorio?.message,
          detalhes: { AMBULATORIO_para_ROTINA: totalPrioridades }
        });

        totalCorrigidos += totalPrioridades;
        console.log(`✅ Prioridades corrigidas no ${arquivo}: ${totalPrioridades} registros`);
      } catch (error: any) {
        statusRegras.push({
          regra: `Correção de Prioridades - ${arquivo}`,
          aplicada: false,
          erro: error.message
        });
      }

      // ============================================================================
      // ETAPA 4: APLICAÇÃO DE CATEGORIAS
      // ============================================================================
      
      console.log(`🔄 [4/6] Aplicando categorias no ${arquivo}...`);
      try {
        let totalCategorias = 0;
        
        // MR → RM
        const { data: updateMR, error: errorMR } = await supabase
          .rpc('update_categoria_by_modalidade', {
            p_arquivo_fonte: arquivo,
            p_modalidade: 'MR',
            p_categoria: 'RM'
          });
        
        if (!errorMR) totalCategorias += updateMR || 0;
        
        // CT → TC  
        const { data: updateCT, error: errorCT } = await supabase
          .rpc('update_categoria_by_modalidade', {
            p_arquivo_fonte: arquivo,
            p_modalidade: 'CT',
            p_categoria: 'TC'
          });
        
        if (!errorCT) totalCategorias += updateCT || 0;
        
        // RX → RX
        const { data: updateRX, error: errorRX } = await supabase
          .rpc('update_categoria_by_modalidade', {
            p_arquivo_fonte: arquivo,
            p_modalidade: 'RX',
            p_categoria: 'RX'
          });
        
        if (!errorRX) totalCategorias += updateRX || 0;
        
        // MG → MG
        const { data: updateMG, error: errorMG } = await supabase
          .rpc('update_categoria_by_modalidade', {
            p_arquivo_fonte: arquivo,
            p_modalidade: 'MG',
            p_categoria: 'MG'
          });
        
        if (!errorMG) totalCategorias += updateMG || 0;
        
        // DO → DO
        const { data: updateDO, error: errorDO } = await supabase
          .rpc('update_categoria_by_modalidade', {
            p_arquivo_fonte: arquivo,
            p_modalidade: 'DO',
            p_categoria: 'DO'
          });
        
        if (!errorDO) totalCategorias += updateDO || 0;

        statusRegras.push({
          regra: `Aplicação de Categorias - ${arquivo}`,
          aplicada: true,
          detalhes: { 
            total_categorias_aplicadas: totalCategorias,
            MR_para_RM: updateMR || 0,
            CT_para_TC: updateCT || 0,
            RX_para_RX: updateRX || 0,
            MG_para_MG: updateMG || 0,
            DO_para_DO: updateDO || 0
          }
        });

        totalCorrigidos += totalCategorias;
        console.log(`✅ Categorias aplicadas no ${arquivo}: ${totalCategorias} registros`);
        
      } catch (error: any) {
        console.error(`❌ ERRO na aplicação de categorias no ${arquivo}:`, error);
        statusRegras.push({
          regra: `Aplicação de Categorias - ${arquivo}`,
          aplicada: false,
          erro: error.message
        });
      }

      // ============================================================================
      // ETAPA 5: TIPIFICAÇÃO DE FATURAMENTO
      // ============================================================================
      
      console.log(`🔄 [5/6] Aplicando tipificação de faturamento no ${arquivo}...`);
      try {
        // Alta complexidade
        const { error: errorAltaComplexidade } = await supabase
          .from('volumetria_mobilemed')
          .update({ 
            tipo_faturamento: 'alta_complexidade',
            updated_at: new Date().toISOString()
          })
          .eq('arquivo_fonte', arquivo)
          .in('MODALIDADE', ['TC', 'RM', 'DO'])
          .or('tipo_faturamento.is.null,tipo_faturamento.eq.""');

        // Padrão
        const { error: errorPadrao } = await supabase
          .from('volumetria_mobilemed')
          .update({ 
            tipo_faturamento: 'padrao',
            updated_at: new Date().toISOString()
          })
          .eq('arquivo_fonte', arquivo)
          .not('MODALIDADE', 'in', '("TC","RM","DO")')
          .or('tipo_faturamento.is.null,tipo_faturamento.eq.""');

        statusRegras.push({
          regra: `Tipificação de Faturamento - ${arquivo}`,
          aplicada: !errorAltaComplexidade && !errorPadrao,
          erro: errorAltaComplexidade?.message || errorPadrao?.message
        });

        console.log(`✅ Tipificação de faturamento aplicada no ${arquivo}`);
      } catch (error: any) {
        statusRegras.push({
          regra: `Tipificação de Faturamento - ${arquivo}`,
          aplicada: false,
          erro: error.message
        });
      }

      // Contagem de registros processados para este arquivo
      const { count: registrosArquivo } = await supabase
        .from('volumetria_mobilemed')
        .select('*', { count: 'exact', head: true })
        .eq('arquivo_fonte', arquivo);

      totalProcessados += registrosArquivo || 0;
    }

    // ============================================================================
    // FINALIZAÇÃO
    // ============================================================================
    
    console.log('🔄 [6/6] Finalizando processamento...');

    const resultado = {
      success: statusRegras.every(r => r.aplicada),
      total_processados: totalProcessados,
      total_corrigidos: totalCorrigidos,
      status_regras: statusRegras,
      arquivo_fonte: aplicar_todos_arquivos ? 'TODOS_OS_ARQUIVOS' : arquivo_fonte,
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