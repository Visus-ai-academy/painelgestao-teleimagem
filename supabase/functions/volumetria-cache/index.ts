import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Cache em memória (simple LRU cache)
class MemoryCache {
  private cache = new Map<string, { data: any; expires: number }>()
  private maxSize = 100
  
  set(key: string, data: any, ttlSeconds = 300) {
    // Limpar cache se muito grande
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    
    this.cache.set(key, {
      data,
      expires: Date.now() + (ttlSeconds * 1000)
    })
  }
  
  get(key: string) {
    const item = this.cache.get(key)
    if (!item || Date.now() > item.expires) {
      this.cache.delete(key)
      return null
    }
    return item.data
  }
  
  clear() {
    this.cache.clear()
  }
}

const cache = new MemoryCache()

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { action, params } = await req.json()
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    switch (action) {
      case 'get_volumetria_stats': {
        const cacheKey = `volumetria_stats_${JSON.stringify(params)}`
        
        // Verificar cache primeiro
        let result = cache.get(cacheKey)
        if (result) {
          console.log('Cache HIT:', cacheKey)
          return new Response(JSON.stringify({ 
            data: result, 
            cached: true 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        console.log('Cache MISS:', cacheKey)
        
        // Buscar dados usando função otimizada
        const { data, error } = await supabase.rpc('get_volumetria_stats', {
          p_empresa: params.empresa || null,
          p_data_inicio: params.data_inicio || null,
          p_data_fim: params.data_fim || null
        })
        
        if (error) throw error
        
        // Cachear resultado por 5 minutos
        cache.set(cacheKey, data[0], 300)
        
        return new Response(JSON.stringify({ 
          data: data[0], 
          cached: false 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      case 'get_empresas_list': {
        const cacheKey = 'empresas_list'
        
        let result = cache.get(cacheKey)
        if (result) {
          return new Response(JSON.stringify({ 
            data: result, 
            cached: true 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Buscar empresas únicas
        const { data, error } = await supabase
          .from('volumetria_mobilemed')
          .select('EMPRESA')
          .not('EMPRESA', 'is', null)
        
        if (error) throw error
        
        const empresasUnicas = [...new Set(data.map(e => e.EMPRESA))].sort()
        
        // Cachear por 1 hora
        cache.set(cacheKey, empresasUnicas, 3600)
        
        return new Response(JSON.stringify({ 
          data: empresasUnicas, 
          cached: false 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      case 'get_dashboard_data': {
        const cacheKey = `dashboard_${JSON.stringify(params)}`
        
        let result = cache.get(cacheKey)
        if (result) {
          return new Response(JSON.stringify({ 
            data: result, 
            cached: true 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Buscar dados da view materializada
        let query = supabase
          .from('mv_volumetria_dashboard')
          .select('*')
        
        if (params.empresa && params.empresa !== 'todos') {
          query = query.eq('EMPRESA', params.empresa)
        }
        
        if (params.data_inicio) {
          query = query.gte('data_referencia', params.data_inicio)
        }
        
        if (params.data_fim) {
          query = query.lte('data_referencia', params.data_fim)
        }
        
        const { data, error } = await query
        
        if (error) throw error
        
        // Cachear por 15 minutos
        cache.set(cacheKey, data, 900)
        
        return new Response(JSON.stringify({ 
          data, 
          cached: false 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      case 'clear_cache': {
        cache.clear()
        console.log('Cache cleared')
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Cache cleared' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      default:
        return new Response(JSON.stringify({ 
          error: 'Action not supported' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
    
  } catch (error) {
    console.error('Cache function error:', error)
    
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})