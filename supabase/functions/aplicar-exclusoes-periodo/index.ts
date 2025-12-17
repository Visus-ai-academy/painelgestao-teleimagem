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
    
    console.log(`🎯 ===============================================`);
    console.log(`🎯 APLICAR EXCLUSÕES POR PERÍODO v002/v003 - v2.1`);
    console.log(`🎯 ===============================================`);
    console.log(`📝 Request body RAW:`, JSON.stringify(requestBody));
    console.log(`📁 Arquivo: ${arquivo_fonte}`);
    console.log(`📅 Período RECEBIDO (raw): "${periodo_referencia}"`);
    console.log(`📅 Tipo do período: ${typeof periodo_referencia}`);

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

    // PARSER ROBUSTO DE PERÍODO - Aceita QUALQUER formato e converte para ano/mês
    let anoCompleto: number;
    let mesNumero: number;
    
    const periodoStr = String(periodo_referencia || '').trim();
    console.log(`🔍 Analisando período: "${periodoStr}"`);
    
    // Formato 1: YYYY-MM (ex: "2025-10") - FORMATO PREFERENCIAL
    if (/^\d{4}-\d{2}$/.test(periodoStr)) {
      const [ano, mes] = periodoStr.split('-');
      anoCompleto = parseInt(ano);
      mesNumero = parseInt(mes);
      console.log(`📅 Formato detectado: YYYY-MM → ano=${anoCompleto}, mês=${mesNumero}`);
    } 
    // Formato 2: mes/ano (ex: "out/25")
    else if (/^[a-zA-Z]{3}\/\d{2}$/.test(periodoStr)) {
      const [mes, ano] = periodoStr.split('/');
      const meses: { [key: string]: number } = {
        'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
        'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12
      };
      anoCompleto = 2000 + parseInt(ano);
      mesNumero = meses[mes.toLowerCase()] || 0;
      
      if (mesNumero === 0) {
        console.error(`❌ Mês inválido no período: "${mes}"`);
        return new Response(JSON.stringify({
          sucesso: false,
          erro: `Mês inválido no período: ${mes}. Use: jan, fev, mar, abr, mai, jun, jul, ago, set, out, nov, dez`
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        });
      }
      
      console.log(`📅 Formato detectado: mes/YY → ano=${anoCompleto}, mês=${mesNumero}`);
    }
    // Formato 3: YYYY/MM (ex: "2025/10")
    else if (/^\d{4}\/\d{2}$/.test(periodoStr)) {
      const [ano, mes] = periodoStr.split('/');
      anoCompleto = parseInt(ano);
      mesNumero = parseInt(mes);
      console.log(`📅 Formato detectado: YYYY/MM → ano=${anoCompleto}, mês=${mesNumero}`);
    }
    else {
      console.error(`❌ Formato de período não reconhecido: "${periodoStr}"`);
      return new Response(JSON.stringify({
        sucesso: false,
        erro: `Formato de período inválido: "${periodoStr}". Use YYYY-MM (ex: 2025-10) ou mes/ano (ex: out/25)`
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      });
    }

    // Validar valores
    if (anoCompleto < 2020 || anoCompleto > 2100) {
      console.error(`❌ Ano inválido: ${anoCompleto}`);
      return new Response(JSON.stringify({
        sucesso: false,
        erro: `Ano inválido: ${anoCompleto}. Deve estar entre 2020 e 2100`
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      });
    }
    
    if (mesNumero < 1 || mesNumero > 12) {
      console.error(`❌ Mês inválido: ${mesNumero}`);
      return new Response(JSON.stringify({
        sucesso: false,
        erro: `Mês inválido: ${mesNumero}. Deve estar entre 1 e 12`
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      });
    }

    console.log(`✅ PERÍODO PARSEADO COM SUCESSO: Ano=${anoCompleto}, Mês=${mesNumero}`);

    // CALCULAR DATAS PARA REGRAS v002/v003
    
    // v003: Excluir exames realizados NO mês de referência ou DEPOIS (>= primeiro dia do mês)
    // Para outubro/2025, dataLimiteRealizacao = 2025-10-01
    // Exames com DATA_REALIZACAO >= 2025-10-01 são EXCLUÍDOS
    // Exames com DATA_REALIZACAO < 2025-10-01 são MANTIDOS (realizados ANTES do mês de referência)
    const dataLimiteRealizacao = new Date(Date.UTC(anoCompleto, mesNumero - 1, 1));
    
    // v002: Manter DATA_LAUDO entre dia 8 do mês de referência e dia 7 do mês seguinte
    // Para outubro/2025: manter laudos entre 2025-10-08 e 2025-11-07
    const dataInicioJanelaLaudo = new Date(Date.UTC(anoCompleto, mesNumero - 1, 8));
    const dataFimJanelaLaudo = new Date(Date.UTC(anoCompleto, mesNumero, 7));

    const dataLimiteRealizacaoStr = dataLimiteRealizacao.toISOString().split('T')[0];
    const dataInicioJanelaLaudoStr = dataInicioJanelaLaudo.toISOString().split('T')[0];
    const dataFimJanelaLaudoStr = dataFimJanelaLaudo.toISOString().split('T')[0];

    console.log(`📊 ===============================================`);
    console.log(`📊 REGRAS A SEREM APLICADAS:`);
    console.log(`📊 ===============================================`);
    console.log(`📊 v003 - EXCLUIR registros com DATA_REALIZACAO >= ${dataLimiteRealizacaoStr}`);
    console.log(`📊        (exames realizados no mês ${mesNumero}/${anoCompleto} ou depois)`);
    console.log(`📊 v002 - MANTER apenas DATA_LAUDO entre ${dataInicioJanelaLaudoStr} e ${dataFimJanelaLaudoStr}`);
    console.log(`📊        (laudos assinados na janela válida do período)`);
    console.log(`📊 ===============================================`);

    // Verificar registros totais antes da aplicação
    const { count: totalRegistrosInicial, error: countError } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', arquivo_fonte);

    if (countError) {
      console.error('❌ Erro ao contar registros iniciais:', countError);
      throw new Error(`Erro ao contar registros: ${countError.message}`);
    }

    console.log(`📊 Total de registros inicial para ${arquivo_fonte}: ${totalRegistrosInicial || 0}`);

    if (!totalRegistrosInicial || totalRegistrosInicial === 0) {
      console.log(`⚠️ Nenhum registro encontrado para ${arquivo_fonte} - nada a processar`);
      return new Response(JSON.stringify({
        sucesso: true,
        arquivo_fonte,
        periodo_referencia: periodoStr,
        periodo_parseado: { ano: anoCompleto, mes: mesNumero },
        registros_inicial: 0,
        registros_encontrados: 0,
        registros_excluidos: 0,
        registros_restantes: 0,
        detalhes: {
          v003_excluidos: 0,
          v002_excluidos: 0,
          data_limite_realizacao: dataLimiteRealizacaoStr,
          janela_laudo_inicio: dataInicioJanelaLaudoStr,
          janela_laudo_fim: dataFimJanelaLaudoStr
        },
        mensagem: 'Nenhum registro para processar'
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Buscar amostra de datas para debug
    const { data: amostraDatas } = await supabase
      .from('volumetria_mobilemed')
      .select('"DATA_REALIZACAO", "DATA_LAUDO"')
      .eq('arquivo_fonte', arquivo_fonte)
      .limit(5);
    
    console.log(`📊 Amostra de datas no arquivo:`, JSON.stringify(amostraDatas, null, 2));

    let totalExcludosV003 = 0;
    let totalExcludosV002 = 0;

    // ===== APLICAR REGRA v003 PRIMEIRO =====
    console.log(`\n🔧 ===== APLICANDO v003 =====`);
    console.log(`🔧 Excluindo registros com DATA_REALIZACAO >= ${dataLimiteRealizacaoStr}...`);
    
    const { count: registrosV003, error: errorV003Count } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', arquivo_fonte)
      .gte('DATA_REALIZACAO', dataLimiteRealizacaoStr);

    if (errorV003Count) {
      console.error('❌ Erro ao contar registros v003:', errorV003Count);
      throw new Error(`Erro ao contar v003: ${errorV003Count.message}`);
    }

    console.log(`📊 v003: ${registrosV003 || 0} registros encontrados para exclusão (DATA_REALIZACAO >= ${dataLimiteRealizacaoStr})`);

    if (registrosV003 && registrosV003 > 0) {
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

        if (selectError) {
          console.error('❌ Erro ao selecionar IDs para v003:', selectError);
          break;
        }

        if (!idsToDelete || idsToDelete.length === 0) {
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
    console.log(`\n🔧 ===== APLICANDO v002 =====`);
    console.log(`🔧 Excluindo registros com DATA_LAUDO fora da janela ${dataInicioJanelaLaudoStr} - ${dataFimJanelaLaudoStr}...`);
    
    // v002: Excluir onde DATA_LAUDO < inicio OU DATA_LAUDO > fim
    const { count: registrosV002, error: errorV002Count } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', arquivo_fonte)
      .or(`DATA_LAUDO.lt.${dataInicioJanelaLaudoStr},DATA_LAUDO.gt.${dataFimJanelaLaudoStr}`);

    if (errorV002Count) {
      console.error('❌ Erro ao contar registros v002:', errorV002Count);
    } else {
      console.log(`📊 v002: ${registrosV002 || 0} registros encontrados para exclusão (DATA_LAUDO fora da janela)`);

      if (registrosV002 && registrosV002 > 0) {
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

          if (selectError) {
            console.error('❌ Erro ao selecionar IDs para v002:', selectError);
            break;
          }

          if (!idsToDelete || idsToDelete.length === 0) {
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
        operation: 'REGRAS_V002_V003_APLICADAS_V2',
        record_id: arquivo_fonte,
        new_data: {
          versao_funcao: '2.1',
          arquivo_fonte,
          periodo_referencia_original: periodoStr,
          periodo_parseado: { ano: anoCompleto, mes: mesNumero },
          registros_inicial: totalRegistrosInicial || 0,
          registros_excluidos_v003: totalExcludosV003,
          registros_excluidos_v002: totalExcludosV002,
          total_excluidos: totalExcluidos,
          registros_finais: registrosFinais || 0,
          regras: 'v002_v003_v2.1',
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
      periodo_referencia: periodoStr,
      periodo_parseado: { ano: anoCompleto, mes: mesNumero },
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
      regra_aplicada: 'v002/v003 - Exclusões por Período (v2.1)',
      data_processamento: new Date().toISOString(),
      observacao: `Período ${mesNumero}/${anoCompleto}: Mantidos apenas exames realizados ANTES de ${dataLimiteRealizacaoStr} com laudos entre ${dataInicioJanelaLaudoStr} e ${dataFimJanelaLaudoStr}. Total excluído: ${totalExcluidos}. Restantes: ${registrosFinais || 0}.`
    };

    console.log(`\n✅ ===============================================`);
    console.log(`✅ RESULTADO FINAL - v002/v003 v2.1:`);
    console.log(`✅ ===============================================`);
    console.log(`✅ Período: ${mesNumero}/${anoCompleto}`);
    console.log(`✅ Registros iniciais: ${totalRegistrosInicial}`);
    console.log(`✅ v003 excluídos: ${totalExcludosV003}`);
    console.log(`✅ v002 excluídos: ${totalExcludosV002}`);
    console.log(`✅ Total excluídos: ${totalExcluidos}`);
    console.log(`✅ Registros finais: ${registrosFinais}`);
    console.log(`✅ ===============================================`);

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
