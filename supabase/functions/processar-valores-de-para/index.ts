import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0"
import * as XLSX from "https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ValorReferencia {
  estudo_descricao: string;
  valores: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { fileName } = await req.json()
    console.log('Processing De Para file:', fileName)

    // Download arquivo do storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('uploads')
      .download(fileName)

    if (downloadError) {
      throw new Error(`Erro ao baixar arquivo: ${downloadError.message}`)
    }

    // Converter arquivo para array buffer
    const arrayBuffer = await fileData.arrayBuffer()
    const data = new Uint8Array(arrayBuffer)

    // Ler planilha
    const workbook = XLSX.read(data, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

    console.log('Dados extraídos:', jsonData.slice(0, 5))

    // Processar dados (assumindo primeira linha são headers)
    const headers = jsonData[0] as string[]
    const rows = jsonData.slice(1) as any[][]

    // Encontrar índices das colunas
    const estudoIndex = headers.findIndex(h => 
      h && h.toString().toUpperCase().includes('ESTUDO_DESCRICAO'))
    const valoresIndex = headers.findIndex(h => 
      h && h.toString().toUpperCase().includes('VALORES'))

    if (estudoIndex === -1 || valoresIndex === -1) {
      throw new Error('Colunas ESTUDO_DESCRICAO e/ou VALORES não encontradas')
    }

    console.log(`Índices encontrados - ESTUDO_DESCRICAO: ${estudoIndex}, VALORES: ${valoresIndex}`)

    // Preparar dados para inserção
    const valoresReferencia: ValorReferencia[] = []
    let linhasProcessadas = 0
    let linhasComErro = 0

    // Função para limpar códigos X1-X9 dos nomes de exames
    const cleanExameName = (value: any): string | undefined => {
      if (value === null || value === undefined || value === '') return undefined;
      
      let cleanName = String(value).trim();
      // Remove códigos X1, X2, X3, X4, X5, X6, X7, X8, X9
      cleanName = cleanName.replace(/\s+X[1-9]\b/gi, '');
      // Remove códigos XE também
      cleanName = cleanName.replace(/\s+XE\b/gi, '');
      // Remove múltiplos espaços que podem ter sobrado
      cleanName = cleanName.replace(/\s+/g, ' ').trim();
      
      return cleanName || undefined;
    };

    for (const row of rows) {
      try {
        const estudoDescricaoRaw = row[estudoIndex]?.toString()?.trim()
        const estudoDescricao = cleanExameName(estudoDescricaoRaw)
        const valores = parseFloat(row[valoresIndex])

        if (estudoDescricao && !isNaN(valores)) {
          valoresReferencia.push({
            estudo_descricao: estudoDescricao,
            valores: valores
          })
          linhasProcessadas++
        } else {
          linhasComErro++
          console.log(`Linha inválida: estudo="${estudoDescricao}", valores="${row[valoresIndex]}"`)
        }
      } catch (error) {
        linhasComErro++
        console.error('Erro ao processar linha:', error)
      }
    }

    console.log(`Processamento concluído: ${linhasProcessadas} válidas, ${linhasComErro} com erro`)

    if (valoresReferencia.length === 0) {
      throw new Error('Nenhum dado válido encontrado no arquivo')
    }

    // Limpar dados existentes e inserir novos
    const { error: deleteError } = await supabase
      .from('valores_referencia_de_para')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Deletar todos

    if (deleteError) {
      console.error('Erro ao limpar dados existentes:', deleteError)
    }

    // Inserir novos dados em lotes
    const batchSize = 100
    let totalInseridos = 0

    for (let i = 0; i < valoresReferencia.length; i += batchSize) {
      const batch = valoresReferencia.slice(i, i + batchSize)
      
      const { error: insertError } = await supabase
        .from('valores_referencia_de_para')
        .insert(batch)

      if (insertError) {
        console.error(`Erro ao inserir lote ${i}-${i + batch.length}:`, insertError)
        throw new Error(`Erro na inserção: ${insertError.message}`)
      }

      totalInseridos += batch.length
      console.log(`Lote inserido: ${totalInseridos}/${valoresReferencia.length}`)
    }

    // Aplicar valores nos dados existentes
    console.log('Aplicando valores "De Para" nos dados existentes...')
    
    const { data: resultadoAplicacao, error: aplicacaoError } = await supabase
      .rpc('aplicar_valores_de_para')

    if (aplicacaoError) {
      console.error('Erro ao aplicar valores:', aplicacaoError)
      throw new Error(`Erro ao aplicar valores: ${aplicacaoError.message}`)
    }

    console.log('Resultado da aplicação:', resultadoAplicacao)

    const resultado = {
      sucesso: true,
      arquivo_processado: fileName,
      linhas_processadas: linhasProcessadas,
      linhas_com_erro: linhasComErro,
      valores_inseridos: totalInseridos,
      aplicacao_resultado: resultadoAplicacao,
      timestamp: new Date().toISOString()
    }

    console.log('Processamento finalizado:', resultado)

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Erro no processamento:', error)
    
    return new Response(JSON.stringify({
      erro: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})