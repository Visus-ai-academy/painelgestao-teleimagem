import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para calcular datas do período de faturamento
function calcularDatasPeriodoFaturamento(periodoReferencia: string) {
  console.log(`🗓️ Calculando datas para período: ${periodoReferencia}`);
  
  const [mesStr, anoStr] = periodoReferencia.toLowerCase().split('/');
  
  const meses = {
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
  
  if (!mes || !ano) {
    throw new Error(`Período inválido: ${periodoReferencia}`);
  }
  
  console.log(`📅 Mês: ${mes}, Ano: ${ano}`);
  
  // Data limite para DATA_REALIZACAO: 01 do mês especificado (INCLUSIVE)
  // Para Jun/25 = 01/06/2025 (excluir >= 01/06/2025)
  const dataLimiteRealizacao = new Date(ano, mes - 1, 1);
  
  // Período de faturamento: dia 8 do mês especificado até dia 7 do mês SEGUINTE
  // Para Jun/25: 08/06/2025 a 07/07/2025
  const inicioFaturamento = new Date(ano, mes - 1, 8);
  const fimFaturamento = new Date(ano, mes, 7);
  
  const result = {
    dataLimiteRealizacao: dataLimiteRealizacao.toISOString().split('T')[0],
    inicioFaturamento: inicioFaturamento.toISOString().split('T')[0],
    fimFaturamento: fimFaturamento.toISOString().split('T')[0]
  };
  
  console.log(`📊 Datas calculadas:`);
  console.log(`   - Excluir DATA_REALIZACAO >= ${result.dataLimiteRealizacao}`);
  console.log(`   - Manter DATA_LAUDO entre ${result.inicioFaturamento} e ${result.fimFaturamento}`);
  
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

    const { dataLimiteRealizacao, inicioFaturamento, fimFaturamento } = calcularDatasPeriodoFaturamento(periodo_referencia);
    
    console.log(`📅 Datas calculadas:`);
    console.log(`   - Data limite DATA_REALIZACAO: ${dataLimiteRealizacao}`);
    console.log(`   - Período DATA_LAUDO: ${inicioFaturamento} a ${fimFaturamento}`);

    let totalExcluidos = 0;
    const detalhes = [];

    // REGRA v031: Filtro de período atual para arquivos NÃO-RETROATIVOS
    console.log(`🗂️ Aplicando REGRA v031 nos arquivos não-retroativos...`);
    
    // Calcular período para arquivos não-retroativos (mês atual)
    const dataInicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const dataFimMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];
    const dataLimiteLaudoV031 = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 7).toISOString().split('T')[0];

    console.log(`📅 REGRA v031 - Período atual: ${dataInicioMes} a ${dataFimMes}`);
    console.log(`📅 REGRA v031 - DATA_LAUDO até: ${dataLimiteLaudoV031}`);

    // Aplicar v031 em volumetria_padrao
    const { error: errorV031_1, count: countV031_1 } = await supabase
      .from('volumetria_mobilemed')
      .delete({ count: 'exact' })
      .eq('arquivo_fonte', 'volumetria_padrao')
      .or(`DATA_REALIZACAO.lt.${dataInicioMes},DATA_REALIZACAO.gt.${dataFimMes},DATA_LAUDO.gt.${dataLimiteLaudoV031}`);

    if (!errorV031_1) {
      const deletedV031_1 = countV031_1 || 0;
      totalExcluidos += deletedV031_1;
      detalhes.push(`REGRA v031 - volumetria_padrao: ${deletedV031_1} registros excluídos`);
      console.log(`✅ REGRA v031 - volumetria_padrao: ${deletedV031_1} registros excluídos`);
    }

    // Aplicar v031 em volumetria_fora_padrao
    const { error: errorV031_2, count: countV031_2 } = await supabase
      .from('volumetria_mobilemed')
      .delete({ count: 'exact' })
      .eq('arquivo_fonte', 'volumetria_fora_padrao')
      .or(`DATA_REALIZACAO.lt.${dataInicioMes},DATA_REALIZACAO.gt.${dataFimMes},DATA_LAUDO.gt.${dataLimiteLaudoV031}`);

    if (!errorV031_2) {
      const deletedV031_2 = countV031_2 || 0;
      totalExcluidos += deletedV031_2;
      detalhes.push(`REGRA v031 - volumetria_fora_padrao: ${deletedV031_2} registros excluídos`);
      console.log(`✅ REGRA v031 - volumetria_fora_padrao: ${deletedV031_2} registros excluídos`);
    }

    // Aplicar v031 em volumetria_onco_padrao
    const { error: errorV031_3, count: countV031_3 } = await supabase
      .from('volumetria_mobilemed')
      .delete({ count: 'exact' })
      .eq('arquivo_fonte', 'volumetria_onco_padrao')
      .or(`DATA_REALIZACAO.lt.${dataInicioMes},DATA_REALIZACAO.gt.${dataFimMes},DATA_LAUDO.gt.${dataLimiteLaudoV031}`);

    if (!errorV031_3) {
      const deletedV031_3 = countV031_3 || 0;
      totalExcluidos += deletedV031_3;
      detalhes.push(`REGRA v031 - volumetria_onco_padrao: ${deletedV031_3} registros excluídos`);
      console.log(`✅ REGRA v031 - volumetria_onco_padrao: ${deletedV031_3} registros excluídos`);
    }

    // Arquivo 3: volumetria_padrao_retroativo
    console.log(`🗂️ Processando Arquivo 3 (volumetria_padrao_retroativo)...`);
    
    // Excluir registros com DATA_REALIZACAO a partir de 01/XX/2025 (INCLUSIVE)
    const { error: error3_realizacao, count: count3_realizacao } = await supabase
      .from('volumetria_mobilemed')
      .delete({ count: 'exact' })
      .eq('arquivo_fonte', 'volumetria_padrao_retroativo')
      .gte('DATA_REALIZACAO', dataLimiteRealizacao);

    if (error3_realizacao) {
      console.error('❌ Erro ao excluir por DATA_REALIZACAO (Arquivo 3):', error3_realizacao);
    } else {
      const deletedCount3_realizacao = count3_realizacao || 0;
      totalExcluidos += deletedCount3_realizacao;
      detalhes.push(`Arquivo 3: ${deletedCount3_realizacao} registros excluídos por DATA_REALIZACAO >= ${dataLimiteRealizacao}`);
      console.log(`✅ Arquivo 3: ${deletedCount3_realizacao} registros excluídos por DATA_REALIZACAO`);
    }

    // Excluir registros com DATA_LAUDO fora do período de faturamento
    const { error: error3_laudo, count: count3_laudo } = await supabase
      .from('volumetria_mobilemed')
      .delete({ count: 'exact' })
      .eq('arquivo_fonte', 'volumetria_padrao_retroativo')
      .or(`DATA_LAUDO.lt.${inicioFaturamento},DATA_LAUDO.gt.${fimFaturamento}`);

    if (error3_laudo) {
      console.error('❌ Erro ao excluir por DATA_LAUDO (Arquivo 3):', error3_laudo);
    } else {
      const deletedCount3_laudo = count3_laudo || 0;
      totalExcluidos += deletedCount3_laudo;
      detalhes.push(`Arquivo 3: ${deletedCount3_laudo} registros excluídos por DATA_LAUDO fora do período ${inicioFaturamento} a ${fimFaturamento}`);
      console.log(`✅ Arquivo 3: ${deletedCount3_laudo} registros excluídos por DATA_LAUDO`);
    }

    // Arquivo 4: volumetria_fora_padrao_retroativo
    console.log(`🗂️ Processando Arquivo 4 (volumetria_fora_padrao_retroativo)...`);
    
    // Excluir registros com DATA_REALIZACAO a partir de 01/XX/2025 (INCLUSIVE)
    const { error: error4_realizacao, count: count4_realizacao } = await supabase
      .from('volumetria_mobilemed')
      .delete({ count: 'exact' })
      .eq('arquivo_fonte', 'volumetria_fora_padrao_retroativo')
      .gte('DATA_REALIZACAO', dataLimiteRealizacao);

    if (error4_realizacao) {
      console.error('❌ Erro ao excluir por DATA_REALIZACAO (Arquivo 4):', error4_realizacao);
    } else {
      const deletedCount4_realizacao = count4_realizacao || 0;
      totalExcluidos += deletedCount4_realizacao;
      detalhes.push(`Arquivo 4: ${deletedCount4_realizacao} registros excluídos por DATA_REALIZACAO >= ${dataLimiteRealizacao}`);
      console.log(`✅ Arquivo 4: ${deletedCount4_realizacao} registros excluídos por DATA_REALIZACAO`);
    }

    // Excluir registros com DATA_LAUDO fora do período de faturamento
    const { error: error4_laudo, count: count4_laudo } = await supabase
      .from('volumetria_mobilemed')
      .delete({ count: 'exact' })
      .eq('arquivo_fonte', 'volumetria_fora_padrao_retroativo')
      .or(`DATA_LAUDO.lt.${inicioFaturamento},DATA_LAUDO.gt.${fimFaturamento}`);

    if (error4_laudo) {
      console.error('❌ Erro ao excluir por DATA_LAUDO (Arquivo 4):', error4_laudo);
    } else {
      const deletedCount4_laudo = count4_laudo || 0;
      totalExcluidos += deletedCount4_laudo;
      detalhes.push(`Arquivo 4: ${deletedCount4_laudo} registros excluídos por DATA_LAUDO fora do período ${inicioFaturamento} a ${fimFaturamento}`);
      console.log(`✅ Arquivo 4: ${deletedCount4_laudo} registros excluídos por DATA_LAUDO`);
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