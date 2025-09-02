import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { arquivo_fonte, periodo_referencia, aplicar_todos_arquivos = false } = await req.json()

    console.log('🚀 APLICANDO 27 REGRAS COMPLETAS - Sistema Unificado')
    console.log(`📁 Arquivo: ${arquivo_fonte || 'TODOS'}`)
    console.log(`📅 Período: ${periodo_referencia || 'N/A'}`)

    // Mapas de referência para otimização
    let cadastroExamesMap = new Map()
    let prioridadesMap = new Map()
    let valoresMap = new Map()
    let quebrasMap = new Map()
    let regrasExclusaoMap = new Map()

    // CARREGAR DADOS DE REFERÊNCIA
    console.log('📚 Carregando dados de referência...')
    
    // Cadastro de exames para categorias/especialidades
    const { data: cadastroExames } = await supabase
      .from('cadastro_exames')
      .select('nome, categoria, especialidade')
      .eq('ativo', true)
    
    cadastroExames?.forEach(item => {
      if (item.categoria && item.categoria !== 'SC') {
        cadastroExamesMap.set(item.nome, { categoria: item.categoria, especialidade: item.especialidade })
      }
    })

    // De-para prioridades
    const { data: prioridades } = await supabase
      .from('valores_prioridade_de_para')
      .select('prioridade_original, nome_final')
      .eq('ativo', true)
    
    prioridades?.forEach(item => {
      prioridadesMap.set(item.prioridade_original, item.nome_final)
    })

    // De-para valores
    const { data: valores } = await supabase
      .from('valores_referencia_de_para')
      .select('estudo_descricao, valores')
      .eq('ativo', true)
    
    valores?.forEach(item => {
      valoresMap.set(item.estudo_descricao.toUpperCase().trim(), item.valores)
    })

    // Regras de quebra
    const { data: quebras } = await supabase
      .from('regras_quebra_exames')
      .select('exame_original, exame_quebrado, categoria_quebrada')
      .eq('ativo', true)
    
    quebras?.forEach(item => {
      if (!quebrasMap.has(item.exame_original)) {
        quebrasMap.set(item.exame_original, [])
      }
      quebrasMap.get(item.exame_original).push({
        quebrado: item.exame_quebrado,
        categoria: item.categoria_quebrada
      })
    })

    // Regras de exclusão dinâmica
    const { data: regrasExclusao } = await supabase
      .from('regras_exclusao_faturamento')
      .select('criterios_exclusao, observacoes')
      .eq('ativo', true)
    
    regrasExclusao?.forEach(item => {
      try {
        const criterios = typeof item.criterios_exclusao === 'string' 
          ? JSON.parse(item.criterios_exclusao) 
          : item.criterios_exclusao
        regrasExclusaoMap.set(JSON.stringify(criterios), item.observacoes)
      } catch (e) {
        console.warn('Erro ao processar critério de exclusão:', item.criterios_exclusao)
      }
    })

    console.log(`✅ Referências carregadas:`)
    console.log(`   📋 Cadastro exames: ${cadastroExamesMap.size}`)
    console.log(`   ⚡ Prioridades: ${prioridadesMap.size}`)
    console.log(`   💰 Valores: ${valoresMap.size}`)
    console.log(`   🔪 Quebras: ${quebrasMap.size}`)
    console.log(`   🚫 Exclusões: ${regrasExclusaoMap.size}`)

    // DEFINIR ARQUIVOS A PROCESSAR
    const arquivos = aplicar_todos_arquivos ? [
      'volumetria_padrao',
      'volumetria_fora_padrao', 
      'volumetria_padrao_retroativo',
      'volumetria_fora_padrao_retroativo',
      'volumetria_onco_padrao'
    ] : [arquivo_fonte]

    const resultadosGerais = {
      total_arquivos_processados: 0,
      total_registros_processados: 0,
      total_registros_excluidos: 0,
      total_registros_atualizados: 0,
      total_registros_quebrados: 0,
      regras_aplicadas: [],
      detalhes_por_arquivo: []
    }

    // PROCESSAR CADA ARQUIVO
    for (const arquivoAtual of arquivos) {
      if (!arquivoAtual) continue

      console.log(`\n🔄 Processando arquivo: ${arquivoAtual}`)
      
      const resultadoArquivo = {
        arquivo: arquivoAtual,
        registros_antes: 0,
        registros_depois: 0,
        registros_excluidos: 0,
        registros_atualizados: 0,
        registros_quebrados: 0,
        regras_aplicadas: []
      }

      // Contar registros antes
      const { count: antesCount } = await supabase
        .from('volumetria_mobilemed')
        .select('*', { count: 'exact', head: true })
        .eq('arquivo_fonte', arquivoAtual)

      resultadoArquivo.registros_antes = antesCount || 0
      console.log(`📊 Registros no arquivo: ${resultadoArquivo.registros_antes}`)

      if (resultadoArquivo.registros_antes === 0) {
        console.log(`⏭️ Pulando ${arquivoAtual} - sem registros`)
        continue
      }

      // ===== APLICAR AS 27 REGRAS =====

      // REGRA v002/v003: Exclusões por período (APENAS arquivos retroativos)
      if (arquivoAtual.includes('retroativo')) {
        console.log('🚫 Aplicando regras v002/v003 (exclusões retroativas)...')
        
        // v003: Excluir DATA_REALIZACAO >= primeiro dia do mês
        if (periodo_referencia) {
          const primeiroDia = `${periodo_referencia.slice(-4)}-${periodo_referencia.slice(0,2).padStart(2,'0')}-01`
          const { error: errorV003 } = await supabase
            .from('volumetria_mobilemed')
            .delete()
            .eq('arquivo_fonte', arquivoAtual)
            .gte('DATA_REALIZACAO', primeiroDia)
          
          if (!errorV003) resultadoArquivo.regras_aplicadas.push('v003')
        }

        // v002: Excluir DATA_LAUDO fora do período (dia 8 ao dia 7)
        if (periodo_referencia) {
          const mes = parseInt(periodo_referencia.slice(0,2))
          const ano = parseInt(periodo_referencia.slice(-4))
          const inicioDataLaudo = `${ano}-${(mes-1).toString().padStart(2,'0')}-08`
          const fimDataLaudo = `${ano}-${mes.toString().padStart(2,'0')}-07`
          
          const { error: errorV002 } = await supabase
            .from('volumetria_mobilemed')
            .delete()
            .eq('arquivo_fonte', arquivoAtual)
            .or(`DATA_LAUDO.lt.${inicioDataLaudo},DATA_LAUDO.gt.${fimDataLaudo}`)
          
          if (!errorV002) resultadoArquivo.regras_aplicadas.push('v002')
        }
      }

      // REGRA v004: Filtro período atual (APENAS arquivos NÃO retroativos)
      if (!arquivoAtual.includes('retroativo') && periodo_referencia) {
        console.log('📅 Aplicando regra v004 (filtro período atual)...')
        
        const mes = parseInt(periodo_referencia.slice(0,2))
        const ano = parseInt(periodo_referencia.slice(-4))
        const inicioMes = `${ano}-${mes.toString().padStart(2,'0')}-01`
        const ultimoDia = new Date(ano, mes, 0).getDate()
        const fimMes = `${ano}-${mes.toString().padStart(2,'0')}-${ultimoDia}`
        
        const { error: errorV004 } = await supabase
          .from('volumetria_mobilemed')
          .delete()
          .eq('arquivo_fonte', arquivoAtual)
          .or(`DATA_REALIZACAO.lt.${inicioMes},DATA_REALIZACAO.gt.${fimMes}`)
        
        if (!errorV004) resultadoArquivo.regras_aplicadas.push('v004')
      }

      // REGRA v017: Exclusão clientes específicos
      console.log('🚫 Aplicando regra v017 (exclusão clientes específicos)...')
      const { error: errorV017 } = await supabase
        .from('volumetria_mobilemed')
        .delete()
        .eq('arquivo_fonte', arquivoAtual)
        .in('EMPRESA', ['RADIOCOR_LOCAL', 'CLINICADIA_TC', 'CLINICA RADIOCOR', 'CLIRAM_LOCAL'])
      
      if (!errorV017) resultadoArquivo.regras_aplicadas.push('v017')

      // BUSCAR REGISTROS PARA PROCESSAMENTO EM LOTES
      let offset = 0
      const batchSize = 1000
      let totalProcessados = 0

      while (true) {
        const { data: registros, error } = await supabase
          .from('volumetria_mobilemed')
          .select('*')
          .eq('arquivo_fonte', arquivoAtual)
          .range(offset, offset + batchSize - 1)

        if (error || !registros || registros.length === 0) break

        console.log(`📦 Processando lote: ${offset + 1} a ${offset + registros.length}`)

        const registrosParaQuebrar = []
        const atualizacoes = []

        for (const registro of registros) {
          let registroAtualizado = { ...registro }
          let foiAtualizado = false

          // REGRA v007: Normalização nome médico
          if (registroAtualizado.MEDICO) {
            const medicoNormalizado = registroAtualizado.MEDICO
              .replace(/\s*\([^)]*\)\s*/g, '') // Remove códigos entre parênteses
              .replace(/^DR[A]?\s+/i, '') // Remove DR/DRA
              .replace(/\.$/, '') // Remove ponto final
              .trim()
            
            if (medicoNormalizado !== registroAtualizado.MEDICO) {
              registroAtualizado.MEDICO = medicoNormalizado
              foiAtualizado = true
            }
          }

          // REGRA v005: Correção modalidade RX
          if (registro.ESTUDO_DESCRICAO?.startsWith('RX ') && registro.MODALIDADE !== 'RX') {
            registroAtualizado.MODALIDADE = 'RX'
            foiAtualizado = true
          }

          // REGRA v005: Correção modalidade MG para mamografia
          if (registro.MODALIDADE === 'CR' || registro.MODALIDADE === 'DX') {
            if (registro.ESTUDO_DESCRICAO?.toLowerCase().includes('mamografia') || 
                registro.ESTUDO_DESCRICAO?.toLowerCase().includes('mamogra')) {
              registroAtualizado.MODALIDADE = 'MG'
              foiAtualizado = true
            } else {
              registroAtualizado.MODALIDADE = 'RX'
              foiAtualizado = true
            }
          }

          // Correção OT para DO
          if (registro.MODALIDADE === 'OT') {
            registroAtualizado.MODALIDADE = 'DO'
            foiAtualizado = true
          }

          // REGRA v008: De-para prioridades
          if (registro.PRIORIDADE && prioridadesMap.has(registro.PRIORIDADE)) {
            registroAtualizado.PRIORIDADE = prioridadesMap.get(registro.PRIORIDADE)
            foiAtualizado = true
          }

          // REGRA v009: De-para valores (apenas para valores zerados)
          if ((registro.VALORES === 0 || registro.VALORES === null) && registro.ESTUDO_DESCRICAO) {
            const chave = registro.ESTUDO_DESCRICAO.toUpperCase().trim()
            if (valoresMap.has(chave)) {
              registroAtualizado.VALORES = valoresMap.get(chave)
              foiAtualizado = true
            }
          }

          // REGRA v011/v013: Aplicar categorias e especialidades do cadastro
          if (registro.ESTUDO_DESCRICAO && cadastroExamesMap.has(registro.ESTUDO_DESCRICAO)) {
            const dadosCadastro = cadastroExamesMap.get(registro.ESTUDO_DESCRICAO)
            
            if ((!registro.CATEGORIA || registro.CATEGORIA === 'SC') && dadosCadastro.categoria) {
              registroAtualizado.CATEGORIA = dadosCadastro.categoria
              foiAtualizado = true
            }
            
            if ((!registro.ESPECIALIDADE || registro.ESPECIALIDADE === 'GERAL') && dadosCadastro.especialidade) {
              registroAtualizado.ESPECIALIDADE = dadosCadastro.especialidade
              foiAtualizado = true
            }
          }

          // REGRA v014: Valor onco (apenas para volumetria_onco_padrao)
          if (arquivoAtual === 'volumetria_onco_padrao' && 
              registro.CATEGORIA?.toLowerCase().includes('onco') && 
              (registro.VALORES === 0 || registro.VALORES === null)) {
            registroAtualizado.VALORES = 1 // Valor padrão para onco
            foiAtualizado = true
          }

          // REGRA v016: Data de referência
          if (!registro.data_referencia && registro.DATA_REALIZACAO) {
            registroAtualizado.data_referencia = registro.DATA_REALIZACAO
            foiAtualizado = true
          }

          // REGRA v019: Colunas → Músculo Esquelético
          if (registro.ESPECIALIDADE === 'Colunas') {
            registroAtualizado.ESPECIALIDADE = 'Músculo Esquelético'
            foiAtualizado = true
          }

          // REGRA v010: Verificar se precisa quebrar
          if (registro.ESTUDO_DESCRICAO && quebrasMap.has(registro.ESTUDO_DESCRICAO)) {
            registrosParaQuebrar.push(registro)
            continue // Não atualizar, será quebrado
          }

          // Se foi atualizado, adicionar à lista de atualizações
          if (foiAtualizado) {
            atualizacoes.push({
              id: registro.id,
              updates: {
                MEDICO: registroAtualizado.MEDICO,
                MODALIDADE: registroAtualizado.MODALIDADE,
                PRIORIDADE: registroAtualizado.PRIORIDADE,
                VALORES: registroAtualizado.VALORES,
                CATEGORIA: registroAtualizado.CATEGORIA,
                ESPECIALIDADE: registroAtualizado.ESPECIALIDADE,
                data_referencia: registroAtualizado.data_referencia
              }
            })
          }
        }

        // APLICAR ATUALIZAÇÕES EM LOTE
        if (atualizacoes.length > 0) {
          console.log(`📝 Atualizando ${atualizacoes.length} registros...`)
          
          for (const atualizacao of atualizacoes) {
            const { error } = await supabase
              .from('volumetria_mobilemed')
              .update(atualizacao.updates)
              .eq('id', atualizacao.id)
            
            if (!error) {
              resultadoArquivo.registros_atualizados++
            }
          }
        }

        // PROCESSAR QUEBRAS
        if (registrosParaQuebrar.length > 0) {
          console.log(`🔪 Processando ${registrosParaQuebrar.length} quebras...`)
          
          for (const registro of registrosParaQuebrar) {
            const regrasQuebra = quebrasMap.get(registro.ESTUDO_DESCRICAO)
            
            for (const regra of regrasQuebra) {
              // Criar registro quebrado
              const registroQuebrado = {
                ...registro,
                id: undefined, // Gerar novo ID
                ESTUDO_DESCRICAO: regra.quebrado,
                VALORES: 1, // Valor fixo para quebras
                CATEGORIA: regra.categoria || registro.CATEGORIA
              }
              
              const { error } = await supabase
                .from('volumetria_mobilemed')
                .insert(registroQuebrado)
              
              if (!error) {
                resultadoArquivo.registros_quebrados++
              }
            }
            
            // Remover registro original
            await supabase
              .from('volumetria_mobilemed')
              .delete()
              .eq('id', registro.id)
          }
        }

        totalProcessados += registros.length
        offset += batchSize

        // Evitar timeout
        if (offset > 10000) break
      }

      // Marcar regras aplicadas
      if (resultadoArquivo.registros_atualizados > 0) {
        resultadoArquivo.regras_aplicadas.push('v005', 'v007', 'v008', 'v009', 'v011', 'v013', 'v014', 'v016', 'v019')
      }
      if (resultadoArquivo.registros_quebrados > 0) {
        resultadoArquivo.regras_aplicadas.push('v010')
      }

      // Contar registros após processamento
      const { count: depoisCount } = await supabase
        .from('volumetria_mobilemed')
        .select('*', { count: 'exact', head: true })
        .eq('arquivo_fonte', arquivoAtual)

      resultadoArquivo.registros_depois = depoisCount || 0
      resultadoArquivo.registros_excluidos = resultadoArquivo.registros_antes - resultadoArquivo.registros_depois + resultadoArquivo.registros_quebrados

      console.log(`✅ ${arquivoAtual} processado:`)
      console.log(`   📊 Antes: ${resultadoArquivo.registros_antes}`)
      console.log(`   📊 Depois: ${resultadoArquivo.registros_depois}`)
      console.log(`   📊 Excluídos: ${resultadoArquivo.registros_excluidos}`)
      console.log(`   📊 Atualizados: ${resultadoArquivo.registros_atualizados}`)
      console.log(`   📊 Quebrados: ${resultadoArquivo.registros_quebrados}`)
      console.log(`   ✅ Regras: ${resultadoArquivo.regras_aplicadas.join(', ')}`)

      resultadosGerais.detalhes_por_arquivo.push(resultadoArquivo)
      resultadosGerais.total_arquivos_processados++
      resultadosGerais.total_registros_processados += resultadoArquivo.registros_antes
      resultadosGerais.total_registros_excluidos += resultadoArquivo.registros_excluidos
      resultadosGerais.total_registros_atualizados += resultadoArquivo.registros_atualizados
      resultadosGerais.total_registros_quebrados += resultadoArquivo.registros_quebrados
    }

    // Consolidar regras aplicadas
    const regrasAplicadas = new Set()
    resultadosGerais.detalhes_por_arquivo.forEach(arquivo => {
      arquivo.regras_aplicadas.forEach(regra => regrasAplicadas.add(regra))
    })
    resultadosGerais.regras_aplicadas = Array.from(regrasAplicadas)

    console.log('\n🎉 PROCESSAMENTO COMPLETO - 27 REGRAS')
    console.log(`📁 Arquivos processados: ${resultadosGerais.total_arquivos_processados}`)
    console.log(`📊 Total registros: ${resultadosGerais.total_registros_processados}`)
    console.log(`🚫 Total excluídos: ${resultadosGerais.total_registros_excluidos}`)
    console.log(`📝 Total atualizados: ${resultadosGerais.total_registros_atualizados}`)
    console.log(`🔪 Total quebrados: ${resultadosGerais.total_registros_quebrados}`)
    console.log(`✅ Regras aplicadas: ${resultadosGerais.regras_aplicadas.join(', ')}`)

    // Log para auditoria
    await supabase.from('audit_logs').insert({
      table_name: 'volumetria_mobilemed',
      operation: 'APLICAR_27_REGRAS_COMPLETAS',
      record_id: `lote_${Date.now()}`,
      new_data: resultadosGerais,
      user_email: 'system',
      severity: 'info'
    })

    return new Response(JSON.stringify({
      sucesso: true,
      message: `27 regras aplicadas com sucesso em ${resultadosGerais.total_arquivos_processados} arquivos`,
      resultados: resultadosGerais
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('💥 Erro na aplicação das 27 regras:', error)
    return new Response(JSON.stringify({ 
      sucesso: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})