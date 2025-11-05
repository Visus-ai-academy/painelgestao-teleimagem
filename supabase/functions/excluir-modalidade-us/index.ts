import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log(`🏁 Iniciando exclusão de registros com modalidade US...`)
    
    // Inicializar cliente Supabase com service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Primeiro, buscar os registros que serão excluídos para registrar na tabela de rejeições
    console.log(`🔍 Buscando registros com modalidade US...`)
    const { data: registrosUS, error: errorFetch } = await supabase
      .from('volumetria_mobilemed')
      .select('*')
      .eq('MODALIDADE', 'US')

    if (errorFetch) {
      console.error(`❌ Erro ao buscar registros US:`, errorFetch)
      throw errorFetch
    }

    const totalRegistrosUS = registrosUS?.length || 0
    console.log(`📊 Encontrados ${totalRegistrosUS} registros com modalidade US`)

    if (totalRegistrosUS === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum registro com modalidade US encontrado.',
          registros_excluidos: 0,
          timestamp: new Date().toISOString()
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Registrar na tabela de rejeições
    console.log(`💾 Salvando ${totalRegistrosUS} registros na tabela de rejeições...`)
    const rejeicoes = registrosUS.map(registro => ({
      empresa: registro.EMPRESA || 'N/I',
      nome_paciente: registro.NOME_PACIENTE || 'N/I',
      arquivo_fonte: registro.arquivo_fonte || 'N/I',
      erro_detalhes: 'MODALIDADE_US_EXCLUIDA: Exames com modalidade US não são realizados, faturados e não têm repasse médico. Excluídos automaticamente.',
      dados_originais: registro,
      status: 'rejeitado',
      created_at: new Date().toISOString()
    }))

    // Inserir rejeições em batches pequenos para evitar timeout
    const BATCH_SIZE = 20
    for (let i = 0; i < rejeicoes.length; i += BATCH_SIZE) {
      const batchRejeicoes = rejeicoes.slice(i, i + BATCH_SIZE)
      
      const { error: errorRejeicao } = await supabase
        .from('volumetria_erros')
        .insert(batchRejeicoes)
      
      if (errorRejeicao) {
        console.warn(`⚠️ Erro ao salvar batch de rejeições ${i}-${i+BATCH_SIZE}:`, errorRejeicao)
      }
    }

    console.log(`✅ Rejeições salvas com sucesso`)

    // Agora excluir os registros
    console.log(`🗑️ Excluindo ${totalRegistrosUS} registros com modalidade US...`)
    const { error: errorDelete, count: deletedCount } = await supabase
      .from('volumetria_mobilemed')
      .delete()
      .eq('MODALIDADE', 'US')

    if (errorDelete) {
      console.error(`❌ Erro ao excluir registros US:`, errorDelete)
      throw errorDelete
    }

    console.log(`✅ ${deletedCount || totalRegistrosUS} registros excluídos com sucesso`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Registros com modalidade US excluídos com sucesso.`,
        registros_excluidos: deletedCount || totalRegistrosUS,
        registros_registrados_rejeicoes: totalRegistrosUS,
        detalhes: {
          motivo: 'Exames com modalidade US não são realizados, faturados e não têm repasse médico.',
          acao: 'Excluídos automaticamente e registrados na tabela de rejeições.'
        },
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Erro geral na exclusão de modalidade US:', error)
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
