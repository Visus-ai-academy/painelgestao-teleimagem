import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função helper para registrar exclusões antes de deletar
async function registrarExclusaoEDeletar(
  supabase: any,
  arquivo_fonte: string,
  filtro: any,
  motivo_rejeicao: string,
  detalhes_erro: string
) {
  // Primeiro buscar registros que serão excluídos
  const { data: registrosParaExcluir } = await supabase
    .from('volumetria_mobilemed')
    .select('*')
    .eq('arquivo_fonte', arquivo_fonte)
    .or(filtro);

  if (registrosParaExcluir && registrosParaExcluir.length > 0) {
    // Salvar registros rejeitados
    const rejectionsToInsert = registrosParaExcluir.map((record: any, index: number) => ({
      arquivo_fonte,
      lote_upload: record.lote_upload || 'exclusao_periodo',
      linha_original: index + 1,
      dados_originais: record,
      motivo_rejeicao,
      detalhes_erro: `${detalhes_erro} - ${record.EMPRESA} - ${record.ESTUDO_DESCRICAO}`
    }));

    const { error: rejectionsError } = await supabase
      .from('registros_rejeitados_processamento')
      .insert(rejectionsToInsert);

    if (rejectionsError) {
      console.error(`❌ Erro ao salvar rejeições em ${arquivo_fonte}:`, rejectionsError);
    } else {
      console.log(`✅ ${registrosParaExcluir.length} rejeições salvas para ${arquivo_fonte}`);
    }
  }

  // Depois deletar os registros
  const { error, count } = await supabase
    .from('volumetria_mobilemed')
    .delete({ count: 'exact' })
    .eq('arquivo_fonte', arquivo_fonte)
    .or(filtro);

  return { error, count };
}

// Função para calcular datas do período de faturamento
function calcularDatasPeriodoFaturamento(periodoReferencia: string) {
  console.log(`🗓️ Calculando datas para período: ${periodoReferencia}`);
  const [mesStr, anoStr] = periodoReferencia.toLowerCase().split('/');
  const meses: Record<string, number> = {
    'janeiro': 1, 'jan': 1,
    'fevereiro': 2, 'fev': 2,
    'março': 3, 'mar': 3,
    'abril': 4, 'abr': 4,
    'maio': 5, 'mai': 5,
    'junho': 6, 'jun': 6,
    'julho': 7, 'jul': 7,
    'agosto': 8, 'ago': 8,
    'setembro': 9, 'set': 9,
    'outubro': 10, 'out': 10,
    'novembro': 11, 'nov': 11,
    'dezembro': 12, 'dez': 12
  };
  const mes = meses[mesStr];
  const ano = anoStr.length === 2 ? 2000 + parseInt(anoStr) : parseInt(anoStr);
  if (!mes || !ano) throw new Error(`Período inválido: ${periodoReferencia}`);

  // Datas base
  const primeiroDiaMes = new Date(ano, mes - 1, 1);
  const ultimoDiaMes = new Date(ano, mes, 0); // dia 0 do próximo mês = último dia do mês atual
  const inicioFaturamento = new Date(ano, mes - 1, 8); // 08 do mês de referência
  const fimFaturamento = new Date(ano, mes, 7); // 07 do mês seguinte

  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const result = {
    // Para retroativos (v002/v003)
    dataLimiteRealizacao: fmt(primeiroDiaMes),
    inicioFaturamento: fmt(inicioFaturamento),
    fimFaturamento: fmt(fimFaturamento),
    // Para não-retroativos (v031)
    realizacaoInicioMes: fmt(primeiroDiaMes),
    realizacaoFimMes: fmt(ultimoDiaMes),
    laudoInicioJanela: fmt(primeiroDiaMes),
    laudoFimJanela: fmt(fimFaturamento),
  };

  console.log('📊 Datas calculadas:', result);
  return result;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { periodo_referencia } = await req.json();
    
    if (!periodo_referencia) {
      throw new Error('período_referencia é obrigatório');
    }

    console.log(`🔧 Aplicando exclusões por período: ${periodo_referencia}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { 
      dataLimiteRealizacao,
      inicioFaturamento,
      fimFaturamento,
      realizacaoInicioMes,
      realizacaoFimMes,
      laudoInicioJanela,
      laudoFimJanela,
    } = calcularDatasPeriodoFaturamento(periodo_referencia);
    
    console.log(`📅 Datas calculadas:`);
    console.log(`   - Data limite DATA_REALIZACAO (retroativos): ${dataLimiteRealizacao}`);
    console.log(`   - Período DATA_LAUDO (retroativos): ${inicioFaturamento} a ${fimFaturamento}`);

    let totalExcluidos = 0;
    const detalhes = [] as string[];

    // REGRA v031: Filtro de período atual para arquivos NÃO-RETROATIVOS
    console.log(`🗂️ Aplicando REGRA v031 nos arquivos não-retroativos...`);
    console.log(`📅 REGRA v031 - REALIZAÇÃO entre: ${realizacaoInicioMes} e ${realizacaoFimMes}`);
    console.log(`📅 REGRA v031 - LAUDO entre: ${laudoInicioJanela} e ${laudoFimJanela}`);

    // Aplicar v031 em volumetria_padrao
    const filtroV031 = `data_realizacao.lt.${realizacaoInicioMes},data_realizacao.gte.${new Date(new Date(realizacaoFimMes).getTime() + 86400000).toISOString().split('T')[0]},data_laudo.lt.${laudoInicioJanela},data_laudo.gte.${new Date(new Date(laudoFimJanela).getTime() + 86400000).toISOString().split('T')[0]}`;
    
    const { error: errorV031_1, count: countV031_1 } = await registrarExclusaoEDeletar(
      supabase,
      'volumetria_padrao',
      filtroV031,
      'REGRA_V031_PERIODO_ATUAL',
      `Data fora do período atual: realização deve estar entre ${realizacaoInicioMes} e ${realizacaoFimMes}, laudo entre ${laudoInicioJanela} e ${laudoFimJanela}`
    );

    if (!errorV031_1) {
      const deletedV031_1 = countV031_1 || 0;
      totalExcluidos += deletedV031_1;
      detalhes.push(`REGRA v031 - volumetria_padrao: ${deletedV031_1} registros excluídos`);
      console.log(`✅ REGRA v031 - volumetria_padrao: ${deletedV031_1} registros excluídos`);
    }

    // Aplicar v031 em volumetria_fora_padrao
    const { error: errorV031_2, count: countV031_2 } = await registrarExclusaoEDeletar(
      supabase,
      'volumetria_fora_padrao',
      filtroV031,
      'REGRA_V031_PERIODO_ATUAL',
      `Data fora do período atual: realização deve estar entre ${realizacaoInicioMes} e ${realizacaoFimMes}, laudo entre ${laudoInicioJanela} e ${laudoFimJanela}`
    );

    if (!errorV031_2) {
      const deletedV031_2 = countV031_2 || 0;
      totalExcluidos += deletedV031_2;
      detalhes.push(`REGRA v031 - volumetria_fora_padrao: ${deletedV031_2} registros excluídos`);
      console.log(`✅ REGRA v031 - volumetria_fora_padrao: ${deletedV031_2} registros excluídos`);
    }

    // Aplicar v031 em volumetria_onco_padrao
    const { error: errorV031_3, count: countV031_3 } = await registrarExclusaoEDeletar(
      supabase,
      'volumetria_onco_padrao',
      filtroV031,
      'REGRA_V031_PERIODO_ATUAL',
      `Data fora do período atual: realização deve estar entre ${realizacaoInicioMes} e ${realizacaoFimMes}, laudo entre ${laudoInicioJanela} e ${laudoFimJanela}`
    );

    if (!errorV031_3) {
      const deletedV031_3 = countV031_3 || 0;
      totalExcluidos += deletedV031_3;
      detalhes.push(`REGRA v031 - volumetria_onco_padrao: ${deletedV031_3} registros excluídos`);
      console.log(`✅ REGRA v031 - volumetria_onco_padrao: ${deletedV031_3} registros excluídos`);
    }

    // Arquivo 3: volumetria_padrao_retroativo
    console.log(`🗂️ Processando Arquivo 3 (volumetria_padrao_retroativo)...`);
    
    // REGRA v003: Excluir registros com DATA_REALIZACAO a partir de 01/XX/2025 (INCLUSIVE)
    const { error: error3_realizacao, count: count3_realizacao } = await registrarExclusaoEDeletar(
      supabase,
      'volumetria_padrao_retroativo',
      `data_realizacao.gte.${dataLimiteRealizacao}`,
      'REGRA_V003_DATA_REALIZACAO',
      `Data de realização >= ${dataLimiteRealizacao} (retroativo)`
    );

    if (!error3_realizacao) {
      const deletedCount3_realizacao = count3_realizacao || 0;
      totalExcluidos += deletedCount3_realizacao;
      detalhes.push(`REGRA v003 - Arquivo 3: ${deletedCount3_realizacao} registros excluídos por DATA_REALIZACAO >= ${dataLimiteRealizacao}`);
      console.log(`✅ REGRA v003 - Arquivo 3: ${deletedCount3_realizacao} registros excluídos por DATA_REALIZACAO`);
    }

    // REGRA v002: Excluir registros com DATA_LAUDO fora do período de faturamento
    console.log(`📋 REGRA v002 - Excluindo laudos < ${inicioFaturamento} OU > ${fimFaturamento}`);
    
    const { error: error3_laudo, count: count3_laudo } = await registrarExclusaoEDeletar(
      supabase,
      'volumetria_padrao_retroativo',
      `data_laudo.lt.${inicioFaturamento},data_laudo.gt.${fimFaturamento}`,
      'REGRA_V002_DATA_LAUDO',
      `Data de laudo fora do período ${inicioFaturamento} a ${fimFaturamento} (retroativo)`
    );

    if (!error3_laudo) {
      const deletedCount3_laudo = count3_laudo || 0;
      totalExcluidos += deletedCount3_laudo;
      detalhes.push(`REGRA v002 - Arquivo 3: ${deletedCount3_laudo} registros excluídos por DATA_LAUDO fora do período`);
      console.log(`✅ REGRA v002 - Arquivo 3: ${deletedCount3_laudo} registros excluídos por DATA_LAUDO`);
    }

    // Arquivo 4: volumetria_fora_padrao_retroativo
    console.log(`🗂️ Processando Arquivo 4 (volumetria_fora_padrao_retroativo)...`);
    
    // REGRA v003: Excluir registros com DATA_REALIZACAO a partir de 01/XX/2025 (INCLUSIVE)
    const { error: error4_realizacao, count: count4_realizacao } = await registrarExclusaoEDeletar(
      supabase,
      'volumetria_fora_padrao_retroativo',
      `data_realizacao.gte.${dataLimiteRealizacao}`,
      'REGRA_V003_DATA_REALIZACAO',
      `Data de realização >= ${dataLimiteRealizacao} (retroativo)`
    );

    if (!error4_realizacao) {
      const deletedCount4_realizacao = count4_realizacao || 0;
      totalExcluidos += deletedCount4_realizacao;
      detalhes.push(`REGRA v003 - Arquivo 4: ${deletedCount4_realizacao} registros excluídos por DATA_REALIZACAO >= ${dataLimiteRealizacao}`);
      console.log(`✅ REGRA v003 - Arquivo 4: ${deletedCount4_realizacao} registros excluídos por DATA_REALIZACAO`);
    }

    // REGRA v002: Excluir registros com DATA_LAUDO fora do período de faturamento
    console.log(`📋 REGRA v002 - Excluindo laudos < ${inicioFaturamento} OU > ${fimFaturamento}`);
    
    const { error: error4_laudo, count: count4_laudo } = await registrarExclusaoEDeletar(
      supabase,
      'volumetria_fora_padrao_retroativo',
      `data_laudo.lt.${inicioFaturamento},data_laudo.gt.${fimFaturamento}`,
      'REGRA_V002_DATA_LAUDO',
      `Data de laudo fora do período ${inicioFaturamento} a ${fimFaturamento} (retroativo)`
    );

    if (!error4_laudo) {
      const deletedCount4_laudo = count4_laudo || 0;
      totalExcluidos += deletedCount4_laudo;
      detalhes.push(`REGRA v002 - Arquivo 4: ${deletedCount4_laudo} registros excluídos por DATA_LAUDO fora do período`);
      console.log(`✅ REGRA v002 - Arquivo 4: ${deletedCount4_laudo} registros excluídos por DATA_LAUDO`);
    }

    // REGRAS APLICADAS:
    // v031: Filtro período atual (arquivos não-retroativos)
    // v002: Exclusão DATA_LAUDO (arquivos retroativos)  
    // v003: Exclusão DATA_REALIZACAO (arquivos retroativos)
    console.log(`✅ Regras v002, v003 e v031 aplicadas na ordem correta de execução`)

    console.log(`🎯 Total de registros excluídos: ${totalExcluidos}`);

    return new Response(JSON.stringify({
      success: true,
      periodo_referencia,
      total_deletados: totalExcluidos, // Usar chave consistente
      total_excluidos: totalExcluidos, // Manter compatibilidade
      detalhes,
      datas_aplicadas: {
        data_limite_realizacao: dataLimiteRealizacao,
        inicio_faturamento: inicioFaturamento,
        fim_faturamento: fimFaturamento
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Erro ao aplicar exclusões:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}