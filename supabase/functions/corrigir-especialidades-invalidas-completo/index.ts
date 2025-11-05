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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('🔧 Iniciando correção de especialidades inválidas (GERAL e RX)...')

    let totalCorrigidos = 0
    let totalNaoEncontrados = 0
    const detalhesCorrecoes: any[] = []

    // ETAPA 1: Corrigir registros com ESPECIALIDADE = 'GERAL'
    console.log('\n📋 ETAPA 1: Corrigindo ESPECIALIDADE = "GERAL"')
    
    const { data: registrosGeral, error: fetchGeralError } = await supabase
      .from('volumetria_mobilemed')
      .select('*')
      .eq('ESPECIALIDADE', 'GERAL')

    if (fetchGeralError) {
      throw new Error(`Erro ao buscar registros GERAL: ${fetchGeralError.message}`)
    }

    console.log(`📊 Encontrados ${registrosGeral?.length || 0} registros com ESPECIALIDADE = "GERAL"`)

    // Buscar mapeamentos do cadastro de exames
    const { data: cadastroExames, error: cadastroError } = await supabase
      .from('cadastro_exames')
      .select('*')
      .eq('ativo', true)

    if (cadastroError) {
      throw new Error(`Erro ao buscar cadastro de exames: ${cadastroError.message}`)
    }

    console.log(`📋 Carregados ${cadastroExames?.length || 0} exames do cadastro`)

    // Criar mapa de exames para lookup rápido (usando nome do cadastro)
    const mapaExames = new Map<string, string>()
    cadastroExames?.forEach(ex => {
      const nomeExame = ex.nome || ex.exame || ex.descricao
      if (nomeExame && ex.especialidade) {
        mapaExames.set(nomeExame.toUpperCase().trim(), ex.especialidade)
      }
    })

    // Função para encontrar especialidade por similaridade
    const encontrarEspecialidadePorSimilaridade = (estudo: string): string | null => {
      const estudoLimpo = estudo.toUpperCase().trim()
      
      // 1. Tentativa: Match exato
      if (mapaExames.has(estudoLimpo)) {
        return mapaExames.get(estudoLimpo)!
      }

      // 2. Tentativa: Match parcial - verifica se o estudo contém algum nome do cadastro
      for (const [nomeExame, especialidade] of mapaExames.entries()) {
        if (estudoLimpo.includes(nomeExame) || nomeExame.includes(estudoLimpo)) {
          console.log(`✓ Match parcial: "${estudo}" ≈ "${nomeExame}" → ${especialidade}`)
          return especialidade
        }
      }

      // 3. Tentativa: Match por palavras-chave principais
      const palavrasChave = estudoLimpo.replace(/USG |US |ULTRASSONOGRAFIA |DE |DO |DA /g, '').trim()
      for (const [nomeExame, especialidade] of mapaExames.entries()) {
        const nomeExameLimpo = nomeExame.replace(/USG |US |ULTRASSONOGRAFIA |DE |DO |DA /g, '').trim()
        if (palavrasChave.includes(nomeExameLimpo) || nomeExameLimpo.includes(palavrasChave)) {
          console.log(`✓ Match por palavras-chave: "${estudo}" ≈ "${nomeExame}" → ${especialidade}`)
          return especialidade
        }
      }

      // 4. Tentativa: Inferir por modalidade US (todos US são MEDICINA INTERNA por padrão)
      return null
    }

    // Processar registros GERAL
    for (const registro of registrosGeral || []) {
      const estudoDescricao = registro.ESTUDO_DESCRICAO || ''
      let especialidadeCorreta = encontrarEspecialidadePorSimilaridade(estudoDescricao)

      // Se não encontrou, tentar inferir pela modalidade
      if (!especialidadeCorreta) {
        const modalidade = registro.MODALIDADE || ''
        
        // Para exames US que não foram encontrados, usar MEDICINA INTERNA como padrão
        if (modalidade === 'US') {
          especialidadeCorreta = 'MEDICINA INTERNA'
          console.log(`ℹ️ Especialidade inferida por modalidade US: ${especialidadeCorreta}`)
        } else {
          const mapeamentoModalidade: Record<string, string> = {
            'DO': 'MUSCULO ESQUELETICO',
            'RX': 'MEDICINA INTERNA',
            'CT': 'MEDICINA INTERNA',
            'MR': 'MEDICINA INTERNA',
            'MG': 'MAMA'
          }
          especialidadeCorreta = mapeamentoModalidade[modalidade] || null
        }
      }

      if (especialidadeCorreta) {
        const { error: updateError } = await supabase
          .from('volumetria_mobilemed')
          .update({ 
            ESPECIALIDADE: especialidadeCorreta,
            updated_at: new Date().toISOString()
          })
          .eq('id', registro.id)

        if (!updateError) {
          totalCorrigidos++
          detalhesCorrecoes.push({
            estudo: registro.ESTUDO_DESCRICAO,
            de: 'GERAL',
            para: especialidadeCorreta
          })
          console.log(`✅ ${registro.ESTUDO_DESCRICAO}: GERAL → ${especialidadeCorreta}`)
        } else {
          console.error(`❌ Erro ao atualizar ${registro.ESTUDO_DESCRICAO}:`, updateError.message)
        }
      } else {
        totalNaoEncontrados++
        console.log(`⚠️ Exame não encontrado no cadastro: ${registro.ESTUDO_DESCRICAO}`)
      }
    }

    // ETAPA 2: Corrigir registros com ESPECIALIDADE = 'RX'
    console.log('\n📋 ETAPA 2: Corrigindo ESPECIALIDADE = "RX"')
    
    const { data: registrosRx, error: fetchRxError } = await supabase
      .from('volumetria_mobilemed')
      .select('*')
      .eq('ESPECIALIDADE', 'RX')

    if (fetchRxError) {
      throw new Error(`Erro ao buscar registros RX: ${fetchRxError.message}`)
    }

    console.log(`📊 Encontrados ${registrosRx?.length || 0} registros com ESPECIALIDADE = "RX"`)

    // Processar registros RX
    for (const registro of registrosRx || []) {
      const estudoDescricao = registro.ESTUDO_DESCRICAO || ''
      let especialidadeCorreta = encontrarEspecialidadePorSimilaridade(estudoDescricao)

      // Se não encontrar no mapa, tentar inferir pela modalidade
      if (!especialidadeCorreta) {
        const modalidade = registro.MODALIDADE || ''
        
        // Mapeamento padrão por modalidade para casos não encontrados
        const mapeamentoModalidade: Record<string, string> = {
          'DO': 'MUSCULO ESQUELETICO',
          'RX': 'MEDICINA INTERNA',
          'US': 'MEDICINA INTERNA',
          'CT': 'MEDICINA INTERNA',
          'MR': 'MEDICINA INTERNA',
          'MG': 'MAMA'
        }
        
        especialidadeCorreta = mapeamentoModalidade[modalidade] || 'MEDICINA INTERNA'
        console.log(`ℹ️ Especialidade inferida por modalidade ${modalidade}: ${especialidadeCorreta}`)
      }

      const { error: updateError } = await supabase
        .from('volumetria_mobilemed')
        .update({ 
          ESPECIALIDADE: especialidadeCorreta,
          updated_at: new Date().toISOString()
        })
        .eq('id', registro.id)

      if (!updateError) {
        totalCorrigidos++
        detalhesCorrecoes.push({
          estudo: registro.ESTUDO_DESCRICAO,
          de: 'RX',
          para: especialidadeCorreta
        })
        console.log(`✅ ${registro.ESTUDO_DESCRICAO}: RX → ${especialidadeCorreta}`)
      } else {
        console.error(`❌ Erro ao atualizar ${registro.ESTUDO_DESCRICAO}:`, updateError.message)
      }
    }

    // Registrar no audit log
    await supabase.from('audit_logs').insert({
      table_name: 'volumetria_mobilemed',
      operation: 'CORRECAO_ESPECIALIDADES_INVALIDAS',
      record_id: 'bulk',
      new_data: {
        total_corrigidos: totalCorrigidos,
        total_nao_encontrados: totalNaoEncontrados,
        registros_geral: registrosGeral?.length || 0,
        registros_rx: registrosRx?.length || 0,
        detalhes: detalhesCorrecoes,
        timestamp: new Date().toISOString()
      },
      user_email: 'system',
      severity: 'info'
    })

    console.log(`\n✅ Correção finalizada: ${totalCorrigidos} registros corrigidos, ${totalNaoEncontrados} não encontrados no cadastro`)

    return new Response(
      JSON.stringify({
        sucesso: true,
        total_corrigidos: totalCorrigidos,
        total_nao_encontrados: totalNaoEncontrados,
        registros_geral_processados: registrosGeral?.length || 0,
        registros_rx_processados: registrosRx?.length || 0,
        detalhes: detalhesCorrecoes,
        mensagem: `Correção concluída: ${totalCorrigidos} registros corrigidos`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('❌ Erro na correção:', error)
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        erro: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
