import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { arquivo_fonte } = await req.json()
    
    console.log(`🏷️ Iniciando aplicação de categorias baseadas no cadastro_exames para arquivo: ${arquivo_fonte}`)
    
    // Buscar cadastro de exames com categorias
    const { data: cadastroExames, error: cadastroError } = await supabase
      .from('cadastro_exames')
      .select('nome, categoria')
      .eq('ativo', true)
      .not('categoria', 'is', null)

    if (cadastroError) {
      console.error('❌ Erro ao buscar cadastro de exames:', cadastroError)
      throw cadastroError
    }

    console.log(`📚 Carregados ${cadastroExames?.length || 0} exames com categoria no cadastro`)

    // Criar mapa de exames para busca eficiente
    const mapaExames = new Map()
    cadastroExames?.forEach(exame => {
      mapaExames.set(exame.nome, exame.categoria)
    })

    // Buscar registros sem categoria ou com categoria vazia
    const { data: registrosSemCategoria, error: selectError } = await supabase
      .from('volumetria_mobilemed')
      .select('id, "ESTUDO_DESCRICAO", "CATEGORIA"')
      .eq('arquivo_fonte', arquivo_fonte)
      .or('"CATEGORIA".is.null,"CATEGORIA".eq.')

    if (selectError) {
      console.error('❌ Erro ao buscar registros sem categoria:', selectError)
      throw selectError
    }

    console.log(`📊 Encontrados ${registrosSemCategoria?.length || 0} registros sem categoria`)

    let totalProcessados = 0
    let totalAtualizados = 0
    let totalErros = 0
    const exemplosCategorizados: any[] = []

    // Processar em lotes de 100 registros
    const batchSize = 100
    for (let i = 0; i < (registrosSemCategoria?.length || 0); i += batchSize) {
      const lote = registrosSemCategoria!.slice(i, i + batchSize)
      console.log(`🔄 Processando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil((registrosSemCategoria?.length || 0) / batchSize)} - ${lote.length} registros`)
      
      for (const registro of lote) {
        totalProcessados++
        
        try {
          const nomeExame = registro.ESTUDO_DESCRICAO
          const categoria = mapaExames.get(nomeExame)
          
          if (categoria) {
            const { error: updateError } = await supabase
              .from('volumetria_mobilemed')
              .update({
                'CATEGORIA': categoria,
                updated_at: new Date().toISOString()
              })
              .eq('id', registro.id)

            if (updateError) {
              console.error(`❌ Erro ao atualizar categoria do registro ${registro.id}:`, updateError)
              totalErros++
            } else {
              totalAtualizados++
              
              // Armazenar exemplo para log
              if (exemplosCategorizados.length < 10) {
                exemplosCategorizados.push({
                  exame: nomeExame,
                  categoria_aplicada: categoria
                })
              }
              
              console.log(`✅ Categoria aplicada: "${nomeExame}" → "${categoria}"`)
            }
          }
        } catch (error) {
          console.error(`❌ Erro ao processar registro ${registro.id}:`, error)
          totalErros++
        }
      }
    }

    // Log da operação no audit_logs
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'APLICAR_CATEGORIAS_CADASTRO',
        record_id: arquivo_fonte,
        new_data: {
          regra: 'v040',
          arquivo_fonte,
          total_processados: totalProcessados,
          total_atualizados: totalAtualizados,
          total_erros: totalErros,
          exemplos_categorizados: exemplosCategorizados,
          data_processamento: new Date().toISOString()
        },
        user_email: 'system',
        severity: 'info'
      })

    const resultado = {
      sucesso: true,
      arquivo_fonte,
      registros_processados: totalProcessados,
      registros_atualizados: totalAtualizados,
      registros_erro: totalErros,
      exemplos_categorizados: exemplosCategorizados,
      regra_aplicada: 'v040 - Aplicação de Categorias baseado no Cadastro de Exames',
      data_processamento: new Date().toISOString(),
      observacao: `Aplicadas categorias para ${totalAtualizados} exames baseadas no cadastro_exames`
    }

    console.log('✅ Categorias aplicadas com sucesso:', resultado)

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Erro geral na aplicação de categorias:', error)
    return new Response(
      JSON.stringify({ erro: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})