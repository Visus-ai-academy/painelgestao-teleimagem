import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PerformanceMetrics {
  query_time: number
  table_name: string
  operation: string
  row_count: number
  user_id?: string
  timestamp: Date
}

interface AlertThresholds {
  slow_query_ms: number
  high_cpu_percent: number
  memory_usage_mb: number
  connection_count: number
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  slow_query_ms: 5000,     // 5 segundos
  high_cpu_percent: 80,    // 80%
  memory_usage_mb: 1000,   // 1GB
  connection_count: 50     // 50 conexões
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verificar se há corpo na requisição antes de tentar fazer parse
    let params: any = {}
    let action = 'check_system_health' // Ação padrão para requisições GET
    
    if (req.method === 'POST') {
      const body = await req.text()
      if (body.trim()) {
        const parsed = JSON.parse(body)
        action = parsed.action || action
        params = parsed
      }
    } else {
      // Para requisições GET, usar query parameters
      const url = new URL(req.url)
      action = url.searchParams.get('action') || action
      params = Object.fromEntries(url.searchParams.entries())
    }
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    switch (action) {
      case 'log_performance': {
        const metrics: PerformanceMetrics = params as PerformanceMetrics
        
        // Salvar métricas no banco
        const { error } = await supabase
          .from('performance_logs')
          .insert({
            query_time: metrics.query_time,
            table_name: metrics.table_name,
            operation: metrics.operation,
            row_count: metrics.row_count,
            user_id: metrics.user_id,
            timestamp: new Date().toISOString()
          })
        
        if (error) {
          console.error('Error logging performance:', error)
        }
        
        // Verificar se precisa criar alerta
        if (metrics.query_time > DEFAULT_THRESHOLDS.slow_query_ms) {
          await createAlert({
            type: 'slow_query',
            severity: 'warning',
            title: 'Query Lenta Detectada',
            description: `Query em ${metrics.table_name} demorou ${metrics.query_time}ms`,
            metadata: metrics
          })
        }
        
        return new Response(JSON.stringify({ 
          success: true 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      case 'get_performance_stats': {
        const hours = params.hours || 24
        const hoursAgo = new Date(Date.now() - (hours * 60 * 60 * 1000))
        
        // Buscar estatísticas de performance
        const { data: stats, error } = await supabase
          .from('performance_logs')
          .select('*')
          .gte('timestamp', hoursAgo.toISOString())
          .order('timestamp', { ascending: false })
        
        if (error) throw error
        
        // Calcular métricas agregadas
        const aggregated = {
          total_queries: stats.length,
          avg_query_time: stats.reduce((sum, s) => sum + s.query_time, 0) / stats.length,
          slow_queries: stats.filter(s => s.query_time > DEFAULT_THRESHOLDS.slow_query_ms).length,
          top_slow_tables: getTopSlowTables(stats),
          hourly_distribution: getHourlyDistribution(stats)
        }
        
        return new Response(JSON.stringify({ 
          stats: aggregated,
          raw_data: stats.slice(0, 100) // Últimas 100 queries
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      case 'check_system_health': {
        const alerts: any[] = []
        
        // Simular verificações de sistema (em produção, usar métricas reais)
        const systemMetrics = await getSystemMetrics()
        
        // Verificar CPU
        if (systemMetrics.cpu_percent > DEFAULT_THRESHOLDS.high_cpu_percent) {
          alerts.push({
            type: 'high_cpu',
            severity: 'critical',
            title: 'CPU Alto',
            description: `CPU em ${systemMetrics.cpu_percent}%`,
            value: systemMetrics.cpu_percent,
            threshold: DEFAULT_THRESHOLDS.high_cpu_percent
          })
        }
        
        // Verificar memória
        if (systemMetrics.memory_mb > DEFAULT_THRESHOLDS.memory_usage_mb) {
          alerts.push({
            type: 'high_memory',
            severity: 'warning',
            title: 'Uso Alto de Memória',
            description: `Memória em ${systemMetrics.memory_mb}MB`,
            value: systemMetrics.memory_mb,
            threshold: DEFAULT_THRESHOLDS.memory_usage_mb
          })
        }
        
        // Verificar conexões
        if (systemMetrics.connection_count > DEFAULT_THRESHOLDS.connection_count) {
          alerts.push({
            type: 'high_connections',
            severity: 'warning',
            title: 'Muitas Conexões',
            description: `${systemMetrics.connection_count} conexões ativas`,
            value: systemMetrics.connection_count,
            threshold: DEFAULT_THRESHOLDS.connection_count
          })
        }
        
        // Salvar alertas se houver
        for (const alert of alerts) {
          await createAlert(alert)
        }
        
        return new Response(JSON.stringify({ 
          healthy: alerts.length === 0,
          alerts,
          metrics: systemMetrics
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      case 'get_alerts': {
        const { data: alerts, error } = await supabase
          .from('security_alerts')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(50)
        
        if (error) throw error
        
        return new Response(JSON.stringify({ 
          alerts 
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
    console.error('Performance monitor error:', error)
    
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function createAlert(alert: any) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )
  
  await supabase.rpc('create_security_alert', {
    p_alert_type: alert.type,
    p_severity: alert.severity,
    p_title: alert.title,
    p_description: alert.description,
    p_metadata: alert.metadata || {}
  })
}

function getTopSlowTables(stats: any[]) {
  const tableStats = stats.reduce((acc, stat) => {
    if (!acc[stat.table_name]) {
      acc[stat.table_name] = { count: 0, total_time: 0 }
    }
    acc[stat.table_name].count++
    acc[stat.table_name].total_time += stat.query_time
    return acc
  }, {} as Record<string, { count: number; total_time: number }>)
  
  return Object.entries(tableStats)
    .map(([table, data]) => ({
      table,
      avg_time: data.total_time / data.count,
      query_count: data.count
    }))
    .sort((a, b) => b.avg_time - a.avg_time)
    .slice(0, 10)
}

function getHourlyDistribution(stats: any[]) {
  const hourlyStats = stats.reduce((acc, stat) => {
    const hour = new Date(stat.timestamp).getHours()
    if (!acc[hour]) acc[hour] = 0
    acc[hour]++
    return acc
  }, {} as Record<number, number>)
  
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: hourlyStats[hour] || 0
  }))
}

async function getSystemMetrics() {
  // Em produção, integrar com métricas reais do Supabase
  // Por agora, retornar dados simulados
  return {
    cpu_percent: Math.random() * 100,
    memory_mb: Math.random() * 2000,
    connection_count: Math.floor(Math.random() * 100),
    disk_usage_percent: Math.random() * 100,
    timestamp: new Date()
  }
}