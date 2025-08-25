import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'
import { corsHeaders } from '../_shared/cors.ts'

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

    console.log(`🧹 LIMPEZA COMPLETA - Iniciando remoção de TODOS os dados de volumetria`)

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

    console.log(`🧹 LIMPEZA EM LOTES - Executando limpeza controlada para evitar timeout`)
    
    let totalRemovidoGeral = 0
    const resultadosLimpeza = []

    // 1. LIMPAR TABELA volumetria_mobilemed - USANDO TRUNCATE (MUITO MAIS RÁPIDO)
    console.log(`📊 Limpando volumetria_mobilemed usando TRUNCATE (bypassa triggers)`)
    
    // Contar registros antes da limpeza
    const { count: countAntes } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
    
    console.log(`📊 Total de registros para limpar: ${countAntes || 0}`)
    
    // TRUNCATE é muito mais rápido que DELETE para limpar toda a tabela
    const { error: truncateError } = await supabase.rpc('exec_truncate_volumetria')
    
    if (truncateError) {
      console.error('❌ Erro ao executar TRUNCATE, tentando DELETE simples:', truncateError)
      
      // Fallback: DELETE simples sem condições
      const { error: deleteError } = await supabase
        .from('volumetria_mobilemed')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Condição que sempre é verdadeira
      
      if (deleteError) {
        console.error('❌ Erro no DELETE fallback:', deleteError)
        throw new Error(`Erro ao limpar volumetria: ${deleteError.message}`)
      }
    }
    
    // Contar registros após a limpeza
    const { count: countDepois } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
    
    const removidosVolumetria = (countAntes || 0) - (countDepois || 0)
    console.log(`🎉 VOLUMETRIA LIMPA: ${removidosVolumetria} registros removidos`)
    
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