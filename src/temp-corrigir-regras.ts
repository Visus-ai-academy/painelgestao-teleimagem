import { supabase } from '@/integrations/supabase/client';

/**
 * CORRIGIR REGRAS FALTANTES
 * Executa a Edge Function para aplicar todas as regras que não foram aplicadas
 */
async function corrigirRegrasFaltantes() {
  console.log('🔥 EXECUTANDO CORREÇÃO DAS REGRAS FALTANTES...');
  
  try {
    // Usar a função existente que aplica todas as 27 regras
    const { data, error } = await supabase.functions.invoke('corrigir-todos-dados-existentes');
    
    if (error) {
      console.error('❌ Erro na correção:', error);
      return;
    }
    
    console.log('✅ CORREÇÃO CONCLUÍDA:', data);
    
    // Verificar resultados
    if (data?.detalhes?.resultados_por_regra) {
      console.log('\n📊 RESUMO DAS CORREÇÕES:');
      data.detalhes.resultados_por_regra.forEach((resultado: any) => {
        console.log(`- ${resultado.regra}: ${resultado.excluidos || resultado.atualizados || 0} registros processados`);
      });
    }
    
    console.log(`\n📈 Total final: ${data?.detalhes?.total_final || 0} registros`);
    console.log(`📋 Sem categoria: ${data?.detalhes?.sem_categoria_final || 0} registros`);
    
  } catch (error) {
    console.error('💥 Erro na execução:', error);
  }
}

// Executar automaticamente
corrigirRegrasFaltantes();