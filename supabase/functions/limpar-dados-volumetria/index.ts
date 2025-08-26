import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'Access-Control-Max-Age': '86400',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Inicializar cliente Supabase com service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log(`🧹 LIMPEZA DIRETA SQL - Executando limpeza super otimizada`)

    // Lista de todos os tipos de arquivo que serão limpos
    const tiposArquivo = [
      'volumetria_padrao',
      'volumetria_fora_padrao', 
      'volumetria_padrao_retroativo',
      'volumetria_fora_padrao_retroativo',
      'de_para_exames',
      'valores_de_para',
      'volumetria_onco_padrao'
    ]

    let totalRemovidoGeral = 0
    const resultadosLimpeza = []

    // ESTRATÉGIA HÍBRIDA: TRUNCATE + FALLBACK DELETE MICRO-LOTES
    console.log(`💥 Iniciando limpeza híbrida para garantir sucesso`)
    
    // Contar registros antes
    const { count: countAntes } = await supabase
      .from('volumetria_mobilemed')  
      .select('*', { count: 'exact', head: true })
    
    console.log(`📊 Registros para limpar: ${countAntes || 0}`)
    
    let removidosVolumetria = 0
    
    // ESTRATÉGIA DE LOTES PEQUENOS PARA EVITAR TIMEOUT
    console.log(`🚀 Iniciando limpeza em lotes pequenos para evitar timeout...`)
    
    const loteSize = 1000 // Lotes pequenos para evitar timeout
    let totalRemovido = 0
    let continuarLimpeza = true
    
    while (continuarLimpeza) {
      console.log(`🔄 Processando lote de ${loteSize} registros...`)
      
      // Buscar IDs dos próximos registros a serem removidos
      const { data: registrosParaRemover } = await supabase
        .from('volumetria_mobilemed')
        .select('id')
        .limit(loteSize)
      
      if (!registrosParaRemover || registrosParaRemover.length === 0) {
        console.log(`✅ Nenhum registro encontrado para remoção - limpeza completa!`)
        continuarLimpeza = false
        break
      }
      
      const ids = registrosParaRemover.map(r => r.id)
      console.log(`🗑️ Removendo ${ids.length} registros...`)
      
      const { error: deleteError, count: deleteCount } = await supabase
        .from('volumetria_mobilemed')
        .delete({ count: 'exact' })
        .in('id', ids)
      
      if (deleteError) {
        console.error(`❌ Erro no DELETE do lote:`, deleteError)
        throw new Error(`DELETE do lote falhou: ${deleteError.message}`)
      }
      
      const removidos = deleteCount || 0
      totalRemovido += removidos
      console.log(`✅ Lote processado: ${removidos} registros removidos (Total: ${totalRemovido})`)
      
      // Se removeu menos que o tamanho do lote, significa que acabaram os registros
      if (removidos < loteSize) {
        continuarLimpeza = false
      }
    }
    
    removidosVolumetria = totalRemovido
    console.log(`🎉 Limpeza em lotes concluída! Total removido: ${totalRemovido}`)
    
    // CRÍTICO: Atualizar view materializada após limpeza
    console.log(`🔄 Atualizando view materializada mv_volumetria_dashboard...`)
    const { error: refreshError } = await supabase.rpc('refresh_volumetria_dashboard')
    
    if (refreshError) {
      console.error(`⚠️ Erro ao atualizar view materializada:`, refreshError)
    } else {
      console.log(`✅ View materializada atualizada com sucesso`)
    }
    
    console.log(`🎉 VOLUMETRIA: ${removidosVolumetria} registros removidos`)
    totalRemovidoGeral += removidosVolumetria
    resultadosLimpeza.push({
      tabela: 'volumetria_mobilemed',
      registros_removidos: removidosVolumetria
    })

    // 2. LIMPAR TABELA processamento_uploads
    console.log(`📊 Limpando tabela: processamento_uploads`)
    
    const { error: statusError, count: statusCount } = await supabase
      .from('processamento_uploads')
      .delete({ count: 'exact' })
      .in('tipo_arquivo', tiposArquivo)

    if (!statusError) {
      console.log(`🗑️ Removidos ${statusCount || 0} registros de processamento_uploads`)
      resultadosLimpeza.push({
        tabela: 'processamento_uploads',
        registros_removidos: statusCount || 0
      })
    }

    // 3. LIMPAR TABELA valores_referencia_de_para
    console.log(`📊 Limpando tabela: valores_referencia_de_para`)
    
    const { error: deParaError, count: deParaCount } = await supabase
      .from('valores_referencia_de_para')
      .delete({ count: 'exact' })
      .gt('created_at', '1900-01-01') // Condição que sempre é verdadeira

    if (!deParaError) {
      console.log(`🗑️ Removidos ${deParaCount || 0} registros de valores_referencia_de_para`)
      resultadosLimpeza.push({
        tabela: 'valores_referencia_de_para',
        registros_removidos: deParaCount || 0
      })
    }

    // 4. LIMPAR registros_rejeitados_processamento
    console.log(`📊 Limpando tabela: registros_rejeitados_processamento`)
    
    const { error: rejeitadosError, count: rejeitadosCount } = await supabase
      .from('registros_rejeitados_processamento')
      .delete({ count: 'exact' })
      .in('arquivo_fonte', tiposArquivo)

    if (!rejeitadosError) {
      console.log(`🗑️ Removidos ${rejeitadosCount || 0} registros de registros_rejeitados_processamento`)
      resultadosLimpeza.push({
        tabela: 'registros_rejeitados_processamento',
        registros_removidos: rejeitadosCount || 0
      })
    }

    const totalFinal = resultadosLimpeza.reduce((acc, curr) => acc + curr.registros_removidos, 0)

    console.log(`✅ LIMPEZA SÍNCRONA FINALIZADA!`)
    console.log(`📊 Total de registros removidos: ${totalFinal}`)
    console.log(`📋 Detalhes por tabela:`, JSON.stringify(resultadosLimpeza, null, 2))

    // RETORNAR RESPOSTA COM RESULTADO REAL
    return new Response(
      JSON.stringify({
        success: true,
        message: `Limpeza concluída! ${totalFinal} registros removidos.`,
        details: resultadosLimpeza,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Erro geral na limpeza completa:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})