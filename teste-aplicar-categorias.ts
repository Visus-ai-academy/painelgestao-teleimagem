// Script de teste para aplicar categorias baseadas no cadastro_exames
import { supabase } from "./src/integrations/supabase/client";

const testarAplicacaoCategorias = async () => {
  try {
    console.log('🏷️ Testando aplicação de categorias...')
    
    // 1. Verificar dados antes
    const { data: antesDados } = await supabase
      .from('volumetria_mobilemed')
      .select('"CATEGORIA"')
      .eq('arquivo_fonte', 'volumetria_padrao')
    
    const antesNull = antesDados?.filter(r => !r.CATEGORIA).length || 0
    const antesPreenchidas = antesDados?.filter(r => r.CATEGORIA).length || 0
    
    console.log('📊 ANTES:')
    console.log(`   - Registros sem categoria: ${antesNull}`)
    console.log(`   - Registros com categoria: ${antesPreenchidas}`)
    
    // 2. Aplicar a nova regra
    console.log('🔄 Aplicando regra v040 - categorias baseadas no cadastro...')
    
    const { data, error } = await supabase.functions.invoke('aplicar-categorias-cadastro', {
      body: { arquivo_fonte: 'volumetria_padrao' }
    })
    
    if (error) {
      console.error('❌ Erro ao aplicar categorias:', error)
      return
    }
    
    console.log('✅ Resultado da aplicação:', data)
    
    // 3. Verificar dados depois
    const { data: depoisDados } = await supabase
      .from('volumetria_mobilemed')
      .select('"CATEGORIA"')
      .eq('arquivo_fonte', 'volumetria_padrao')
    
    const depoisNull = depoisDados?.filter(r => !r.CATEGORIA).length || 0
    const depoisPreenchidas = depoisDados?.filter(r => r.CATEGORIA).length || 0
    
    console.log('📊 DEPOIS:')
    console.log(`   - Registros sem categoria: ${depoisNull}`)
    console.log(`   - Registros com categoria: ${depoisPreenchidas}`)
    console.log(`   - Categorias aplicadas: ${antesPreenchidas - depoisNull}`)
    
    // 4. Mostrar distribuição das categorias
    const { data: distribuicao } = await supabase
      .from('volumetria_mobilemed')
      .select('"CATEGORIA"')
      .eq('arquivo_fonte', 'volumetria_padrao')
      .not('"CATEGORIA"', 'is', null)
    
    const contadorCategorias: Record<string, number> = {}
    distribuicao?.forEach(r => {
      contadorCategorias[r.CATEGORIA] = (contadorCategorias[r.CATEGORIA] || 0) + 1
    })
    
    console.log('🎯 Distribuição das categorias:')
    Object.entries(contadorCategorias)
      .sort(([,a], [,b]) => b - a)
      .forEach(([categoria, total]) => {
        console.log(`   - ${categoria}: ${total} registros`)
      })
    
  } catch (error) {
    console.error('💥 Erro no teste:', error)
  }
}

testarAplicacaoCategorias()