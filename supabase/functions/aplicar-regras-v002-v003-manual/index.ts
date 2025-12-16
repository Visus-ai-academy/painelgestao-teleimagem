import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Receber período do request body (OBRIGATÓRIO agora)
    const body = await req.json().catch(() => ({}));
    const { periodo_referencia, arquivo_fonte = 'volumetria_padrao_retroativo' } = body;

    console.log('🔧 APLICAÇÃO MANUAL DAS REGRAS V002/V003');
    console.log(`📁 Arquivo: ${arquivo_fonte}`);
    console.log(`📅 Período recebido: ${periodo_referencia}`);

    // Validar período obrigatório
    if (!periodo_referencia) {
      return new Response(JSON.stringify({
        success: false,
        error: 'periodo_referencia é obrigatório. Formato: YYYY-MM (ex: 2025-10) ou mmm/YY (ex: out/25)'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Calcular datas baseadas no período de referência
    let anoCompleto: number;
    let mesNumero: number;
    
    // Detectar formato do período: YYYY-MM ou mes/ano
    if (periodo_referencia.includes('-')) {
      // Formato YYYY-MM (ex: "2025-10")
      const [ano, mes] = periodo_referencia.split('-');
      anoCompleto = parseInt(ano);
      mesNumero = parseInt(mes);
      console.log(`📅 Período detectado (YYYY-MM): ano=${anoCompleto}, mês=${mesNumero}`);
    } else if (periodo_referencia.includes('/')) {
      // Formato mes/ano (ex: "out/25")
      const [mes, ano] = periodo_referencia.split('/');
      const meses: { [key: string]: number } = {
        'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
        'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12
      };
      anoCompleto = 2000 + parseInt(ano);
      mesNumero = meses[mes.toLowerCase()];
      console.log(`📅 Período detectado (mes/ano): ano=${anoCompleto}, mês=${mesNumero}`);
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: `Formato de período inválido: ${periodo_referencia}. Use YYYY-MM ou mes/ano`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Calcular datas das regras
    // v003: Excluir exames com DATA_REALIZACAO >= primeiro dia do mês de referência
    const dataLimiteRealizacao = new Date(anoCompleto, mesNumero - 1, 1);
    const dataLimiteRealizacaoStr = dataLimiteRealizacao.toISOString().split('T')[0];
    
    // v002: Manter DATA_LAUDO entre dia 8 do mês de referência e dia 7 do mês seguinte
    const dataInicioJanelaLaudo = new Date(anoCompleto, mesNumero - 1, 8);
    const dataFimJanelaLaudo = new Date(anoCompleto, mesNumero, 7);
    const dataInicioJanelaLaudoStr = dataInicioJanelaLaudo.toISOString().split('T')[0];
    const dataFimJanelaLaudoStr = dataFimJanelaLaudo.toISOString().split('T')[0];

    console.log(`📊 REGRAS CALCULADAS PARA PERÍODO ${periodo_referencia}:`);
    console.log(`   v003 - Excluir DATA_REALIZACAO >= ${dataLimiteRealizacaoStr}`);
    console.log(`   v002 - Manter DATA_LAUDO entre ${dataInicioJanelaLaudoStr} e ${dataFimJanelaLaudoStr}`);
    
    // Verificar dados antes da aplicação
    const { count: totalAntes } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', arquivo_fonte);
    
    console.log(`📊 Total registros ANTES: ${totalAntes || 0}`);

    // REGRA V003: Excluir registros com DATA_REALIZACAO >= primeiro dia do mês
    console.log(`🗑️ Aplicando REGRA V003: Excluindo registros com DATA_REALIZACAO >= ${dataLimiteRealizacaoStr}`);
    
    const { count: excluidos } = await supabase
      .from('volumetria_mobilemed')
      .delete({ count: 'exact' })
      .eq('arquivo_fonte', arquivo_fonte)
      .gte('DATA_REALIZACAO', dataLimiteRealizacaoStr);

    console.log(`❌ V003: ${excluidos || 0} registros excluídos por DATA_REALIZACAO >= ${dataLimiteRealizacaoStr}`);

    // REGRA V002: Manter apenas registros com DATA_LAUDO dentro da janela
    console.log(`🔍 Aplicando REGRA V002: Mantendo apenas DATA_LAUDO entre ${dataInicioJanelaLaudoStr} e ${dataFimJanelaLaudoStr}`);
    
    const { count: excluidos_v002 } = await supabase
      .from('volumetria_mobilemed')
      .delete({ count: 'exact' })
      .eq('arquivo_fonte', arquivo_fonte)
      .or(`DATA_LAUDO.lt.${dataInicioJanelaLaudoStr},DATA_LAUDO.gt.${dataFimJanelaLaudoStr}`);

    console.log(`❌ V002: ${excluidos_v002 || 0} registros excluídos por DATA_LAUDO fora do período ${dataInicioJanelaLaudoStr} a ${dataFimJanelaLaudoStr}`);

    // Verificar dados após aplicação
    const { count: totalDepois } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', arquivo_fonte);
    
    console.log(`📊 Total registros DEPOIS: ${totalDepois || 0}`);

    // Verificar faixas de data após aplicação
    const { data: estatisticas } = await supabase
      .from('volumetria_mobilemed')
      .select('DATA_LAUDO, DATA_REALIZACAO')
      .eq('arquivo_fonte', arquivo_fonte)
      .order('DATA_REALIZACAO', { ascending: true })
      .limit(5);

    const { data: estatisticas_fim } = await supabase
      .from('volumetria_mobilemed')
      .select('DATA_LAUDO, DATA_REALIZACAO')
      .eq('arquivo_fonte', arquivo_fonte)
      .order('DATA_REALIZACAO', { ascending: false })
      .limit(5);

    console.log('📅 Primeiros 5 registros por DATA_REALIZACAO:', estatisticas);
    console.log('📅 Últimos 5 registros por DATA_REALIZACAO:', estatisticas_fim);

    // Registrar no audit_logs
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'REGRAS_V002_V003_APLICADAS',
        record_id: arquivo_fonte,
        new_data: {
          arquivo_fonte,
          periodo_referencia,
          registros_inicial: totalAntes || 0,
          registros_excluidos_v003: excluidos || 0,
          registros_excluidos_v002: excluidos_v002 || 0,
          total_excluidos: (excluidos || 0) + (excluidos_v002 || 0),
          registros_finais: totalDepois || 0,
          regras: 'v002_v003',
          data_limite_realizacao: dataLimiteRealizacaoStr,
          janela_laudo_inicio: dataInicioJanelaLaudoStr,
          janela_laudo_fim: dataFimJanelaLaudoStr
        },
        user_email: 'system',
        severity: 'info'
      });

    const resultado = {
      success: true,
      regras_aplicadas: ['v002', 'v003'],
      registros_antes: totalAntes || 0,
      registros_depois: totalDepois || 0,
      excluidos_v003: excluidos || 0,
      excluidos_v002: excluidos_v002 || 0,
      total_excluidos: (excluidos || 0) + (excluidos_v002 || 0),
      arquivo_processado: arquivo_fonte,
      periodo_referencia,
      timestamp: new Date().toISOString(),
      detalhes: {
        data_limite_realizacao: dataLimiteRealizacaoStr,
        janela_laudo_inicio: dataInicioJanelaLaudoStr,
        janela_laudo_fim: dataFimJanelaLaudoStr
      },
      observacao: `V003: Exclui DATA_REALIZACAO >= ${dataLimiteRealizacaoStr} | V002: Mantém DATA_LAUDO entre ${dataInicioJanelaLaudoStr} e ${dataFimJanelaLaudoStr}`
    };

    console.log('✅ Resultado final:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Erro na aplicação manual das regras:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
