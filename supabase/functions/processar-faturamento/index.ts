
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função para converter data do Excel para formato ISO
const formatExcelDate = (excelDate: any): string => {
  console.log('formatExcelDate - valor recebido:', excelDate, 'tipo:', typeof excelDate);
  
  if (!excelDate) {
    console.log('Data vazia, mantendo original');
    return excelDate; // Retorna vazio para não mascarar o problema
  }
  
  // Se já está em formato de data válido
  if (excelDate instanceof Date) {
    const formatted = excelDate.toISOString().split('T')[0];
    console.log('Data convertida de Date:', formatted);
    return formatted;
  }
  
  // Se é string, tentar converter
  if (typeof excelDate === 'string') {
    // Tentar diferentes formatos de data
    const formats = [
      excelDate, // formato original
      excelDate.replace(/\//g, '-'), // trocar / por -
      excelDate.split('/').reverse().join('-') // DD/MM/YYYY para YYYY-MM-DD
    ];
    
    for (const format of formats) {
      const date = new Date(format);
      if (!isNaN(date.getTime())) {
        const formatted = date.toISOString().split('T')[0];
        console.log(`Data convertida de string "${excelDate}" para:`, formatted);
        return formatted;
      }
    }
  }
  
  // Se é número (formato Excel serial date)
  if (typeof excelDate === 'number') {
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (excelDate - 2) * 24 * 60 * 60 * 1000);
    const formatted = date.toISOString().split('T')[0];
    console.log(`Data convertida de número Excel ${excelDate} para:`, formatted);
    return formatted;
  }
  
  console.log('Não foi possível converter a data:', excelDate);
  return excelDate?.toString() || '';
};

serve(async (req) => {
  console.log('=== PROCESSAR-FATURAMENTO V7 - CORRIGINDO DATAS ===')
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  let logData: any = null;

  try {
    console.log('1. Iniciando processamento com correção de datas...')
    
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

    console.log('6. Processando arquivo Excel...')
    const arrayBuffer = await fileData.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

    console.log('7. Dados extraídos do Excel:', jsonData.length, 'linhas')

    const headers = jsonData[0] as string[]
    console.log('8. Cabeçalhos encontrados:', headers)

    // Otimização: buscar apenas clientes que aparecem no Excel
    console.log('8.1. Extraindo códigos únicos do Excel...')
    const codigosUnicos = [...new Set(
      jsonData.slice(1, 501)
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

    console.log('8.4. Clientes encontrados:', clientesCadastrados?.length || 0)

    const encontrarClienteId = (codigoCliente: string): string | null => {
      if (!codigoCliente || !clientesCadastrados) return null
      
      const cliente = clientesCadastrados.find(c => 
        c.cod_cliente?.toUpperCase() === codigoCliente.trim().toUpperCase() ||
        c.nome?.toUpperCase() === codigoCliente.trim().toUpperCase()
      )
      
      return cliente?.id || null
    }

    const dadosMapeados = []
    const maxRecords = 100
    
    console.log(`9. Processando os primeiros ${maxRecords} registros com datas corretas...`)
    
    const hoje = new Date().toISOString().split('T')[0]
    const vencimento = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    for (let i = 1; i < Math.min(jsonData.length, maxRecords + 1); i++) {
      const row = jsonData[i] as any[]
      if (!row || row.length === 0) continue

      const codigoCliente = row[0]?.toString().trim()
      if (!codigoCliente) continue

      const clienteId = encontrarClienteId(codigoCliente)
      
      // CORREÇÃO: Usar a data do arquivo Excel (assumindo que está na coluna 3)
      const dataExameArquivo = formatExcelDate(row[3])
      
      console.log(`Processando linha ${i}: data original=${row[3]}, data formatada=${dataExameArquivo}`)
      
      dadosMapeados.push({
        omie_id: `FAT_${Date.now()}_${i}`,
        numero_fatura: `NF_${Date.now()}_${i}`,
        cliente_id: clienteId,
        cliente_nome: row[1]?.toString() || 'Paciente Não Informado',
        paciente: codigoCliente,
        medico: row[2]?.toString() || 'Médico Não Informado',
        data_exame: dataExameArquivo, // CORREÇÃO: usando data do arquivo
        modalidade: row[4]?.toString() || 'Não Informado',
        especialidade: row[5]?.toString() || 'Não Informado',
        categoria: row[6]?.toString() || 'Não Informado',
        prioridade: row[7]?.toString() || 'Normal',
        nome_exame: row[8]?.toString() || 'Exame Não Informado',
        quantidade: parseInt(row[9]?.toString() || '1'),
        valor_bruto: parseFloat(row[10]?.toString().replace(',', '.') || '0'),
        valor: parseFloat(row[10]?.toString().replace(',', '.') || '0'),
        data_emissao: hoje,
        data_vencimento: vencimento
      })
    }

    console.log('10. Dados mapeados:', dadosMapeados.length, 'registros')

    // Identificar períodos
    const periodos = new Set<string>()
    dadosMapeados.forEach(item => {
      const periodo = item.data_emissao.slice(0, 7)
      periodos.add(periodo)
    })
    
    const periodosArray = Array.from(periodos)
    console.log('11. Períodos identificados:', periodosArray)

    for (const periodo of periodosArray) {
      console.log(`Removendo dados do período ${periodo}`)
      
      const inicioMes = `${periodo}-01`
      const proximoMes = new Date(`${periodo}-01`)
      proximoMes.setMonth(proximoMes.getMonth() + 1)
      const fimMes = proximoMes.toISOString().split('T')[0]
      
      const { error: deleteError } = await supabase
        .from('faturamento')
        .delete()
        .gte('data_emissao', inicioMes)
        .lt('data_emissao', fimMes)

      if (deleteError) {
        console.log(`Erro ao remover dados do período ${periodo}:`, deleteError.message)
      } else {
        console.log(`Dados do período ${periodo} removidos com sucesso`)
      }
    }

    // Inserir dados em lotes
    console.log('12. Inserindo dados em lotes...')
    const batchSize = 50
    let totalInseridos = 0

    for (let i = 0; i < dadosMapeados.length; i += batchSize) {
      const lote = dadosMapeados.slice(i, i + batchSize)
      console.log(`Inserindo lote ${Math.floor(i/batchSize) + 1}: ${lote.length} registros`)
      
      const { error: insertError } = await supabase
        .from('faturamento')
        .insert(lote)

      if (insertError) {
        console.error(`Erro no lote ${Math.floor(i/batchSize) + 1}:`, insertError.message)
        for (const registro of lote) {
          const { error: singleError } = await supabase
            .from('faturamento')
            .insert([registro])
          
          if (!singleError) {
            totalInseridos++
          } else {
            console.error(`Erro ao inserir registro individual:`, singleError.message)
          }
        }
      } else {
        totalInseridos += lote.length
        console.log(`Lote inserido com sucesso. Total: ${totalInseridos}`)
      }
      
      await supabase
        .from('upload_logs')
        .update({ records_processed: totalInseridos })
        .eq('id', logData.id)
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
      message: `Processamento concluído com sucesso - ${totalInseridos} registros inseridos com datas corretas`,
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
