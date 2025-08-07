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

    // REGRA v002 NÃO SE APLICA MAIS AOS ARQUIVOS NÃO-RETROATIVOS
    // A regra de DATA_LAUDO deve ser aplicada SOMENTE nos arquivos retroativos
    console.log(`📝 Regra v002: Exclusão por DATA_LAUDO - aplicação removida dos arquivos não-retroativos`);
    console.log(`📝 A regra será aplicada apenas em: volumetria_padrao_retroativo e volumetria_fora_padrao_retroativo`);
    
    // Sem exclusões nesta função - transferidas para aplicar-exclusoes-periodo

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