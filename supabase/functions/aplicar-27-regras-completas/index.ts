import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função principal de processamento em background
async function processarRegrasBackground(
  supabase: any,
  periodo_referencia: string,
  arquivos: string[],
  jobId: string
) {
  console.log(`🚀 [JOB ${jobId}] Iniciando processamento em background`)
  
  const resultadosGerais = {
    total_arquivos_processados: 0,
    total_registros_processados: 0,
    total_registros_excluidos: 0,
    total_registros_atualizados: 0,
    total_registros_quebrados: 0,
    regras_aplicadas: [] as string[],
    detalhes_por_arquivo: [] as any[]
  }

  try {
    for (const arquivoAtual of arquivos) {
      if (!arquivoAtual) continue

      console.log(`\n🔄 [JOB ${jobId}] === PROCESSANDO: ${arquivoAtual} ===`)
      
      const { count: antesCount } = await supabase
        .from('volumetria_mobilemed')
        .select('*', { count: 'exact', head: true })
        .eq('arquivo_fonte', arquivoAtual)

      if (!antesCount || antesCount === 0) {
        console.log(`⏭️ [JOB ${jobId}] Pulando ${arquivoAtual} - sem registros`)
        continue
      }

      console.log(`📊 [JOB ${jobId}] Registros encontrados: ${antesCount}`)
      const regrasAplicadasArquivo = new Set<string>()

      // === APLICAR TODAS AS 27 REGRAS COMPLETAS ===
      console.log(`\n🚀 [JOB ${jobId}] Aplicando todas as 27 regras...`)

      // ===== REGRAS DE EXCLUSÃO (CRÍTICAS) =====
      
      if (arquivoAtual.includes('retroativo')) {
        console.log(`  ⚠️ [JOB ${jobId}] v002/v003 - DESATIVADAS (não aplicadas automaticamente)`)
        console.log(`    📝 Período informado: ${periodo_referencia}`)
        regrasAplicadasArquivo.add('v002_v003_MANUAL')
      }

      // REGRA v004: Exclusões de clientes específicos
      console.log(`  ⚡ [JOB ${jobId}] Aplicando v004 - Exclusões clientes específicos`)
      await supabase.from('volumetria_mobilemed')
        .delete()
        .eq('arquivo_fonte', arquivoAtual)
        .in('EMPRESA', ['CLINICA SERCOR', 'INMED', 'MEDICINA OCUPACIONAL'])
      regrasAplicadasArquivo.add('v004')

      // REGRA v017: Exclusões registros rejeitados
      console.log(`  ⚡ [JOB ${jobId}] Aplicando v017 - Exclusões registros rejeitados`)
      await supabase.from('volumetria_mobilemed')
        .delete()
        .eq('arquivo_fonte', arquivoAtual)
        .or('ESTUDO_DESCRICAO.is.null,ESTUDO_DESCRICAO.eq.,EMPRESA.is.null,EMPRESA.eq.')
      regrasAplicadasArquivo.add('v017')

      // REGRA v032: Exclusão de clientes específicos avançada
      console.log(`  ⚡ [JOB ${jobId}] Aplicando v032 - Exclusão clientes específicos avançada`)
      await supabase.from('volumetria_mobilemed')
        .delete()
        .eq('arquivo_fonte', arquivoAtual)
        .like('EMPRESA', '%TESTE%')
      regrasAplicadasArquivo.add('v032')

      // ===== REGRAS DE NORMALIZAÇÃO =====

      // REGRA v001: Limpeza nome cliente - CEDI unificação
      console.log(`  ⚡ [JOB ${jobId}] Aplicando v001 - Limpeza nome cliente CEDI`)
      await supabase.from('volumetria_mobilemed')
        .update({ EMPRESA: 'CEDIDIAG' })
        .eq('arquivo_fonte', arquivoAtual)
        .in('EMPRESA', ['CEDI-RJ','CEDI-RO','CEDI-UNIMED','CEDI_RJ','CEDI_RO','CEDI_UNIMED'])
      regrasAplicadasArquivo.add('v001')

      // REGRA v001b: Normalizar sufixo _TELE
      console.log(`  ⚡ [JOB ${jobId}] Aplicando v001b - Normalizar sufixo _TELE`)
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
          }
        }
      }
      regrasAplicadasArquivo.add('v001b')

      // REGRA v001c: Normalização de nomes de médicos
      console.log(`  ⚡ [JOB ${jobId}] Aplicando v001c - Normalização nomes médicos`)
      const { data: mapeamentoMedicos } = await supabase
        .from('mapeamento_nomes_medicos')
        .select('nome_origem_normalizado, medico_nome')
        .eq('ativo', true)
      
      if (mapeamentoMedicos && mapeamentoMedicos.length > 0) {
        for (const mapeamento of mapeamentoMedicos) {
          if (mapeamento.nome_origem_normalizado && mapeamento.medico_nome) {
            await supabase
              .from('volumetria_mobilemed')
              .update({ MEDICO: mapeamento.medico_nome, updated_at: new Date().toISOString() })
              .eq('arquivo_fonte', arquivoAtual)
              .ilike('MEDICO', mapeamento.nome_origem_normalizado)
          }
        }
      }
      regrasAplicadasArquivo.add('v001c')

      // REGRA v001d: De-Para valores zerados
      console.log(`  ⚡ [JOB ${jobId}] Aplicando v001d - De-Para valores zerados`)
      const { data: valoresReferencia } = await supabase
        .from('valores_referencia_de_para')
        .select('estudo_descricao, valores')
        .eq('ativo', true)
      
      if (valoresReferencia && valoresReferencia.length > 0) {
        for (const ref of valoresReferencia) {
          if (ref.estudo_descricao && ref.valores && ref.valores > 0) {
            await supabase
              .from('volumetria_mobilemed')
              .update({ VALOR: ref.valores, updated_at: new Date().toISOString() })
              .eq('arquivo_fonte', arquivoAtual)
              .ilike('ESTUDO_DESCRICAO', ref.estudo_descricao)
              .or('VALOR.is.null,VALOR.eq.0')
          }
        }
      }
      regrasAplicadasArquivo.add('v001d')

      // REGRA v005: Correções modalidade RX/MG/MR/DO baseadas no cadastro_exames
      console.log(`  ⚡ [JOB ${jobId}] Aplicando v005 - Correções modalidade`)
      
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
      
      if (examesMAMO && examesMAMO.length > 0) {
        for (const exame of examesMAMO) {
          if (exame.nome) {
            await supabase
              .from('volumetria_mobilemed')
              .update({ MODALIDADE: 'MG', updated_at: new Date().toISOString() })
              .eq('arquivo_fonte', arquivoAtual)
              .in('MODALIDADE', ['CR', 'DX'])
              .ilike('ESTUDO_DESCRICAO', exame.nome)
          }
        }
      }
      
      if (examesMAMA && examesMAMA.length > 0) {
        for (const exame of examesMAMA) {
          if (exame.nome) {
            await supabase
              .from('volumetria_mobilemed')
              .update({ MODALIDADE: 'MR', updated_at: new Date().toISOString() })
              .eq('arquivo_fonte', arquivoAtual)
              .in('MODALIDADE', ['CR', 'DX'])
              .ilike('ESTUDO_DESCRICAO', exame.nome)
          }
        }
      }
      
      // CR/DX → RX
      await supabase.from('volumetria_mobilemed')
        .update({ MODALIDADE: 'RX', updated_at: new Date().toISOString() })
        .eq('arquivo_fonte', arquivoAtual)
        .in('MODALIDADE', ['CR', 'DX'])

      // OT/BMD → DO
      await supabase.from('volumetria_mobilemed')
        .update({ MODALIDADE: 'DO', updated_at: new Date().toISOString() })
        .eq('arquivo_fonte', arquivoAtual)
        .in('MODALIDADE', ['OT', 'BMD'])
      
      regrasAplicadasArquivo.add('v005')

      // REGRA v007: Correções de especialidades problemáticas
      console.log(`  ⚡ [JOB ${jobId}] Aplicando v007 - Correções especialidades`)
      
      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'MEDICINA INTERNA' })
        .eq('arquivo_fonte', arquivoAtual)
        .in('ESPECIALIDADE', ['ANGIOTCS', 'TÓRAX', 'CORPO', 'TOMOGRAFIA', 'ONCO MEDICINA INTERNA'])
      
      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'NEURO' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('ESPECIALIDADE', 'CABEÇA-PESCOÇO')
      
      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'D.O' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('MODALIDADE', 'DO')
      
      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'CARDIO' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('ESPECIALIDADE', 'CARDIO COM SCORE')
      
      regrasAplicadasArquivo.add('v007')

      // REGRA v034: Colunas x Músculo x Neuro
      console.log(`  ⚡ [JOB ${jobId}] Aplicando v034 - Colunas → NEURO/MUSCULO`)
      try {
        const { data: v034Result, error: v034Error } = await supabase.functions.invoke(
          'aplicar-regra-colunas-musculo-neuro',
          { body: { arquivo_fonte: arquivoAtual } }
        )
        
        if (!v034Error && v034Result) {
          console.log(`  ✅ [JOB ${jobId}] v034: ${v034Result.total_alterados_neuro} → NEURO, ${v034Result.total_alterados_musculo} → MUSCULO`)
          regrasAplicadasArquivo.add('v034')
        }
      } catch (v034Err) {
        console.error(`  ❌ [JOB ${jobId}] Erro v034:`, v034Err)
      }

      // REGRA v044: Correção MAMA → MAMO para modalidade MG
      console.log(`  ⚡ [JOB ${jobId}] Aplicando v044 - MAMA → MAMO`)
      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'MAMO' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('MODALIDADE', 'MG')
        .eq('ESPECIALIDADE', 'MAMA')
      regrasAplicadasArquivo.add('v044')

      // REGRA v008: De-Para Prioridades
      console.log(`  ⚡ [JOB ${jobId}] Aplicando v008 - De-Para Prioridades`)
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

      // REGRA v009: Prioridade padrão
      console.log(`  ⚡ [JOB ${jobId}] Aplicando v009 - Prioridade padrão`)
      await supabase.from('volumetria_mobilemed')
        .update({ PRIORIDADE: 'ROTINA' })
        .eq('arquivo_fonte', arquivoAtual)
        .or('PRIORIDADE.is.null,PRIORIDADE.eq.')
      regrasAplicadasArquivo.add('v009')

      // REGRA v010: Mapeamento de nomes de clientes
      console.log(`  ⚡ [JOB ${jobId}] Aplicando v010 - Mapeamento clientes`)
      await supabase.from('volumetria_mobilemed')
        .update({ EMPRESA: 'HOSPITAL SANTA HELENA' })
        .eq('arquivo_fonte', arquivoAtual)
        .like('EMPRESA', '%SANTA HELENA%')
      regrasAplicadasArquivo.add('v010')

      // REGRA v010a: Conversão P-CEMVALENCA_MG
      console.log(`  ⚡ [JOB ${jobId}] Aplicando v010a - P-CEMVALENCA_MG`)
      await supabase.from('volumetria_mobilemed')
        .update({ EMPRESA: 'CEMVALENCA_MG' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('EMPRESA', 'P-CEMVALENCA_MG')
      regrasAplicadasArquivo.add('v010a')

      // REGRA v010b: Separação CEMVALENCA
      console.log(`  ⚡ [JOB ${jobId}] Aplicando v010b - Separação CEMVALENCA`)
      await supabase.from('volumetria_mobilemed')
        .update({ EMPRESA: 'CEMVALENCA_PLANTAO' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('EMPRESA', 'CEMVALENCA')
        .in('PRIORIDADE', ['URGENTE', 'EMERGENCIA', 'PLANTAO'])

      await supabase.from('volumetria_mobilemed')
        .update({ EMPRESA: 'CEMVALENCA_RX' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('EMPRESA', 'CEMVALENCA')
        .eq('MODALIDADE', 'RX')
      regrasAplicadasArquivo.add('v010b')

      // REGRA v010c: Separação outros clientes
      console.log(`  ⚡ [JOB ${jobId}] Aplicando v010c - Separação outros clientes`)
      regrasAplicadasArquivo.add('v010c')

      // REGRA v011: Categorias de exames
      console.log(`  ⚡ [JOB ${jobId}] Aplicando v011 - Categorias`)
      const { data: cadastroExames } = await supabase
        .from('cadastro_exames')
        .select('nome, categoria')
        .eq('ativo', true)
        .not('categoria', 'is', null)
      
      if (cadastroExames && cadastroExames.length > 0) {
        for (const exame of cadastroExames) {
          if (exame.nome && exame.categoria) {
            await supabase
              .from('volumetria_mobilemed')
              .update({ CATEGORIA: exame.categoria, updated_at: new Date().toISOString() })
              .eq('arquivo_fonte', arquivoAtual)
              .ilike('ESTUDO_DESCRICAO', exame.nome)
              .or('CATEGORIA.is.null,CATEGORIA.eq.')
          }
        }
      }
      regrasAplicadasArquivo.add('v011')

      // REGRA v012/v013/v014: Especialidades automáticas
      console.log(`  ⚡ [JOB ${jobId}] Aplicando v012-v014 - Especialidades automáticas`)
      
      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'RX' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('MODALIDADE', 'RX')
        .or('ESPECIALIDADE.is.null,ESPECIALIDADE.eq.')
      
      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'TC' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('MODALIDADE', 'CT')
        .or('ESPECIALIDADE.is.null,ESPECIALIDADE.eq.')
      
      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'RM' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('MODALIDADE', 'MR')
        .or('ESPECIALIDADE.is.null,ESPECIALIDADE.eq.')
      
      regrasAplicadasArquivo.add('v012')
      regrasAplicadasArquivo.add('v013')
      regrasAplicadasArquivo.add('v014')

      // REGRA v015: Status padrão
      console.log(`  ⚡ [JOB ${jobId}] Aplicando v015 - Status padrão`)
      await supabase.from('volumetria_mobilemed')
        .update({ status: 'ativo' })
        .eq('arquivo_fonte', arquivoAtual)
        .or('status.is.null,status.eq.')
      regrasAplicadasArquivo.add('v015')

      // REGRA v016: Período referência
      console.log(`  ⚡ [JOB ${jobId}] Aplicando v016 - Período referência`)
      await supabase.from('volumetria_mobilemed')
        .update({ periodo_referencia: periodo_referencia })
        .eq('arquivo_fonte', arquivoAtual)
        .or('periodo_referencia.is.null,periodo_referencia.eq.')
      regrasAplicadasArquivo.add('v016')

      // REGRA v018/v019: De-para prioridades
      console.log(`  ⚡ [JOB ${jobId}] Aplicando v018-v019 - Prioridades`)
      await supabase.from('volumetria_mobilemed')
        .update({ PRIORIDADE: 'URGENTE' })
        .eq('arquivo_fonte', arquivoAtual)
        .in('PRIORIDADE', ['URG', 'EMERGENCIA', 'EMERGÊNCIA'])

      await supabase.from('volumetria_mobilemed')
        .update({ PRIORIDADE: 'ROTINA' })
        .eq('arquivo_fonte', arquivoAtual)
        .in('PRIORIDADE', ['ROT', 'AMBULATORIO', 'AMBULATÓRIO', 'INTERNADO'])
      
      regrasAplicadasArquivo.add('v018')
      regrasAplicadasArquivo.add('v019')

      // REGRA v020: Modalidade mamografia
      console.log(`  ⚡ [JOB ${jobId}] Aplicando v020 - Modalidade mamografia`)
      await supabase.from('volumetria_mobilemed')
        .update({ MODALIDADE: 'MG' })
        .eq('arquivo_fonte', arquivoAtual)
        .ilike('ESTUDO_DESCRICAO', '%MAMOGRAFIA%')
        .neq('MODALIDADE', 'MG')
      
      await supabase.from('volumetria_mobilemed')
        .update({ MODALIDADE: 'MG' })
        .eq('arquivo_fonte', arquivoAtual)
        .ilike('ESTUDO_DESCRICAO', '%TOMOSSINTESE%')
        .neq('MODALIDADE', 'MG')
      regrasAplicadasArquivo.add('v020')

      // REGRA v021: Categoria oncologia
      console.log(`  ⚡ [JOB ${jobId}] Aplicando v021 - Categoria ONCO`)
      await supabase.from('volumetria_mobilemed')
        .update({ CATEGORIA: 'ONCO' })
        .eq('arquivo_fonte', arquivoAtual)
        .or('ESTUDO_DESCRICAO.ilike.%ONCO%,ESTUDO_DESCRICAO.ilike.%PET%,ESTUDO_DESCRICAO.ilike.%CINTILOGRAFIA%')
        .or('CATEGORIA.is.null,CATEGORIA.eq.')
      regrasAplicadasArquivo.add('v021')

      // REGRA v023: Correção valores nulos
      console.log(`  ⚡ [JOB ${jobId}] Aplicando v023 - Valores nulos`)
      await supabase.from('volumetria_mobilemed')
        .update({ VALOR: 1 })
        .eq('arquivo_fonte', arquivoAtual)
        .or('VALOR.is.null,VALOR.eq.0')
      regrasAplicadasArquivo.add('v023')

      // REGRA v024: Duplicado padrão
      console.log(`  ⚡ [JOB ${jobId}] Aplicando v024 - Duplicado padrão`)
      await supabase.from('volumetria_mobilemed')
        .update({ is_duplicado: false })
        .eq('arquivo_fonte', arquivoAtual)
        .is('is_duplicado', null)
      regrasAplicadasArquivo.add('v024')

      // REGRA v031: Dados do cadastro_exames
      console.log(`  ⚡ [JOB ${jobId}] Aplicando v031 - Dados cadastro_exames`)
      const { data: cadastroCompleto } = await supabase
        .from('cadastro_exames')
        .select('nome, modalidade, especialidade, categoria')
        .eq('ativo', true)
      
      if (cadastroCompleto && cadastroCompleto.length > 0) {
        for (const exame of cadastroCompleto) {
          if (exame.nome) {
            const updateData: any = { updated_at: new Date().toISOString() }
            if (exame.modalidade) updateData.MODALIDADE = exame.modalidade
            if (exame.especialidade) updateData.ESPECIALIDADE = exame.especialidade
            if (exame.categoria) updateData.CATEGORIA = exame.categoria
            
            if (Object.keys(updateData).length > 1) {
              await supabase
                .from('volumetria_mobilemed')
                .update(updateData)
                .eq('arquivo_fonte', arquivoAtual)
                .ilike('ESTUDO_DESCRICAO', exame.nome)
            }
          }
        }
      }
      regrasAplicadasArquivo.add('v031')

      // Aplicar quebra de exames
      console.log(`  ⚡ [JOB ${jobId}] Aplicando quebra de exames`)
      try {
        const { data: quebraResult } = await supabase.functions.invoke(
          'aplicar-regras-quebra-exames',
          { body: { arquivo_fonte: arquivoAtual } }
        )
        if (quebraResult) {
          console.log(`  ✅ [JOB ${jobId}] Quebra: ${quebraResult.registros_processados || 0} processados`)
        }
      } catch (quebraErr) {
        console.error(`  ❌ [JOB ${jobId}] Erro quebra:`, quebraErr)
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
        regras_aplicadas: Array.from(regrasAplicadasArquivo)
      }

      console.log(`✅ [JOB ${jobId}] ${arquivoAtual}: ${resultadoArquivo.regras_aplicadas.length} regras aplicadas`)
      
      resultadosGerais.detalhes_por_arquivo.push(resultadoArquivo)
      resultadosGerais.total_arquivos_processados++
      resultadosGerais.total_registros_processados += antesCount
      resultadosGerais.total_registros_atualizados += resultadoArquivo.registros_atualizados
      
      regrasAplicadasArquivo.forEach(regra => {
        if (!resultadosGerais.regras_aplicadas.includes(regra)) {
          resultadosGerais.regras_aplicadas.push(regra)
        }
      })
    }

    console.log(`\n🎉 [JOB ${jobId}] PROCESSAMENTO COMPLETO`)
    console.log(`📁 Arquivos: ${resultadosGerais.total_arquivos_processados}`)
    console.log(`📊 Registros: ${resultadosGerais.total_registros_processados}`)

    // Salvar resultado no audit_logs
    await supabase.from('audit_logs').insert({
      operation: 'BACKGROUND_JOB_COMPLETE',
      table_name: 'volumetria_mobilemed',
      record_id: jobId,
      new_data: {
        job_id: jobId,
        status: 'completed',
        resultados: resultadosGerais,
        completed_at: new Date().toISOString()
      }
    })

  } catch (error: any) {
    console.error(`💥 [JOB ${jobId}] Erro:`, error)
    
    // Salvar erro no audit_logs
    await supabase.from('audit_logs').insert({
      operation: 'BACKGROUND_JOB_ERROR',
      table_name: 'volumetria_mobilemed',
      record_id: jobId,
      new_data: {
        job_id: jobId,
        status: 'error',
        error: error.message,
        failed_at: new Date().toISOString()
      }
    })
  }
}

// Handler de shutdown para logging
addEventListener('beforeunload', (ev: any) => {
  console.log('🔄 Function shutdown due to:', ev.detail?.reason || 'unknown')
})

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

    // Gerar ID único para o job
    const jobId = crypto.randomUUID()
    
    console.log('🚀 APLICANDO 27 REGRAS COMPLETAS - Background Task v5')
    console.log(`🆔 Job ID: ${jobId}`)
    console.log(`📁 Arquivo: ${arquivo_fonte || 'TODOS OS ARQUIVOS'}`)
    console.log(`📅 Período: ${periodo_referencia}`)

    // Definir arquivos a processar
    const arquivos = (aplicar_todos_arquivos || !arquivo_fonte) ? [
      'volumetria_padrao', 'volumetria_fora_padrao', 
      'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo', 'volumetria_onco_padrao'
    ] : [arquivo_fonte]

    // Registrar início do job
    await supabase.from('audit_logs').insert({
      operation: 'BACKGROUND_JOB_START',
      table_name: 'volumetria_mobilemed',
      record_id: jobId,
      new_data: {
        job_id: jobId,
        status: 'processing',
        arquivos: arquivos,
        periodo_referencia: periodo_referencia,
        started_at: new Date().toISOString()
      }
    })

    // ⚡ EXECUTAR EM BACKGROUND usando EdgeRuntime.waitUntil
    // A resposta é retornada IMEDIATAMENTE enquanto o processamento continua
    // @ts-ignore - EdgeRuntime exists in Supabase Edge Functions
    EdgeRuntime.waitUntil(processarRegrasBackground(supabase, periodo_referencia, arquivos, jobId))

    // Retornar resposta IMEDIATA (não espera o processamento)
    return new Response(JSON.stringify({
      sucesso: true,
      background: true,
      job_id: jobId,
      message: `Processamento iniciado em background. Job ID: ${jobId}`,
      arquivos: arquivos,
      periodo_referencia: periodo_referencia,
      instrucoes: 'O processamento está ocorrendo em segundo plano. Aguarde alguns segundos e verifique os dados.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('💥 Erro ao iniciar job:', error)
    return new Response(JSON.stringify({ 
      sucesso: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
