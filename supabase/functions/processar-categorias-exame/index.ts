import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

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
    
    // Ler arquivo (suporta Excel e CSV)
    const arrayBuffer = await file.arrayBuffer()
    let dataRows: string[][] = []
    
    if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
      // Processar arquivo Excel
      console.log('📊 Processando arquivo Excel')
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][]
      
      if (jsonData.length < 2) {
        throw new Error('Arquivo deve conter pelo menos um cabeçalho e uma linha de dados')
      }
      
      // Pular a primeira linha (cabeçalho)
      dataRows = jsonData.slice(1)
    } else {
      // Processar arquivo CSV
      console.log('📄 Processando arquivo CSV')
      const decoder = new TextDecoder('utf-8')
      let text = decoder.decode(arrayBuffer)
      
      // Remover BOM se presente
      if (text.charCodeAt(0) === 0xFEFF) {
        text = text.slice(1)
      }
      
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) {
        throw new Error('Arquivo deve conter pelo menos um cabeçalho e uma linha de dados')
      }

      // Pular a primeira linha (cabeçalho) e converter para array de arrays
      dataRows = lines.slice(1).map(line => line.split(',').map(col => col.trim().replace(/"/g, '')))
    }
    
    let inseridos = 0
    let atualizados = 0
    let erros = 0
    const errosDetalhes: string[] = []

    for (const row of dataRows) {
      if (!row || row.length === 0) continue
      
      try {
        const nome = row[0]?.toString()?.trim()
        
        if (!nome) {
          erros++
          errosDetalhes.push(`Linha sem nome: ${row.join(',')}`)
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
        console.error('❌ Erro ao processar linha:', row.join(','), error)
        erros++
        errosDetalhes.push(`Linha "${row.join(',')}": ${error.message}`)
      }
    }

    console.log(`✅ Categorias de exame processadas - ${inseridos} inseridas, ${atualizados} atualizadas, ${erros} erros`)

    // Registrar processamento
    const { error: logError } = await supabase
      .from('processamento_uploads')
      .insert({
        arquivo_nome: file.name,
        tipo_arquivo: 'categorias_exame',
        tipo_dados: 'incremental',
        status: erros === dataRows.length ? 'erro' : 'concluido',
        registros_processados: dataRows.length,
        registros_inseridos: inseridos,
        registros_atualizados: atualizados,
        registros_erro: erros,
        mensagem_erro: erros > 0 ? errosDetalhes.slice(0, 3).join('; ') : null,
        detalhes_erro: erros > 0 ? errosDetalhes : null
      });

    if (logError) {
      console.error('Erro ao registrar log de processamento:', logError);
    }

    const response = {
      sucesso: true,
      processados: dataRows.length,
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