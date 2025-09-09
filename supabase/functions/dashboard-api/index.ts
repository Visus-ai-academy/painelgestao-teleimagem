import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: `Bearer ${token}` }
        }
      }
    )

    const { action, ...params } = await req.json()
    console.log(`Dashboard API: ${action}`, params)

    switch (action) {
      case 'get_optimized_dashboard': {
        const startTime = Date.now()
        
        // Log de performance
        EdgeRuntime.waitUntil(logPerformance('dashboard_load', startTime))
        
        // Usar cache para dados frequentes
        const cacheResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/volumetria-cache`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
          },
          body: JSON.stringify({
            action: 'get_dashboard_data',
            params
          })
        })
        
        const cacheData = await cacheResponse.json()
        
        if (cacheData.cached) {
          console.log('Dashboard data served from cache')
        }
        
        const endTime = Date.now()
        
        return new Response(JSON.stringify({
          ...cacheData,
          performance: {
            query_time: endTime - startTime,
            cached: cacheData.cached
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'get_companies': {
        const startTime = Date.now()
        
        // Usar cache para lista de empresas
        const cacheResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/volumetria-cache`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
          },
          body: JSON.stringify({
            action: 'get_empresas_list'
          })
        })
        
        const cacheData = await cacheResponse.json()
        const endTime = Date.now()
        
        // Log de performance em background
        EdgeRuntime.waitUntil(logPerformance('empresas_list', startTime, endTime))
        
        return new Response(JSON.stringify({
          ...cacheData,
          performance: {
            query_time: endTime - startTime,
            cached: cacheData.cached
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'get_aggregated_stats': {
        const startTime = Date.now()
        
        // Usar função otimizada do banco
        const cacheResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/volumetria-cache`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
          },
          body: JSON.stringify({
            action: 'get_volumetria_stats',
            params
          })
        })
        
        const cacheData = await cacheResponse.json()
        const endTime = Date.now()
        
        // Log de performance em background
        EdgeRuntime.waitUntil(logPerformance('volumetria_stats', startTime, endTime))
        
        return new Response(JSON.stringify({
          ...cacheData,
          performance: {
            query_time: endTime - startTime,
            cached: cacheData.cached
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'refresh_cache': {
        // Limpar cache manualmente
        const cacheResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/volumetria-cache`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
          },
          body: JSON.stringify({
            action: 'clear_cache'
          })
        })
        
        const result = await cacheResponse.json()
        
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'get_performance_insights': {
        // Buscar insights de performance
        const performanceResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/performance-monitor`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({
            action: 'get_performance_stats',
            hours: params.hours || 24
          })
        })
        
        const performanceData = await performanceResponse.json()
        
        return new Response(JSON.stringify(performanceData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      default:
        return new Response(JSON.stringify({ 
          error: 'Action not supported',
          available_actions: [
            'get_optimized_dashboard',
            'get_companies', 
            'get_aggregated_stats',
            'refresh_cache',
            'get_performance_insights'
          ]
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
    
  } catch (error) {
    console.error('Dashboard API error:', error)
    
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Check edge function logs for more information'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function logPerformance(operation: string, startTime: number, endTime?: number) {
  try {
    const finalEndTime = endTime || Date.now()
    
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/performance-monitor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        action: 'log_performance',
        query_time: finalEndTime - startTime,
        table_name: 'volumetria_mobilemed',
        operation,
        row_count: 0 // Será preenchido com dados reais se necessário
      })
    })
  } catch (error) {
    console.error('Error logging performance:', error)
  }
}