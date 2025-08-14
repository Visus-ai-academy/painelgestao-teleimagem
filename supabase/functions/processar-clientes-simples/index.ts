import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

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
    const { fileName } = await req.json()
    console.log('Processando arquivo de clientes:', fileName)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('uploads')
      .download(fileName)

    if (downloadError) {
      console.error('Erro ao baixar arquivo:', downloadError)
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao baixar arquivo' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Read Excel file
    const buffer = await fileData.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

    console.log('Total linhas no arquivo:', jsonData.length)
    console.log('Cabeçalhos:', jsonData[0])

    // Remove header row
    const dataRows = jsonData.slice(1)
    console.log('Linhas de dados:', dataRows.length)

    // Não limpar clientes - usar UPSERT para evitar duplicação
    console.log('Processando clientes com UPSERT...')

    // Process data - direct mapping to known structure
    const processedClients = []
    let processedCount = 0
    let errorCount = 0

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]
      
      // Skip empty rows
      if (!row || row.length === 0 || !row[0]) {
        continue
      }

      try {
        // Mapeamento completo do novo cadastro de clientes
        const cliente = {
          // Campos existentes - baseado no template CSV: Nome,email,cnpj,contato,endereço,Status,data inicio,data termino,cod cliente
          nome: row[0] || null, // Contagem de Cliente (Nome Fantasia)
          email: row[1] || null, // email  
          cnpj: row[2] || null, // cnpj
          contato: row[3] || null, // contato
          endereco: row[4] || null, // endereço
          status: (row[5] === 'A' || row[5] === 'ATIVO' || row[5] === 'Ativo' || row[5] === 'ativo') ? 'Ativo' : 'Inativo',
          ativo: (row[5] === 'A' || row[5] === 'ATIVO' || row[5] === 'Ativo' || row[5] === 'ativo'),
          data_inicio_contrato: row[6] && row[6] !== '' ? (() => {
            try {
              const date = new Date(row[6]);
              return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
            } catch {
              return null;
            }
          })() : null, // data inicio contrato
          data_termino_contrato: row[7] && row[7] !== '' ? (() => {
            try {
              const date = new Date(row[7]);
              return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
            } catch {
              return null;
            }
          })() : null, // data termino de vigência
          cod_cliente: row[8] || null, // cod cliente
          
          // Campos adicionais
          nome_mobilemed: row[0] || null,
          nome_fantasia: row[0] || null,
          tipo_cliente: 'CO',
          cidade: null,
          estado: null,
          telefone: null,
          bairro: null,
          cep: null
        }

        // Debug: Log first few rows to understand the data structure
        if (i < 3) {
          console.log(`Linha ${i + 2} dados:`, {
            row_length: row.length,
            first_10_columns: row.slice(0, 10),
            status_valor: row[5],
            status_processado: cliente.status,
            nome_mobilemed: cliente.nome_mobilemed,
            nome_fantasia: cliente.nome_fantasia,
            nome: cliente.nome
          })
        }

        // Aceitar todos os registros - apenas pular linhas completamente vazias
        const isCompletelyEmpty = !row.some(cell => cell && cell.toString().trim() !== '')
        if (isCompletelyEmpty) {
          console.log(`Pulando linha ${i + 2}: linha completamente vazia`)
          continue
        }

        // Use best available name, but allow empty names too
        if (!cliente.nome && cliente.nome_fantasia) {
          cliente.nome = cliente.nome_fantasia
        } else if (!cliente.nome && cliente.nome_mobilemed) {
          cliente.nome = cliente.nome_mobilemed
        }
        
        // If still no name, use a placeholder or leave empty
        if (!cliente.nome || cliente.nome.trim() === '') {
          cliente.nome = cliente.nome_mobilemed || cliente.nome_fantasia || `Cliente_${i + 2}`
        }

        // Clean and format CNPJ if present
        if (cliente.cnpj) {
          let cnpjLimpo = cliente.cnpj.toString().replace(/[^\d]/g, '')
          if (cnpjLimpo.length === 14) {
            cliente.cnpj = `${cnpjLimpo.substring(0,2)}.${cnpjLimpo.substring(2,5)}.${cnpjLimpo.substring(5,8)}/${cnpjLimpo.substring(8,12)}-${cnpjLimpo.substring(12,14)}`
          } else if (cnpjLimpo.length === 11) {
            cliente.cnpj = `${cnpjLimpo.substring(0,3)}.${cnpjLimpo.substring(3,6)}.${cnpjLimpo.substring(6,9)}-${cnpjLimpo.substring(9,11)}`
          }
        }

        processedClients.push(cliente)
        processedCount++

      } catch (error) {
        console.error(`Erro ao processar linha ${i + 2}:`, error)
        errorCount++
      }
    }

    console.log(`Processados: ${processedCount}, Erros: ${errorCount}`)
    console.log(`Total de clientes para inserir: ${processedClients.length}`)
    
    // Log sample client for debug
    if (processedClients.length > 0) {
      console.log('Exemplo de cliente processado:', processedClients[0])
    }

    // Insert in batches
    let insertedCount = 0
    const batchSize = 50

    for (let i = 0; i < processedClients.length; i += batchSize) {
      const batch = processedClients.slice(i, i + batchSize)
      
      const { data, error } = await supabase
        .from('clientes')
        .insert(batch)
        .select('id')

      if (error) {
        console.error(`Erro ao inserir lote ${Math.floor(i/batchSize) + 1}:`, error)
        
        // Try individual inserts if batch fails
        for (const cliente of batch) {
          const { error: singleError } = await supabase
            .from('clientes')
            .upsert([cliente], { onConflict: 'cnpj' })

          if (singleError) {
            console.error('Erro individual:', singleError, cliente.nome)
            errorCount++
          } else {
            insertedCount++
          }
        }
      } else {
        insertedCount += batch.length
        console.log(`Lote ${Math.floor(i/batchSize) + 1} inserido: ${batch.length} registros`)
      }
    }

    // Calculate final stats
    const { count: totalCount } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })

    const { count: nomeCount } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })
      .not('nome', 'is', null)
      .neq('nome', '')

    const { data: cnpjData } = await supabase
      .from('clientes')
      .select('cnpj')
      .not('cnpj', 'is', null)
      .neq('cnpj', '')

    const cnpjUnicos = new Set(cnpjData?.map(item => item.cnpj) || []).size

    const { count: contatoCount } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })
      .not('contato', 'is', null)
      .neq('contato', '')

    console.log('Estatísticas finais:', {
      total: totalCount,
      nomes: nomeCount,
      cnpjsUnicos: cnpjUnicos,
      contatos: contatoCount
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processamento concluído. ${insertedCount} registros importados.`,
        details: {
          total_processed: processedCount,
          inserted: insertedCount,
          errors: errorCount,
          final_stats: {
            total_registros: totalCount || 0,
            nome_mobilemed: nomeCount || 0,
            cnpjs_unicos: cnpjUnicos,
            nome_fantasia: contatoCount || 0
          }
        }
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