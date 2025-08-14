import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Iniciando limpeza da tabela clientes...')

    // Clear all clients
    const { error: clearError } = await supabase
      .from('clientes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (clearError) {
      console.error('Erro ao limpar clientes:', clearError)
      return new Response(
        JSON.stringify({ success: false, error: clearError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify cleanup
    const { count } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })

    console.log('Limpeza concluída. Registros restantes:', count)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Base de clientes limpa com sucesso. ${count || 0} registros restantes.`,
        registros_restantes: count || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro geral:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})