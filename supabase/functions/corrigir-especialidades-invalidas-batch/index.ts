import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const resultados: Record<string, number> = {}

    // 1. RX como especialidade → TORAX
    console.log('🔧 Corrigindo ESPECIALIDADE = RX → TORAX...')
    const { count: countRX } = await supabase
      .from('volumetria_mobilemed')
      .update({ ESPECIALIDADE: 'TORAX' }, { count: 'exact' })
      .eq('ESPECIALIDADE', 'RX')
    resultados['RX_para_TORAX'] = countRX || 0
    console.log(`✅ ${countRX || 0} registros corrigidos`)

    // 2. COLUNAS fora de contexto → MUSCULO ESQUELETICO
    console.log('🔧 Corrigindo ESPECIALIDADE = COLUNAS (sem COLUNA no nome)...')
    const { data: colunasForaContexto } = await supabase
      .from('volumetria_mobilemed')
      .select('id')
      .eq('ESPECIALIDADE', 'COLUNAS')
      .not('ESTUDO_DESCRICAO', 'ilike', '%coluna%')
      .limit(50000)
    
    let countColunas = 0
    if (colunasForaContexto && colunasForaContexto.length > 0) {
      const ids = colunasForaContexto.map(r => r.id)
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500)
        await supabase.from('volumetria_mobilemed')
          .update({ ESPECIALIDADE: 'MUSCULO ESQUELETICO' })
          .in('id', chunk)
        countColunas += chunk.length
      }
    }
    resultados['COLUNAS_para_MUSCULO'] = countColunas
    console.log(`✅ ${countColunas} registros corrigidos`)

    // 3. CT/MR + MEDICINA INTERNA + CABEÇA → NEURO
    console.log('🔧 Corrigindo MEDICINA INTERNA + CABEÇA → NEURO...')
    const modalidades = ['CT', 'MR']
    const categoriasCabeca = ['CABEÇA', 'CABECA']
    const categoriasPescoco = ['PESCOÇO', 'PESCOCO']
    
    let countCabeca = 0
    for (const mod of modalidades) {
      for (const cat of [...categoriasCabeca, ...categoriasPescoco]) {
        const { count } = await supabase.from('volumetria_mobilemed')
          .update({ ESPECIALIDADE: 'NEURO' }, { count: 'exact' })
          .eq('MODALIDADE', mod)
          .eq('ESPECIALIDADE', 'MEDICINA INTERNA')
          .eq('CATEGORIA', cat)
        countCabeca += (count || 0)
      }
    }
    resultados['MEDICINA_INTERNA_para_NEURO'] = countCabeca
    console.log(`✅ ${countCabeca} registros corrigidos`)

    // Verificar se ainda restam especialidades inválidas
    const { data: restantes } = await supabase
      .from('volumetria_mobilemed')
      .select('"ESPECIALIDADE", "CATEGORIA"')
      .in('ESPECIALIDADE', ['RX', 'COLUNAS'])
      .limit(100)
    
    const especialidadesRestantes = restantes?.length || 0

    return new Response(
      JSON.stringify({
        sucesso: true,
        resultados,
        total_corrigidos: Object.values(resultados).reduce((a, b) => a + b, 0),
        especialidades_invalidas_restantes: especialidadesRestantes,
        detalhes_restantes: restantes?.slice(0, 10)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('❌ Erro:', error)
    return new Response(
      JSON.stringify({ sucesso: false, erro: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
