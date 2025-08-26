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
    console.log(`🏁 Iniciando limpeza de dados de volumetria...`)
    
    // Inicializar cliente Supabase com service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

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

    // Definir tarefa de limpeza como background task
    const backgroundCleanup = async () => {
      console.log(`🧹 INICIANDO LIMPEZA EM BACKGROUND...`)
      
      try {
        // 1. LIMPAR TABELA volumetria_mobilemed (operação principal)
        console.log(`🚀 Executando DELETE completo na tabela volumetria_mobilemed...`)
        
        const { count: volumetriaCount, error: volumetriaError } = await supabase
          .from('volumetria_mobilemed')
          .delete()
          .gte('id', '00000000-0000-0000-0000-000000000000') // Remove todos os registros
        
        if (volumetriaError) {
          console.error(`❌ Erro ao limpar volumetria_mobilemed:`, volumetriaError)
          throw volumetriaError
        }
        
        const removidosVolumetria = volumetriaCount || 0
        console.log(`✅ VOLUMETRIA: ${removidosVolumetria} registros removidos`)

        // 2. LIMPAR TABELA processamento_uploads
        console.log(`📊 Limpando tabela: processamento_uploads`)
        
        const { error: statusError } = await supabase
          .from('processamento_uploads')
          .delete()
          .in('tipo_arquivo', tiposArquivo)

        if (!statusError) {
          console.log(`✅ Registros de processamento_uploads removidos`)
        }

        // 3. LIMPAR TABELA valores_referencia_de_para
        console.log(`📊 Limpando tabela: valores_referencia_de_para`)
        
        const { error: deParaError } = await supabase
          .from('valores_referencia_de_para')
          .delete()
          .gte('created_at', '1900-01-01') // Remove todos os registros

        if (!deParaError) {
          console.log(`✅ Registros de valores_referencia_de_para removidos`)
        }

        // 4. LIMPAR registros_rejeitados_processamento
        console.log(`📊 Limpando tabela: registros_rejeitados_processamento`)
        
        const { error: rejeitadosError } = await supabase
          .from('registros_rejeitados_processamento')
          .delete()
          .in('arquivo_fonte', tiposArquivo)

        if (!rejeitadosError) {
          console.log(`✅ Registros de registros_rejeitados_processamento removidos`)
        }

        // 5. Tentar atualizar view materializada (opcional)
        console.log(`🔄 Tentando atualizar view materializada...`)
        const { error: refreshError } = await supabase.rpc('refresh_volumetria_dashboard')
        
        if (refreshError) {
          console.log(`ℹ️ View materializada não atualizada (normal se não existir):`, refreshError.message)
        } else {
          console.log(`✅ View materializada atualizada com sucesso`)
        }

        console.log(`🎉 LIMPEZA EM BACKGROUND FINALIZADA! Total volumetria: ${removidosVolumetria}`)
        
      } catch (error) {
        console.error('❌ Erro durante limpeza em background:', error)
      }
    }

    // Iniciar limpeza em background sem aguardar
    EdgeRuntime.waitUntil(backgroundCleanup())

    // Retornar resposta imediata
    console.log(`✅ Limpeza iniciada em background`)
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Limpeza iniciada com sucesso. O processo está sendo executado em background.',
        status: 'processing',
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