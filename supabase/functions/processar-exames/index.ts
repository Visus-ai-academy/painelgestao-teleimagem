import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== EDGE FUNCTION INICIADA ===')
  console.log('Method:', req.method)
  console.log('URL:', req.url)
  
  if (req.method === 'OPTIONS') {
    console.log('Retornando OPTIONS')
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Processando requisição...')
    
    const requestBody = await req.json()
    console.log('Body recebido:', requestBody)

    console.log('Retornando sucesso...')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Função executada com sucesso',
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('=== ERRO ===')
    console.error('Error:', error)
    console.error('Error message:', error?.message)
    console.error('Error stack:', error?.stack)

    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Erro desconhecido'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})