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
  
  // Data limite: dia 7 do mês SEGUINTE ao período
  // Para Jun/25: limite é 07/07/2025 (laudos após essa data devem ser excluídos)
  const dataLimiteLaudo = new Date(ano, mes, 7);
  
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

    // Arquivos não-retroativos que precisam do filtro de DATA_LAUDO
    const arquivosNaoRetroativos = [
      'volumetria_padrao',
      'volumetria_fora_padrao', 
      'volumetria_onco_padrao'
    ];

    for (const arquivo of arquivosNaoRetroativos) {
      console.log(`🗂️ Processando ${arquivo}...`);
      
      // Excluir registros com DATA_LAUDO posterior ao período permitido
      const { error, count } = await supabase
        .from('volumetria_mobilemed')
        .delete({ count: 'exact' })
        .eq('arquivo_fonte', arquivo)
        .gt('DATA_LAUDO', dataLimiteLaudo);

      if (error) {
        console.error(`❌ Erro ao filtrar ${arquivo}:`, error);
        detalhes.push(`${arquivo}: ERRO - ${error.message}`);
      } else {
        const deletedCount = count || 0;
        totalExcluidos += deletedCount;
        detalhes.push(`${arquivo}: ${deletedCount} registros excluídos com DATA_LAUDO > ${dataLimiteLaudo}`);
        console.log(`✅ ${arquivo}: ${deletedCount} registros excluídos`);
      }
    }

    // REGRA ADICIONAL: Excluir TODOS os laudos após 07/07/2025 (independente do arquivo)
    console.log(`🗂️ Aplicando regra fixa: Excluir laudos após 07/07/2025...`);
    
    const { error: errorLaudosRecentes, count: countLaudosRecentes } = await supabase
      .from('volumetria_mobilemed')
      .delete({ count: 'exact' })
      .gt('DATA_LAUDO', '2025-07-07');

    if (errorLaudosRecentes) {
      console.error('❌ Erro ao excluir laudos após 07/07/2025:', errorLaudosRecentes);
      detalhes.push(`Regra fixa: ERRO - ${errorLaudosRecentes.message}`);
    } else {
      const deletedCountLaudos = countLaudosRecentes || 0;
      totalExcluidos += deletedCountLaudos;
      detalhes.push(`Regra fixa: ${deletedCountLaudos} registros excluídos com DATA_LAUDO > 07/07/2025`);
      console.log(`✅ Regra fixa: ${deletedCountLaudos} registros excluídos com laudos recentes`);
    }

    console.log(`🎯 Total de registros excluídos: ${totalExcluidos}`);

    return new Response(JSON.stringify({
      success: true,
      periodo_referencia,
      total_excluidos: totalExcluidos,
      detalhes,
      data_limite_aplicada: dataLimiteLaudo,
      arquivos_processados: arquivosNaoRetroativos
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