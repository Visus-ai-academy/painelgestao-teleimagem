import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

export default async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Inicializar cliente Supabase com service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log(`🧹 LIMPEZA COMPLETA - Iniciando remoção de TODOS os dados de volumetria e de-para`)

    // Lista de todos os tipos de arquivo que serão limpos
    const tiposArquivo = [
      'volumetria_padrao',
      'volumetria_fora_padrao', 
      'volumetria_padrao_retroativo',
      'volumetria_fora_padrao_retroativo',
      'de_para_exames',
      'valores_de_para'
    ]

    let totalRemovidoGeral = 0
    const resultadosLimpeza = []

    // 1. LIMPAR TABELA volumetria_mobilemed
    console.log(`📊 Limpando tabela: volumetria_mobilemed`)
    
    const { count: totalVolumetria, error: countError } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.error('Erro ao contar registros volumetria:', countError)
    } else {
      console.log(`📊 Total de registros em volumetria_mobilemed: ${totalVolumetria}`)
      
      if (totalVolumetria > 0) {
        // Deletar TODOS os registros em lotes
        const batchSize = 1000
        let removidosVolumetria = 0

        while (true) {
          const { error, count } = await supabase
            .from('volumetria_mobilemed')
            .delete({ count: 'exact' })
            .limit(batchSize)

          if (error) {
            console.error('Erro ao deletar volumetria:', error)
            break
          }

          removidosVolumetria += count || 0
          console.log(`🗑️ Lote removido de volumetria_mobilemed: ${count} registros (total: ${removidosVolumetria})`)

          if ((count || 0) < batchSize) {
            break
          }

          await new Promise(resolve => setTimeout(resolve, 100))
        }

        totalRemovidoGeral += removidosVolumetria
        resultadosLimpeza.push({
          tabela: 'volumetria_mobilemed',
          registros_removidos: removidosVolumetria
        })
      }
    }

    // 2. LIMPAR TABELA processamento_uploads
    console.log(`📊 Limpando tabela: processamento_uploads`)
    
    const { error: statusError, count: statusCount } = await supabase
      .from('processamento_uploads')
      .delete({ count: 'exact' })
      .in('tipo_arquivo', tiposArquivo)

    if (statusError) {
      console.warn('Erro ao limpar processamento_uploads:', statusError.message)
    } else {
      console.log(`🗑️ Removidos ${statusCount} registros de processamento_uploads`)
      resultadosLimpeza.push({
        tabela: 'processamento_uploads',
        registros_removidos: statusCount || 0
      })
    }

    // 3. LIMPAR TABELA valores_referencia_de_para (se existir)
    console.log(`📊 Limpando tabela: valores_referencia_de_para`)
    
    const { error: deParaError, count: deParaCount } = await supabase
      .from('valores_referencia_de_para')
      .delete({ count: 'exact' })

    if (deParaError) {
      console.warn('Erro ao limpar valores_referencia_de_para:', deParaError.message)
    } else {
      console.log(`🗑️ Removidos ${deParaCount} registros de valores_referencia_de_para`)
      resultadosLimpeza.push({
        tabela: 'valores_referencia_de_para',
        registros_removidos: deParaCount || 0
      })
    }

    // 4. LIMPAR outras tabelas relacionadas a uploads se existirem
    const tabelasUpload = [
      'import_history',
      'upload_status'
    ]

    for (const tabela of tabelasUpload) {
      try {
        console.log(`📊 Tentando limpar tabela: ${tabela}`)
        
        const { error: uploadError, count: uploadCount } = await supabase
          .from(tabela)
          .delete({ count: 'exact' })
          .in('file_type', tiposArquivo)

        if (uploadError) {
          console.warn(`Tabela ${tabela} não existe ou erro ao limpar:`, uploadError.message)
        } else {
          console.log(`🗑️ Removidos ${uploadCount} registros de ${tabela}`)
          resultadosLimpeza.push({
            tabela: tabela,
            registros_removidos: uploadCount || 0
          })
        }
      } catch (error) {
        console.warn(`Erro ao processar tabela ${tabela}:`, error)
      }
    }

    // Calcular total final
    const totalFinal = resultadosLimpeza.reduce((acc, curr) => acc + curr.registros_removidos, 0)

    console.log(`✅ LIMPEZA COMPLETA FINALIZADA!`)
    console.log(`📊 Total de registros removidos: ${totalFinal}`)
    console.log(`📋 Detalhes por tabela:`, resultadosLimpeza)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `✅ Limpeza completa realizada! ${totalFinal} registros removidos`,
        tipos_arquivo_limpos: tiposArquivo,
        registros_removidos: totalFinal,
        detalhes_por_tabela: resultadosLimpeza,
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
}