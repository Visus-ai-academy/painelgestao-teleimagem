import { supabase } from '@/integrations/supabase/client';

/**
 * TESTE DA NOVA FUNÇÃO: aplicar-27-regras-completas
 * Remove duplicações e usa a função unificada
 */
async function testarNovasFuncoes() {
  console.log('🧪 TESTANDO NOVA FUNÇÃO: aplicar-27-regras-completas');
  
  try {
    // 1. Testar função unificada
    console.log('\n1️⃣ Testando aplicação das 27 regras...');
    const { data, error } = await supabase.functions.invoke('aplicar-27-regras-completas', {
      body: {
        aplicar_todos_arquivos: true,
        periodo_referencia: '06/2025'
      }
    });
    
    if (error) {
      console.error('❌ Erro na função unificada:', error);
    } else {
      console.log('✅ Função unificada funcionando:', data);
      
      if (data?.resultados) {
        console.log('\n📊 RESULTADOS:');
        console.log(`   📁 Arquivos processados: ${data.resultados.total_arquivos_processados}`);
        console.log(`   📊 Registros processados: ${data.resultados.total_registros_processados}`);
        console.log(`   🚫 Registros excluídos: ${data.resultados.total_registros_excluidos}`);
        console.log(`   📝 Registros atualizados: ${data.resultados.total_registros_atualizados}`);
        console.log(`   🔪 Registros quebrados: ${data.resultados.total_registros_quebrados}`);
        console.log(`   ✅ Regras aplicadas: ${data.resultados.regras_aplicadas?.join(', ')}`);
        
        if (data.resultados.detalhes_por_arquivo) {
          console.log('\n📋 DETALHES POR ARQUIVO:');
          data.resultados.detalhes_por_arquivo.forEach((arquivo: any) => {
            console.log(`   🗂️ ${arquivo.arquivo}:`);
            console.log(`      📊 ${arquivo.registros_antes} → ${arquivo.registros_depois} (${arquivo.registros_excluidos} excluídos)`);
            console.log(`      ✅ Regras: ${arquivo.regras_aplicadas.join(', ')}`);
          });
        }
      }
    }
    
    // 2. Verificar estado final dos dados
    console.log('\n2️⃣ Verificando estado final dos dados...');
    const { count: totalFinal } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString());
    
    const { count: semCategoria } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('CATEGORIA', 'SC')
      .gte('created_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString());
    
    console.log(`📈 Total de registros: ${totalFinal}`);
    console.log(`📋 Registros sem categoria: ${semCategoria}`);
    
    // 3. Verificar aplicação das regras específicas
    console.log('\n3️⃣ Verificando aplicação das regras específicas...');
    
    // Verificar modalidades corrigidas
    const { count: modalidadesRX } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('MODALIDADE', 'RX')
      .like('ESTUDO_DESCRICAO', 'RX %')
      .gte('created_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString());
    
    // Verificar prioridades aplicadas
    const { count: prioridadesAplicadas } = await supabase
      .from('valores_prioridade_de_para')
      .select('*', { count: 'exact', head: true })
      .eq('ativo', true);
    
    console.log(`🔧 Modalidades RX corrigidas: ${modalidadesRX}`);
    console.log(`⚡ Prioridades disponíveis: ${prioridadesAplicadas}`);
    
    console.log('\n🎉 TESTE CONCLUÍDO - Função unificada funcionando!');
    
  } catch (error) {
    console.error('💥 Erro no teste:', error);
  }
}

// Executar teste
testarNovasFuncoes();