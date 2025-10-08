import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const { arquivo_fonte, periodo_referencia } = requestBody;
    
    console.log(`🎯 APLICAR EXCLUSÕES POR PERÍODO v002/v003`);
    console.log(`📝 Request body completo:`, JSON.stringify(requestBody, null, 2));
    console.log(`📁 Arquivo: ${arquivo_fonte}`);
    console.log(`📅 Período: ${periodo_referencia}`);

    // Validar arquivo_fonte
    const arquivosValidos = [
      'volumetria_padrao',
      'volumetria_fora_padrao', 
      'volumetria_padrao_retroativo',
      'volumetria_fora_padrao_retroativo',
      'volumetria_onco_padrao',
      'arquivo_1_padrao',
      'arquivo_2_padrao',
      'arquivo_3_padrao', 
      'arquivo_4_padrao',
      'arquivo_5_padrao'
    ];

    if (!arquivosValidos.includes(arquivo_fonte)) {
      return new Response(JSON.stringify({
        sucesso: false,
        erro: `Arquivo ${arquivo_fonte} não é válido para esta regra`
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const isRetroativo = arquivo_fonte.includes('retroativo');
    console.log(`🔍 Tipo de arquivo: ${isRetroativo ? 'RETROATIVO' : 'PADRÃO'}`);

    if (!isRetroativo) {
      console.log(`⏸️ Arquivo ${arquivo_fonte} não é retroativo - regras v002/v003 não aplicáveis`);
      return new Response(JSON.stringify({
        sucesso: true,
        arquivo_fonte,
        periodo_referencia,
        mensagem: 'Regras v002/v003 são aplicáveis apenas para arquivos retroativos',
        registros_encontrados: 0,
        registros_excluidos: 0
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Calcular datas baseado no período de referência
    // RETROATIVOS: DATA_REALIZACAO antiga + DATA_LAUDO no período atual
    let dataLimiteRealizacao: Date;
    let dataInicioJanelaLaudo: Date;
    let dataFimJanelaLaudo: Date;
    
    const [mes, ano] = periodo_referencia.split('/');
    const meses: { [key: string]: number } = {
      'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
      'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12
    };
    const anoCompleto = 2000 + parseInt(ano);
    const mesNumero = meses[mes];
    
    // v003: Excluir DATA_REALIZACAO >= primeiro dia do mês de referência
    // Para retroativos de set/25, exclui DATA_REALIZACAO >= 2025-09-01
    // (mantém registros com DATA_REALIZACAO em julho/agosto)
    dataLimiteRealizacao = new Date(anoCompleto, mesNumero - 1, 1);
    
    // v002: Janela válida do DATA_LAUDO (dia 8 do mês ref até dia 7 do mês seguinte)
    // Para set/25: 2025-09-08 até 2025-10-07
    dataInicioJanelaLaudo = new Date(anoCompleto, mesNumero - 1, 8);
    dataFimJanelaLaudo = new Date(anoCompleto, mesNumero, 7);

    const dataLimiteRealizacaoStr = dataLimiteRealizacao.toISOString().split('T')[0];
    const dataInicioJanelaLaudoStr = dataInicioJanelaLaudo.toISOString().split('T')[0];
    const dataFimJanelaLaudoStr = dataFimJanelaLaudo.toISOString().split('T')[0];

    console.log(`📊 REGRAS APLICADAS:`);
    console.log(`   v003 - Excluir DATA_REALIZACAO >= ${dataLimiteRealizacaoStr}`);
    console.log(`   v002 - Manter DATA_LAUDO apenas entre ${dataInicioJanelaLaudoStr} e ${dataFimJanelaLaudoStr}`);

    // Verificar registros totais antes da aplicação
    const { count: totalRegistrosInicial } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', arquivo_fonte);

    console.log(`📊 Total de registros inicial: ${totalRegistrosInicial || 0}`);

    let totalExcludosV003 = 0;
    let totalExcludosV002 = 0;

    // ===== APLICAR REGRA v003 PRIMEIRO =====
    console.log(`🔧 Aplicando v003: Excluindo DATA_REALIZACAO >= ${dataLimiteRealizacaoStr}...`);
    
    const { count: registrosV003, error: errorV003Count } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', arquivo_fonte)
      .gte('DATA_REALIZACAO', dataLimiteRealizacaoStr);

    if (errorV003Count) {
      console.error('❌ Erro ao contar registros v003:', errorV003Count);
      return new Response(JSON.stringify({ 
        sucesso: false, 
        erro: errorV003Count.message 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      });
    }

    console.log(`📊 v003: ${registrosV003 || 0} registros encontrados para exclusão`);

    if (registrosV003 && registrosV003 > 0) {
      // Excluir em lotes
      const BATCH_SIZE = 100;
      let processedBatches = 0;
      
      while (true) {
        const { data: idsToDelete, error: selectError } = await supabase
          .from('volumetria_mobilemed')
          .select('id')
          .eq('arquivo_fonte', arquivo_fonte)
          .gte('DATA_REALIZACAO', dataLimiteRealizacaoStr)
          .order('id')
          .limit(BATCH_SIZE);

        if (selectError || !idsToDelete || idsToDelete.length === 0) {
          break;
        }

        const idsArray = idsToDelete.map(row => row.id);
        const { error: deleteError, count } = await supabase
          .from('volumetria_mobilemed')
          .delete({ count: 'exact' })
          .in('id', idsArray);

        if (deleteError) {
          console.error('❌ Erro ao excluir registros v003:', deleteError);
          break;
        }

        const batchDeleted = count || 0;
        totalExcludosV003 += batchDeleted;
        processedBatches++;
        
        console.log(`v003 - Lote ${processedBatches}: ${batchDeleted} excluídos (Total v003: ${totalExcludosV003})`);
        
        if (batchDeleted < BATCH_SIZE) break;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    console.log(`✅ v003 concluída: ${totalExcludosV003} registros excluídos`);

    // ===== APLICAR REGRA v002 NOS REGISTROS RESTANTES =====
    console.log(`🔧 Aplicando v002: Excluindo DATA_LAUDO fora da janela ${dataInicioJanelaLaudoStr} - ${dataFimJanelaLaudoStr}...`);
    
    const { count: registrosV002, error: errorV002Count } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', arquivo_fonte)
      .or(`DATA_LAUDO.lt.${dataInicioJanelaLaudoStr},DATA_LAUDO.gt.${dataFimJanelaLaudoStr}`);

    if (errorV002Count) {
      console.error('❌ Erro ao contar registros v002:', errorV002Count);
    } else {
      console.log(`📊 v002: ${registrosV002 || 0} registros encontrados para exclusão`);

      if (registrosV002 && registrosV002 > 0) {
        // Excluir em lotes
        const BATCH_SIZE = 100;
        let processedBatches = 0;
        
        while (true) {
          const { data: idsToDelete, error: selectError } = await supabase
            .from('volumetria_mobilemed')
            .select('id')
            .eq('arquivo_fonte', arquivo_fonte)
            .or(`DATA_LAUDO.lt.${dataInicioJanelaLaudoStr},DATA_LAUDO.gt.${dataFimJanelaLaudoStr}`)
            .order('id')
            .limit(BATCH_SIZE);

          if (selectError || !idsToDelete || idsToDelete.length === 0) {
            break;
          }

          const idsArray = idsToDelete.map(row => row.id);
          const { error: deleteError, count } = await supabase
            .from('volumetria_mobilemed')
            .delete({ count: 'exact' })
            .in('id', idsArray);

          if (deleteError) {
            console.error('❌ Erro ao excluir registros v002:', deleteError);
            break;
          }

          const batchDeleted = count || 0;
          totalExcludosV002 += batchDeleted;
          processedBatches++;
          
          console.log(`v002 - Lote ${processedBatches}: ${batchDeleted} excluídos (Total v002: ${totalExcludosV002})`);
          
          if (batchDeleted < BATCH_SIZE) break;
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    }

    console.log(`✅ v002 concluída: ${totalExcludosV002} registros excluídos`);

    // Verificar registros finais
    const { count: registrosFinais } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', arquivo_fonte);

    const totalExcluidos = totalExcludosV003 + totalExcludosV002;

    // Log da operação
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'REGRAS_V002_V003_APLICADAS',
        record_id: arquivo_fonte,
        new_data: {
          arquivo_fonte,
          periodo_referencia,
          registros_inicial: totalRegistrosInicial || 0,
          registros_excluidos_v003: totalExcludosV003,
          registros_excluidos_v002: totalExcludosV002,
          total_excluidos: totalExcluidos,
          registros_finais: registrosFinais || 0,
          regras: 'v002_v003',
          data_limite_realizacao: dataLimiteRealizacaoStr,
          janela_laudo_inicio: dataInicioJanelaLaudoStr,
          janela_laudo_fim: dataFimJanelaLaudoStr
        },
        user_email: 'system',
        severity: 'info'
      });

    const resultado = {
      sucesso: true,
      arquivo_fonte,
      periodo_referencia,
      registros_inicial: totalRegistrosInicial || 0,
      registros_encontrados: (registrosV003 || 0) + (registrosV002 || 0),
      registros_excluidos: totalExcluidos,
      registros_restantes: registrosFinais || 0,
      detalhes: {
        v003_excluidos: totalExcludosV003,
        v002_excluidos: totalExcludosV002,
        data_limite_realizacao: dataLimiteRealizacaoStr,
        janela_laudo_inicio: dataInicioJanelaLaudoStr,
        janela_laudo_fim: dataFimJanelaLaudoStr
      },
      regra_aplicada: 'v002/v003 - Exclusões por Período',
      data_processamento: new Date().toISOString(),
      observacao: `Aplicadas ambas as regras v002 e v003. Total excluído: ${totalExcluidos}. Restantes: ${registrosFinais || 0}.`
    };

    console.log(`✅ RESULTADO FINAL:`, resultado);

    return new Response(JSON.stringify(resultado), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('💥 Erro na função aplicar-exclusoes-periodo:', error);
    return new Response(JSON.stringify({ 
      sucesso: false, 
      erro: error.message 
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500 
    });
  }
});