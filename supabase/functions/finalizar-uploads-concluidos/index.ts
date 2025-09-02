import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🔄 Iniciando finalização de uploads travados...')

    // Buscar uploads que estão processando há mais de 10 minutos
    const { data: uploadsProcessando, error: fetchError } = await supabaseClient
      .from('processamento_uploads')
      .select('*')
      .eq('status', 'processando')
      .lt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())

    if (fetchError) {
      console.error('❌ Erro ao buscar uploads:', fetchError)
      throw fetchError
    }

    console.log(`📊 Encontrados ${uploadsProcessando?.length || 0} uploads para finalizar`)

    let finalizados = 0

    for (const upload of uploadsProcessando || []) {
      try {
        // Verificar se há registros na volumetria para este upload
        const loteUpload = `${upload.tipo_arquivo}_${upload.created_at.replace(/[^0-9]/g, '')}_${upload.id.slice(0, 8)}`;
        
        const { count } = await supabaseClient
          .from('volumetria_mobilemed')
          .select('*', { count: 'exact', head: true })
          .eq('arquivo_fonte', upload.tipo_arquivo)

        if (count && count > 0) {
          // Atualizar status para concluído
          const { error: updateError } = await supabaseClient
            .from('processamento_uploads')
            .update({
              status: 'concluido',
              registros_inseridos: count,
              updated_at: new Date().toISOString()
            })
            .eq('id', upload.id)

          if (!updateError) {
            console.log(`✅ Upload ${upload.arquivo_nome} finalizado com ${count} registros`)
            finalizados++
          } else {
            console.error(`❌ Erro ao finalizar ${upload.arquivo_nome}:`, updateError)
          }
        } else {
          console.log(`⚠️ Upload ${upload.arquivo_nome} sem registros na base`)
        }
      } catch (error) {
        console.error(`❌ Erro processando upload ${upload.arquivo_nome}:`, error)
      }
    }

    const resultado = {
      sucesso: true,
      uploads_encontrados: uploadsProcessando?.length || 0,
      uploads_finalizados: finalizados,
      data_processamento: new Date().toISOString()
    }

    console.log('📋 Resultado:', resultado)

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('❌ Erro na finalização:', error)
    return new Response(JSON.stringify({ 
      sucesso: false, 
      erro: error.message,
      data_processamento: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})