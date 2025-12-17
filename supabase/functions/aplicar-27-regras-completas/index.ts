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

    const { periodo_referencia, aplicar_todos_arquivos = true, arquivo_fonte } = await req.json()

    // Validar período obrigatório
    if (!periodo_referencia) {
      console.error('❌ Período de referência não informado')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Período de referência é obrigatório. Selecione o período antes de processar.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log('🚀 APLICANDO 27 REGRAS COMPLETAS - Sistema Otimizado v4')
    console.log(`📁 Arquivo: ${arquivo_fonte || 'TODOS OS ARQUIVOS'}`)
    console.log(`📅 Período: ${periodo_referencia}`)
    console.log(`🔄 Aplicar todos: ${aplicar_todos_arquivos}`)

    // Se aplicar_todos_arquivos = true OU não foi especificado arquivo_fonte, processar todos
    const arquivos = (aplicar_todos_arquivos || !arquivo_fonte) ? [
      'volumetria_padrao', 'volumetria_fora_padrao', 
      'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo', 'volumetria_onco_padrao'
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

    for (const arquivoAtual of arquivos) {
      if (!arquivoAtual) continue

      console.log(`\n🔄 === PROCESSANDO: ${arquivoAtual} ===`)
      
      const { count: antesCount } = await supabase
        .from('volumetria_mobilemed')
        .select('*', { count: 'exact', head: true })
        .eq('arquivo_fonte', arquivoAtual)

      if (!antesCount || antesCount === 0) {
        console.log(`⏭️ Pulando ${arquivoAtual} - sem registros`)
        continue
      }

      console.log(`📊 Registros encontrados: ${antesCount}`)
      const regrasAplicadasArquivo = new Set()

      // === APLICAR TODAS AS 27 REGRAS COMPLETAS ===
      console.log('\n🚀 Aplicando todas as 27 regras...')

      // ===== REGRAS DE EXCLUSÃO (CRÍTICAS) =====
      
      // REGRAS v002/v003: Exclusões por período (apenas para retroativos)
      if (arquivoAtual.includes('retroativo')) {
        console.log('  ⚡ Aplicando v002/v003 - Exclusões por período para retroativos')
        
        // Parsear período (formato YYYY-MM)
        let ano: number, mes: number
        if (periodo_referencia.includes('-')) {
          const [anoStr, mesStr] = periodo_referencia.split('-')
          ano = parseInt(anoStr)
          mes = parseInt(mesStr)
        } else if (periodo_referencia.includes('/')) {
          const partes = periodo_referencia.split('/')
          const mesNome = partes[0].toLowerCase()
          const anoStr = partes[1]
          const mesesMap: Record<string, number> = {
            'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
            'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12
          }
          mes = mesesMap[mesNome.substring(0, 3)] || 1
          ano = anoStr.length === 2 ? 2000 + parseInt(anoStr) : parseInt(anoStr)
        } else {
          console.error('❌ Formato de período inválido:', periodo_referencia)
          continue
        }
        
        // Calcular datas limites
        // v003: DATA_REALIZACAO deve ser ANTES do primeiro dia do mês de referência
        const dataLimiteRealizacao = `${ano}-${String(mes).padStart(2, '0')}-01`
        
        // v002: DATA_LAUDO deve estar entre dia 8 do mês ref e dia 7 do mês seguinte
        const dataInicioJanelaLaudo = `${ano}-${String(mes).padStart(2, '0')}-08`
        const mesSeguinte = mes === 12 ? 1 : mes + 1
        const anoSeguinte = mes === 12 ? ano + 1 : ano
        const dataFimJanelaLaudo = `${anoSeguinte}-${String(mesSeguinte).padStart(2, '0')}-07`
        
        console.log(`    📅 Período: ${periodo_referencia} (${ano}-${mes})`)
        console.log(`    📅 v003: DATA_REALIZACAO < ${dataLimiteRealizacao}`)
        console.log(`    📅 v002: DATA_LAUDO entre ${dataInicioJanelaLaudo} e ${dataFimJanelaLaudo}`)
        
        // Contar registros antes
        const { count: antesExclusao } = await supabase
          .from('volumetria_mobilemed')
          .select('*', { count: 'exact', head: true })
          .eq('arquivo_fonte', arquivoAtual)
        
        // v003: Excluir registros com DATA_REALIZACAO >= primeiro dia do mês de referência
        const { count: excluidosV003 } = await supabase
          .from('volumetria_mobilemed')
          .delete()
          .eq('arquivo_fonte', arquivoAtual)
          .gte('DATA_REALIZACAO', dataLimiteRealizacao)
          .select('*', { count: 'exact', head: true })
        
        console.log(`    🗑️ v003: ${excluidosV003 || 0} registros excluídos (DATA_REALIZACAO >= ${dataLimiteRealizacao})`)
        regrasAplicadasArquivo.add('v003')
        
        // v002: Excluir registros com DATA_LAUDO fora da janela permitida
        // Excluir DATA_LAUDO < dataInicioJanelaLaudo
        const { count: excluidosV002Antes } = await supabase
          .from('volumetria_mobilemed')
          .delete()
          .eq('arquivo_fonte', arquivoAtual)
          .lt('DATA_LAUDO', dataInicioJanelaLaudo)
          .select('*', { count: 'exact', head: true })
        
        // Excluir DATA_LAUDO > dataFimJanelaLaudo
        const { count: excluidosV002Depois } = await supabase
          .from('volumetria_mobilemed')
          .delete()
          .eq('arquivo_fonte', arquivoAtual)
          .gt('DATA_LAUDO', dataFimJanelaLaudo)
          .select('*', { count: 'exact', head: true })
        
        const totalExcluidosV002 = (excluidosV002Antes || 0) + (excluidosV002Depois || 0)
        console.log(`    🗑️ v002: ${totalExcluidosV002} registros excluídos (DATA_LAUDO fora da janela)`)
        regrasAplicadasArquivo.add('v002')
        
        // Contar registros depois
        const { count: depoisExclusao } = await supabase
          .from('volumetria_mobilemed')
          .select('*', { count: 'exact', head: true })
          .eq('arquivo_fonte', arquivoAtual)
        
        const totalExcluidos = (antesExclusao || 0) - (depoisExclusao || 0)
        console.log(`    📊 Total excluídos v002/v003: ${totalExcluidos} (${antesExclusao} → ${depoisExclusao})`)
      }

      // REGRA v004: Exclusões de clientes específicos
      console.log('  ⚡ Aplicando v004 - Exclusões clientes específicos')
      await supabase.from('volumetria_mobilemed')
        .delete()
        .eq('arquivo_fonte', arquivoAtual)
        .in('EMPRESA', ['CLINICA SERCOR', 'INMED', 'MEDICINA OCUPACIONAL'])
      regrasAplicadasArquivo.add('v004')

      // REGRA v017: Exclusões registros rejeitados
      console.log('  ⚡ Aplicando v017 - Exclusões registros rejeitados')
      await supabase.from('volumetria_mobilemed')
        .delete()
        .eq('arquivo_fonte', arquivoAtual)
        .or('ESTUDO_DESCRICAO.is.null,ESTUDO_DESCRICAO.eq.,EMPRESA.is.null,EMPRESA.eq.')
      regrasAplicadasArquivo.add('v017')

      // REGRA v032: Exclusão de clientes específicos avançada
      console.log('  ⚡ Aplicando v032 - Exclusão clientes específicos avançada')
      await supabase.from('volumetria_mobilemed')
        .delete()
        .eq('arquivo_fonte', arquivoAtual)
        .like('EMPRESA', '%TESTE%')
      regrasAplicadasArquivo.add('v032')

      // ===== REGRAS DE NORMALIZAÇÃO =====

      // REGRA v001: Limpeza nome cliente - CEDI unificação
      console.log('  ⚡ Aplicando v001 - Limpeza nome cliente CEDI')
      await supabase.from('volumetria_mobilemed')
        .update({ EMPRESA: 'CEDIDIAG' })
        .eq('arquivo_fonte', arquivoAtual)
        .in('EMPRESA', ['CEDI-RJ','CEDI-RO','CEDI-UNIMED','CEDI_RJ','CEDI_RO','CEDI_UNIMED'])
      regrasAplicadasArquivo.add('v001')

      // REGRA v001b: Normalizar sufixo _TELE (ex: CLINICA_CRL_TELE -> CLINICA_CRL)
      console.log('  ⚡ Aplicando v001b - Normalizar sufixo _TELE')
      const { data: clientesTele } = await supabase
        .from('volumetria_mobilemed')
        .select('"EMPRESA"')
        .eq('arquivo_fonte', arquivoAtual)
        .like('EMPRESA', '%_TELE')
      
      if (clientesTele && clientesTele.length > 0) {
        const empresasUnicas = [...new Set(clientesTele.map((c: any) => c.EMPRESA).filter(Boolean))]
        for (const empresaTele of empresasUnicas) {
          if (empresaTele && empresaTele.endsWith('_TELE')) {
            const empresaNormalizada = empresaTele.replace(/_TELE$/, '')
            await supabase.from('volumetria_mobilemed')
              .update({ EMPRESA: empresaNormalizada })
              .eq('arquivo_fonte', arquivoAtual)
              .eq('EMPRESA', empresaTele)
            console.log(`    📝 ${empresaTele} → ${empresaNormalizada}`)
          }
        }
      }
      regrasAplicadasArquivo.add('v001b')

      // REGRA v001c: Normalização de nomes de médicos (via mapeamento_nomes_medicos)
      console.log('  ⚡ Aplicando v001c - Normalização nomes médicos')
      const { data: mapeamentoMedicos } = await supabase
        .from('mapeamento_nomes_medicos')
        .select('nome_origem_normalizado, medico_nome')
        .eq('ativo', true)
      
      if (mapeamentoMedicos && mapeamentoMedicos.length > 0) {
        let totalMedicosNormalizados = 0
        for (const mapeamento of mapeamentoMedicos) {
          if (mapeamento.nome_origem_normalizado && mapeamento.medico_nome) {
            const { count } = await supabase
              .from('volumetria_mobilemed')
              .update({ MEDICO: mapeamento.medico_nome, updated_at: new Date().toISOString() })
              .eq('arquivo_fonte', arquivoAtual)
              .ilike('MEDICO', mapeamento.nome_origem_normalizado)
              .select('*', { count: 'exact', head: true })
            
            if (count && count > 0) {
              totalMedicosNormalizados += count
              console.log(`    📝 ${mapeamento.nome_origem_normalizado} → ${mapeamento.medico_nome} (${count})`)
            }
          }
        }
        if (totalMedicosNormalizados > 0) {
          console.log(`  ✅ v001c: ${totalMedicosNormalizados} médicos normalizados`)
        }
      } else {
        console.log('  ℹ️ v001c: Nenhum mapeamento de médicos configurado')
      }
      regrasAplicadasArquivo.add('v001c')

      // REGRA v001d: De-Para valores zerados (via valores_referencia_de_para)
      console.log('  ⚡ Aplicando v001d - De-Para valores zerados')
      const { data: valoresReferencia } = await supabase
        .from('valores_referencia_de_para')
        .select('estudo_descricao, valores')
        .eq('ativo', true)
      
      if (valoresReferencia && valoresReferencia.length > 0) {
        let totalValoresAtualizados = 0
        for (const ref of valoresReferencia) {
          if (ref.estudo_descricao && ref.valores && ref.valores > 0) {
            const { count } = await supabase
              .from('volumetria_mobilemed')
              .update({ VALOR: ref.valores, updated_at: new Date().toISOString() })
              .eq('arquivo_fonte', arquivoAtual)
              .ilike('ESTUDO_DESCRICAO', ref.estudo_descricao)
              .or('VALOR.is.null,VALOR.eq.0')
              .select('*', { count: 'exact', head: true })
            
            if (count && count > 0) {
              totalValoresAtualizados += count
            }
          }
        }
        if (totalValoresAtualizados > 0) {
          console.log(`  ✅ v001d: ${totalValoresAtualizados} valores atualizados via de-para`)
        }
      } else {
        console.log('  ℹ️ v001d: Nenhum valor de-para configurado')
      }
      regrasAplicadasArquivo.add('v001d')

      // REGRA v005: Correções modalidade RX/MG/MR/DO baseadas no cadastro_exames
      console.log('  ⚡ Aplicando v005 - Correções modalidade baseadas no cadastro_exames')
      
      // Buscar exames cadastrados com especialidades MAMO e MAMA
      const { data: examesMAMO } = await supabase
        .from('cadastro_exames')
        .select('nome')
        .eq('especialidade', 'MAMO')
        .eq('ativo', true)
      
      const { data: examesMAMA } = await supabase
        .from('cadastro_exames')
        .select('nome')
        .eq('especialidade', 'MAMA')
        .eq('ativo', true)
      
      // Converter CR/DX para MG (exames de MAMO - Mamografia/Tomossíntese)
      if (examesMAMO && examesMAMO.length > 0) {
        let totalMG = 0
        for (const exame of examesMAMO) {
          if (exame.nome) {
            const { count } = await supabase
              .from('volumetria_mobilemed')
              .update({ MODALIDADE: 'MG', updated_at: new Date().toISOString() })
              .eq('arquivo_fonte', arquivoAtual)
              .in('MODALIDADE', ['CR', 'DX'])
              .ilike('ESTUDO_DESCRICAO', exame.nome)
              .select('*', { count: 'exact', head: true })
            
            if (count && count > 0) {
              totalMG += count
              console.log(`    📝 CR/DX → MG (MAMO): ${exame.nome} (${count})`)
            }
          }
        }
        if (totalMG > 0) {
          console.log(`  ✅ v005a: ${totalMG} registros CR/DX → MG (especialidade MAMO)`)
        }
      }
      
      // Converter CR/DX para MR (exames de MAMA - ex: RM MAMAS)
      if (examesMAMA && examesMAMA.length > 0) {
        let totalMR = 0
        for (const exame of examesMAMA) {
          if (exame.nome) {
            const { count } = await supabase
              .from('volumetria_mobilemed')
              .update({ MODALIDADE: 'MR', updated_at: new Date().toISOString() })
              .eq('arquivo_fonte', arquivoAtual)
              .in('MODALIDADE', ['CR', 'DX'])
              .ilike('ESTUDO_DESCRICAO', exame.nome)
              .select('*', { count: 'exact', head: true })
            
            if (count && count > 0) {
              totalMR += count
              console.log(`    📝 CR/DX → MR (MAMA): ${exame.nome} (${count})`)
            }
          }
        }
        if (totalMR > 0) {
          console.log(`  ✅ v005b: ${totalMR} registros CR/DX → MR (especialidade MAMA)`)
        }
      }
      
      // Converter CR/DX restantes para RX (exames que não são MAMO nem MAMA)
      const { count: countRX } = await supabase
        .from('volumetria_mobilemed')
        .update({ MODALIDADE: 'RX', updated_at: new Date().toISOString() })
        .eq('arquivo_fonte', arquivoAtual)
        .in('MODALIDADE', ['CR', 'DX'])
        .select('*', { count: 'exact', head: true })
      
      if (countRX && countRX > 0) {
        console.log(`  ✅ v005c: ${countRX} registros CR/DX → RX (outros exames)`)
      }

      // Converter OT para DO (Densitometria Óssea)
      await supabase.from('volumetria_mobilemed')
        .update({ MODALIDADE: 'DO', updated_at: new Date().toISOString() })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('MODALIDADE', 'OT')
      
      // Converter BMD para DO (Densitometria Óssea)
      await supabase.from('volumetria_mobilemed')
        .update({ MODALIDADE: 'DO', updated_at: new Date().toISOString() })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('MODALIDADE', 'BMD')
      
      regrasAplicadasArquivo.add('v005')

      // REGRA v007: Correções de especialidades problemáticas
      console.log('  ⚡ Aplicando v007 - Correções especialidades problemáticas')
      
      // ANGIOTCS → MEDICINA INTERNA
      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'MEDICINA INTERNA' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('ESPECIALIDADE', 'ANGIOTCS')
      
      // CABEÇA-PESCOÇO → NEURO
      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'NEURO' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('ESPECIALIDADE', 'CABEÇA-PESCOÇO')
      
      // TÓRAX → MEDICINA INTERNA
      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'MEDICINA INTERNA' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('ESPECIALIDADE', 'TÓRAX')
      
      // CORPO → MEDICINA INTERNA
      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'MEDICINA INTERNA' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('ESPECIALIDADE', 'CORPO')
      
      // MODALIDADE DO → ESPECIALIDADE D.O (Densitometria Óssea)
      // Exames de modalidade DO devem ter especialidade D.O, não MUSCULO ESQUELETICO
      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'D.O' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('MODALIDADE', 'DO')
      
      // TOMOGRAFIA → MEDICINA INTERNA
      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'MEDICINA INTERNA' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('ESPECIALIDADE', 'TOMOGRAFIA')
      
      // CARDIO COM SCORE → CARDIO
      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'CARDIO' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('ESPECIALIDADE', 'CARDIO COM SCORE')
      
      // NOTA: Colunas NÃO é convertido aqui - v034 cuida de toda a lógica
      // v034 aplica: Neurologista → NEURO+SC, Outros → MUSCULO ESQUELETICO

      // ONCO MEDICINA INTERNA → MEDICINA INTERNA
      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'MEDICINA INTERNA' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('ESPECIALIDADE', 'ONCO MEDICINA INTERNA')
      regrasAplicadasArquivo.add('v007')

      // ===== REGRA v034: Colunas x Músculo x Neuro (APÓS v007) =====
      // Se o médico é neurologista, sobrescreve para NEURO + SC
      console.log('  ⚡ Aplicando v034 - Colunas → NEURO para neurologistas')
      try {
        const { data: v034Result, error: v034Error } = await supabase.functions.invoke(
          'aplicar-regra-colunas-musculo-neuro',
          { body: { arquivo_fonte: arquivoAtual } }
        )
        
        if (v034Error) {
          console.error('❌ Erro ao aplicar v034:', v034Error)
        } else if (v034Result) {
          console.log(`✅ v034: ${v034Result.total_alterados_neuro} → NEURO+SC, ${v034Result.total_alterados_musculo} → MUSCULO ESQUELETICO`)
          regrasAplicadasArquivo.add('v034')
        }
      } catch (v034Err) {
        console.error('❌ Erro ao chamar v034:', v034Err)
      }

      // REGRA v044: Correção MAMA → MAMO para modalidade MG
      // MAMA é reservado para RM MAMAS (modalidade MR), mamografias devem ter MAMO
      console.log('  ⚡ Aplicando v044 - Correção MAMA → MAMO (modalidade MG)')
      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'MAMO' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('MODALIDADE', 'MG')
        .eq('ESPECIALIDADE', 'MAMA')
      regrasAplicadasArquivo.add('v044')

      // REGRA v008: De-Para Prioridades
      console.log('  ⚡ Aplicando v008 - De-Para Prioridades')
      
      // Aplicar mapeamento de prioridades usando tabela valores_prioridade_de_para
      const { data: prioridadesDePara } = await supabase
        .from('valores_prioridade_de_para')
        .select('prioridade_original, nome_final')
        .eq('ativo', true)
      
      if (prioridadesDePara && prioridadesDePara.length > 0) {
        for (const mapeamento of prioridadesDePara) {
          await supabase.from('volumetria_mobilemed')
            .update({ PRIORIDADE: mapeamento.nome_final })
            .eq('arquivo_fonte', arquivoAtual)
            .eq('PRIORIDADE', mapeamento.prioridade_original)
        }
      }
      regrasAplicadasArquivo.add('v008')
      console.log('  ⚡ Aplicando v009 - Prioridade padrão')
      await supabase.from('volumetria_mobilemed')
        .update({ PRIORIDADE: 'ROTINA' })
        .eq('arquivo_fonte', arquivoAtual)
        .or('PRIORIDADE.is.null,PRIORIDADE.eq.')
      regrasAplicadasArquivo.add('v009')

      // REGRA v010: Mapeamento de nomes de clientes
      console.log('  ⚡ Aplicando v010 - Mapeamento nomes clientes')
      await supabase.from('volumetria_mobilemed')
        .update({ EMPRESA: 'HOSPITAL SANTA HELENA' })
        .eq('arquivo_fonte', arquivoAtual)
        .like('EMPRESA', '%SANTA HELENA%')
      regrasAplicadasArquivo.add('v010')

      // REGRA v010a: Conversão P-CEMVALENCA_MG para CEMVALENCA
      console.log('  ⚡ Aplicando v010a - Conversão P-CEMVALENCA_MG')
      await supabase.from('volumetria_mobilemed')
        .update({ EMPRESA: 'CEMVALENCA' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('EMPRESA', 'P-CEMVALENCA_MG')
      regrasAplicadasArquivo.add('v010a')

      // REGRA v010b: Separação automática CEMVALENCA
      console.log('  ⚡ Aplicando v010b - Separação CEMVALENCA (PLANTÃO/RX/Principal)')
      
      // Corrigir nome legado CEMVALENCA_PLANTÃO -> CEMVALENCA_PL
      await supabase.from('volumetria_mobilemed')
        .update({ EMPRESA: 'CEMVALENCA_PL' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('EMPRESA', 'CEMVALENCA_PLANTÃO')
      
      // Corrigir legado P-CEMVALENCA_PL (com ou sem espaço) -> CEMVALENCA_PL
      await supabase.from('volumetria_mobilemed')
        .update({ EMPRESA: 'CEMVALENCA_PL' })
        .eq('arquivo_fonte', arquivoAtual)
        .or('EMPRESA.eq.P-CEMVALENCA_PL,EMPRESA.eq.P- CEMVALENCA_PL')
      
      // Corrigir legado P-CEMVALENCA_RX -> CEMVALENCA_RX
      await supabase.from('volumetria_mobilemed')
        .update({ EMPRESA: 'CEMVALENCA_RX' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('EMPRESA', 'P-CEMVALENCA_RX')
      
      // Separar PLANTÃO para CEMVALENCA_PL (qualquer prioridade com PLANTÃO/PLANTAO)
      await supabase.from('volumetria_mobilemed')
        .update({ EMPRESA: 'CEMVALENCA_PL' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('EMPRESA', 'CEMVALENCA')
        .or('PRIORIDADE.ilike.%PLANTÃO%,PRIORIDADE.ilike.%PLANTAO%,PRIORIDADE.eq.PLANTÃO')
      
      // Separar RX para CEMVALENCA_RX (TODOS os RX que não são PLANTÃO)
      await supabase.from('volumetria_mobilemed')
        .update({ EMPRESA: 'CEMVALENCA_RX' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('EMPRESA', 'CEMVALENCA')
        .eq('MODALIDADE', 'RX')
        .not('PRIORIDADE', 'ilike', '%PLANTÃO%')
        .not('PRIORIDADE', 'ilike', '%PLANTAO%')
      
      // CEMVALENCA permanece com as demais modalidades (CT, RM, US, MG, DO) que não são PLANTÃO
      
      regrasAplicadasArquivo.add('v010b')

      // v010c: Agrupar todos DIAGNOSTICA PLANTAO_* como DIAGNOSTICA
      await supabase.from('volumetria_mobilemed')
        .update({ EMPRESA: 'DIAGNOSTICA' })
        .eq('arquivo_fonte', arquivoAtual)
        .ilike('EMPRESA', 'DIAGNOSTICA PLANTAO_%')
      
      regrasAplicadasArquivo.add('v010c')

      // REGRA v011: Processamento de Categorias de Exames
      // Critério: Processa e categoriza exames com base na tabela cadastro_exames
      // TODOS os exames estão no cadastro e TODOS possuem categoria definida (incluindo "SC")
      // NÃO há fallback - categoria vem exclusivamente do cadastro_exames
      console.log('  ⚡ Aplicando v011 - Processamento de Categorias de Exames')
      
      // Buscar categorias do cadastro de exames
      const { data: examesComCategoria } = await supabase
        .from('cadastro_exames')
        .select('nome, categoria')
        .eq('ativo', true)
        .not('categoria', 'is', null)
      
      if (examesComCategoria && examesComCategoria.length > 0) {
        // Buscar registros sem categoria para este arquivo
        const { data: registrosSemCategoria } = await supabase
          .from('volumetria_mobilemed')
          .select('id, ESTUDO_DESCRICAO')
          .eq('arquivo_fonte', arquivoAtual)
          .or('CATEGORIA.is.null,CATEGORIA.eq.')
        
        if (registrosSemCategoria && registrosSemCategoria.length > 0) {
          // Criar mapa de nome -> categoria
          const mapaCategorias = new Map<string, string>()
          for (const exame of examesComCategoria) {
            if (exame.categoria) {
              mapaCategorias.set(exame.nome.toUpperCase().trim(), exame.categoria)
            }
          }
          
          // Agrupar por categoria para updates em batch
          const updatesPorCategoria = new Map<string, string[]>()
          let naoEncontradosNoCadastro = 0
          
          for (const registro of registrosSemCategoria) {
            const nomeExame = registro.ESTUDO_DESCRICAO?.toUpperCase().trim() || ''
            const categoria = mapaCategorias.get(nomeExame)
            
            if (categoria) {
              if (!updatesPorCategoria.has(categoria)) {
                updatesPorCategoria.set(categoria, [])
              }
              updatesPorCategoria.get(categoria)!.push(registro.id)
            } else {
              // Exame não encontrado no cadastro - NÃO aplicar fallback
              // Isso indica um exame "fora do padrão" que precisa ser cadastrado
              naoEncontradosNoCadastro++
            }
          }
          
          // Aplicar updates por categoria (vindas do cadastro_exames)
          for (const [categoria, ids] of updatesPorCategoria) {
            if (ids.length > 0) {
              // Processar em batches de 500
              for (let i = 0; i < ids.length; i += 500) {
                const batch = ids.slice(i, i + 500)
                await supabase.from('volumetria_mobilemed')
                  .update({ CATEGORIA: categoria, updated_at: new Date().toISOString() })
                  .in('id', batch)
              }
            }
          }
          
          const totalCategorizados = Array.from(updatesPorCategoria.values()).reduce((sum, ids) => sum + ids.length, 0)
          console.log(`    v011: Categorias aplicadas do cadastro: ${totalCategorizados} registros`)
          console.log(`    v011: Categorias distintas: ${updatesPorCategoria.size}`)
          if (naoEncontradosNoCadastro > 0) {
            console.log(`    v011: AVISO - ${naoEncontradosNoCadastro} exames não encontrados no cadastro (fora do padrão)`)
          }
        }
      }
      regrasAplicadasArquivo.add('v011')

      // REGRA v012: Aplicação especialidade automática por modalidade
      console.log('  ⚡ Aplicando v012 - Especialidade automática RX')
      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'RX' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('MODALIDADE', 'RX')
        .or('ESPECIALIDADE.is.null,ESPECIALIDADE.eq.')
      regrasAplicadasArquivo.add('v012')

      // REGRA v013: Especialidade automática CT
      console.log('  ⚡ Aplicando v013 - Especialidade automática CT')
      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'CT' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('MODALIDADE', 'CT')
        .or('ESPECIALIDADE.is.null,ESPECIALIDADE.eq.')
      regrasAplicadasArquivo.add('v013')

      // REGRA v014: Especialidade automática RM
      console.log('  ⚡ Aplicando v014 - Especialidade automática RM')
      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'RM' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('MODALIDADE', 'MR')
        .or('ESPECIALIDADE.is.null,ESPECIALIDADE.eq.')
      regrasAplicadasArquivo.add('v014')

      // REGRA v015: Aplicação de status
      console.log('  ⚡ Aplicando v015 - Status padrão')
      await supabase.from('volumetria_mobilemed')
        .update({ STATUS: 'PROCESSADO' })
        .eq('arquivo_fonte', arquivoAtual)
        .or('STATUS.is.null,STATUS.eq.')
      regrasAplicadasArquivo.add('v015')

      // REGRA v016: Aplicação período de referência
      console.log('  ⚡ Aplicando v016 - Período referência')
      await supabase.from('volumetria_mobilemed')
        .update({ PERIODO_REFERENCIA: periodo_referencia.replace('/', '/20') })
        .eq('arquivo_fonte', arquivoAtual)
        .or('PERIODO_REFERENCIA.is.null,PERIODO_REFERENCIA.eq.')
      regrasAplicadasArquivo.add('v016')

      // REGRA v018: Aplicação de-para prioridades URGENTE
      console.log('  ⚡ Aplicando v018 - De-para prioridades URGENTE')
      await supabase.from('volumetria_mobilemed')
        .update({ PRIORIDADE: 'URGENTE' })
        .eq('arquivo_fonte', arquivoAtual)
        .in('PRIORIDADE', ['EMERGENCIA', 'STAT'])
      regrasAplicadasArquivo.add('v018')

      // REGRA v019: De-para prioridades ROTINA
      console.log('  ⚡ Aplicando v019 - De-para prioridades ROTINA')
      await supabase.from('volumetria_mobilemed')
        .update({ PRIORIDADE: 'ROTINA' })
        .eq('arquivo_fonte', arquivoAtual)
        .in('PRIORIDADE', ['NORMAL', 'REGULAR'])
      regrasAplicadasArquivo.add('v019')

      // REGRA v020: Correção modalidade mamografia
      console.log('  ⚡ Aplicando v020 - Correção modalidade mamografia')
      await supabase.from('volumetria_mobilemed')
        .update({ MODALIDADE: 'MG' })
        .eq('arquivo_fonte', arquivoAtual)
        .like('ESTUDO_DESCRICAO', '%mamograf%')
      regrasAplicadasArquivo.add('v020')

      // REGRA v021: Aplicação categoria baseada em exame oncologia
      console.log('  ⚡ Aplicando v021 - Categoria oncologia')
      await supabase.from('volumetria_mobilemed')
        .update({ CATEGORIA: 'ONCOLOGIA' })
        .eq('arquivo_fonte', arquivoAtual)
        .like('ESTUDO_DESCRICAO', '%onco%')
      regrasAplicadasArquivo.add('v021')

      // REGRA v022: REMOVIDA - Categoria PEDIATRIA não existe no sistema
      console.log('  ℹ️ Regra v022 removida - PEDIATRIA não é categoria válida')

      // REGRA v023: Correção valores nulos
      console.log('  ⚡ Aplicando v023 - Correção valores nulos')
      await supabase.from('volumetria_mobilemed')
        .update({ VALORES: 1 })
        .eq('arquivo_fonte', arquivoAtual)
        .or('VALORES.is.null,VALORES.eq.0')
      regrasAplicadasArquivo.add('v023')

      // REGRA v024: Aplicação duplicado padrão
      console.log('  ⚡ Aplicando v024 - Duplicado padrão')
      await supabase.from('volumetria_mobilemed')
        .update({ DUPLICADO: 'NAO' })
        .eq('arquivo_fonte', arquivoAtual)
        .or('DUPLICADO.is.null,DUPLICADO.eq.')
      regrasAplicadasArquivo.add('v024')

      // REGRA v025: REMOVIDA - tipo_faturamento será aplicado pela função aplicar-tipificacao-faturamento
      // O campo tipo_faturamento deve conter apenas tipos válidos de cliente (CO-FT, CO-NF, NC-FT, NC-NF, NC1-NF)
      console.log('  ℹ️ Regra v025 removida - tipo_faturamento será aplicado do contrato')

      console.log(`  ✅ Aplicadas ${regrasAplicadasArquivo.size} regras para ${arquivoAtual}`)

      // ========================================================
      // REGRA v031 (CRÍTICA): Aplicação de MODALIDADE/ESPECIALIDADE/CATEGORIA baseada no cadastro_exames
      // Esta é a ÚLTIMA regra antes da quebra, garantindo que os dados do cadastro sobrescrevam qualquer valor incorreto
      // ========================================================
      console.log('  ⚡ Aplicando v031 - Dados do cadastro_exames (MODALIDADE/ESPECIALIDADE/CATEGORIA)')
      
      try {
        // Buscar cadastro de exames com todas as informações
        const { data: cadastroExames, error: cadastroError } = await supabase
          .from('cadastro_exames')
          .select('nome, modalidade, especialidade, categoria')
          .eq('ativo', true)

        if (cadastroError) {
          console.error('❌ Erro ao buscar cadastro de exames:', cadastroError)
        } else if (cadastroExames && cadastroExames.length > 0) {
          console.log(`  📚 Carregados ${cadastroExames.length} exames no cadastro`)

          // Criar mapa de exames para busca eficiente (nome do exame como chave)
          const mapaExames = new Map()
          cadastroExames.forEach(exame => {
            const key = exame.nome.toUpperCase().trim()
            mapaExames.set(key, {
              modalidade: exame.modalidade,
              especialidade: exame.especialidade,
              categoria: exame.categoria
            })
          })

          // Buscar TODOS os registros do arquivo para verificar
          const { data: registros, error: selectError } = await supabase
            .from('volumetria_mobilemed')
            .select('id, "ESTUDO_DESCRICAO", "MODALIDADE", "ESPECIALIDADE", "CATEGORIA"')
            .eq('arquivo_fonte', arquivoAtual)

          if (selectError) {
            console.error('❌ Erro ao buscar registros para v031:', selectError)
          } else if (registros && registros.length > 0) {
            let totalAtualizadosCadastro = 0
            
            // Processar em lotes de 50
            const batchSize = 50
            for (let i = 0; i < registros.length; i += batchSize) {
              const lote = registros.slice(i, i + batchSize)
              
              for (const registro of lote) {
                const nomeExame = registro.ESTUDO_DESCRICAO?.toUpperCase().trim()
                const dadosCadastro = mapaExames.get(nomeExame)
                
                if (dadosCadastro) {
                  // Verificar se precisa atualizar
                  const precisaAtualizar = 
                    registro.MODALIDADE !== dadosCadastro.modalidade ||
                    registro.ESPECIALIDADE !== dadosCadastro.especialidade ||
                    registro.CATEGORIA !== dadosCadastro.categoria

                  if (precisaAtualizar) {
                    await supabase
                      .from('volumetria_mobilemed')
                      .update({
                        'MODALIDADE': dadosCadastro.modalidade,
                        'ESPECIALIDADE': dadosCadastro.especialidade,
                        'CATEGORIA': dadosCadastro.categoria,
                        updated_at: new Date().toISOString()
                      })
                      .eq('id', registro.id)
                    
                    totalAtualizadosCadastro++
                  }
                }
              }
            }
            
            console.log(`  ✅ v031: ${totalAtualizadosCadastro} registros atualizados com dados do cadastro`)
          }
        }
        regrasAplicadasArquivo.add('v031')
      } catch (v031Err) {
        console.error('❌ Erro ao aplicar v031 (cadastro_exames):', v031Err)
      }

      // APLICAR QUEBRA DE EXAMES AUTOMATICAMENTE
      console.log('  ⚡ Aplicando quebra de exames automática')
      try {
        const { data: quebraResult, error: quebraError } = await supabase.functions.invoke(
          'aplicar-regras-quebra-exames',
          { body: { arquivo_fonte: arquivoAtual } }
        )
        
        if (quebraError) {
          console.error('❌ Erro ao aplicar quebra de exames:', quebraError)
        } else if (quebraResult) {
          console.log(`✅ Quebra de exames: ${quebraResult.registros_processados} processados, ${quebraResult.registros_quebrados} quebrados`)
          resultadosGerais.total_registros_quebrados += quebraResult.registros_quebrados || 0
        }
      } catch (quebraErr) {
        console.error('❌ Erro ao chamar quebra de exames:', quebraErr)
      }

      // Contar registros finais
      const { count: depoisCount } = await supabase
        .from('volumetria_mobilemed')
        .select('*', { count: 'exact', head: true })
        .eq('arquivo_fonte', arquivoAtual)

      const resultadoArquivo = {
        arquivo: arquivoAtual,
        registros_antes: antesCount,
        registros_depois: depoisCount || 0,
        registros_excluidos: (antesCount - (depoisCount || 0)),
        registros_atualizados: depoisCount || 0,
        registros_quebrados: 0,
        regras_aplicadas: Array.from(regrasAplicadasArquivo)
      }

      console.log(`✅ ${arquivoAtual}: ${resultadoArquivo.regras_aplicadas.length} regras aplicadas`)
      
      resultadosGerais.detalhes_por_arquivo.push(resultadoArquivo)
      resultadosGerais.total_arquivos_processados++
      resultadosGerais.total_registros_processados += antesCount
      resultadosGerais.total_registros_atualizados += resultadoArquivo.registros_atualizados
      
      // Adicionar regras ao total geral
      regrasAplicadasArquivo.forEach(regra => {
        if (!resultadosGerais.regras_aplicadas.includes(regra)) {
          resultadosGerais.regras_aplicadas.push(regra)
        }
      })
    }

    console.log('\n🎉 PROCESSAMENTO COMPLETO')
    console.log(`📁 Arquivos: ${resultadosGerais.total_arquivos_processados}`)
    console.log(`📊 Registros: ${resultadosGerais.total_registros_processados}`)
    console.log(`✅ Regras aplicadas: ${resultadosGerais.regras_aplicadas.join(', ')}`)

    return new Response(JSON.stringify({
      sucesso: true,
      message: `${resultadosGerais.regras_aplicadas.length} regras aplicadas com sucesso`,
      resultados: resultadosGerais
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('💥 Erro:', error)
    return new Response(JSON.stringify({ 
      sucesso: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})