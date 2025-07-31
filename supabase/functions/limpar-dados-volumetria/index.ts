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

    // Parse do corpo da requisição
    const { arquivos_fonte } = await req.json()

    if (!arquivos_fonte || !Array.isArray(arquivos_fonte)) {
      return new Response(
        JSON.stringify({ 
          error: 'arquivos_fonte deve ser um array de strings' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Limpando dados dos arquivos: ${arquivos_fonte.join(', ')}`)

    // Contar primeiro quantos registros serão removidos
    const { count: totalCount, error: countError } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .in('arquivo_fonte', arquivos_fonte)

    if (countError) {
      console.error('Erro ao contar registros:', countError)
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao contar registros',
          details: countError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Total de registros a serem removidos: ${totalCount}`)

    if (totalCount === 0) {
      console.log('Nenhum registro encontrado para remover')
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Nenhum registro encontrado para remover',
          arquivos_removidos: arquivos_fonte,
          registros_removidos: 0
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Deletar em lotes para evitar timeout
    let totalRemovidos = 0
    const batchSize = 1000

    for (const arquivo of arquivos_fonte) {
      console.log(`Processando arquivo: ${arquivo}`)
      
      while (true) {
        const { data, error, count } = await supabase
          .from('volumetria_mobilemed')
          .delete({ count: 'exact' })
          .eq('arquivo_fonte', arquivo)
          .limit(batchSize)

        if (error) {
          console.error(`Erro ao limpar dados de ${arquivo}:`, error)
          return new Response(
            JSON.stringify({ 
              error: `Erro ao limpar dados de ${arquivo}`,
              details: error.message,
              parcialmente_removidos: totalRemovidos
            }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        totalRemovidos += count || 0
        console.log(`Lote removido de ${arquivo}: ${count} registros (total: ${totalRemovidos})`)

        // Se removeu menos que o tamanho do lote, não há mais registros
        if ((count || 0) < batchSize) {
          break
        }

        // Pequena pausa para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    // Também limpar os registros de status na tabela processamento_uploads
    const { error: statusError } = await supabase
      .from('processamento_uploads')
      .delete()
      .in('tipo_arquivo', arquivos_fonte)

    if (statusError) {
      console.warn('Aviso ao limpar status:', statusError.message)
    } else {
      console.log('Status de upload também removidos')
    }

    console.log(`${totalRemovidos} registros removidos com sucesso`)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `${totalRemovidos} registros removidos com sucesso`,
        arquivos_removidos: arquivos_fonte,
        registros_removidos: totalRemovidos
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Erro geral:', error)
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