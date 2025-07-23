import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CustomMetric {
  id: string
  name: string
  description: string
  query_template: string
  metric_type: 'counter' | 'gauge' | 'histogram'
  update_frequency_minutes: number
  enabled: boolean
  parameters: Record<string, any>
  alert_thresholds: Record<string, any>
}

interface MetricValue {
  metric_id: string
  value: number
  dimensions: Record<string, any>
  metadata: Record<string, any>
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    )

    const { action, metric_name, metric_config, start_date, end_date } = await req.json()

    console.log(`Processing custom metrics action: ${action}`)

    switch (action) {
      case 'calculate_metric': {
        if (!metric_name) {
          throw new Error('metric_name é obrigatório para calcular métrica')
        }

        // Calcular métrica usando função do banco
        const { data: result, error } = await supabaseClient
          .rpc('calculate_custom_metric', { metric_name })

        if (error) {
          console.error('Erro ao calcular métrica:', error)
          throw error
        }

        console.log(`Métrica ${metric_name} calculada:`, result)

        return new Response(
          JSON.stringify({
            success: true,
            metric_name,
            result,
            calculated_at: new Date().toISOString()
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'update_all_metrics': {
        // Atualizar todas as métricas ativas
        const { data: updated_count, error } = await supabaseClient
          .rpc('update_custom_metrics')

        if (error) {
          console.error('Erro ao atualizar métricas:', error)
          throw error
        }

        console.log(`Atualizadas ${updated_count} métricas`)

        return new Response(
          JSON.stringify({
            success: true,
            updated_metrics: updated_count,
            updated_at: new Date().toISOString()
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'get_metric_values': {
        if (!metric_name) {
          throw new Error('metric_name é obrigatório para buscar valores')
        }

        // Buscar métrica por nome
        const { data: metrics, error: metricError } = await supabaseClient
          .from('custom_metrics')
          .select('id, name, description, metric_type')
          .eq('name', metric_name)
          .eq('enabled', true)
          .single()

        if (metricError || !metrics) {
          throw new Error(`Métrica ${metric_name} não encontrada ou desabilitada`)
        }

        // Buscar valores da métrica
        let query = supabaseClient
          .from('custom_metric_values')
          .select('*')
          .eq('metric_id', metrics.id)
          .order('timestamp', { ascending: false })

        if (start_date) {
          query = query.gte('timestamp', start_date)
        }
        if (end_date) {
          query = query.lte('timestamp', end_date)
        }

        const { data: values, error: valuesError } = await query.limit(100)

        if (valuesError) {
          console.error('Erro ao buscar valores da métrica:', valuesError)
          throw valuesError
        }

        return new Response(
          JSON.stringify({
            success: true,
            metric: metrics,
            values: values || [],
            count: values?.length || 0
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'list_metrics': {
        // Listar todas as métricas disponíveis
        const { data: metrics, error } = await supabaseClient
          .from('custom_metrics')
          .select('*')
          .eq('enabled', true)
          .order('name')

        if (error) {
          console.error('Erro ao listar métricas:', error)
          throw error
        }

        return new Response(
          JSON.stringify({
            success: true,
            metrics: metrics || [],
            count: metrics?.length || 0
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'create_metric': {
        if (!metric_config) {
          throw new Error('metric_config é obrigatório para criar métrica')
        }

        // Criar nova métrica
        const { data: newMetric, error } = await supabaseClient
          .from('custom_metrics')
          .insert([metric_config])
          .select()
          .single()

        if (error) {
          console.error('Erro ao criar métrica:', error)
          throw error
        }

        console.log('Nova métrica criada:', newMetric)

        return new Response(
          JSON.stringify({
            success: true,
            metric: newMetric,
            message: 'Métrica criada com sucesso'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 201,
          }
        )
      }

      case 'analyze_partitioning': {
        // Analisar necessidade de particionamento
        const { data: analysis, error } = await supabaseClient
          .rpc('analyze_partitioning_need')

        if (error) {
          console.error('Erro ao analisar particionamento:', error)
          throw error
        }

        console.log('Análise de particionamento:', analysis)

        return new Response(
          JSON.stringify({
            success: true,
            analysis,
            analyzed_at: new Date().toISOString()
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'get_partition_history': {
        // Buscar histórico de análises de particionamento
        const { data: history, error } = await supabaseClient
          .from('partition_analysis')
          .select('*')
          .order('analysis_timestamp', { ascending: false })
          .limit(20)

        if (error) {
          console.error('Erro ao buscar histórico de particionamento:', error)
          throw error
        }

        return new Response(
          JSON.stringify({
            success: true,
            history: history || [],
            count: history?.length || 0
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      default:
        throw new Error(`Ação não reconhecida: ${action}`)
    }
  } catch (error) {
    console.error('Erro na função custom-metrics:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})