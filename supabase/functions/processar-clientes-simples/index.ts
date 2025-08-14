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
        // Mapeamento baseado na sequência correta de colunas fornecida pelo usuário:
        // 0: NOME_MOBILEMED, 1: Nome Fantasia, 2: Contrato, 3: CNPJ, 4: Razão Social, 5: Endereço, 6: Bairro, 7: CEP, 8: Cidade, 9: UF, 10: E-MAIL ENVIO NF, 11: TIPO_CLIENTE, 12: DIA_FATURAMENTO, 13: DATA_INICIO, 14: DATA_TERMINO, 15: STATUS
        const cliente = {
          // nome preenchido apenas com Nome Fantasia (coluna 1)
          nome: row[1] || null, // Nome Fantasia - coluna 1
          nome_fantasia: row[1] || null, // Nome Fantasia - coluna 1
          nome_mobilemed: row[0] || null, // NOME_MOBILEMED - coluna 0
          email: row[10] || null, // E-MAIL ENVIO NF - coluna 10
          email_envio_nf: row[10] || null, // E-MAIL ENVIO NF - coluna 10
          cnpj: row[3] || null, // CNPJ - coluna 3
          contato: null, // Não existe no arquivo - deixar em branco
          endereco: row[5] || null, // Endereço - coluna 5
          cidade: row[8] || null, // Cidade - coluna 8
          estado: row[9] || null, // UF - coluna 9
          bairro: row[6] || null, // Bairro - coluna 6
          cep: row[7] || null, // CEP - coluna 7
          numero_contrato: row[2] || null, // Contrato - coluna 2
          razao_social: row[4] || null, // Razão Social - coluna 4
          tipo_cliente: row[11] || 'CO', // TIPO_CLIENTE - coluna 11
          dia_faturamento: row[12] ? parseInt(row[12]) : null, // DIA_FATURAMENTO - coluna 12
          
          // Gerar cod_cliente sequencial baseado na data de início
          cod_cliente: (() => {
            if (row[13] && row[13] !== '') {
              try {
                const date = new Date(row[13]);
                if (!isNaN(date.getTime())) {
                  const year = date.getFullYear().toString().slice(-2);
                  const month = (date.getMonth() + 1).toString().padStart(2, '0');
                  return `CLI${year}${month}${(i + 1).toString().padStart(3, '0')}`;
                }
              } catch (error) {
                // Se erro na data, usar apenas sequencial
              }
            }
            return `CLI${(i + 1).toString().padStart(6, '0')}`;
          })(),
          
          // Status processamento
          status: (row[15] === 'A' || row[15] === 'ATIVO' || row[15] === 'Ativo' || row[15] === 'ativo') ? 'Ativo' : 'Inativo', // STATUS - coluna 15
          ativo: (row[15] === 'A' || row[15] === 'ATIVO' || row[15] === 'Ativo' || row[15] === 'ativo'),
          
          // Datas - tratamento mais robusto
          data_inicio_contrato: row[13] && row[13] !== '' ? (() => {
            try {
              let dateValue = row[13];
              
              // Se for um número (Excel timestamp)
              if (typeof dateValue === 'number') {
                // Excel epoch is 1900-01-01, JavaScript epoch is 1970-01-01
                // Excel has 25567 days difference + 2 days for Excel bug
                const date = new Date((dateValue - 25569) * 86400 * 1000);
                return isNaN(date.getTime()) || date.getFullYear() < 1970 ? null : date.toISOString().split('T')[0];
              }
              
              // Se for string, tentar parsear
              const date = new Date(dateValue);
              return isNaN(date.getTime()) || date.getFullYear() < 1970 ? null : date.toISOString().split('T')[0];
            } catch {
              return null;
            }
          })() : null, // DATA_INICIO - coluna 13
          data_termino_contrato: row[14] && row[14] !== '' ? (() => {
            try {
              let dateValue = row[14];
              
              // Se for um número (Excel timestamp)
              if (typeof dateValue === 'number') {
                // Excel epoch is 1900-01-01, JavaScript epoch is 1970-01-01
                // Excel has 25567 days difference + 2 days for Excel bug
                const date = new Date((dateValue - 25569) * 86400 * 1000);
                return isNaN(date.getTime()) || date.getFullYear() < 1970 ? null : date.toISOString().split('T')[0];
              }
              
              // Se for string, tentar parsear
              const date = new Date(dateValue);
              return isNaN(date.getTime()) || date.getFullYear() < 1970 ? null : date.toISOString().split('T')[0];
            } catch {
              return null;
            }
          })() : null, // DATA_TERMINO - coluna 14
          
          // Campos opcionais com valores padrão
          telefone: null,
          integracao: row[16] || null, // Integração - coluna 16 se existir
          portal_laudos: row[17] === 'S' || row[17] === 'Sim' || row[17] === 'SIM' || false, // Portal de Laudos - coluna 17
          possui_franquia: row[18] === 'S' || row[18] === 'Sim' || row[18] === 'SIM' || false, // Possui Franquia - coluna 18
          valor_franquia: row[19] ? parseFloat(row[19]) : 0, // Valor Franquia - coluna 19
          frequencia_continua: row[20] === 'S' || row[20] === 'Sim' || row[20] === 'SIM' || false, // Frequencia Contínua - coluna 20
          frequencia_por_volume: row[21] === 'S' || row[21] === 'Sim' || row[21] === 'SIM' || false, // Frequência por volume - coluna 21
          volume_franquia: row[22] ? parseInt(row[22]) : 0, // Volume Franquia - coluna 22
          valor_franquia_acima_volume: row[23] ? parseFloat(row[23]) : 0 // R$ Valor Franquia Acima Volume - coluna 23
        }

        // Debug: Log first few rows to understand the data structure
        if (i < 3) {
          console.log(`Linha ${i + 2} dados:`, {
            row_length: row.length,
            first_10_columns: row.slice(0, 10),
            status_raw: row[15],
            status_processado: cliente.status,
            nome_mobilemed: cliente.nome_mobilemed,
            nome_fantasia: cliente.nome_fantasia,
            nome: cliente.nome,
            email: cliente.email,
            cnpj: cliente.cnpj,
            cidade: cliente.cidade,
            estado: cliente.estado,
            endereco: cliente.endereco,
            tipo_cliente: cliente.tipo_cliente
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

        // Clean and format CNPJ/CPF if present
        if (cliente.cnpj) {
          let cnpjLimpo = cliente.cnpj.toString().replace(/[^\d]/g, '')
          if (cnpjLimpo.length === 14) {
            // CNPJ format: XX.XXX.XXX/XXXX-XX
            cliente.cnpj = `${cnpjLimpo.substring(0,2)}.${cnpjLimpo.substring(2,5)}.${cnpjLimpo.substring(5,8)}/${cnpjLimpo.substring(8,12)}-${cnpjLimpo.substring(12,14)}`
          } else if (cnpjLimpo.length === 11) {
            // CPF format: XXX.XXX.XXX-XX
            cliente.cnpj = `${cnpjLimpo.substring(0,3)}.${cnpjLimpo.substring(3,6)}.${cnpjLimpo.substring(6,9)}-${cnpjLimpo.substring(9,11)}`
          } else if (cnpjLimpo.length > 0) {
            // Keep original if doesn't match expected lengths but has numbers
            cliente.cnpj = cnpjLimpo
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