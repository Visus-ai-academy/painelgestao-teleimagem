import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para calcular datas do período retroativo
function calcularDatasRetroativo(periodoReferencia: string) {
  const [mesStr, anoStr] = periodoReferencia.toLowerCase().split('/');
  const meses: Record<string, number> = {
    'janeiro': 1, 'jan': 1, 'fevereiro': 2, 'fev': 2, 'março': 3, 'mar': 3,
    'abril': 4, 'abr': 4, 'maio': 5, 'mai': 5, 'junho': 6, 'jun': 6,
    'julho': 7, 'jul': 7, 'agosto': 8, 'ago': 8, 'setembro': 9, 'set': 9,
    'outubro': 10, 'out': 10, 'novembro': 11, 'nov': 11, 'dezembro': 12, 'dez': 12
  };
  
  const mes = meses[mesStr];
  const ano = anoStr.length === 2 ? 2000 + parseInt(anoStr) : parseInt(anoStr);
  
  // Para arquivos retroativos:
  // v003: DATA_REALIZACAO deve ser < 01 do mês de referência
  // v002: DATA_LAUDO deve estar entre 08 do mês e 07 do mês seguinte (inclusive)
  const dataLimiteRealizacao = new Date(ano, mes - 1, 1); // 01 do mês
  const inicioFaturamento = new Date(ano, mes - 1, 8); // 08 do mês
  const fimFaturamento = new Date(ano, mes, 7); // 07 do mês seguinte
  
  return {
    dataLimiteRealizacao: dataLimiteRealizacao.toISOString().split('T')[0],
    inicioFaturamento: inicioFaturamento.toISOString().split('T')[0],
    fimFaturamento: fimFaturamento.toISOString().split('T')[0]
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { periodo_referencia } = await req.json();
    
    if (!periodo_referencia) {
      throw new Error('período_referencia é obrigatório');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`🔧 CORRIGINDO VOLUMETRIA RETROATIVA para período: ${periodo_referencia}`);

    const { dataLimiteRealizacao, inicioFaturamento, fimFaturamento } = calcularDatasRetroativo(periodo_referencia);
    
    console.log(`📅 Datas calculadas:`);
    console.log(`   - Limite REALIZACAO (exclusivo): < ${dataLimiteRealizacao}`);
    console.log(`   - Período LAUDO (inclusivo): ${inicioFaturamento} até ${fimFaturamento}`);

    let totalExcluidos = 0;
    const detalhes = [];

    // 1. Primeiro, contar registros antes da correção
    const { count: antesCount } = await supabaseClient
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', 'volumetria_padrao_retroativo');

    console.log(`📊 Registros ANTES da correção: ${antesCount}`);

    // 2. REGRA v003: Excluir DATA_REALIZACAO >= data limite (deve ser < 01 do mês)
    console.log(`🗑️ Aplicando REGRA v003 - Excluindo DATA_REALIZACAO >= ${dataLimiteRealizacao}`);
    
    const { error: errorRealizacao, count: countRealizacao } = await supabaseClient
      .from('volumetria_mobilemed')
      .delete({ count: 'exact' })
      .eq('arquivo_fonte', 'volumetria_padrao_retroativo')
      .gte('data_realizacao', dataLimiteRealizacao);

    if (errorRealizacao) {
      console.error('❌ Erro na REGRA v003:', errorRealizacao);
    } else {
      const deleted = countRealizacao || 0;
      totalExcluidos += deleted;
      detalhes.push(`REGRA v003: ${deleted} registros excluídos por DATA_REALIZACAO >= ${dataLimiteRealizacao}`);
      console.log(`✅ REGRA v003: ${deleted} registros excluídos`);
    }

    // 3. REGRA v002: Excluir DATA_LAUDO fora do período de faturamento
    console.log(`🗑️ Aplicando REGRA v002 - Mantendo DATA_LAUDO entre ${inicioFaturamento} e ${fimFaturamento}`);
    
    const { error: errorLaudo, count: countLaudo } = await supabaseClient
      .from('volumetria_mobilemed')
      .delete({ count: 'exact' })
      .eq('arquivo_fonte', 'volumetria_padrao_retroativo')
      .or(`data_laudo.lt.${inicioFaturamento},data_laudo.gt.${fimFaturamento}`);

    if (errorLaudo) {
      console.error('❌ Erro na REGRA v002:', errorLaudo);
    } else {
      const deleted = countLaudo || 0;
      totalExcluidos += deleted;
      detalhes.push(`REGRA v002: ${deleted} registros excluídos por DATA_LAUDO fora do período`);
      console.log(`✅ REGRA v002: ${deleted} registros excluídos`);
    }

    // 4. REGRA v032: Excluir clientes específicos
    console.log(`🗑️ Aplicando REGRA v032 - Excluindo clientes específicos`);
    
    const clientesExcluir = ['RADIOCOR_LOCAL', 'CLINICADIA_TC', 'CLINICA RADIOCOR', 'CLIRAM_LOCAL'];
    
    const { error: errorClientes, count: countClientes } = await supabaseClient
      .from('volumetria_mobilemed')
      .delete({ count: 'exact' })
      .eq('arquivo_fonte', 'volumetria_padrao_retroativo')
      .in('EMPRESA', clientesExcluir);

    if (errorClientes) {
      console.error('❌ Erro na REGRA v032:', errorClientes);
    } else {
      const deleted = countClientes || 0;
      totalExcluidos += deleted;
      detalhes.push(`REGRA v032: ${deleted} registros excluídos de clientes específicos`);
      console.log(`✅ REGRA v032: ${deleted} registros excluídos`);
    }

    // 5. Contar registros após a correção
    const { count: depoisCount } = await supabaseClient
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', 'volumetria_padrao_retroativo');

    console.log(`📊 Registros DEPOIS da correção: ${depoisCount}`);

    // 6. Log de auditoria
    await supabaseClient
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'CORRECAO_VOLUMETRIA_RETROATIVA',
        record_id: 'volumetria_padrao_retroativo',
        new_data: {
          periodo_referencia,
          registros_antes: antesCount,
          registros_depois: depoisCount,
          total_excluidos: totalExcluidos,
          detalhes
        },
        user_email: 'system',
        severity: 'info'
      });

    console.log(`🎯 CORREÇÃO CONCLUÍDA!`);
    console.log(`   - Registros antes: ${antesCount}`);
    console.log(`   - Registros depois: ${depoisCount}`);
    console.log(`   - Total excluído: ${totalExcluidos}`);

    return new Response(JSON.stringify({
      success: true,
      periodo_referencia,
      registros_antes: antesCount,
      registros_depois: depoisCount,
      total_excluidos: totalExcluidos,
      detalhes,
      esperado_aproximado: '~247 registros'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 ERRO CRÍTICO:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});