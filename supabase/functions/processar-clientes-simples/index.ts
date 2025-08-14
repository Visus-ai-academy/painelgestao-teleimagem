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

    // Clear existing clients
    console.log('Limpando clientes existentes...')
    const { error: clearError } = await supabase
      .from('clientes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (clearError) {
      console.error('Erro ao limpar clientes:', clearError)
    }

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
          // Campos existentes (mantidos para compatibilidade)
          nome: row[1] || null, // Nome_Fantasia -> nome (campo principal)
          contato: row[0] || null, // NOME_MOBILEMED -> contato (temporário)
          endereco: row[5] || null, // Endereço
          cidade: row[8] || null, // Cidade
          estado: row[9] || null, // UF
          email: row[10] || null, // E-MAIL ENVIO NF
          cnpj: row[3] || null, // CNPJ
          tipo_cliente: row[12] || 'CO', // TIPO_CLIENTE
          status: (row[16] === 'ATIVO' || row[16] === 'ATIVO' || !row[16]) ? 'Ativo' : 'Inativo',
          ativo: (row[16] === 'ATIVO' || row[16] === 'ATIVO' || !row[16]),
          
          // Novos campos específicos
          nome_mobilemed: row[0] || null, // NOME_MOBILEMED
          nome_fantasia: row[1] || null, // Nome_Fantasia
          numero_contrato: row[2] || null, // Contrato
          razao_social: row[4] || null, // Razão Social
          bairro: row[6] || null, // Bairro
          cep: row[7] || null, // CEP
          email_envio_nf: row[11] || null, // E-MAIL ENVIO NF
          dia_faturamento: row[13] ? parseInt(row[13]) : null, // DIA_FATURAMENTO
          data_inicio_contrato: row[14] ? new Date(row[14]).toISOString().split('T')[0] : null, // DATA_INICIO
          data_termino_contrato: row[15] ? new Date(row[15]).toISOString().split('T')[0] : null, // DATA_TERMINO
          integracao: row[17] || null, // Integração
          portal_laudos: row[18] === 'SIM' || row[18] === 'sim' || row[18] === 'S', // Portal de Laudos
          possui_franquia: row[19] === 'SIM' || row[19] === 'sim' || row[19] === 'S', // Possui Franquia
          valor_franquia: row[20] ? parseFloat(row[20]) : 0, // Valor Franquia
          frequencia_continua: row[21] === 'SIM' || row[21] === 'sim' || row[21] === 'S', // Frequencia Contínua
          frequencia_por_volume: row[22] === 'SIM' || row[22] === 'sim' || row[22] === 'S', // Frequência por volume
          volume_franquia: row[23] ? parseInt(row[23]) : 0, // Volume Franquia
          valor_franquia_acima_volume: row[24] ? parseFloat(row[24]) : 0 // R$ Valor Franquia Acima Volume
        }

        // Skip if no name (required field)
        if (!cliente.nome || cliente.nome.trim() === '') {
          console.log(`Pulando linha ${i + 2}: sem nome`)
          errorCount++
          continue
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
            .insert([cliente])

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