import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('🔄 Iniciando correção retroativa de especialidades...')

    const { arquivo_fonte } = await req.json()

    // Mapeamento de especialidades problemáticas (REGRA v007)
    const mapeamentoEspecialidades: Record<string, string> = {
      'ANGIOTCS': 'MEDICINA INTERNA',
      'CABEÇA-PESCOÇO': 'NEURO',
      'TÓRAX': 'MEDICINA INTERNA',
      'CORPO': 'MEDICINA INTERNA',
      'D.O': 'MUSCULO ESQUELETICO',
      'MAMO': 'MAMA',
      'TOMOGRAFIA': 'MEDICINA INTERNA',
      'CARDIO COM SCORE': 'CARDIO',
      'ONCO MEDICINA INTERNA': 'MEDICINA INTERNA'
    }

    const especialidadesProblematicas = Object.keys(mapeamentoEspecialidades)
    let totalCorrigidos = 0

    // Buscar registros com especialidades problemáticas
    let query = supabase
      .from('volumetria_mobilemed')
      .select('*')
      .in('ESPECIALIDADE', especialidadesProblematicas)

    if (arquivo_fonte) {
      query = query.eq('arquivo_fonte', arquivo_fonte)
    }

    const { data: registros, error: fetchError } = await query

    if (fetchError) {
      console.error('Erro ao buscar registros:', fetchError)
      throw fetchError
    }

    console.log(`📊 Encontrados ${registros?.length || 0} registros com especialidades problemáticas`)

    // Processar cada especialidade problemática
    for (const [especialidadeOriginal, especialidadeCorreta] of Object.entries(mapeamentoEspecialidades)) {
      const registrosEspecialidade = registros?.filter(r => r.ESPECIALIDADE === especialidadeOriginal) || []
      
      if (registrosEspecialidade.length === 0) continue

      console.log(`\n🔧 Corrigindo ${especialidadeOriginal} -> ${especialidadeCorreta} (${registrosEspecialidade.length} registros)`)

      // Atualizar em lote
      const { error: updateError } = await supabase
        .from('volumetria_mobilemed')
        .update({ 
          ESPECIALIDADE: especialidadeCorreta,
          updated_at: new Date().toISOString()
        })
        .in('id', registrosEspecialidade.map(r => r.id))

      if (updateError) {
        console.error(`Erro ao atualizar ${especialidadeOriginal}:`, updateError)
        continue
      }

      totalCorrigidos += registrosEspecialidade.length
      console.log(`✅ Corrigidos ${registrosEspecialidade.length} registros de ${especialidadeOriginal}`)
    }

    // Registrar no audit log
    await supabase.from('audit_logs').insert({
      table_name: 'volumetria_mobilemed',
      operation: 'CORRECAO_ESPECIALIDADES_RETROATIVA',
      record_id: 'bulk',
      new_data: {
        total_corrigidos: totalCorrigidos,
        especialidades_corrigidas: Object.keys(mapeamentoEspecialidades),
        arquivo_fonte: arquivo_fonte || 'TODOS',
        timestamp: new Date().toISOString()
      },
      user_email: 'system',
      severity: 'info'
    })

    console.log(`\n✅ Correção retroativa concluída: ${totalCorrigidos} registros corrigidos`)

    return new Response(
      JSON.stringify({
        sucesso: true,
        total_corrigidos: totalCorrigidos,
        especialidades_processadas: Object.keys(mapeamentoEspecialidades),
        arquivo_fonte: arquivo_fonte || 'TODOS',
        mensagem: `Correção retroativa aplicada com sucesso: ${totalCorrigidos} registros corrigidos`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('❌ Erro na correção retroativa:', error)
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        erro: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})