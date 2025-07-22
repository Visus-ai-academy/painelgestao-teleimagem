import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== PROCESSAR-FATURAMENTO V5 - SÍNCRONO ===')
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  let logData: any = null;

  try {
    console.log('1. Iniciando processamento síncrono...')
    
    const body = await req.json()
    const fileName = body?.fileName

    if (!fileName) {
      throw new Error('Nome do arquivo é obrigatório')
    }

    console.log('2. Processando arquivo:', fileName)

    // Criar log
    const { data: logResult, error: logError } = await supabase
      .from('upload_logs')
      .insert({
        filename: fileName,
        file_type: 'faturamento',
        status: 'processing'
      })
      .select()
      .single()

    if (logError) {
      throw new Error(`Erro ao criar log: ${logError.message}`)
    }

    logData = logResult
    console.log('3. Log criado com ID:', logData.id)

    // Baixar arquivo
    console.log('4. Baixando arquivo do storage...')
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('uploads')
      .download(fileName)

    if (downloadError) {
      throw new Error(`Erro ao baixar arquivo: ${downloadError.message}`)
    }

    console.log('5. Arquivo baixado, tamanho:', fileData.size)

    // Processar Excel
    console.log('6. Processando arquivo Excel...')
    const arrayBuffer = await fileData.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

    console.log('7. Dados extraídos do Excel:', jsonData.length, 'linhas')

    // Pegar cabeçalhos
    const headers = jsonData[0] as string[]
    console.log('8. Cabeçalhos encontrados:', headers)

    // Otimização: buscar apenas clientes que aparecem no Excel
    console.log('8.1. Extraindo códigos únicos do Excel...')
    const codigosUnicos = [...new Set(
      jsonData.slice(1, 101) // Apenas os primeiros 100 registros
        .map(row => row[0]?.toString().trim())
        .filter(Boolean)
    )]
    
    console.log('8.2. Códigos únicos encontrados:', codigosUnicos.length)
    
    console.log('8.3. Buscando apenas clientes relevantes...')
    const { data: clientesCadastrados, error: clientesError } = await supabase
      .from('clientes')
      .select('id, nome, cod_cliente')
      .or(`cod_cliente.in.(${codigosUnicos.join(',')}),nome.in.(${codigosUnicos.join(',')})`)
      .eq('ativo', true)

    if (clientesError) {
      throw new Error(`Erro ao buscar clientes: ${clientesError.message}`)
    }

    console.log('8.2. Clientes encontrados:', clientesCadastrados?.length || 0)

    // Função simplificada para encontrar cliente
    const encontrarClienteId = (codigoCliente: string): string | null => {
      if (!codigoCliente || !clientesCadastrados) return null
      
      const cliente = clientesCadastrados.find(c => 
        c.cod_cliente?.toUpperCase() === codigoCliente.trim().toUpperCase() ||
        c.nome?.toUpperCase() === codigoCliente.trim().toUpperCase()
      )
      
      return cliente?.id || null
    }

    // Mapear dados - PROCESSAMENTO MUITO CONSERVADOR
    const dadosMapeados = []
    const maxRecords = 100 // LIMITE MUITO BAIXO para teste
    
    console.log(`9. Processando apenas os primeiros ${maxRecords} registros...`)
    
    for (let i = 1; i < Math.min(jsonData.length, maxRecords + 1); i++) {
      const row = jsonData[i] as any[]
      
      if (!row || row.length === 0) continue

      const codigoCliente = row[0]?.toString().trim()
      if (!codigoCliente) continue

      const clienteId = encontrarClienteId(codigoCliente)
      
      const registro = {
        omie_id: `FAT_${Date.now()}_${i}`,
        numero_fatura: `NF_${Date.now()}_${i}`,
        cliente_id: clienteId,
        cliente: row[1]?.toString() || 'Paciente Não Informado',
        cliente_nome: row[1]?.toString() || 'Paciente Não Informado',
        paciente: codigoCliente,
        medico: row[2]?.toString() || 'Médico Não Informado',
        data_exame: new Date(row[3]?.toString() || Date.now()),
        modalidade: row[4]?.toString() || 'Não Informado',
        especialidade: row[5]?.toString() || 'Não Informado',
        categoria: row[6]?.toString() || 'Não Informado',
        prioridade: row[7]?.toString() || 'Normal',
        nome_exame: row[8]?.toString() || 'Exame Não Informado',
        quantidade: parseInt(row[9]?.toString() || '1'),
        valor_bruto: parseFloat(row[10]?.toString().replace(',', '.') || '0'),
        valor: parseFloat(row[10]?.toString().replace(',', '.') || '0'),
        data_emissao: new Date(),
        data_vencimento: new Date(),
        status: 'Ativo'
      }
      
      dadosMapeados.push(registro)
    }

    console.log('10. Dados mapeados:', dadosMapeados.length, 'registros')

    // Identificar períodos
    const periodos = new Set<string>()
    dadosMapeados.forEach(item => {
      const periodo = item.data_emissao.toISOString().slice(0, 7) // YYYY-MM
      periodos.add(periodo)
    })
    
    const periodosArray = Array.from(periodos)
    console.log('11. Períodos identificados:', periodosArray)

    // Remover dados existentes - UM PERÍODO POR VEZ
    for (const periodo of periodosArray) {
      console.log(`Removendo dados do período ${periodo}`)
      
      const inicioMes = new Date(`${periodo}-01`)
      const fimMes = new Date(inicioMes)
      fimMes.setMonth(fimMes.getMonth() + 1)
      
      const { error: deleteError } = await supabase
        .from('faturamento')
        .delete()
        .gte('data_emissao', inicioMes.toISOString())
        .lt('data_emissao', fimMes.toISOString())

      if (deleteError) {
        console.log(`Erro ao remover dados do período ${periodo}:`, deleteError.message)
      } else {
        console.log(`Dados do período ${periodo} removidos com sucesso`)
      }
    }

    // Inserir dados - LOTES MUITO PEQUENOS
    console.log('12. Inserindo dados em lotes pequenos...')
    const batchSize = 10 // MUITO PEQUENO
    let totalInseridos = 0

    for (let i = 0; i < dadosMapeados.length; i += batchSize) {
      const lote = dadosMapeados.slice(i, i + batchSize)
      console.log(`Inserindo lote ${Math.floor(i/batchSize) + 1}: ${lote.length} registros`)
      
      const { error: insertError } = await supabase
        .from('faturamento')
        .insert(lote)

      if (insertError) {
        console.error(`Erro no lote ${Math.floor(i/batchSize) + 1}:`, insertError.message)
      } else {
        totalInseridos += lote.length
        console.log(`Lote inserido com sucesso. Total: ${totalInseridos}`)
        
        // Atualizar progresso
        await supabase
          .from('upload_logs')
          .update({ records_processed: totalInseridos })
          .eq('id', logData.id)
      }
    }

    // Finalizar
    await supabase
      .from('upload_logs')
      .update({
        status: 'completed',
        records_processed: totalInseridos
      })
      .eq('id', logData.id)

    console.log('13. Processamento concluído! Total inserido:', totalInseridos)

    return new Response(JSON.stringify({
      success: true,
      message: `Processamento síncrono concluído - ${totalInseridos} registros inseridos`,
      recordsProcessed: totalInseridos,
      periodosSubstituidos: periodosArray
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Erro no processamento:', error)
    
    if (logData?.id) {
      await supabase
        .from('upload_logs')
        .update({
          status: 'error',
          error_message: error instanceof Error ? error.message : 'Erro desconhecido'
        })
        .eq('id', logData.id)
    }

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})