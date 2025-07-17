import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { fileName } = await req.json()

    console.log('Processando arquivo de clientes:', fileName)

    // 1. Log do início do processamento
    const { data: logEntry, error: logError } = await supabaseClient
      .from('upload_logs')
      .insert({
        filename: fileName,
        file_type: 'clientes',
        status: 'processing'
      })
      .select()
      .single()

    if (logError) {
      throw new Error(`Erro ao criar log: ${logError.message}`)
    }

    // 2. Baixar arquivo do storage
    console.log('Baixando arquivo do storage...')
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('uploads')
      .download(fileName)

    if (downloadError) {
      throw new Error(`Erro ao baixar arquivo: ${downloadError.message}`)
    }

    // 3. Converter arquivo para buffer
    const buffer = await fileData.arrayBuffer()
    
    // 4. Processar arquivo Excel/CSV
    console.log('Analisando formato do arquivo...')
    const workbook = XLSX.read(buffer)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet)

    console.log('Dados encontrados:', jsonData.length, 'registros')
    
    // Log das primeiras linhas para debug
    if (jsonData.length > 0) {
      console.log('Primeira linha do arquivo:', JSON.stringify(jsonData[0]))
      console.log('Colunas disponíveis:', Object.keys(jsonData[0]))
    }

    // 5. Mapear dados para estrutura do banco com busca flexível de colunas
    const clientes = jsonData.map((row: any) => {
      // Buscar nome em várias possibilidades
      const nome = row.nome || row.Nome || row.NOME || row.cliente || row.Cliente || row.CLIENTE ||
                   row.razao_social || row['Razão Social'] || row['RAZÃO SOCIAL'] || 
                   row.empresa || row.Empresa || row.EMPRESA || '';
      
      // Buscar email
      const email = row.email || row.Email || row.EMAIL || row['E-mail'] || row['e-mail'] || '';
      
      console.log('Processando linha:', { nome, email, originalRow: row });
      
      return {
        id: crypto.randomUUID(),
        nome: String(nome).trim(),
        email: String(email).trim(),
        telefone: row.telefone || row.Telefone || row.TELEFONE || row.fone || row.Fone || null,
        endereco: row.endereco || row.Endereco || row.ENDERECO || row.endereco_completo || null,
        cnpj: row.cnpj || row.CNPJ || row.documento || row.Documento || null,
        ativo: true
      };
    })

    // 6. Filtrar apenas clientes com nome válido
    const clientesValidos = clientes.filter(cliente => 
      cliente.nome && cliente.nome.trim() !== '' && cliente.nome !== 'undefined'
    )

    console.log('Inserindo clientes no banco...', clientesValidos.length, 'registros')

    // 7. ⚠️ IMPORTANTE: Limpar dados antigos primeiro (substitui arquivo anterior)
    const { error: deleteError } = await supabaseClient
      .from('clientes')
      .delete()
      .neq('id', 'never-match') // Deleta todos os registros

    if (deleteError) {
      console.warn('Aviso ao limpar dados antigos:', deleteError.message)
    }

    // 8. Inserir novos clientes
    const { data: clientesInseridos, error: clientesError } = await supabaseClient
      .from('clientes')
      .insert(clientesValidos)
      .select()

    if (clientesError) {
      throw new Error(`Erro ao inserir clientes: ${clientesError.message}`)
    }

    // 9. Atualizar log com sucesso
    const { error: updateLogError } = await supabaseClient
      .from('upload_logs')
      .update({
        status: 'completed',
        records_processed: clientesValidos.length
      })
      .eq('id', logEntry.id)

    if (updateLogError) {
      console.error('Erro ao atualizar log:', updateLogError.message)
    }

    console.log(`Processamento concluído! ${clientesValidos.length} clientes inseridos.`)

    return new Response(
      JSON.stringify({
        success: true,
        registros_processados: clientesValidos.length,
        registros_erro: jsonData.length - clientesValidos.length,
        mensagem: `${clientesValidos.length} clientes processados com sucesso`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Erro no processamento:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro interno do servidor'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})