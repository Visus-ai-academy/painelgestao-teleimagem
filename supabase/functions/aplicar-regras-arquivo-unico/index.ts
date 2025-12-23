import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Timeout máximo para processamento (em ms) - 5 minutos
const MAX_PROCESSING_TIME = 5 * 60 * 1000

// Limite de registros para considerar arquivo "grande"
const LARGE_FILE_THRESHOLD = 10000

// Tipos de fases
type ProcessingPhase = 'fase1' | 'fase2' | 'fase3' | 'completo'

interface ProgressoFase {
  fase: ProcessingPhase
  regrasAplicadas: string[]
  regraAtual?: string
  indiceAtual?: number  // Para regras que processam listas (v011, v031, etc)
}

interface PhaseResult {
  fase: ProcessingPhase
  regrasAplicadas: string[]
  proximaFase: ProcessingPhase | null
  tempoMs: number
  completa: boolean
  progresso?: ProgressoFase
}

// ===== SALVAR E CARREGAR PROGRESSO =====
async function carregarProgresso(supabase: any, jobId: string): Promise<ProgressoFase | null> {
  const { data } = await supabase
    .from('processamento_regras_log')
    .select('progresso_fase')
    .eq('id', jobId)
    .single()
  
  return data?.progresso_fase || null
}

async function salvarProgresso(supabase: any, jobId: string, progresso: ProgressoFase) {
  await supabase.from('processamento_regras_log').update({
    progresso_fase: progresso,
    regras_aplicadas: progresso.regrasAplicadas,
    mensagem: `Processando ${progresso.fase} - ${progresso.regraAtual || 'iniciando'}...`
  }).eq('id', jobId)
}

// ===== FASE 1: Regras de exclusão e normalização básica =====
async function executarFase1(
  supabase: any,
  arquivoFonte: string,
  periodoReferencia: string,
  jobId: string,
  startTime: number,
  progressoAnterior?: ProgressoFase
): Promise<PhaseResult> {
  const regrasAplicadas: string[] = progressoAnterior?.regrasAplicadas || []
  const indiceInicial = progressoAnterior?.indiceAtual || 0
  
  const jaAplicada = (regra: string) => regrasAplicadas.includes(regra)
  
  const checkTimeout = () => {
    if (Date.now() - startTime > MAX_PROCESSING_TIME) {
      throw new Error('TIMEOUT')
    }
  }

  console.log(`🔧 [${jobId}] FASE 1: Iniciando regras de exclusão e normalização`)
  console.log(`📋 [${jobId}] Regras já aplicadas: ${regrasAplicadas.join(', ') || 'nenhuma'}`)

  // ===== VERIFICAR SE É ARQUIVO RETROATIVO PARA APLICAR v002/v003 =====
  const isRetroativo = arquivoFonte.includes('retroativo')
  
  if (isRetroativo && !jaAplicada('v003')) {
    console.log(`🔄 [${jobId}] Arquivo retroativo detectado - aplicando regras v002/v003`)
    
    let anoCompleto: number = 0
    let mesNumero: number = 0
    const periodoStr = String(periodoReferencia || '').trim()
    
    if (/^\d{4}-\d{2}$/.test(periodoStr)) {
      const [ano, mes] = periodoStr.split('-')
      anoCompleto = parseInt(ano)
      mesNumero = parseInt(mes)
    } else if (/^[a-zA-Z]{3}\/\d{2}$/.test(periodoStr)) {
      const [mes, ano] = periodoStr.split('/')
      const meses: { [key: string]: number } = {
        'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
        'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12
      }
      anoCompleto = 2000 + parseInt(ano)
      mesNumero = meses[mes.toLowerCase()] || 0
    } else if (/^\d{4}\/\d{2}$/.test(periodoStr)) {
      const [ano, mes] = periodoStr.split('/')
      anoCompleto = parseInt(ano)
      mesNumero = parseInt(mes)
    }

    if (anoCompleto >= 2020 && mesNumero >= 1 && mesNumero <= 12) {
      const dataLimiteRealizacao = new Date(Date.UTC(anoCompleto, mesNumero - 1, 1))
      const dataLimiteRealizacaoStr = dataLimiteRealizacao.toISOString().split('T')[0]
      
      const dataInicioJanelaLaudo = new Date(Date.UTC(anoCompleto, mesNumero - 1, 8))
      const dataFimJanelaLaudo = new Date(Date.UTC(anoCompleto, mesNumero, 7))
      const dataInicioJanelaLaudoStr = dataInicioJanelaLaudo.toISOString().split('T')[0]
      const dataFimJanelaLaudoStr = dataFimJanelaLaudo.toISOString().split('T')[0]

      // v003: Excluir em lotes
      let totalExcludosV003 = 0
      const BATCH_SIZE = 1000
      
      while (true) {
        checkTimeout()
        const { data: idsToDelete } = await supabase
          .from('volumetria_mobilemed')
          .select('id')
          .eq('arquivo_fonte', arquivoFonte)
          .gte('DATA_REALIZACAO', dataLimiteRealizacaoStr)
          .limit(BATCH_SIZE)

        if (!idsToDelete || idsToDelete.length === 0) break

        const { count } = await supabase
          .from('volumetria_mobilemed')
          .delete({ count: 'exact' })
          .in('id', idsToDelete.map((r: any) => r.id))

        totalExcludosV003 += count || 0
        if ((count || 0) < BATCH_SIZE) break
      }
      
      console.log(`✅ [${jobId}] v003: ${totalExcludosV003} registros excluídos`)
      if (!jaAplicada('v003')) regrasAplicadas.push('v003')

      // v002: Excluir em lotes (DATA_LAUDO fora da janela)
      if (!jaAplicada('v002')) {
        let totalExcludosV002 = 0
        
        while (true) {
          checkTimeout()
          const { data: idsToDelete } = await supabase
            .from('volumetria_mobilemed')
            .select('id')
            .eq('arquivo_fonte', arquivoFonte)
            .or(`DATA_LAUDO.lt.${dataInicioJanelaLaudoStr},DATA_LAUDO.gt.${dataFimJanelaLaudoStr}`)
            .limit(BATCH_SIZE)

          if (!idsToDelete || idsToDelete.length === 0) break

          const { count } = await supabase
            .from('volumetria_mobilemed')
            .delete({ count: 'exact' })
            .in('id', idsToDelete.map((r: any) => r.id))

          totalExcludosV002 += count || 0
          if ((count || 0) < BATCH_SIZE) break
        }
        
        console.log(`✅ [${jobId}] v002: ${totalExcludosV002} registros excluídos`)
        regrasAplicadas.push('v002')
      }
    }
  }

  checkTimeout()

  // ===== REGRAS DE EXCLUSÃO (operações em lote) =====
  
  // v004: Exclusões de clientes específicos
  if (!jaAplicada('v004')) {
    await supabase.from('volumetria_mobilemed')
      .delete()
      .eq('arquivo_fonte', arquivoFonte)
      .in('EMPRESA', ['CLINICA SERCOR', 'INMED', 'MEDICINA OCUPACIONAL'])
    regrasAplicadas.push('v004')
  }

  // v017: Exclusões registros rejeitados
  if (!jaAplicada('v017')) {
    await supabase.from('volumetria_mobilemed')
      .delete()
      .eq('arquivo_fonte', arquivoFonte)
      .or('ESTUDO_DESCRICAO.is.null,ESTUDO_DESCRICAO.eq.,EMPRESA.is.null,EMPRESA.eq.')
    regrasAplicadas.push('v017')
  }

  // v032: Exclusão de clientes com TESTE
  if (!jaAplicada('v032')) {
    await supabase.from('volumetria_mobilemed')
      .delete()
      .eq('arquivo_fonte', arquivoFonte)
      .like('EMPRESA', '%TESTE%')
    regrasAplicadas.push('v032')
  }

  checkTimeout()

  // ===== REGRAS DE NORMALIZAÇÃO =====

  // v001: CEDI unificação
  if (!jaAplicada('v001')) {
    await supabase.from('volumetria_mobilemed')
      .update({ EMPRESA: 'CEDIDIAG' })
      .eq('arquivo_fonte', arquivoFonte)
      .in('EMPRESA', ['CEDI-RJ','CEDI-RO','CEDI-UNIMED','CEDI_RJ','CEDI_RO','CEDI_UNIMED'])
    regrasAplicadas.push('v001')
  }

  // v001b: Normalizar sufixo _TELE
  if (!jaAplicada('v001b')) {
    const { data: empresasComTele } = await supabase
      .from('volumetria_mobilemed')
      .select('"EMPRESA"')
      .eq('arquivo_fonte', arquivoFonte)
      .like('EMPRESA', '%_TELE')
    
    if (empresasComTele && empresasComTele.length > 0) {
      const empresasUnicas = [...new Set(empresasComTele.map((c: any) => c.EMPRESA))]
      for (const empresa of empresasUnicas) {
        if (typeof empresa === 'string' && empresa.endsWith('_TELE')) {
          await supabase.from('volumetria_mobilemed')
            .update({ EMPRESA: empresa.replace(/_TELE$/, '') })
            .eq('arquivo_fonte', arquivoFonte)
            .eq('EMPRESA', empresa)
        }
      }
    }
    regrasAplicadas.push('v001b')
  }

  checkTimeout()

  // v001c: Normalização de nomes de médicos - COM CHECKPOINT
  if (!jaAplicada('v001c')) {
    const { data: mapeamentoMedicos } = await supabase
      .from('mapeamento_nomes_medicos')
      .select('nome_origem_normalizado, medico_nome')
      .eq('ativo', true)
    
    if (mapeamentoMedicos && mapeamentoMedicos.length > 0) {
      console.log(`📋 [${jobId}] v001c: ${mapeamentoMedicos.length} mapeamentos de médicos`)
      
      const inicioV001c = progressoAnterior?.regraAtual === 'v001c' ? indiceInicial : 0
      
      for (let i = inicioV001c; i < mapeamentoMedicos.length; i++) {
        checkTimeout()
        const mapeamento = mapeamentoMedicos[i]
        if (mapeamento.nome_origem_normalizado && mapeamento.medico_nome) {
          await supabase
            .from('volumetria_mobilemed')
            .update({ MEDICO: mapeamento.medico_nome })
            .eq('arquivo_fonte', arquivoFonte)
            .ilike('MEDICO', mapeamento.nome_origem_normalizado)
        }
        
        // Salvar checkpoint a cada 50 registros
        if (i > 0 && i % 50 === 0) {
          await salvarProgresso(supabase, jobId, {
            fase: 'fase1',
            regrasAplicadas,
            regraAtual: 'v001c',
            indiceAtual: i
          })
        }
      }
    }
    regrasAplicadas.push('v001c')
  }

  checkTimeout()

  // v001d: De-Para valores zerados - COM CHECKPOINT
  if (!jaAplicada('v001d')) {
    const { data: valoresReferencia } = await supabase
      .from('valores_referencia_de_para')
      .select('estudo_descricao, valores')
      .eq('ativo', true)
    
    if (valoresReferencia && valoresReferencia.length > 0) {
      console.log(`📋 [${jobId}] v001d: ${valoresReferencia.length} valores de referência`)
      
      const inicioV001d = progressoAnterior?.regraAtual === 'v001d' ? indiceInicial : 0
      
      for (let i = inicioV001d; i < valoresReferencia.length; i++) {
        checkTimeout()
        const ref = valoresReferencia[i]
        if (ref.estudo_descricao && ref.valores && ref.valores > 0) {
          await supabase
            .from('volumetria_mobilemed')
            .update({ VALOR: ref.valores })
            .eq('arquivo_fonte', arquivoFonte)
            .eq('ESTUDO_DESCRICAO', ref.estudo_descricao)
            .or('VALOR.is.null,VALOR.eq.0')
        }
      }
    }
    regrasAplicadas.push('v001d')
  }

  checkTimeout()

  // v005: Correções modalidade
  if (!jaAplicada('v005')) {
    const { data: examesMAMO } = await supabase
      .from('cadastro_exames')
      .select('nome')
      .eq('especialidade', 'MAMO')
      .eq('ativo', true)
    
    if (examesMAMO && examesMAMO.length > 0) {
      const nomesMAMO = examesMAMO.map((e: any) => e.nome).filter(Boolean)
      for (const nome of nomesMAMO) {
        await supabase
          .from('volumetria_mobilemed')
          .update({ MODALIDADE: 'MG' })
          .eq('arquivo_fonte', arquivoFonte)
          .in('MODALIDADE', ['CR', 'DX'])
          .eq('ESTUDO_DESCRICAO', nome)
      }
    }
    
    // CR/DX → RX
    await supabase.from('volumetria_mobilemed')
      .update({ MODALIDADE: 'RX' })
      .eq('arquivo_fonte', arquivoFonte)
      .in('MODALIDADE', ['CR', 'DX'])

    // OT/BMD → DO
    await supabase.from('volumetria_mobilemed')
      .update({ MODALIDADE: 'DO' })
      .eq('arquivo_fonte', arquivoFonte)
      .in('MODALIDADE', ['OT', 'BMD'])
    
    regrasAplicadas.push('v005')
  }

  checkTimeout()

  // v007: Correções de especialidades
  if (!jaAplicada('v007')) {
    await supabase.from('volumetria_mobilemed')
      .update({ ESPECIALIDADE: 'MEDICINA INTERNA' })
      .eq('arquivo_fonte', arquivoFonte)
      .in('ESPECIALIDADE', ['ANGIOTCS', 'TÓRAX', 'CORPO', 'TOMOGRAFIA', 'ONCO MEDICINA INTERNA'])
    
    await supabase.from('volumetria_mobilemed')
      .update({ ESPECIALIDADE: 'NEURO' })
      .eq('arquivo_fonte', arquivoFonte)
      .eq('ESPECIALIDADE', 'CABEÇA-PESCOÇO')
    
    await supabase.from('volumetria_mobilemed')
      .update({ ESPECIALIDADE: 'D.O' })
      .eq('arquivo_fonte', arquivoFonte)
      .eq('MODALIDADE', 'DO')
    
    await supabase.from('volumetria_mobilemed')
      .update({ ESPECIALIDADE: 'CARDIO' })
      .eq('arquivo_fonte', arquivoFonte)
      .eq('ESPECIALIDADE', 'CARDIO COM SCORE')
    
    regrasAplicadas.push('v007')
  }

  checkTimeout()

  // v034: Colunas → NEURO/MUSCULO (atualiza ESPECIALIDADE e CATEGORIA)
  if (!jaAplicada('v034')) {
    try {
      const { data: neurologistas } = await supabase
        .from('medicos_neurologistas')
        .select('nome')
        .eq('ativo', true)
      
      if (neurologistas && neurologistas.length > 0) {
        for (const neuro of neurologistas) {
          if (neuro.nome) {
            // Neurologistas: ESPECIALIDADE → NEURO, CATEGORIA → NEURO
            await supabase.from('volumetria_mobilemed')
              .update({ ESPECIALIDADE: 'NEURO', CATEGORIA: 'NEURO' })
              .eq('arquivo_fonte', arquivoFonte)
              .ilike('ESTUDO_DESCRICAO', '%COLUNA%')
              .ilike('MEDICO', `%${neuro.nome}%`)
          }
        }
      }
      
      // Colunas padrão (não neurologistas) → MUSCULO ESQUELETICO (ESPECIALIDADE e CATEGORIA)
      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'MUSCULO ESQUELETICO', CATEGORIA: 'MUSCULO ESQUELETICO' })
        .eq('arquivo_fonte', arquivoFonte)
        .ilike('ESTUDO_DESCRICAO', '%COLUNA%')
        .eq('ESPECIALIDADE', 'COLUNAS')
      
      regrasAplicadas.push('v034')
    } catch (v034Err) {
      console.error(`⚠️ [${jobId}] Erro v034:`, v034Err)
    }
  }

  // v044: MAMA → MAMO
  if (!jaAplicada('v044')) {
    await supabase.from('volumetria_mobilemed')
      .update({ ESPECIALIDADE: 'MAMO' })
      .eq('arquivo_fonte', arquivoFonte)
      .eq('MODALIDADE', 'MG')
      .eq('ESPECIALIDADE', 'MAMA')
    regrasAplicadas.push('v044')
  }

  checkTimeout()

  // v008: De-Para Prioridades
  if (!jaAplicada('v008')) {
    const { data: prioridadesDePara } = await supabase
      .from('valores_prioridade_de_para')
      .select('prioridade_original, nome_final')
      .eq('ativo', true)
    
    if (prioridadesDePara && prioridadesDePara.length > 0) {
      for (const mapeamento of prioridadesDePara) {
        await supabase.from('volumetria_mobilemed')
          .update({ PRIORIDADE: mapeamento.nome_final })
          .eq('arquivo_fonte', arquivoFonte)
          .eq('PRIORIDADE', mapeamento.prioridade_original)
      }
    }
    regrasAplicadas.push('v008')
  }

  // v009: Prioridade padrão
  if (!jaAplicada('v009')) {
    await supabase.from('volumetria_mobilemed')
      .update({ PRIORIDADE: 'ROTINA' })
      .eq('arquivo_fonte', arquivoFonte)
      .or('PRIORIDADE.is.null,PRIORIDADE.eq.')
    regrasAplicadas.push('v009')
  }

  // v010: Mapeamento de nomes de clientes
  if (!jaAplicada('v010')) {
    await supabase.from('volumetria_mobilemed')
      .update({ EMPRESA: 'HOSPITAL SANTA HELENA' })
      .eq('arquivo_fonte', arquivoFonte)
      .like('EMPRESA', '%SANTA HELENA%')
    regrasAplicadas.push('v010')
  }

  // v010a: P-CEMVALENCA_MG
  if (!jaAplicada('v010a')) {
    await supabase.from('volumetria_mobilemed')
      .update({ EMPRESA: 'CEMVALENCA_MG' })
      .eq('arquivo_fonte', arquivoFonte)
      .eq('EMPRESA', 'P-CEMVALENCA_MG')
    regrasAplicadas.push('v010a')
  }

  // v010b: Separação CEMVALENCA
  if (!jaAplicada('v010b')) {
    await supabase.from('volumetria_mobilemed')
      .update({ EMPRESA: 'CEMVALENCA_PLANTAO' })
      .eq('arquivo_fonte', arquivoFonte)
      .eq('EMPRESA', 'CEMVALENCA')
      .in('PRIORIDADE', ['URGENTE', 'EMERGENCIA', 'PLANTAO'])

    await supabase.from('volumetria_mobilemed')
      .update({ EMPRESA: 'CEMVALENCA_RX' })
      .eq('arquivo_fonte', arquivoFonte)
      .eq('EMPRESA', 'CEMVALENCA')
      .eq('MODALIDADE', 'RX')
    regrasAplicadas.push('v010b')
  }

  checkTimeout()

  // v012-v014: Especialidades automáticas
  if (!jaAplicada('v012-v014')) {
    await supabase.from('volumetria_mobilemed')
      .update({ ESPECIALIDADE: 'RX' })
      .eq('arquivo_fonte', arquivoFonte)
      .eq('MODALIDADE', 'RX')
      .or('ESPECIALIDADE.is.null,ESPECIALIDADE.eq.')
    
    await supabase.from('volumetria_mobilemed')
      .update({ ESPECIALIDADE: 'TC' })
      .eq('arquivo_fonte', arquivoFonte)
      .eq('MODALIDADE', 'CT')
      .or('ESPECIALIDADE.is.null,ESPECIALIDADE.eq.')
    
    await supabase.from('volumetria_mobilemed')
      .update({ ESPECIALIDADE: 'RM' })
      .eq('arquivo_fonte', arquivoFonte)
      .eq('MODALIDADE', 'MR')
      .or('ESPECIALIDADE.is.null,ESPECIALIDADE.eq.')
    
    regrasAplicadas.push('v012-v014')
  }

  // v015: Status padrão
  if (!jaAplicada('v015')) {
    await supabase.from('volumetria_mobilemed')
      .update({ status: 'ativo' })
      .eq('arquivo_fonte', arquivoFonte)
      .or('status.is.null,status.eq.')
    regrasAplicadas.push('v015')
  }

  // v016: Período referência
  if (!jaAplicada('v016')) {
    await supabase.from('volumetria_mobilemed')
      .update({ periodo_referencia: periodoReferencia })
      .eq('arquivo_fonte', arquivoFonte)
      .or('periodo_referencia.is.null,periodo_referencia.eq.')
    regrasAplicadas.push('v016')
  }

  // v018-v019: Prioridades
  if (!jaAplicada('v018-v019')) {
    await supabase.from('volumetria_mobilemed')
      .update({ PRIORIDADE: 'URGENTE' })
      .eq('arquivo_fonte', arquivoFonte)
      .in('PRIORIDADE', ['URG', 'EMERGENCIA', 'EMERGÊNCIA'])

    await supabase.from('volumetria_mobilemed')
      .update({ PRIORIDADE: 'ROTINA' })
      .eq('arquivo_fonte', arquivoFonte)
      .in('PRIORIDADE', ['ROT', 'AMBULATORIO', 'AMBULATÓRIO', 'INTERNADO'])
    
    regrasAplicadas.push('v018-v019')
  }

  checkTimeout()

  // v020: Modalidade mamografia
  if (!jaAplicada('v020')) {
    await supabase.from('volumetria_mobilemed')
      .update({ MODALIDADE: 'MG' })
      .eq('arquivo_fonte', arquivoFonte)
      .ilike('ESTUDO_DESCRICAO', '%MAMOGRAFIA%')
      .neq('MODALIDADE', 'MG')
    
    await supabase.from('volumetria_mobilemed')
      .update({ MODALIDADE: 'MG' })
      .eq('arquivo_fonte', arquivoFonte)
      .ilike('ESTUDO_DESCRICAO', '%TOMOSSINTESE%')
      .neq('MODALIDADE', 'MG')
    regrasAplicadas.push('v020')
  }

  // v021: Categoria oncologia
  if (!jaAplicada('v021')) {
    await supabase.from('volumetria_mobilemed')
      .update({ CATEGORIA: 'ONCO' })
      .eq('arquivo_fonte', arquivoFonte)
      .ilike('ESTUDO_DESCRICAO', '%ONCO%')
      .or('CATEGORIA.is.null,CATEGORIA.eq.')
    
    await supabase.from('volumetria_mobilemed')
      .update({ CATEGORIA: 'ONCO' })
      .eq('arquivo_fonte', arquivoFonte)
      .ilike('ESTUDO_DESCRICAO', '%PET%')
      .or('CATEGORIA.is.null,CATEGORIA.eq.')
    
    await supabase.from('volumetria_mobilemed')
      .update({ CATEGORIA: 'ONCO' })
      .eq('arquivo_fonte', arquivoFonte)
      .ilike('ESTUDO_DESCRICAO', '%CINTILOGRAFIA%')
      .or('CATEGORIA.is.null,CATEGORIA.eq.')
    
    regrasAplicadas.push('v021')
  }

  // v023: Correção valores nulos
  if (!jaAplicada('v023')) {
    await supabase.from('volumetria_mobilemed')
      .update({ VALOR: 1 })
      .eq('arquivo_fonte', arquivoFonte)
      .or('VALOR.is.null,VALOR.eq.0')
    regrasAplicadas.push('v023')
  }

  // v024: Duplicado padrão
  if (!jaAplicada('v024')) {
    await supabase.from('volumetria_mobilemed')
      .update({ is_duplicado: false })
      .eq('arquivo_fonte', arquivoFonte)
      .is('is_duplicado', null)
    regrasAplicadas.push('v024')
  }

  console.log(`✅ [${jobId}] FASE 1 concluída: ${regrasAplicadas.length} regras aplicadas`)

  return {
    fase: 'fase1',
    regrasAplicadas,
    proximaFase: 'fase2',
    tempoMs: Date.now() - startTime,
    completa: true
  }
}

// ===== FASE 2: Regras de mapeamento pesadas (v011, v031) =====
async function executarFase2(
  supabase: any,
  arquivoFonte: string,
  jobId: string,
  startTime: number,
  progressoAnterior?: ProgressoFase
): Promise<PhaseResult> {
  const regrasAplicadas: string[] = progressoAnterior?.regrasAplicadas || []
  const indiceInicial = progressoAnterior?.indiceAtual || 0
  
  const jaAplicada = (regra: string) => regrasAplicadas.includes(regra)
  
  const checkTimeout = () => {
    if (Date.now() - startTime > MAX_PROCESSING_TIME) {
      throw new Error('TIMEOUT')
    }
  }

  console.log(`🔧 [${jobId}] FASE 2: Iniciando regras de mapeamento (v011, v031)`)
  console.log(`📋 [${jobId}] Regras já aplicadas: ${regrasAplicadas.join(', ') || 'nenhuma'}`)

  // v011: Categorias de exames - OTIMIZADO COM BATCH
  // Usa DUAS fontes: cadastro_exames direto + valores_referencia_de_para (vinculações manuais)
  if (!jaAplicada('v011')) {
    console.log(`🏷️ [${jobId}] v011: Aplicando categorias (modo batch otimizado)...`)
    
    // 1. Buscar exames do cadastro com categoria
    const { data: cadastroExamesCategoria } = await supabase
      .from('cadastro_exames')
      .select('nome, categoria')
      .eq('ativo', true)
      .not('categoria', 'is', null)
    
    // 2. Buscar vinculações da tabela de_para (exames fora do padrão vinculados)
    const { data: vinculacoes } = await supabase
      .from('valores_referencia_de_para')
      .select('estudo_descricao, cadastro_exame_id, cadastro_exames!inner(categoria)')
      .eq('ativo', true)
      .not('cadastro_exame_id', 'is', null)
    
    // 3. Buscar todos registros sem categoria do arquivo
    const { data: registrosSemCategoria } = await supabase
      .from('volumetria_mobilemed')
      .select('id, ESTUDO_DESCRICAO')
      .eq('arquivo_fonte', arquivoFonte)
      .or('CATEGORIA.is.null,CATEGORIA.eq.')
      .limit(50000)
    
    if (registrosSemCategoria && registrosSemCategoria.length > 0) {
      console.log(`📋 [${jobId}] v011: ${registrosSemCategoria.length} registros sem categoria`)
      
      // Criar mapa de ESTUDO_DESCRICAO → categoria
      const mapaCategorias = new Map<string, string>()
      
      // Primeiro as vinculações (prioridade maior)
      if (vinculacoes) {
        for (const vinc of vinculacoes) {
          const categoria = (vinc.cadastro_exames as any)?.categoria
          if (vinc.estudo_descricao && categoria) {
            mapaCategorias.set(vinc.estudo_descricao.toUpperCase(), categoria)
          }
        }
        console.log(`📋 [${jobId}] v011: ${vinculacoes.length} vinculações mapeadas`)
      }
      
      // Depois o cadastro direto
      if (cadastroExamesCategoria) {
        for (const exame of cadastroExamesCategoria) {
          if (exame.nome && exame.categoria) {
            mapaCategorias.set(exame.nome.toUpperCase(), exame.categoria)
          }
        }
        console.log(`📋 [${jobId}] v011: ${cadastroExamesCategoria.length} exames do cadastro`)
      }
      
      // Agrupar registros por categoria a aplicar
      const porCategoria = new Map<string, string[]>()
      for (const reg of registrosSemCategoria) {
        if (reg.ESTUDO_DESCRICAO) {
          const categoriaEncontrada = mapaCategorias.get(reg.ESTUDO_DESCRICAO.toUpperCase())
          if (categoriaEncontrada) {
            if (!porCategoria.has(categoriaEncontrada)) {
              porCategoria.set(categoriaEncontrada, [])
            }
            porCategoria.get(categoriaEncontrada)!.push(reg.id)
          }
        }
      }
      
      // Aplicar em batch por categoria
      let totalAplicadas = 0
      for (const [categoria, ids] of porCategoria.entries()) {
        // Processar em chunks de 500 IDs
        for (let i = 0; i < ids.length; i += 500) {
          checkTimeout()
          const chunk = ids.slice(i, i + 500)
          await supabase
            .from('volumetria_mobilemed')
            .update({ CATEGORIA: categoria })
            .in('id', chunk)
          totalAplicadas += chunk.length
        }
      }
      
      console.log(`✅ [${jobId}] v011: ${totalAplicadas} registros atualizados com categoria`)
    } else {
      console.log(`✅ [${jobId}] v011: Nenhum registro sem categoria encontrado`)
    }
    
    regrasAplicadas.push('v011')
  }

  checkTimeout()

  // v031: Modalidade e Especialidade do cadastro_exames - OTIMIZADO COM BATCH
  if (!jaAplicada('v031')) {
    console.log(`🔧 [${jobId}] v031: Aplicando modalidade/especialidade (modo batch otimizado)...`)
    
    const { data: cadastroCompleto } = await supabase
      .from('cadastro_exames')
      .select('nome, modalidade, especialidade')
      .eq('ativo', true)
    
    const { data: vinculacoesV031 } = await supabase
      .from('valores_referencia_de_para')
      .select('estudo_descricao, cadastro_exame_id, cadastro_exames!inner(modalidade, especialidade)')
      .eq('ativo', true)
      .not('cadastro_exame_id', 'is', null)
    
    // Buscar registros sem modalidade ou especialidade
    const { data: registrosSemMod } = await supabase
      .from('volumetria_mobilemed')
      .select('id, ESTUDO_DESCRICAO')
      .eq('arquivo_fonte', arquivoFonte)
      .or('MODALIDADE.is.null,MODALIDADE.eq.')
      .limit(50000)
    
    const { data: registrosSemEsp } = await supabase
      .from('volumetria_mobilemed')
      .select('id, ESTUDO_DESCRICAO')
      .eq('arquivo_fonte', arquivoFonte)
      .or('ESPECIALIDADE.is.null,ESPECIALIDADE.eq.')
      .limit(50000)
    
    // Criar mapas de ESTUDO_DESCRICAO → modalidade/especialidade
    const mapaModalidade = new Map<string, string>()
    const mapaEspecialidade = new Map<string, string>()
    
    // Primeiro as vinculações (prioridade maior)
    if (vinculacoesV031) {
      for (const vinc of vinculacoesV031) {
        const mod = (vinc.cadastro_exames as any)?.modalidade
        const esp = (vinc.cadastro_exames as any)?.especialidade
        if (vinc.estudo_descricao) {
          if (mod) mapaModalidade.set(vinc.estudo_descricao.toUpperCase(), mod)
          if (esp) mapaEspecialidade.set(vinc.estudo_descricao.toUpperCase(), esp)
        }
      }
      console.log(`📋 [${jobId}] v031: ${vinculacoesV031.length} vinculações mapeadas`)
    }
    
    // Depois o cadastro direto
    if (cadastroCompleto) {
      for (const exame of cadastroCompleto) {
        if (exame.nome) {
          if (exame.modalidade) mapaModalidade.set(exame.nome.toUpperCase(), exame.modalidade)
          if (exame.especialidade) mapaEspecialidade.set(exame.nome.toUpperCase(), exame.especialidade)
        }
      }
      console.log(`📋 [${jobId}] v031: ${cadastroCompleto.length} exames do cadastro`)
    }
    
    let totalAplicados = 0
    
    // Aplicar modalidades em batch
    if (registrosSemMod && registrosSemMod.length > 0) {
      const porModalidade = new Map<string, string[]>()
      for (const reg of registrosSemMod) {
        if (reg.ESTUDO_DESCRICAO) {
          const mod = mapaModalidade.get(reg.ESTUDO_DESCRICAO.toUpperCase())
          if (mod) {
            if (!porModalidade.has(mod)) porModalidade.set(mod, [])
            porModalidade.get(mod)!.push(reg.id)
          }
        }
      }
      
      for (const [modalidade, ids] of porModalidade.entries()) {
        for (let i = 0; i < ids.length; i += 500) {
          checkTimeout()
          const chunk = ids.slice(i, i + 500)
          await supabase
            .from('volumetria_mobilemed')
            .update({ MODALIDADE: modalidade })
            .in('id', chunk)
          totalAplicados += chunk.length
        }
      }
    }
    
    // Aplicar especialidades em batch
    if (registrosSemEsp && registrosSemEsp.length > 0) {
      const porEspecialidade = new Map<string, string[]>()
      for (const reg of registrosSemEsp) {
        if (reg.ESTUDO_DESCRICAO) {
          const esp = mapaEspecialidade.get(reg.ESTUDO_DESCRICAO.toUpperCase())
          if (esp) {
            if (!porEspecialidade.has(esp)) porEspecialidade.set(esp, [])
            porEspecialidade.get(esp)!.push(reg.id)
          }
        }
      }
      
      for (const [especialidade, ids] of porEspecialidade.entries()) {
        for (let i = 0; i < ids.length; i += 500) {
          checkTimeout()
          const chunk = ids.slice(i, i + 500)
          await supabase
            .from('volumetria_mobilemed')
            .update({ ESPECIALIDADE: especialidade })
            .in('id', chunk)
          totalAplicados += chunk.length
        }
      }
    }
    
    console.log(`✅ [${jobId}] v031: ${totalAplicados} atualizações aplicadas`)
    regrasAplicadas.push('v031')
  }

  checkTimeout()

  // v030: Correção detalhada CR/DX → RX (não mamografia) ou MG (mamografia)
  if (!jaAplicada('v030')) {
    console.log(`🔧 [${jobId}] v030: Aplicando correção detalhada CR/DX...`)
    
    // CR/DX que NÃO são mamografia → RX
    await supabase.from('volumetria_mobilemed')
      .update({ MODALIDADE: 'RX' })
      .eq('arquivo_fonte', arquivoFonte)
      .in('MODALIDADE', ['CR', 'DX'])
      .not('ESTUDO_DESCRICAO', 'ilike', '%mamografia%')
      .not('ESTUDO_DESCRICAO', 'ilike', '%mamogra%')
      .not('ESTUDO_DESCRICAO', 'ilike', '%tomossintese%')
    
    // CR/DX que SÃO mamografia → MG
    await supabase.from('volumetria_mobilemed')
      .update({ MODALIDADE: 'MG' })
      .eq('arquivo_fonte', arquivoFonte)
      .in('MODALIDADE', ['CR', 'DX'])
      .or('ESTUDO_DESCRICAO.ilike.%mamografia%,ESTUDO_DESCRICAO.ilike.%mamogra%,ESTUDO_DESCRICAO.ilike.%tomossintese%')
    
    console.log(`✅ [${jobId}] v030: Correção CR/DX aplicada`)
    regrasAplicadas.push('v030')
  }

  checkTimeout()

  // v033: Substituição de Especialidade para Cardio com Score e Onco Medicina Interna
  if (!jaAplicada('v033')) {
    console.log(`🔧 [${jobId}] v033: Aplicando substituição de especialidades...`)
    
    // Buscar cadastro de exames
    const { data: cadastroV033 } = await supabase
      .from('cadastro_exames')
      .select('nome, especialidade, categoria')
      .eq('ativo', true)
    
    const mapaExamesV033 = new Map<string, { especialidade: string, categoria: string }>()
    if (cadastroV033) {
      for (const ex of cadastroV033) {
        if (ex.nome) {
          mapaExamesV033.set(ex.nome.toUpperCase(), { especialidade: ex.especialidade, categoria: ex.categoria })
        }
      }
    }
    
    // Buscar registros com especialidades alvo
    const { data: registrosV033 } = await supabase
      .from('volumetria_mobilemed')
      .select('id, ESTUDO_DESCRICAO')
      .eq('arquivo_fonte', arquivoFonte)
      .in('ESPECIALIDADE', ['Cardio com Score', 'CARDIO COM SCORE', 'Onco Medicina Interna', 'ONCO MEDICINA INTERNA'])
      .limit(50000)
    
    if (registrosV033 && registrosV033.length > 0) {
      let totalV033 = 0
      for (const reg of registrosV033) {
        if (reg.ESTUDO_DESCRICAO) {
          const dados = mapaExamesV033.get(reg.ESTUDO_DESCRICAO.toUpperCase())
          if (dados) {
            await supabase.from('volumetria_mobilemed')
              .update({ ESPECIALIDADE: dados.especialidade, CATEGORIA: dados.categoria })
              .eq('id', reg.id)
            totalV033++
          }
        }
        if (totalV033 % 100 === 0) checkTimeout()
      }
      console.log(`✅ [${jobId}] v033: ${totalV033} registros substituídos`)
    }
    
    regrasAplicadas.push('v033')
  }

  checkTimeout()

  // v035: Mapeamento de nome cliente (nome_mobilemed → nome_fantasia)
  if (!jaAplicada('v035')) {
    console.log(`🔧 [${jobId}] v035: Aplicando mapeamento de nomes de clientes...`)
    
    // Buscar mapeamentos de clientes
    const { data: clientesMap } = await supabase
      .from('clientes')
      .select('nome_mobilemed, nome_fantasia')
      .not('nome_mobilemed', 'is', null)
      .not('nome_fantasia', 'is', null)
    
    if (clientesMap && clientesMap.length > 0) {
      let totalV035 = 0
      for (const cliente of clientesMap) {
        if (cliente.nome_mobilemed && cliente.nome_fantasia && cliente.nome_mobilemed !== cliente.nome_fantasia) {
          const { count } = await supabase.from('volumetria_mobilemed')
            .update({ EMPRESA: cliente.nome_fantasia })
            .eq('arquivo_fonte', arquivoFonte)
            .eq('EMPRESA', cliente.nome_mobilemed)
            .select('id', { count: 'exact', head: true })
          
          totalV035 += count || 0
        }
        if (totalV035 % 50 === 0) checkTimeout()
      }
      console.log(`✅ [${jobId}] v035: ${totalV035} registros com nome de cliente mapeado`)
    }
    
    regrasAplicadas.push('v035')
  }

  checkTimeout()

  // v026: De-Para automático de valores (via RPC)
  if (!jaAplicada('v026')) {
    console.log(`🔧 [${jobId}] v026: Aplicando De-Para automático de valores...`)
    
    try {
      const { data: deParaResult, error: deParaError } = await supabase
        .rpc('aplicar_de_para_automatico', { arquivo_fonte_param: arquivoFonte })
      
      if (deParaError) {
        console.warn(`⚠️ [${jobId}] v026: De-Para falhou - ${deParaError.message}`)
      } else {
        console.log(`✅ [${jobId}] v026: De-Para aplicado - ${deParaResult?.registros_atualizados || 0} registros`)
      }
    } catch (v026Err: any) {
      console.warn(`⚠️ [${jobId}] v026: Erro - ${v026Err.message}`)
    }
    
    regrasAplicadas.push('v026')
  }

  checkTimeout()

  // v028: Aplicar categorias adicionais do cadastro_exames (complementa v011)
  if (!jaAplicada('v028')) {
    console.log(`🔧 [${jobId}] v028: Aplicando categorias adicionais do cadastro...`)
    
    // Buscar registros ainda sem categoria ou com SC
    const { data: semCategoriaV028 } = await supabase
      .from('volumetria_mobilemed')
      .select('id, ESTUDO_DESCRICAO')
      .eq('arquivo_fonte', arquivoFonte)
      .or('CATEGORIA.is.null,CATEGORIA.eq.,CATEGORIA.eq.SC')
      .limit(50000)
    
    if (semCategoriaV028 && semCategoriaV028.length > 0) {
      const { data: cadastroV028 } = await supabase
        .from('cadastro_exames')
        .select('nome, categoria')
        .eq('ativo', true)
        .not('categoria', 'is', null)
        .neq('categoria', 'SC')
      
      const mapaCategoriasV028 = new Map<string, string>()
      if (cadastroV028) {
        for (const ex of cadastroV028) {
          if (ex.nome && ex.categoria) {
            mapaCategoriasV028.set(ex.nome.toUpperCase(), ex.categoria)
          }
        }
      }
      
      const porCategoriaV028 = new Map<string, string[]>()
      for (const reg of semCategoriaV028) {
        if (reg.ESTUDO_DESCRICAO) {
          const cat = mapaCategoriasV028.get(reg.ESTUDO_DESCRICAO.toUpperCase())
          if (cat) {
            if (!porCategoriaV028.has(cat)) porCategoriaV028.set(cat, [])
            porCategoriaV028.get(cat)!.push(reg.id)
          }
        }
      }
      
      let totalV028 = 0
      for (const [categoria, ids] of porCategoriaV028.entries()) {
        for (let i = 0; i < ids.length; i += 500) {
          checkTimeout()
          const chunk = ids.slice(i, i + 500)
          await supabase.from('volumetria_mobilemed')
            .update({ CATEGORIA: categoria })
            .in('id', chunk)
          totalV028 += chunk.length
        }
      }
      
      console.log(`✅ [${jobId}] v028: ${totalV028} registros com categoria aplicada`)
    }
    
    regrasAplicadas.push('v028')
  }

  console.log(`✅ [${jobId}] FASE 2 concluída: ${regrasAplicadas.length} regras aplicadas`)

  return {
    fase: 'fase2',
    regrasAplicadas,
    proximaFase: 'fase3',
    tempoMs: Date.now() - startTime,
    completa: true
  }
}

// ===== FASE 3: Regra de quebra de exames (v027) =====
async function executarFase3(
  supabase: any,
  arquivoFonte: string,
  jobId: string,
  startTime: number,
  progressoAnterior?: ProgressoFase
): Promise<PhaseResult> {
  const regrasAplicadas: string[] = progressoAnterior?.regrasAplicadas || []
  
  const jaAplicada = (regra: string) => regrasAplicadas.includes(regra)
  
  const checkTimeout = () => {
    if (Date.now() - startTime > MAX_PROCESSING_TIME) {
      throw new Error('TIMEOUT')
    }
  }

  console.log(`🔧 [${jobId}] FASE 3: Iniciando regra de quebra de exames (v027)`)

  if (!jaAplicada('v027')) {
    try {
      const { data: regrasQuebra, error: errorRegras } = await supabase
        .from('regras_quebra_exames')
        .select('exame_original, exame_quebrado, categoria_quebrada')
        .eq('ativo', true)
      
      if (errorRegras) {
        console.error(`⚠️ [${jobId}] Erro ao buscar regras de quebra:`, errorRegras)
      } else if (regrasQuebra && regrasQuebra.length > 0) {
        console.log(`📋 [${jobId}] v027: ${regrasQuebra.length} regras de quebra`)
        
        const examesQuebrados = regrasQuebra.map((r: any) => r.exame_quebrado)
        const { data: cadastroExamesQuebrados } = await supabase
          .from('cadastro_exames')
          .select('nome, especialidade, categoria')
          .in('nome', examesQuebrados)
          .eq('ativo', true)
        
        const mapaCadastro = new Map<string, { especialidade: string | null, categoria: string | null }>()
        if (cadastroExamesQuebrados) {
          for (const ce of cadastroExamesQuebrados) {
            mapaCadastro.set(ce.nome, { especialidade: ce.especialidade, categoria: ce.categoria })
          }
        }
        
        const quebrasAgrupadas = new Map<string, Array<{exame_original: string, exame_quebrado: string, categoria_quebrada: string | null}>>()
        
        for (const regra of regrasQuebra) {
          if (!quebrasAgrupadas.has(regra.exame_original)) {
            quebrasAgrupadas.set(regra.exame_original, [])
          }
          quebrasAgrupadas.get(regra.exame_original)!.push(regra)
        }
        
        console.log(`📋 [${jobId}] v027: ${quebrasAgrupadas.size} tipos de exames com regras de quebra`)
        
        let totalQuebrados = 0
        let totalRegistrosCriados = 0
        
        for (const [exameOriginal, configsQuebra] of quebrasAgrupadas) {
          checkTimeout()
          
          // Processar em lotes
          let offsetQuebra = 0
          const limitQuebra = 500
          
          while (true) {
            checkTimeout()
            
            const { data: registrosOriginais, error: errorRegistros } = await supabase
              .from('volumetria_mobilemed')
              .select('*')
              .eq('arquivo_fonte', arquivoFonte)
              .eq('ESTUDO_DESCRICAO', exameOriginal)
              .range(offsetQuebra, offsetQuebra + limitQuebra - 1)
            
            if (errorRegistros) {
              console.error(`⚠️ [${jobId}] Erro ao buscar registros para quebra ${exameOriginal}:`, errorRegistros)
              break
            }
            
            if (!registrosOriginais || registrosOriginais.length === 0) break
            
            // Coletar todos os registros para inserção em lote
            const registrosParaInserir: any[] = []
            const idsParaDeletar: string[] = []
            
            for (const registroOriginal of registrosOriginais) {
              const prioridadeOriginal = registroOriginal.PRIORIDADE
              
              const registrosQuebrados = configsQuebra.map((config) => {
                const novoRegistro = { ...registroOriginal }
                delete novoRegistro.id
                delete novoRegistro.created_at
                delete novoRegistro.updated_at
                
                const dadosCadastro = mapaCadastro.get(config.exame_quebrado)
                
                return {
                  ...novoRegistro,
                  ESTUDO_DESCRICAO: config.exame_quebrado,
                  VALORES: 1,
                  ESPECIALIDADE: dadosCadastro?.especialidade || registroOriginal.ESPECIALIDADE,
                  CATEGORIA: dadosCadastro?.categoria || config.categoria_quebrada || registroOriginal.CATEGORIA || 'SC',
                  PRIORIDADE: prioridadeOriginal,
                  updated_at: new Date().toISOString()
                }
              })
              
              registrosParaInserir.push(...registrosQuebrados)
              idsParaDeletar.push(registroOriginal.id)
            }
            
            // Inserir em lote
            if (registrosParaInserir.length > 0) {
              const { error: errorInsert } = await supabase
                .from('volumetria_mobilemed')
                .insert(registrosParaInserir)
              
              if (errorInsert) {
                console.error(`⚠️ [${jobId}] Erro ao inserir quebras:`, errorInsert)
              } else {
                // Deletar originais em lote
                const { error: errorDelete } = await supabase
                  .from('volumetria_mobilemed')
                  .delete()
                  .in('id', idsParaDeletar)
                
                if (!errorDelete) {
                  totalQuebrados += idsParaDeletar.length
                  totalRegistrosCriados += registrosParaInserir.length
                }
              }
            }
            
            offsetQuebra += limitQuebra
            if (registrosOriginais.length < limitQuebra) break
          }
        }
        
        console.log(`✅ [${jobId}] v027: ${totalQuebrados} exames quebrados → ${totalRegistrosCriados} registros criados`)
      } else {
        console.log(`ℹ️ [${jobId}] v027: Nenhuma regra de quebra ativa encontrada`)
      }
      
      regrasAplicadas.push('v027')
    } catch (v027Err: any) {
      if (v027Err.message === 'TIMEOUT') throw v027Err
      console.error(`❌ [${jobId}] Erro v027:`, v027Err.message)
    }
  }

  checkTimeout()

  // v034: Regra Colunas x Músculo x Neuro - converte ESPECIALIDADE=COLUNAS para NEURO ou MUSCULO ESQUELETICO
  if (!jaAplicada('v034')) {
    try {
      console.log(`🔧 [${jobId}] v034: Aplicando regra Colunas x Músculo x Neuro...`)
      
      // Buscar neurologistas
      const { data: neurologistasDb } = await supabase
        .from('medicos_neurologistas')
        .select('nome')
        .eq('ativo', true)
      
      const medicosNeuroLista = neurologistasDb?.map((n: any) => n.nome.toUpperCase().replace(/^DR[A]?\s+/i, '').trim()) || []
      
      if (medicosNeuroLista.length === 0) {
        console.warn(`⚠️ [${jobId}] v034: Nenhum neurologista cadastrado na tabela`)
      } else {
        console.log(`👨‍⚕️ [${jobId}] v034: ${medicosNeuroLista.length} neurologistas carregados`)
        
        // Buscar registros com ESPECIALIDADE = COLUNAS
        const { data: registrosColunas } = await supabase
          .from('volumetria_mobilemed')
          .select('id, MEDICO')
          .eq('arquivo_fonte', arquivoFonte)
          .or('ESPECIALIDADE.eq.COLUNAS,ESPECIALIDADE.eq.Colunas,ESPECIALIDADE.ilike.colunas')
        
        if (registrosColunas && registrosColunas.length > 0) {
          console.log(`📊 [${jobId}] v034: ${registrosColunas.length} registros com ESPECIALIDADE=COLUNAS`)
          
          const idsNeuro: string[] = []
          const idsMusculo: string[] = []
          
          for (const registro of registrosColunas) {
            const medico = (registro.MEDICO || '').toUpperCase().replace(/^DR[A]?\s+/i, '').trim()
            
            let ehNeurologista = false
            for (const medicoNeuro of medicosNeuroLista) {
              if (medico === medicoNeuro || medico.startsWith(medicoNeuro.split(' ')[0])) {
                ehNeurologista = true
                break
              }
            }
            
            if (ehNeurologista) {
              idsNeuro.push(registro.id)
            } else {
              idsMusculo.push(registro.id)
            }
          }
          
          console.log(`📋 [${jobId}] v034: ${idsNeuro.length} → NEURO, ${idsMusculo.length} → MUSCULO ESQUELETICO`)
          
          // Atualizar NEURO em batch (ESPECIALIDADE e CATEGORIA)
          if (idsNeuro.length > 0) {
            for (let i = 0; i < idsNeuro.length; i += 500) {
              checkTimeout()
              const batch = idsNeuro.slice(i, i + 500)
              await supabase
                .from('volumetria_mobilemed')
                .update({ ESPECIALIDADE: 'NEURO', CATEGORIA: 'NEURO', updated_at: new Date().toISOString() })
                .in('id', batch)
            }
          }
          
          // Atualizar MUSCULO ESQUELETICO em batch (ESPECIALIDADE e CATEGORIA)
          if (idsMusculo.length > 0) {
            for (let i = 0; i < idsMusculo.length; i += 500) {
              checkTimeout()
              const batch = idsMusculo.slice(i, i + 500)
              await supabase
                .from('volumetria_mobilemed')
                .update({ ESPECIALIDADE: 'MUSCULO ESQUELETICO', CATEGORIA: 'MUSCULO ESQUELETICO', updated_at: new Date().toISOString() })
                .in('id', batch)
            }
          }
          
          console.log(`✅ [${jobId}] v034: Atualizações concluídas`)
        } else {
          console.log(`✅ [${jobId}] v034: Nenhum registro com ESPECIALIDADE=COLUNAS`)
        }
      }
      
      regrasAplicadas.push('v034')
    } catch (v034Err: any) {
      if (v034Err.message === 'TIMEOUT') throw v034Err
      console.error(`❌ [${jobId}] Erro v034:`, v034Err.message)
    }
  }

  console.log(`✅ [${jobId}] FASE 3 concluída: ${regrasAplicadas.length} regras aplicadas`)

  return {
    fase: 'fase3',
    regrasAplicadas,
    proximaFase: null,
    tempoMs: Date.now() - startTime,
    completa: true
  }
}

// ===== FUNÇÃO PRINCIPAL QUE ORQUESTRA O PROCESSAMENTO =====
async function processarArquivo(
  supabase: any,
  arquivoFonte: string,
  periodoReferencia: string,
  jobId: string,
  faseInicial: ProcessingPhase = 'fase1'
) {
  console.log(`🚀 [${jobId}] Iniciando processamento: ${arquivoFonte} (fase: ${faseInicial})`)
  
  let todasRegrasAplicadas: string[] = []
  let faseAtual: ProcessingPhase | null = faseInicial
  const startTimeTotal = Date.now()
  let tentativas = 0
  const MAX_TENTATIVAS = 10  // Máximo de re-tentativas por timeout

  try {
    // Carregar progresso anterior se existir
    const progressoAnterior = await carregarProgresso(supabase, jobId)
    if (progressoAnterior) {
      console.log(`📂 [${jobId}] Retomando da fase ${progressoAnterior.fase}`)
      faseAtual = progressoAnterior.fase
      todasRegrasAplicadas = progressoAnterior.regrasAplicadas || []
    }
    
    // Inicializar log se for nova execução
    if (faseInicial === 'fase1' && !progressoAnterior) {
      const { count: antesCount } = await supabase
        .from('volumetria_mobilemed')
        .select('*', { count: 'exact', head: true })
        .eq('arquivo_fonte', arquivoFonte)

      if (!antesCount || antesCount === 0) {
        await supabase.from('processamento_regras_log').upsert({
          id: jobId,
          arquivo_fonte: arquivoFonte,
          periodo_referencia: periodoReferencia,
          status: 'concluido',
          registros_antes: 0,
          registros_depois: 0,
          regras_aplicadas: [],
          completed_at: new Date().toISOString(),
          mensagem: 'Arquivo sem registros'
        })
        console.log(`ℹ️ [${jobId}] Arquivo sem registros`)
        return
      }

      console.log(`📊 [${jobId}] Registros encontrados: ${antesCount}`)

      await supabase.from('processamento_regras_log').upsert({
        id: jobId,
        arquivo_fonte: arquivoFonte,
        periodo_referencia: periodoReferencia,
        status: 'processando',
        registros_antes: antesCount,
        started_at: new Date().toISOString(),
        mensagem: `Iniciando processamento (${antesCount} registros)`
      })
    }

    // Executar fases em sequência com retry automático
    while (faseAtual && tentativas < MAX_TENTATIVAS) {
      const startTimeFase = Date.now()
      let resultado: PhaseResult

      try {
        // Carregar progresso atual para a fase
        const progressoFase = await carregarProgresso(supabase, jobId)
        
        switch (faseAtual) {
          case 'fase1':
            resultado = await executarFase1(supabase, arquivoFonte, periodoReferencia, jobId, startTimeFase, progressoFase || undefined)
            break
          case 'fase2':
            resultado = await executarFase2(supabase, arquivoFonte, jobId, startTimeFase, progressoFase || undefined)
            break
          case 'fase3':
            resultado = await executarFase3(supabase, arquivoFonte, jobId, startTimeFase, progressoFase || undefined)
            break
          default:
            resultado = { fase: 'completo', regrasAplicadas: [], proximaFase: null, tempoMs: 0, completa: true }
        }

        todasRegrasAplicadas = [...new Set([...todasRegrasAplicadas, ...resultado.regrasAplicadas])]
        
        // Atualizar log com progresso
        await supabase.from('processamento_regras_log').update({
          regras_aplicadas: todasRegrasAplicadas,
          mensagem: `${resultado.fase} concluída em ${Math.round(resultado.tempoMs / 1000)}s`,
          progresso_fase: null  // Limpar progresso pois a fase foi concluída
        }).eq('id', jobId)

        // Avançar para próxima fase
        faseAtual = resultado.proximaFase
        tentativas = 0  // Reset tentativas ao completar uma fase

      } catch (faseError: any) {
        console.error(`❌ [${jobId}] Erro na ${faseAtual}:`, faseError.message)
        
        // Se deu timeout, continuar na mesma fase (não pular!)
        if (faseError.message === 'TIMEOUT') {
          tentativas++
          console.log(`⚠️ [${jobId}] Timeout na ${faseAtual} (tentativa ${tentativas}/${MAX_TENTATIVAS}) - continuando...`)
          
          // Atualizar log
          await supabase.from('processamento_regras_log').update({
            mensagem: `Timeout na ${faseAtual} (tentativa ${tentativas}/${MAX_TENTATIVAS}) - continuando...`
          }).eq('id', jobId)
          
          // Aguardar um pouco antes de re-tentar
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          // Continuar na mesma fase
          continue
        }
        
        throw faseError
      }
    }

    // Verificar se excedeu tentativas
    if (tentativas >= MAX_TENTATIVAS) {
      throw new Error(`Excedeu ${MAX_TENTATIVAS} tentativas de timeout`)
    }

    // Contar registros depois
    const { count: depoisCount } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', arquivoFonte)

    const tempoTotal = Math.round((Date.now() - startTimeTotal) / 1000)
    console.log(`✅ [${jobId}] Arquivo ${arquivoFonte} processado completamente em ${tempoTotal}s`)

    // Buscar registros_antes do log
    const { data: logData } = await supabase
      .from('processamento_regras_log')
      .select('registros_antes')
      .eq('id', jobId)
      .single()

    // Atualizar log de conclusão
    const { error: updateError } = await supabase.from('processamento_regras_log').update({
      status: 'concluido',
      registros_depois: depoisCount || 0,
      registros_excluidos: (logData?.registros_antes || 0) - (depoisCount || 0),
      regras_aplicadas: todasRegrasAplicadas,
      completed_at: new Date().toISOString(),
      mensagem: `Processamento concluído em ${tempoTotal}s`,
      progresso_fase: null
    }).eq('id', jobId)

    if (updateError) {
      console.error(`❌ [${jobId}] Erro ao atualizar status para concluído:`, updateError)
    } else {
      console.log(`✅ [${jobId}] Status atualizado para concluído no banco`)
    }

  } catch (error: any) {
    console.error(`❌ [${jobId}] Erro no arquivo ${arquivoFonte}:`, error)
    
    await supabase.from('processamento_regras_log').update({
      status: 'erro',
      erro: error.message || 'Erro desconhecido',
      regras_aplicadas: todasRegrasAplicadas,
      completed_at: new Date().toISOString()
    }).eq('id', jobId)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    const { arquivo_fonte, periodo_referencia, fase } = body

    if (!arquivo_fonte) {
      return new Response(
        JSON.stringify({ erro: 'arquivo_fonte é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!periodo_referencia) {
      return new Response(
        JSON.stringify({ erro: 'periodo_referencia é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Gerar ID único para o job (ou usar existente se for continuação)
    const jobId = body.job_id || crypto.randomUUID()
    const faseInicial: ProcessingPhase = fase || 'fase1'
    
    console.log(`📁 [${jobId}] Iniciando processamento: ${arquivo_fonte}`)
    console.log(`📅 [${jobId}] Período: ${periodo_referencia}`)
    console.log(`🔧 [${jobId}] Fase inicial: ${faseInicial}`)

    // Iniciar processamento em background
    EdgeRuntime.waitUntil(
      processarArquivo(supabase, arquivo_fonte, periodo_referencia, jobId, faseInicial)
    )

    // Retornar resposta imediata
    return new Response(
      JSON.stringify({
        sucesso: true,
        job_id: jobId,
        arquivo: arquivo_fonte,
        fase_inicial: faseInicial,
        mensagem: 'Processamento iniciado em background com retry automático.',
        status: 'processando'
      }),
      { 
        status: 202,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error: any) {
    console.error('❌ Erro geral:', error)
    return new Response(
      JSON.stringify({ erro: error.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
