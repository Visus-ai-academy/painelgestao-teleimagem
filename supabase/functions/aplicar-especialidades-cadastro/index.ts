import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

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
    
    console.log(`🎯 Iniciando aplicação de modalidade/especialidade/categoria baseadas no cadastro_exames para arquivo: ${arquivo_fonte}`)
    
    // Buscar cadastro de exames com todas as informações
    const { data: cadastroExames, error: cadastroError } = await supabase
      .from('cadastro_exames')
      .select('nome, modalidade, especialidade, categoria')
      .eq('ativo', true)

    if (cadastroError) {
      console.error('❌ Erro ao buscar cadastro de exames:', cadastroError)
      throw cadastroError
    }

    console.log(`📚 Carregados ${cadastroExames?.length || 0} exames no cadastro`)

    // Criar mapa de exames para busca eficiente (nome do exame como chave)
    const mapaExames = new Map()
    cadastroExames?.forEach(exame => {
      const key = exame.nome.toUpperCase().trim()
      mapaExames.set(key, {
        modalidade: exame.modalidade,
        especialidade: exame.especialidade,
        categoria: exame.categoria
      })
    })

    // Buscar registros para processar
    const { data: registros, error: selectError } = await supabase
      .from('volumetria_mobilemed')
      .select('id, "ESTUDO_DESCRICAO", "MODALIDADE", "ESPECIALIDADE", "CATEGORIA"')
      .eq('arquivo_fonte', arquivo_fonte)

    if (selectError) {
      console.error('❌ Erro ao buscar registros:', selectError)
      throw selectError
    }

    console.log(`📊 Encontrados ${registros?.length || 0} registros para verificar`)

    let totalProcessados = 0
    let totalAtualizados = 0
    let totalErros = 0
    const exemplosAplicados: any[] = []

    // Processar em lotes de 100 registros
    const batchSize = 100
    for (let i = 0; i < (registros?.length || 0); i += batchSize) {
      const lote = registros!.slice(i, i + batchSize)
      console.log(`🔄 Processando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil((registros?.length || 0) / batchSize)} - ${lote.length} registros`)
      
      for (const registro of lote) {
        totalProcessados++
        
        try {
          const nomeExame = registro.ESTUDO_DESCRICAO?.toUpperCase().trim()
          const dadosCadastro = mapaExames.get(nomeExame)
          
          if (dadosCadastro) {
            // Verificar se precisa atualizar
            const precisaAtualizar = 
              registro.MODALIDADE !== dadosCadastro.modalidade ||
              registro.ESPECIALIDADE !== dadosCadastro.especialidade ||
              registro.CATEGORIA !== dadosCadastro.categoria

            if (precisaAtualizar) {
              const { error: updateError } = await supabase
                .from('volumetria_mobilemed')
                .update({
                  'MODALIDADE': dadosCadastro.modalidade,
                  'ESPECIALIDADE': dadosCadastro.especialidade,
                  'CATEGORIA': dadosCadastro.categoria,
                  updated_at: new Date().toISOString()
                })
                .eq('id', registro.id)

              if (updateError) {
                console.error(`❌ Erro ao atualizar registro ${registro.id}:`, updateError)
                totalErros++
              } else {
                totalAtualizados++
                
                // Armazenar exemplo para log
                if (exemplosAplicados.length < 20) {
                  exemplosAplicados.push({
                    exame: registro.ESTUDO_DESCRICAO,
                    modalidade_antiga: registro.MODALIDADE,
                    modalidade_nova: dadosCadastro.modalidade,
                    especialidade_antiga: registro.ESPECIALIDADE,
                    especialidade_nova: dadosCadastro.especialidade,
                    categoria_antiga: registro.CATEGORIA,
                    categoria_nova: dadosCadastro.categoria
                  })
                }
                
                console.log(`✅ Dados aplicados: "${registro.ESTUDO_DESCRICAO}" → MOD:${dadosCadastro.modalidade} ESP:${dadosCadastro.especialidade} CAT:${dadosCadastro.categoria}`)
              }
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
        operation: 'APLICAR_ESPECIALIDADES_CADASTRO',
        record_id: arquivo_fonte,
        new_data: {
          regra: 'v031',
          arquivo_fonte,
          total_processados: totalProcessados,
          total_atualizados: totalAtualizados,
          total_erros: totalErros,
          exemplos_aplicados: exemplosAplicados,
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
      exemplos_aplicados: exemplosAplicados,
      regra_aplicada: 'v031 - Aplicação de Modalidade/Especialidade/Categoria baseado no Cadastro de Exames',
      data_processamento: new Date().toISOString(),
      observacao: `Aplicadas dados do cadastro para ${totalAtualizados} exames com base no nome (ESTUDO_DESCRICAO)`
    }

    console.log('✅ Dados do cadastro aplicados com sucesso:', resultado)

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Erro geral na aplicação de dados do cadastro:', error)
    return new Response(
      JSON.stringify({ erro: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
