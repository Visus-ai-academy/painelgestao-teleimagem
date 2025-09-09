import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
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

    const { calculo, dataVencimento, observacoes } = await req.json()

    console.log('Iniciando geração de fatura para:', calculo.clienteId, calculo.periodo)

    // 1. Buscar dados do cliente
    const { data: cliente, error: clienteError } = await supabaseClient
      .from('clientes')
      .select('*')
      .eq('id', calculo.clienteId)
      .single()

    if (clienteError) {
      throw new Error(`Erro ao buscar cliente: ${clienteError.message}`)
    }

    // 2. Gerar número da fatura
    const numeroFatura = `#${new Date().getFullYear()}${String(Date.now()).slice(-6)}`

    // 3. Salvar fatura no banco
    const { data: fatura, error: faturaError } = await supabaseClient
      .from('faturas_geradas')
      .insert({
        numero: numeroFatura,
        cliente_id: calculo.clienteId,
        periodo: calculo.periodo,
        data_emissao: new Date().toISOString().split('T')[0],
        data_vencimento: dataVencimento,
        subtotal: calculo.resumo.subtotal,
        desconto: calculo.resumo.totalDesconto,
        acrescimo: calculo.resumo.totalAcrescimo,
        valor_total: calculo.resumo.valorFinal,
        observacoes: observacoes,
        status: 'Gerada'
      })
      .select()
      .single()

    if (faturaError) {
      throw new Error(`Erro ao salvar fatura: ${faturaError.message}`)
    }

    // 4. Salvar itens da fatura
    const itens = calculo.items.map((item: any) => ({
      fatura_id: fatura.id,
      exame_id: item.exameId,
      modalidade: item.modalidade,
      especialidade: item.especialidade,
      categoria: item.categoria,
      prioridade: item.prioridade,
      valor_contrato: item.valorContrato,
      desconto: item.desconto,
      acrescimo: item.acrescimo,
      valor_final: item.valorFinal
    }))

    const { error: itensError } = await supabaseClient
      .from('fatura_itens')
      .insert(itens)

    if (itensError) {
      throw new Error(`Erro ao salvar itens: ${itensError.message}`)
    }

    // 5. Gerar PDF (simulado por agora)
    console.log('Gerando PDF para fatura:', numeroFatura)
    
    // Aguardar 2 segundos para simular processamento
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const nomeArquivo = `fatura_${cliente.nome.replace(/ /g, '_')}_${calculo.periodo}.pdf`
    
    // 6. Simular upload do PDF
    const { data: uploadData, error: uploadError } = await supabaseClient
      .from('faturas_geradas')
      .update({ arquivo_pdf: nomeArquivo })
      .eq('id', fatura.id)

    if (uploadError) {
      throw new Error(`Erro ao atualizar PDF: ${uploadError.message}`)
    }

    console.log('PDF gerado com sucesso:', nomeArquivo)

    // 7. Enviar email (simulado)
    console.log('Enviando email para:', cliente.email)
    
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    const { error: emailError } = await supabaseClient
      .from('faturas_geradas')
      .update({ 
        email_enviado: true,
        data_email: new Date().toISOString()
      })
      .eq('id', fatura.id)

    if (emailError) {
      throw new Error(`Erro ao marcar email: ${emailError.message}`)
    }

    console.log('Email enviado com sucesso!')

    return new Response(
      JSON.stringify({
        success: true,
        fatura: {
          id: fatura.id,
          numero: numeroFatura,
          cliente: cliente.nome,
          valor: calculo.resumo.valorFinal,
          arquivo: nomeArquivo
        },
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Erro na função gerar-fatura:', error)
    
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