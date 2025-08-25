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

    // ========== RESPOSTA IMEDIATA ==========
    const responsePromise = new Response(
      JSON.stringify({
        success: true,
        status: 'processando',
        message: 'Limpeza iniciada em background. Aguarde alguns minutos...',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

    // ========== PROCESSAMENTO EM BACKGROUND ==========
    const backgroundCleanup = async () => {
      let totalRemovidoGeral = 0
      const resultadosLimpeza = []

      try {
        // 1. LIMPAR TABELA volumetria_mobilemed com batches menores
        console.log(`📊 Limpando tabela: volumetria_mobilemed`)
        
        const { count: totalVolumetria, error: countError } = await supabase
          .from('volumetria_mobilemed')
          .select('*', { count: 'exact', head: true })

        if (countError) {
          console.error('Erro ao contar registros volumetria:', countError)
        } else {
          console.log(`📊 Total de registros em volumetria_mobilemed: ${totalVolumetria}`)
          
          if (totalVolumetria > 0) {
            // Batches menores para evitar timeout
            const batchSize = 500
            let removidosVolumetria = 0
            let batchCount = 0

            while (true) {
              const startTime = Date.now();
              
              const { error, count } = await supabase
                .from('volumetria_mobilemed')
                .delete({ count: 'exact' })
                .limit(batchSize)

              if (error) {
                console.error('Erro ao deletar volumetria:', error)
                break
              }

              removidosVolumetria += count || 0
              batchCount++
              
              const elapsed = Date.now() - startTime;
              console.log(`🗑️ Batch ${batchCount}: ${count} registros removidos em ${elapsed}ms (total: ${removidosVolumetria}/${totalVolumetria})`)

              if ((count || 0) < batchSize) {
                break
              }

              // Pausa maior entre batches para evitar sobrecarga
              await new Promise(resolve => setTimeout(resolve, 200))
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

        if (!statusError) {
          console.log(`🗑️ Removidos ${statusCount} registros de processamento_uploads`)
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

        if (!deParaError) {
          console.log(`🗑️ Removidos ${deParaCount} registros de valores_referencia_de_para`)
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
          console.log(`🗑️ Removidos ${rejeitadosCount} registros de registros_rejeitados_processamento`)
          resultadosLimpeza.push({
            tabela: 'registros_rejeitados_processamento',
            registros_removidos: rejeitadosCount || 0
          })
        }

        // 5. LIMPAR outras tabelas relacionadas
        const tabelasUpload = ['import_history', 'upload_status']

        for (const tabela of tabelasUpload) {
          try {
            console.log(`📊 Tentando limpar tabela: ${tabela}`)
            
            const { error: uploadError, count: uploadCount } = await supabase
              .from(tabela)
              .delete({ count: 'exact' })
              .in('file_type', tiposArquivo)

            if (!uploadError && uploadCount > 0) {
              console.log(`🗑️ Removidos ${uploadCount} registros de ${tabela}`)
              resultadosLimpeza.push({
                tabela: tabela,
                registros_removidos: uploadCount || 0
              })
            }
          } catch (error) {
            console.warn(`Tabela ${tabela} não existe ou erro:`, error)
          }
        }

        const totalFinal = resultadosLimpeza.reduce((acc, curr) => acc + curr.registros_removidos, 0)

        console.log(`✅ LIMPEZA COMPLETA FINALIZADA!`)
        console.log(`📊 Total de registros removidos: ${totalFinal}`)
        console.log(`📋 Detalhes por tabela:`, JSON.stringify(resultadosLimpeza, null, 2))

      } catch (error) {
        console.error('❌ Erro durante limpeza em background:', error)
      }
    };

    // Executar limpeza em background
    EdgeRuntime.waitUntil(backgroundCleanup());

    return responsePromise;

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