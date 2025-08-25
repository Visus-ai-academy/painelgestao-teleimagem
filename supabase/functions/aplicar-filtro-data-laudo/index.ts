import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para calcular período válido de laudos
function calcularPeriodoValidoLaudo(periodoReferencia: string) {
  console.log(`🗓️ Calculando período válido para laudos - período: ${periodoReferencia}`);
  
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
  
  // PERÍODO VÁLIDO PARA LAUDOS:
  // Data início: dia 8 do mês de referência
  // Data fim: dia 7 do mês seguinte
  // Exemplo para jun/25: 08/06/2025 até 07/07/2025 (ambos inclusive)
  
  const dataInicioLaudo = new Date(ano, mes - 1, 8); // dia 8 do mês
  const dataFimLaudo = new Date(ano, mes, 7); // dia 7 do mês seguinte
  
  const result = {
    dataInicioLaudo: dataInicioLaudo.toISOString().split('T')[0],
    dataFimLaudo: dataFimLaudo.toISOString().split('T')[0]
  };
  
  console.log(`📊 Período válido calculado:`);
  console.log(`   - Data início: ${result.dataInicioLaudo} (inclusive)`);
  console.log(`   - Data fim: ${result.dataFimLaudo} (inclusive)`);
  console.log(`   - Excluir DATA_LAUDO < ${result.dataInicioLaudo} OU DATA_LAUDO > ${result.dataFimLaudo}`);
  
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

    console.log(`🔧 Aplicando filtro de DATA_LAUDO para período: ${periodo_referencia}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { dataInicioLaudo, dataFimLaudo } = calcularPeriodoValidoLaudo(periodo_referencia);
    
    console.log(`📅 Período válido para DATA_LAUDO: ${dataInicioLaudo} até ${dataFimLaudo}`);

    let totalExcluidos = 0;
    const detalhes = [];

    // REGRA v031: Filtro de PERÍODO de DATA_LAUDO para arquivos NÃO-RETROATIVOS
    // Manter apenas laudos dentro do período válido
    console.log(`📝 Regra v031: Filtro de período de DATA_LAUDO para arquivos não-retroativos`);
    
    // Aplicar v031 em volumetria_padrao
    // Buscar registros FORA do período válido (antes da data início OU depois da data fim)
    const { data: registrosV031_1 } = await supabase
      .from('volumetria_mobilemed')
      .select('*')
      .eq('arquivo_fonte', 'volumetria_padrao')
      .or(`data_laudo.lt.${dataInicioLaudo},data_laudo.gt.${dataFimLaudo}`);

    if (registrosV031_1 && registrosV031_1.length > 0) {
      // Salvar registros rejeitados com motivo específico
      const rejectionsToInsert = registrosV031_1.map((record, index) => ({
        arquivo_fonte: 'volumetria_padrao',
        lote_upload: record.lote_upload || 'filtro_periodo_laudo',
        linha_original: index + 1,
        dados_originais: record,
        motivo_rejeicao: 'FILTRO_PERIODO_DATA_LAUDO',
        detalhes_erro: `Data de laudo ${record.DATA_LAUDO} fora do período válido (${dataInicioLaudo} até ${dataFimLaudo})`
      }));

      await supabase.from('registros_rejeitados_processamento').insert(rejectionsToInsert);
    }

    const { error: errorV031_1, count: countV031_1 } = await supabase
      .from('volumetria_mobilemed')
      .delete({ count: 'exact' })
      .eq('arquivo_fonte', 'volumetria_padrao')
      .or(`data_laudo.lt.${dataInicioLaudo},data_laudo.gt.${dataFimLaudo}`);

    if (!errorV031_1) {
      const deletedV031_1 = countV031_1 || 0;
      totalExcluidos += deletedV031_1;
      detalhes.push(`REGRA v031 - volumetria_padrao: ${deletedV031_1} registros excluídos`);
      console.log(`✅ REGRA v031 - volumetria_padrao: ${deletedV031_1} registros excluídos`);
    }

    // Aplicar v031 em volumetria_fora_padrao  
    const { data: registrosV031_2 } = await supabase
      .from('volumetria_mobilemed')
      .select('*')
      .eq('arquivo_fonte', 'volumetria_fora_padrao')
      .or(`data_laudo.lt.${dataInicioLaudo},data_laudo.gt.${dataFimLaudo}`);

    if (registrosV031_2 && registrosV031_2.length > 0) {
      const rejectionsToInsert = registrosV031_2.map((record, index) => ({
        arquivo_fonte: 'volumetria_fora_padrao',
        lote_upload: record.lote_upload || 'filtro_periodo_laudo',
        linha_original: index + 1,
        dados_originais: record,
        motivo_rejeicao: 'FILTRO_PERIODO_DATA_LAUDO',
        detalhes_erro: `Data de laudo ${record.DATA_LAUDO} fora do período válido (${dataInicioLaudo} até ${dataFimLaudo})`
      }));

      await supabase.from('registros_rejeitados_processamento').insert(rejectionsToInsert);
    }

    const { error: errorV031_2, count: countV031_2 } = await supabase
      .from('volumetria_mobilemed')
      .delete({ count: 'exact' })
      .eq('arquivo_fonte', 'volumetria_fora_padrao')
      .or(`data_laudo.lt.${dataInicioLaudo},data_laudo.gt.${dataFimLaudo}`);

    if (!errorV031_2) {
      const deletedV031_2 = countV031_2 || 0;
      totalExcluidos += deletedV031_2;
      detalhes.push(`REGRA v031 - volumetria_fora_padrao: ${deletedV031_2} registros excluídos`);
      console.log(`✅ REGRA v031 - volumetria_fora_padrao: ${deletedV031_2} registros excluídos`);
    }

    // Aplicar v031 em volumetria_onco_padrao
    const { data: registrosV031_3 } = await supabase
      .from('volumetria_mobilemed')
      .select('*')
      .eq('arquivo_fonte', 'volumetria_onco_padrao')
      .or(`data_laudo.lt.${dataInicioLaudo},data_laudo.gt.${dataFimLaudo}`);

    if (registrosV031_3 && registrosV031_3.length > 0) {
      const rejectionsToInsert = registrosV031_3.map((record, index) => ({
        arquivo_fonte: 'volumetria_onco_padrao',
        lote_upload: record.lote_upload || 'filtro_periodo_laudo',
        linha_original: index + 1,
        dados_originais: record,
        motivo_rejeicao: 'FILTRO_PERIODO_DATA_LAUDO',
        detalhes_erro: `Data de laudo ${record.DATA_LAUDO} fora do período válido (${dataInicioLaudo} até ${dataFimLaudo})`
      }));

      await supabase.from('registros_rejeitados_processamento').insert(rejectionsToInsert);
    }

    const { error: errorV031_3, count: countV031_3 } = await supabase
      .from('volumetria_mobilemed')
      .delete({ count: 'exact' })
      .eq('arquivo_fonte', 'volumetria_onco_padrao')
      .or(`data_laudo.lt.${dataInicioLaudo},data_laudo.gt.${dataFimLaudo}`);

    if (!errorV031_3) {
      const deletedV031_3 = countV031_3 || 0;
      totalExcluidos += deletedV031_3;
      detalhes.push(`REGRA v031 - volumetria_onco_padrao: ${deletedV031_3} registros excluídos`);
      console.log(`✅ REGRA v031 - volumetria_onco_padrao: ${deletedV031_3} registros excluídos`);
    }

    console.log(`🎯 Total de registros excluídos: ${totalExcluidos}`);

    return new Response(JSON.stringify({
      success: true,
      periodo_referencia,
      total_excluidos: totalExcluidos,
      detalhes,
      periodo_valido_aplicado: {
        data_inicio: dataInicioLaudo,
        data_fim: dataFimLaudo
      },
      arquivos_processados: []
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Erro ao aplicar filtro de DATA_LAUDO:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}