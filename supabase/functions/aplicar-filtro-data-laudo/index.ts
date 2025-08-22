import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para calcular data limite do laudo
function calcularDataLimiteLaudo(periodoReferencia: string) {
  console.log(`🗓️ Calculando data limite para período: ${periodoReferencia}`);
  
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
  
  // Data limite: dia 7 do mês SEGUINTE ao período (INCLUSIVE)
  // Para Jun/25: limite é 07/07/2025 (laudos APÓS 07/07/2025 devem ser excluídos)
  const dataLimiteLaudo = new Date(ano, mes - 1, 7);
  
  const result = {
    dataLimiteLaudo: dataLimiteLaudo.toISOString().split('T')[0]
  };
  
  console.log(`📊 Data limite calculada: ${result.dataLimiteLaudo}`);
  console.log(`   - Excluir DATA_LAUDO > ${result.dataLimiteLaudo}`);
  
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

    const { dataLimiteLaudo } = calcularDataLimiteLaudo(periodo_referencia);
    
    console.log(`📅 Data limite para DATA_LAUDO: ${dataLimiteLaudo}`);

    let totalExcluidos = 0;
    const detalhes = [];

    // REGRA v031: Filtro de DATA_LAUDO para arquivos NÃO-RETROATIVOS
    // Excluir laudos APÓS dia 7 do mês seguinte ao período (dia 7 é permitido)
    console.log(`📝 Regra v031: Exclusão por DATA_LAUDO para arquivos não-retroativos`);
    
    // Aplicar v031 em volumetria_padrao
    // Primeiro buscar registros que serão excluídos
    const { data: registrosV031_1 } = await supabase
      .from('volumetria_mobilemed')
      .select('*')
      .eq('arquivo_fonte', 'volumetria_padrao')
      .gt('data_laudo', dataLimiteLaudo);

    if (registrosV031_1 && registrosV031_1.length > 0) {
      // Salvar registros rejeitados
      const rejectionsToInsert = registrosV031_1.map((record, index) => ({
        arquivo_fonte: 'volumetria_padrao',
        lote_upload: record.lote_upload || 'filtro_data_laudo',
        linha_original: index + 1,
        dados_originais: record,
        motivo_rejeicao: 'FILTRO_DATA_LAUDO_LIMITE',
        detalhes_erro: `Data de laudo ${record.DATA_LAUDO} > limite ${dataLimiteLaudo}`
      }));

      await supabase.from('registros_rejeitados_processamento').insert(rejectionsToInsert);
    }

    const { error: errorV031_1, count: countV031_1 } = await supabase
      .from('volumetria_mobilemed')
      .delete({ count: 'exact' })
      .eq('arquivo_fonte', 'volumetria_padrao')
      .gt('data_laudo', dataLimiteLaudo);

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
      .gt('data_laudo', dataLimiteLaudo);

    if (registrosV031_2 && registrosV031_2.length > 0) {
      const rejectionsToInsert = registrosV031_2.map((record, index) => ({
        arquivo_fonte: 'volumetria_fora_padrao',
        lote_upload: record.lote_upload || 'filtro_data_laudo',
        linha_original: index + 1,
        dados_originais: record,
        motivo_rejeicao: 'FILTRO_DATA_LAUDO_LIMITE',
        detalhes_erro: `Data de laudo ${record.DATA_LAUDO} > limite ${dataLimiteLaudo}`
      }));

      await supabase.from('registros_rejeitados_processamento').insert(rejectionsToInsert);
    }

    const { error: errorV031_2, count: countV031_2 } = await supabase
      .from('volumetria_mobilemed')
      .delete({ count: 'exact' })
      .eq('arquivo_fonte', 'volumetria_fora_padrao')
      .gt('data_laudo', dataLimiteLaudo);

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
      .gt('data_laudo', dataLimiteLaudo);

    if (registrosV031_3 && registrosV031_3.length > 0) {
      const rejectionsToInsert = registrosV031_3.map((record, index) => ({
        arquivo_fonte: 'volumetria_onco_padrao',
        lote_upload: record.lote_upload || 'filtro_data_laudo',
        linha_original: index + 1,
        dados_originais: record,
        motivo_rejeicao: 'FILTRO_DATA_LAUDO_LIMITE',
        detalhes_erro: `Data de laudo ${record.DATA_LAUDO} > limite ${dataLimiteLaudo}`
      }));

      await supabase.from('registros_rejeitados_processamento').insert(rejectionsToInsert);
    }

    const { error: errorV031_3, count: countV031_3 } = await supabase
      .from('volumetria_mobilemed')
      .delete({ count: 'exact' })
      .eq('arquivo_fonte', 'volumetria_onco_padrao')
      .gt('data_laudo', dataLimiteLaudo);

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
      data_limite_aplicada: dataLimiteLaudo,
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