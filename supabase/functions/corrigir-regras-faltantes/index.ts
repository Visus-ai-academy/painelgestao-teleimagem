import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('🔥 CORRIGINDO TODAS AS REGRAS FALTANTES...')

    const resultados: any[] = []

    // 1. APLICAR REGRAS v002/v003 (EXCLUSÕES RETROATIVAS)
    console.log('\n1️⃣ Aplicando regras v002/v003 (exclusões retroativas)...')
    
    // Regra v003: Excluir registros retroativos com DATA_REALIZACAO >= 2025-06-01
    const { count: countV003Before } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .like('arquivo_fonte', '%retroativo%')
      .gte('DATA_REALIZACAO', '2025-06-01')

    const { error: errorV003 } = await supabase
      .from('volumetria_mobilemed')
      .delete()
      .like('arquivo_fonte', '%retroativo%')
      .gte('DATA_REALIZACAO', '2025-06-01')

    const { count: countV003After } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .like('arquivo_fonte', '%retroativo%')
      .gte('DATA_REALIZACAO', '2025-06-01')

    if (errorV003) {
      console.error('❌ Erro na regra v003:', errorV003)
    } else {
      const excluidos = (countV003Before || 0) - (countV003After || 0)
      console.log(`✅ Regra v003: ${excluidos} registros excluídos`)
      resultados.push({
        regra: 'v003',
        antes: countV003Before,
        depois: countV003After,
        excluidos
      })
    }

    // Regra v002: Excluir registros retroativos com DATA_LAUDO fora do período 2025-06-08 a 2025-07-07
    const { count: countV002Before } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .like('arquivo_fonte', '%retroativo%')
      .or('DATA_LAUDO.lt.2025-06-08,DATA_LAUDO.gt.2025-07-07')

    const { error: errorV002 } = await supabase
      .from('volumetria_mobilemed')
      .delete()
      .like('arquivo_fonte', '%retroativo%')
      .or('DATA_LAUDO.lt.2025-06-08,DATA_LAUDO.gt.2025-07-07')

    const { count: countV002After } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .like('arquivo_fonte', '%retroativo%')
      .or('DATA_LAUDO.lt.2025-06-08,DATA_LAUDO.gt.2025-07-07')

    if (errorV002) {
      console.error('❌ Erro na regra v002:', errorV002)
    } else {
      const excluidos = (countV002Before || 0) - (countV002After || 0)
      console.log(`✅ Regra v002: ${excluidos} registros excluídos`)
      resultados.push({
        regra: 'v002',
        antes: countV002Before,
        depois: countV002After,
        excluidos
      })
    }

    // 2. APLICAR CATEGORIAS DO CADASTRO_EXAMES
    console.log('\n2️⃣ Aplicando categorias do cadastro_exames...')
    
    const { count: categoriasBefore } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('CATEGORIA', 'SC')

    // Buscar mapeamentos de categoria do cadastro_exames
    const { data: cadastroExames } = await supabase
      .from('cadastro_exames')
      .select('nome, categoria')
      .eq('ativo', true)
      .not('categoria', 'is', null)
      .neq('categoria', '')

    let categoriasAtualizadas = 0
    if (cadastroExames && cadastroExames.length > 0) {
      // Criar um mapa de exame -> categoria
      const mapaCategorias = new Map()
      cadastroExames.forEach(exame => {
        if (exame.categoria && exame.categoria !== 'SC') {
          mapaCategorias.set(exame.nome, exame.categoria)
        }
      })

      // Buscar registros que precisam de categoria
      const { data: registrosSemCategoria } = await supabase
        .from('volumetria_mobilemed')
        .select('id, ESTUDO_DESCRICAO')
        .eq('CATEGORIA', 'SC')

      if (registrosSemCategoria) {
        // Processar em lotes de 100
        const loteSize = 100
        for (let i = 0; i < registrosSemCategoria.length; i += loteSize) {
          const lote = registrosSemCategoria.slice(i, i + loteSize)
          
          for (const registro of lote) {
            const novaCategoria = mapaCategorias.get(registro.ESTUDO_DESCRICAO)
            if (novaCategoria) {
              const { error } = await supabase
                .from('volumetria_mobilemed')
                .update({ CATEGORIA: novaCategoria })
                .eq('id', registro.id)
              
              if (!error) categoriasAtualizadas++
            }
          }
        }
      }
    }

    console.log(`✅ Categorias: ${categoriasAtualizadas} registros atualizados`)
    resultados.push({
      regra: 'categorias',
      antes: categoriasBefore,
      atualizados: categoriasAtualizadas
    })

    // 3. VERIFICAÇÃO FINAL
    console.log('\n📊 VERIFICAÇÃO FINAL...')
    
    const { count: totalFinal } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())

    const { count: semCategoriaFinal } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('CATEGORIA', 'SC')
      .gte('created_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())

    console.log(`📈 Total final de registros: ${totalFinal}`)
    console.log(`📋 Registros ainda sem categoria: ${semCategoriaFinal}`)

    const resultado = {
      sucesso: true,
      message: 'Regras faltantes aplicadas com sucesso',
      detalhes: {
        total_final: totalFinal,
        sem_categoria_final: semCategoriaFinal,
        resultados_por_regra: resultados
      }
    }

    console.log('🎉 CORREÇÃO CONCLUÍDA:', resultado)

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('💥 Erro crítico:', error)
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        error: error.message || 'Erro desconhecido' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})