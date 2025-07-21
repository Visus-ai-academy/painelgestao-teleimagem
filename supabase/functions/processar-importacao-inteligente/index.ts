import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FieldMapping {
  id: string;
  template_name: string;
  file_type: string;
  source_field: string;
  target_field: string;
  target_table: string;
  field_type: string;
  is_required: boolean;
  default_value?: string;
  order_index: number;
}

interface ImportTemplate {
  id: string;
  name: string;
  file_type: string;
  auto_detect_columns: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const requestBody = await req.json()
    const filename = requestBody.filename || requestBody.fileName
    
    if (!filename) {
      throw new Error('Nome do arquivo não fornecido')
    }
    
    console.log('Processando arquivo:', filename)

    // Criar log de processamento
    const { data: logData, error: logError } = await supabaseClient
      .from('import_history')
      .insert({
        filename: filename,
        file_type: 'auto-detect',
        status: 'processing'
      })
      .select()
      .single()

    if (logError) {
      console.error('Erro ao criar log:', logError)
      throw logError
    }

    const importId = logData.id

    try {
      // Download do arquivo
      const { data: fileData, error: downloadError } = await supabaseClient.storage
        .from('uploads')
        .download(filename)

      if (downloadError) {
        console.error('Erro ao baixar arquivo:', downloadError)
        throw downloadError
      }

      // Converter para ArrayBuffer
      const arrayBuffer = await fileData.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

      if (jsonData.length === 0) {
        throw new Error('Arquivo vazio ou formato inválido')
      }

      // Primeira linha contém os cabeçalhos
      const headers = jsonData[0] as string[]
      console.log('Cabeçalhos encontrados:', headers)

      // Detectar template baseado nos cabeçalhos
      const { data: templates, error: templatesError } = await supabaseClient
        .from('import_templates')
        .select('*')
        .eq('active', true)

      if (templatesError) throw templatesError

      let selectedTemplate: ImportTemplate | null = null
      
      // Procurar template que melhor corresponde aos cabeçalhos
      for (const template of templates) {
        const requiredColumns = template.auto_detect_columns as string[]
        const foundColumns = requiredColumns.filter(col => 
          headers.some(header => 
            header.toLowerCase().includes(col.toLowerCase()) ||
            col.toLowerCase().includes(header.toLowerCase())
          )
        )
        
        // Se encontrou pelo menos 70% das colunas obrigatórias
        if (foundColumns.length >= requiredColumns.length * 0.7) {
          selectedTemplate = template
          console.log('Template detectado:', template.name)
          break
        }
      }

      if (!selectedTemplate) {
        throw new Error('Não foi possível detectar o tipo de arquivo. Verifique se o formato corresponde a um template configurado.')
      }

      // Buscar mapeamentos para o template
      const { data: mappings, error: mappingsError } = await supabaseClient
        .from('field_mappings')
        .select('*')
        .eq('template_name', selectedTemplate.name)
        .eq('active', true)
        .order('order_index')

      if (mappingsError) throw mappingsError

      // Criar mapeamento de índices de colunas
      const columnMapping: Record<string, number> = {}
      
      mappings.forEach(mapping => {
        const headerIndex = headers.findIndex(header => 
          header.toLowerCase().trim() === mapping.source_field.toLowerCase().trim() ||
          header.toLowerCase().includes(mapping.source_field.toLowerCase()) ||
          mapping.source_field.toLowerCase().includes(header.toLowerCase())
        )
        
        if (headerIndex !== -1) {
          columnMapping[mapping.target_field] = headerIndex
        } else if (mapping.is_required) {
          console.warn(`Campo obrigatório não encontrado: ${mapping.source_field}`)
        }
      })

      console.log('Mapeamento de colunas:', columnMapping)

      // Processar dados
      const processedData = []
      const errors = []
      
      // Pular a primeira linha (cabeçalhos)
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[]
        const processedRow: Record<string, any> = {}
        
        try {
          mappings.forEach(mapping => {
            const columnIndex = columnMapping[mapping.target_field]
            let value = null
            
            if (columnIndex !== undefined && columnIndex < row.length) {
              value = row[columnIndex]
            } else if (mapping.default_value) {
              value = mapping.default_value
            }
            
            // Tratar valores undefined ou vazios
            if (value === undefined || value === null || value === '' || value === 'undefined') {
              if (mapping.is_required) {
                throw new Error(`Campo obrigatório '${mapping.source_field}' está vazio na linha ${i + 1}`)
              } else {
                // Para campos não obrigatórios, deixar null em vez de "undefined"
                processedRow[mapping.target_field] = null
                return
              }
            }
            
            // Converter tipo de dados
            switch (mapping.field_type) {
              case 'number':
                const numValue = typeof value === 'string' ? 
                  parseFloat(value.replace(/[^\d.-]/g, '')) : value
                processedRow[mapping.target_field] = isNaN(numValue) ? null : numValue
                break
                
              case 'date':
                if (typeof value === 'number') {
                  // Excel serial date
                  const date = new Date((value - 25569) * 86400 * 1000)
                  processedRow[mapping.target_field] = date.toISOString().split('T')[0]
                } else if (typeof value === 'string') {
                  const parsedDate = new Date(value)
                  processedRow[mapping.target_field] = isNaN(parsedDate.getTime()) ? 
                    null : parsedDate.toISOString().split('T')[0]
                } else {
                  processedRow[mapping.target_field] = null
                }
                break
                
              case 'boolean':
                processedRow[mapping.target_field] = Boolean(value)
                break
                
              default: // text
                 let stringValue = String(value).trim()
                 
                 // Formatação especial para CNPJ
                 if (mapping.target_field === 'cnpj' && stringValue) {
                   // Remove qualquer formatação existente
                   const cleanCnpj = stringValue.replace(/\D/g, '')
                   // Aplica formatação 00.000.000/0000-00
                   if (cleanCnpj.length === 14) {
                     stringValue = cleanCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
                   }
                 }
                 
                 // Tratamento especial para campo Status (A=Ativo, I=Inativo)
                 if (mapping.source_field?.toLowerCase().includes('status')) {
                   if (stringValue.toUpperCase() === 'A') {
                     // Se for "A", definir como ativo
                     processedRow['ativo'] = true
                     processedRow['status'] = 'Ativo'
                   } else if (stringValue.toUpperCase() === 'I') {
                     // Se for "I", definir como inativo
                     processedRow['ativo'] = false
                     processedRow['status'] = 'Inativo'
                   } else {
                     // Padrão: ativo
                     processedRow['ativo'] = true
                     processedRow['status'] = 'Ativo'
                   }
                   // Não processar mais este campo pois já tratamos
                   return
                 }
                 
                 processedRow[mapping.target_field] = stringValue
            }
          })
          
          processedData.push(processedRow)
        } catch (error) {
          errors.push({
            line: i + 1,
            error: error.message,
            data: row
          })
        }
      }

      console.log(`Processados ${processedData.length} registros, ${errors.length} erros`)

      // Inserir dados na tabela apropriada
      let insertedCount = 0
      if (processedData.length > 0) {
        const targetTable = mappings[0]?.target_table
        
        if (targetTable) {
          // Para tabelas que precisam de limpeza prévia (como clientes)
          if (targetTable === 'clientes') {
            const { error: deleteError } = await supabaseClient
              .from(targetTable)
              .delete()
              .neq('id', '00000000-0000-0000-0000-000000000000') // delete all
            
            if (deleteError) {
              console.warn('Aviso ao limpar tabela:', deleteError)
            }
          }
          
          // Inserir em lotes para evitar timeout
          const batchSize = 100
          for (let i = 0; i < processedData.length; i += batchSize) {
            const batch = processedData.slice(i, i + batchSize)
            
            // Para clientes, garantir que o status está definido se não foi processado
            if (targetTable === 'clientes') {
              batch.forEach(cliente => {
                // Só definir status se não foi definido pelo processamento
                if (cliente.status === undefined) {
                  cliente.status = cliente.ativo ? 'Ativo' : 'Inativo'
                }
              })
            }
            
            const { error: insertError } = await supabaseClient
              .from(targetTable)
              .insert(batch)
            
            if (insertError) {
              console.error('Erro ao inserir lote:', insertError)
              errors.push({
                line: `Lote ${Math.floor(i / batchSize) + 1}`,
                error: insertError.message,
                data: batch
              })
            } else {
              insertedCount += batch.length
            }
          }
        }
      }

      // Atualizar log com resultado
      const { error: updateError } = await supabaseClient
        .from('import_history')
        .update({
          template_id: selectedTemplate.id,
          file_type: selectedTemplate.file_type,
          records_imported: insertedCount,
          records_failed: errors.length,
          status: errors.length === 0 ? 'completed' : (insertedCount > 0 ? 'partial' : 'failed'),
          error_details: errors.length > 0 ? errors : null,
          import_summary: {
            total_rows: jsonData.length - 1,
            processed: processedData.length,
            inserted: insertedCount,
            failed: errors.length,
            template_used: selectedTemplate.name
          },
          mapping_used: mappings
        })
        .eq('id', importId)

      if (updateError) {
        console.error('Erro ao atualizar log:', updateError)
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Processamento concluído. ${insertedCount} registros importados, ${errors.length} erros.`,
          details: {
            template_detected: selectedTemplate.name,
            file_type: selectedTemplate.file_type,
            records_imported: insertedCount,
            records_failed: errors.length,
            errors: errors.slice(0, 10) // Mostrar apenas os primeiros 10 erros
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } catch (processingError) {
      console.error('Erro no processamento:', processingError)
      
      // Atualizar log com erro
      await supabaseClient
        .from('import_history')
        .update({
          status: 'failed',
          error_details: [{ error: processingError.message }]
        })
        .eq('id', importId)

      return new Response(
        JSON.stringify({
          success: false,
          error: processingError.message
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

  } catch (error) {
    console.error('Erro geral:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})