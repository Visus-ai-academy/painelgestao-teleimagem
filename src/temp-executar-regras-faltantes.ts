import { supabase } from '@/integrations/supabase/client';

/**
 * EXECUTAR REGRAS FALTANTES
 * Aplica todas as regras que não foram aplicadas nos uploads recentes
 */
async function executarRegrasFaltantes() {
  console.log('🔥 APLICANDO REGRAS FALTANTES...');
  
  try {
    // 1. Regras v002/v003 (Exclusões Retroativas)
    console.log('\n1️⃣ Aplicando regras v002/v003...');
    const { data: v002v003, error: errorV002 } = await supabase.functions.invoke('aplicar-regras-v002-v003-manual');
    if (errorV002) console.error('❌ Erro v002/v003:', errorV002);
    else console.log('✅ v002/v003:', v002v003);
    
    // 2. Categorias
    console.log('\n2️⃣ Aplicando categorias...');
    const { data: categorias, error: errorCat } = await supabase.functions.invoke('aplicar-categorias-cadastro');
    if (errorCat) console.error('❌ Erro categorias:', errorCat);
    else console.log('✅ Categorias:', categorias);
    
    // 3. Quebras
    console.log('\n3️⃣ Aplicando quebras...');
    const { data: quebras, error: errorQuebras } = await supabase.functions.invoke('aplicar-quebras-automatico');
    if (errorQuebras) console.error('❌ Erro quebras:', errorQuebras);
    else console.log('✅ Quebras:', quebras);
    
    // 4. De-Para Prioridades
    console.log('\n4️⃣ Aplicando de-para prioridades...');
    const { data: prioridades, error: errorPrio } = await supabase.functions.invoke('aplicar-de-para-prioridades');
    if (errorPrio) console.error('❌ Erro prioridades:', errorPrio);
    else console.log('✅ Prioridades:', prioridades);
    
    // 5. De-Para Valores
    console.log('\n5️⃣ Aplicando de-para valores...');
    const { data: valores, error: errorVal } = await supabase.functions.invoke('aplicar-de-para-automatico');
    if (errorVal) console.error('❌ Erro valores:', errorVal);
    else console.log('✅ Valores:', valores);
    
    // 6. Correção Modalidades
    console.log('\n6️⃣ Corrigindo modalidades...');
    const { data: modalidades, error: errorMod } = await supabase.functions.invoke('aplicar-correcao-modalidade-rx');
    if (errorMod) console.error('❌ Erro modalidades:', errorMod);
    else console.log('✅ Modalidades:', modalidades);
    
    // Verificação final
    console.log('\n📊 VERIFICAÇÃO FINAL...');
    const { count: totalFinal } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString());
    
    const { data: stats } = await supabase
      .from('volumetria_mobilemed')
      .select('CATEGORIA')
      .eq('CATEGORIA', 'SC')
      .gte('created_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString());
      
    console.log(`📈 Total de registros: ${totalFinal}`);
    console.log(`📋 Registros ainda sem categoria: ${stats?.length || 0}`);
    
    console.log('\n🎉 TODAS AS REGRAS APLICADAS!');
    
  } catch (error) {
    console.error('💥 Erro:', error);
  }
}

// Executar
executarRegrasFaltantes();