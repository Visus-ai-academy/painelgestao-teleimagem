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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      throw new Error('Nenhum arquivo enviado')
    }

    console.log('📂 Processando categorias de exame:', file.name)
    
    const text = await file.text()
    const lines = text.split('\n').filter(line => line.trim())
    
    if (lines.length < 2) {
      throw new Error('Arquivo deve conter pelo menos um cabeçalho e uma linha de dados')
    }

    // Pular a primeira linha (cabeçalho)
    const dataLines = lines.slice(1)
    
    let inseridos = 0
    let atualizados = 0
    let erros = 0
    const errosDetalhes: string[] = []

    for (const line of dataLines) {
      if (!line.trim()) continue
      
      try {
        const cols = line.split(',').map(col => col.trim().replace(/"/g, ''))
        const nome = cols[0]
        
        if (!nome) {
          erros++
          errosDetalhes.push(`Linha sem nome: ${line}`)
          continue
        }

        // Verificar se categoria já existe
        const { data: existing } = await supabase
          .from('categorias_exame')
          .select('id')
          .eq('nome', nome)
          .single()

        if (existing) {
          // Atualizar
          const { error } = await supabase
            .from('categorias_exame')
            .update({
              nome,
              ativo: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)

          if (error) throw error
          atualizados++
        } else {
          // Inserir
          const { error } = await supabase
            .from('categorias_exame')
            .insert({
              nome,
              ativo: true
            })

          if (error) throw error
          inseridos++
        }
        
      } catch (error) {
        console.error('❌ Erro ao processar linha:', line, error)
        erros++
        errosDetalhes.push(`Linha "${line}": ${error.message}`)
      }
    }

    console.log(`✅ Categorias de exame processadas - ${inseridos} inseridas, ${atualizados} atualizadas, ${erros} erros`)

    const response = {
      sucesso: true,
      processados: dataLines.length,
      inseridos,
      atualizados,
      erros,
      errosDetalhes: erros > 0 ? errosDetalhes : undefined
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('❌ Erro geral:', error)
    return new Response(
      JSON.stringify({ erro: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})