import { supabase } from '@/integrations/supabase/client';

/**
 * APLICAR TODAS AS REGRAS MANUALMENTE
 * 
 * Este script aplica todas as regras que faltaram nos uploads recentes:
 * - Regras v002/v003 (exclusões retroativas)
 * - Categorias do cadastro_exames
 * - Quebras de exames
 * - Outras regras de negócio
 */
export async function aplicarTodasRegrasManualmente(): Promise<{ success: boolean; message: string; detalhes: any }> {
  console.log('🚀 APLICANDO TODAS AS REGRAS MANUALMENTE');
  
  try {
    const resultados = [];
    
    // 1. APLICAR REGRAS v002/v003 (Exclusões Retroativas)
    console.log('\n🔥 1. Aplicando regras v002/v003 (exclusões retroativas)...');
    const { data: resultadoV002V003, error: errorV002V003 } = await supabase.functions.invoke(
      'aplicar-regras-v002-v003-manual',
      { body: {} }
    );
    
    if (errorV002V003) {
      console.error('❌ Erro v002/v003:', errorV002V003);
    } else {
      console.log('✅ Regras v002/v003 aplicadas:', resultadoV002V003);
      resultados.push({ regra: 'v002_v003', resultado: resultadoV002V003 });
    }
    
    // 2. APLICAR CATEGORIAS
    console.log('\n📋 2. Aplicando categorias do cadastro_exames...');
    const { data: resultadoCategorias, error: errorCategorias } = await supabase.functions.invoke(
      'aplicar-categorias-cadastro',
      { body: {} }
    );
    
    if (errorCategorias) {
      console.error('❌ Erro categorias:', errorCategorias);
    } else {
      console.log('✅ Categorias aplicadas:', resultadoCategorias);
      resultados.push({ regra: 'categorias', resultado: resultadoCategorias });
    }
    
    // 3. APLICAR QUEBRAS DE EXAMES
    console.log('\n🔪 3. Aplicando quebras de exames...');
    const { data: resultadoQuebras, error: errorQuebras } = await supabase.functions.invoke(
      'aplicar-quebras-automatico',
      { body: {} }
    );
    
    if (errorQuebras) {
      console.error('❌ Erro quebras:', errorQuebras);
    } else {
      console.log('✅ Quebras aplicadas:', resultadoQuebras);
      resultados.push({ regra: 'quebras', resultado: resultadoQuebras });
    }
    
    // 4. APLICAR DE-PARA DE PRIORIDADES
    console.log('\n⚡ 4. Aplicando de-para de prioridades...');
    const { data: resultadoPrioridades, error: errorPrioridades } = await supabase.functions.invoke(
      'aplicar-de-para-prioridades',
      { body: {} }
    );
    
    if (errorPrioridades) {
      console.error('❌ Erro prioridades:', errorPrioridades);
    } else {
      console.log('✅ Prioridades aplicadas:', resultadoPrioridades);
      resultados.push({ regra: 'prioridades', resultado: resultadoPrioridades });
    }
    
    // 5. APLICAR DE-PARA DE VALORES
    console.log('\n💰 5. Aplicando de-para de valores...');
    const { data: resultadoValores, error: errorValores } = await supabase.functions.invoke(
      'aplicar-de-para-automatico',
      { body: {} }
    );
    
    if (errorValores) {
      console.error('❌ Erro valores:', errorValores);
    } else {
      console.log('✅ Valores aplicados:', resultadoValores);
      resultados.push({ regra: 'valores', resultado: resultadoValores });
    }
    
    // 6. CORREÇÃO DE MODALIDADES
    console.log('\n🔧 6. Aplicando correções de modalidades...');
    const { data: resultadoModalidades, error: errorModalidades } = await supabase.functions.invoke(
      'aplicar-correcao-modalidade-rx',
      { body: {} }
    );
    
    if (errorModalidades) {
      console.error('❌ Erro modalidades:', errorModalidades);
    } else {
      console.log('✅ Modalidades corrigidas:', resultadoModalidades);
      resultados.push({ regra: 'modalidades', resultado: resultadoModalidades });
    }
    
    // VERIFICAR RESULTADO FINAL
    console.log('\n📊 Verificando resultado final...');
    const { count: totalFinal } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString());
    
    console.log(`📈 Total final de registros: ${totalFinal || 0}`);
    
    return {
      success: true,
      message: `Todas as regras foram aplicadas. ${resultados.length} regras processadas.`,
      detalhes: {
        total_regras_aplicadas: resultados.length,
        registros_finais: totalFinal || 0,
        resultados_por_regra: resultados
      }
    };
    
  } catch (error) {
    console.error('💥 Erro crítico:', error);
    return {
      success: false,
      message: `Erro na aplicação das regras: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      detalhes: null
    };
  }
}

// Executar automaticamente
aplicarTodasRegrasManualmente().then(resultado => {
  console.log('\n🏁 RESULTADO FINAL:', resultado);
});