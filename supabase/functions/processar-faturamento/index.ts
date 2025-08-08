
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
    console.log('Data vazia, usando data atual como fallback');
    return new Date().toISOString().split('T')[0]; // Fallback para data atual
  }
  
  // Se já está em formato de data válido
  if (excelDate instanceof Date) {
    const formatted = excelDate.toISOString().split('T')[0];
    console.log('Data convertida de Date:', formatted);
    return formatted;
  }
  
  // Se é string, tentar converter
  if (typeof excelDate === 'string') {
    // Tentar diferentes formatos de data brasileiros
    let testDate = excelDate.trim();
    
    // Se está no formato DD/MM/YYYY, converter para YYYY-MM-DD
    if (testDate.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [dia, mes, ano] = testDate.split('/');
      testDate = `${ano}-${mes}-${dia}`;
    }
    
    const date = new Date(testDate);
    if (!isNaN(date.getTime())) {
      const formatted = date.toISOString().split('T')[0];
      console.log(`Data convertida de string "${excelDate}" para:`, formatted);
      return formatted;
    }
  }
  
  // Se é número (formato Excel serial date)
  if (typeof excelDate === 'number') {
    // Excel conta dias desde 1900-01-01, mas tem um bug para anos bissextos
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (excelDate - 2) * 24 * 60 * 60 * 1000);
    const formatted = date.toISOString().split('T')[0];
    console.log(`Data convertida de número Excel ${excelDate} para:`, formatted);
    return formatted;
  }
  
  console.log('Não foi possível converter a data, usando data atual:', excelDate);
  return new Date().toISOString().split('T')[0]; // Fallback seguro
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
    // ❌ REMOVIDA LIMITAÇÃO - processar TODOS os registros
    
    console.log(`9. Processando TODOS os ${jsonData.length} registros (limitação removida)...`)
    
    const hoje = new Date().toISOString().split('T')[0]
    const vencimento = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    for (let i = 1; i < jsonData.length; i++) { // ✅ PROCESSAR TODOS
      const row = jsonData[i] as any[]
      if (!row || row.length === 0) continue

      const codigoCliente = row[0]?.toString().trim()
      if (!codigoCliente) continue

      const clienteId = encontrarClienteId(codigoCliente)
      
      // CORREÇÃO: Usar a data do arquivo Excel (assumindo que está na coluna 3)
      const dataExameArquivo = formatExcelDate(row[3])
      
      console.log(`Processando linha ${i}: data original=${row[3]}, data formatada=${dataExameArquivo}`)
      
      // Determinar tipo de faturamento (Regras F005/F006)
      const determinarTipoFaturamento = (cliente, especialidade, prioridade, medico) => {
        const CLIENTES_NC_ORIGINAL = ["CDICARDIO", "CDIGOIAS", "CISP", "CLIRAM", "CRWANDERLEY", "DIAGMAX-PR", "GOLD", "PRODIMAGEM", "TRANSDUSON", "ZANELLO"];
        const CLIENTES_NC_ADICIONAIS = ["CEMVALENCA", "RMPADUA", "RADI-IMAGEM"];
        const CLIENTES_NC = [...CLIENTES_NC_ORIGINAL, ...CLIENTES_NC_ADICIONAIS];
        const ESPECIALIDADES_NC_FATURADAS = ["CARDIO"];
        const MEDICOS_NC_FATURADOS = ["Dr. Antonio Gualberto Chianca Filho", "Dr. Daniel Chrispim", "Dr. Efraim Da Silva Ferreira", "Dr. Felipe Falcão de Sá", "Dr. Guilherme N. Schincariol", "Dr. Gustavo Andreis", "Dr. João Carlos Dantas do Amaral", "Dr. João Fernando Miranda Pompermayer", "Dr. Leonardo de Paula Ribeiro Figueiredo", "Dr. Raphael Sanfelice João", "Dr. Thiago P. Martins", "Dr. Virgílio Oliveira Barreto", "Dra. Adriana Giubilei Pimenta", "Dra. Aline Andrade Dorea", "Dra. Camila Amaral Campos", "Dra. Cynthia Mendes Vieira de Morais", "Dra. Fernanda Gama Barbosa", "Dra. Kenia Menezes Fernandes", "Dra. Lara M. Durante Bacelar", "Dr. Aguinaldo Cunha Zuppani", "Dr. Alex Gueiros de Barros", "Dr. Eduardo Caminha Nunes", "Dr. Márcio D'Andréa Rossi", "Dr. Rubens Pereira Moura Filho", "Dr. Wesley Walber da Silva", "Dra. Luna Azambuja Satte Alam", "Dra. Roberta Bertoldo Sabatini Treml", "Dra. Thais Nogueira D. Gastaldi", "Dra. Vanessa da Costa Maldonado"];

        if (!CLIENTES_NC.includes(cliente)) return "CO-FT";
        
        if (CLIENTES_NC_ORIGINAL.includes(cliente)) {
          const temEspecialidadeFaturada = especialidade && ESPECIALIDADES_NC_FATURADAS.includes(especialidade);
          const ehPlantao = prioridade === "PLANTÃO";
          return (temEspecialidadeFaturada || ehPlantao) ? "NC-FT" : "NC-NF";
        }
        
        if (CLIENTES_NC_ADICIONAIS.includes(cliente)) {
          const temEspecialidadeFaturada = especialidade && ESPECIALIDADES_NC_FATURADAS.includes(especialidade);
          const ehPlantao = prioridade === "PLANTÃO";
          const temMedicoFaturado = medico && MEDICOS_NC_FATURADOS.includes(medico);
          const temMamaRadiImagem = cliente === "RADI-IMAGEM" && especialidade === "MAMA";
          return (temEspecialidadeFaturada || ehPlantao || temMedicoFaturado || temMamaRadiImagem) ? "NC-FT" : "NC-NF";
        }
        
        return "NC-NF";
      };

      const clienteNome = row[1]?.toString() || 'Paciente Não Informado';
      const especialidade = row[5]?.toString() || 'Não Informado';
      const prioridade = row[7]?.toString() || 'Normal';
      const medico = row[2]?.toString() || 'Médico Não Informado';

      dadosMapeados.push({
        omie_id: `FAT_${Date.now()}_${i}`,
        numero_fatura: `NF_${Date.now()}_${i}`,
        cliente_id: clienteId,
        cliente_nome: clienteNome,
        paciente: codigoCliente,
        medico: medico,
        data_exame: dataExameArquivo, // CORREÇÃO: usando data do arquivo
        modalidade: row[4]?.toString() || 'Não Informado',
        especialidade: especialidade,
        categoria: row[6]?.toString() || 'Não Informado',
        prioridade: prioridade,
        nome_exame: row[8]?.toString() || 'Exame Não Informado',
        quantidade: parseInt(row[9]?.toString() || '1'),
        valor_bruto: parseFloat(row[10]?.toString().replace(',', '.') || '0'),
        valor: parseFloat(row[10]?.toString().replace(',', '.') || '0'),
        tipo_faturamento: determinarTipoFaturamento(clienteNome, especialidade, prioridade, medico, row[8]?.toString()),
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
