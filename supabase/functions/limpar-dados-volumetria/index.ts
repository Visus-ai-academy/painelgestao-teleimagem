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

    // Deletar registros dos arquivos especificados
    const { data, error, count } = await supabase
      .from('volumetria_mobilemed')
      .delete({ count: 'exact' })
      .in('arquivo_fonte', arquivos_fonte)

    if (error) {
      console.error('Erro ao limpar dados:', error)
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao limpar dados',
          details: error.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
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

    console.log(`${count} registros removidos com sucesso`)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `${count} registros removidos com sucesso`,
        arquivos_removidos: arquivos_fonte,
        registros_removidos: count
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