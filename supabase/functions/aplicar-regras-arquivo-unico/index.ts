import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função para aplicar todas as regras em UM ÚNICO arquivo
async function aplicarRegrasArquivo(
  supabase: any,
  arquivoFonte: string,
  periodoReferencia: string,
  jobId: string
) {
  console.log(`🚀 [${jobId}] Aplicando regras no arquivo: ${arquivoFonte}`)
  
  const regrasAplicadas: string[] = []

  try {
    // Atualizar status para processando
    await supabase.from('processamento_regras_log').upsert({
      id: jobId,
      arquivo_fonte: arquivoFonte,
      periodo_referencia: periodoReferencia,
      status: 'processando',
      started_at: new Date().toISOString()
    })

    // Contar registros antes
    const { count: antesCount } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', arquivoFonte)

    if (!antesCount || antesCount === 0) {
      await supabase.from('processamento_regras_log').update({
        status: 'concluido',
        registros_antes: 0,
        registros_depois: 0,
        regras_aplicadas: [],
        completed_at: new Date().toISOString(),
        mensagem: 'Arquivo sem registros'
      }).eq('id', jobId)

      console.log(`ℹ️ [${jobId}] Arquivo sem registros`)
      return
    }

    console.log(`📊 [${jobId}] Registros encontrados: ${antesCount}`)

    // ===== VERIFICAR SE É ARQUIVO RETROATIVO PARA APLICAR v002/v003 =====
    const isRetroativo = arquivoFonte.includes('retroativo')
    
    if (isRetroativo) {
      console.log(`🔄 [${jobId}] Arquivo retroativo detectado - aplicando regras v002/v003`)
      
      // Parsear período para calcular datas
      let anoCompleto: number = 0
      let mesNumero: number = 0
      const periodoStr = String(periodoReferencia || '').trim()
      
      // Formato YYYY-MM
      if (/^\d{4}-\d{2}$/.test(periodoStr)) {
        const [ano, mes] = periodoStr.split('-')
        anoCompleto = parseInt(ano)
        mesNumero = parseInt(mes)
      } 
      // Formato mes/YY
      else if (/^[a-zA-Z]{3}\/\d{2}$/.test(periodoStr)) {
        const [mes, ano] = periodoStr.split('/')
        const meses: { [key: string]: number } = {
          'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
          'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12
        }
        anoCompleto = 2000 + parseInt(ano)
        mesNumero = meses[mes.toLowerCase()] || 0
      }
      // Formato YYYY/MM
      else if (/^\d{4}\/\d{2}$/.test(periodoStr)) {
        const [ano, mes] = periodoStr.split('/')
        anoCompleto = parseInt(ano)
        mesNumero = parseInt(mes)
      }

      if (anoCompleto >= 2020 && mesNumero >= 1 && mesNumero <= 12) {
        // v003: Excluir DATA_REALIZACAO >= primeiro dia do mês de referência
        const dataLimiteRealizacao = new Date(Date.UTC(anoCompleto, mesNumero - 1, 1))
        const dataLimiteRealizacaoStr = dataLimiteRealizacao.toISOString().split('T')[0]
        
        // v002: Manter DATA_LAUDO entre dia 8 do mês ref e dia 7 do mês seguinte
        const dataInicioJanelaLaudo = new Date(Date.UTC(anoCompleto, mesNumero - 1, 8))
        const dataFimJanelaLaudo = new Date(Date.UTC(anoCompleto, mesNumero, 7))
        const dataInicioJanelaLaudoStr = dataInicioJanelaLaudo.toISOString().split('T')[0]
        const dataFimJanelaLaudoStr = dataFimJanelaLaudo.toISOString().split('T')[0]

        console.log(`📊 [${jobId}] v003: Excluir DATA_REALIZACAO >= ${dataLimiteRealizacaoStr}`)
        console.log(`📊 [${jobId}] v002: Manter DATA_LAUDO entre ${dataInicioJanelaLaudoStr} e ${dataFimJanelaLaudoStr}`)

        // v003: Excluir em lotes
        let totalExcludosV003 = 0
        const BATCH_SIZE = 100
        
        while (true) {
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
            .in('id', idsToDelete.map(r => r.id))

          totalExcludosV003 += count || 0
          if ((count || 0) < BATCH_SIZE) break
          await new Promise(resolve => setTimeout(resolve, 30))
        }
        
        console.log(`✅ [${jobId}] v003: ${totalExcludosV003} registros excluídos`)
        regrasAplicadas.push('v003')

        // v002: Excluir em lotes (DATA_LAUDO fora da janela)
        let totalExcludosV002 = 0
        
        while (true) {
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
            .in('id', idsToDelete.map(r => r.id))

          totalExcludosV002 += count || 0
          if ((count || 0) < BATCH_SIZE) break
          await new Promise(resolve => setTimeout(resolve, 30))
        }
        
        console.log(`✅ [${jobId}] v002: ${totalExcludosV002} registros excluídos`)
        regrasAplicadas.push('v002')
      } else {
        console.warn(`⚠️ [${jobId}] Não foi possível parsear período "${periodoStr}" para v002/v003`)
      }
    }

    // ===== REGRAS DE EXCLUSÃO =====
    
    // v004: Exclusões de clientes específicos
    await supabase.from('volumetria_mobilemed')
      .delete()
      .eq('arquivo_fonte', arquivoFonte)
      .in('EMPRESA', ['CLINICA SERCOR', 'INMED', 'MEDICINA OCUPACIONAL'])
    regrasAplicadas.push('v004')

    // v017: Exclusões registros rejeitados
    await supabase.from('volumetria_mobilemed')
      .delete()
      .eq('arquivo_fonte', arquivoFonte)
      .or('ESTUDO_DESCRICAO.is.null,ESTUDO_DESCRICAO.eq.,EMPRESA.is.null,EMPRESA.eq.')
    regrasAplicadas.push('v017')

    // v032: Exclusão de clientes com TESTE
    await supabase.from('volumetria_mobilemed')
      .delete()
      .eq('arquivo_fonte', arquivoFonte)
      .like('EMPRESA', '%TESTE%')
    regrasAplicadas.push('v032')

    // ===== REGRAS DE NORMALIZAÇÃO =====

    // v001: CEDI unificação
    await supabase.from('volumetria_mobilemed')
      .update({ EMPRESA: 'CEDIDIAG' })
      .eq('arquivo_fonte', arquivoFonte)
      .in('EMPRESA', ['CEDI-RJ','CEDI-RO','CEDI-UNIMED','CEDI_RJ','CEDI_RO','CEDI_UNIMED'])
    regrasAplicadas.push('v001')

    // v001b: Normalizar sufixo _TELE - buscar TODOS
    let offsetTele = 0
    const limitTele = 500
    const empresasTeleProcessadas = new Set<string>()
    
    while (true) {
      const { data: clientesTele } = await supabase
        .from('volumetria_mobilemed')
        .select('"EMPRESA"')
        .eq('arquivo_fonte', arquivoFonte)
        .like('EMPRESA', '%_TELE')
        .range(offsetTele, offsetTele + limitTele - 1)
      
      if (!clientesTele || clientesTele.length === 0) break
      
      for (const c of clientesTele) {
        const empresaTele = c.EMPRESA
        if (empresaTele && typeof empresaTele === 'string' && empresaTele.endsWith('_TELE') && !empresasTeleProcessadas.has(empresaTele)) {
          empresasTeleProcessadas.add(empresaTele)
          const empresaNormalizada = empresaTele.replace(/_TELE$/, '')
          await supabase.from('volumetria_mobilemed')
            .update({ EMPRESA: empresaNormalizada })
            .eq('arquivo_fonte', arquivoFonte)
            .eq('EMPRESA', empresaTele)
        }
      }
      
      offsetTele += limitTele
      if (clientesTele.length < limitTele) break
      await new Promise(resolve => setTimeout(resolve, 30))
    }
    regrasAplicadas.push('v001b')

    // v001c: Normalização de nomes de médicos - buscar TODOS
    let offsetMedicos = 0
    const limitMedicos = 500
    
    while (true) {
      const { data: mapeamentoMedicos } = await supabase
        .from('mapeamento_nomes_medicos')
        .select('nome_origem_normalizado, medico_nome')
        .eq('ativo', true)
        .range(offsetMedicos, offsetMedicos + limitMedicos - 1)
      
      if (!mapeamentoMedicos || mapeamentoMedicos.length === 0) break
      
      for (const mapeamento of mapeamentoMedicos) {
        if (mapeamento.nome_origem_normalizado && mapeamento.medico_nome) {
          await supabase
            .from('volumetria_mobilemed')
            .update({ MEDICO: mapeamento.medico_nome, updated_at: new Date().toISOString() })
            .eq('arquivo_fonte', arquivoFonte)
            .ilike('MEDICO', mapeamento.nome_origem_normalizado)
        }
      }
      
      offsetMedicos += limitMedicos
      if (mapeamentoMedicos.length < limitMedicos) break
      await new Promise(resolve => setTimeout(resolve, 30))
    }
    regrasAplicadas.push('v001c')

    // v001d: De-Para valores zerados - buscar TODOS
    let offsetValores = 0
    const limitValores = 500
    
    while (true) {
      const { data: valoresReferencia } = await supabase
        .from('valores_referencia_de_para')
        .select('estudo_descricao, valores')
        .eq('ativo', true)
        .range(offsetValores, offsetValores + limitValores - 1)
      
      if (!valoresReferencia || valoresReferencia.length === 0) break
      
      for (const ref of valoresReferencia) {
        if (ref.estudo_descricao && ref.valores && ref.valores > 0) {
          await supabase
            .from('volumetria_mobilemed')
            .update({ VALOR: ref.valores, updated_at: new Date().toISOString() })
            .eq('arquivo_fonte', arquivoFonte)
            .eq('ESTUDO_DESCRICAO', ref.estudo_descricao)
            .or('VALOR.is.null,VALOR.eq.0')
        }
      }
      
      offsetValores += limitValores
      if (valoresReferencia.length < limitValores) break
      await new Promise(resolve => setTimeout(resolve, 30))
    }
    regrasAplicadas.push('v001d')

    // v005: Correções modalidade - buscar TODOS exames MAMO
    let offsetMAMO = 0
    const limitMAMO = 500
    
    while (true) {
      const { data: examesMAMO } = await supabase
        .from('cadastro_exames')
        .select('nome')
        .eq('especialidade', 'MAMO')
        .eq('ativo', true)
        .range(offsetMAMO, offsetMAMO + limitMAMO - 1)
      
      if (!examesMAMO || examesMAMO.length === 0) break
      
      for (const exame of examesMAMO) {
        if (exame.nome) {
          await supabase
            .from('volumetria_mobilemed')
            .update({ MODALIDADE: 'MG' })
            .eq('arquivo_fonte', arquivoFonte)
            .in('MODALIDADE', ['CR', 'DX'])
            .eq('ESTUDO_DESCRICAO', exame.nome)
        }
      }
      
      offsetMAMO += limitMAMO
      if (examesMAMO.length < limitMAMO) break
      await new Promise(resolve => setTimeout(resolve, 30))
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

    // v007: Correções de especialidades
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

    // v034: Colunas → NEURO/MUSCULO - buscar TODOS neurologistas
    try {
      let offsetNeuro = 0
      const limitNeuro = 500
      
      while (true) {
        const { data: neurologistas } = await supabase
          .from('medicos_neurologistas')
          .select('nome')
          .eq('ativo', true)
          .range(offsetNeuro, offsetNeuro + limitNeuro - 1)
        
        if (!neurologistas || neurologistas.length === 0) break
        
        for (const neuro of neurologistas) {
          if (neuro.nome) {
            // Colunas de neurologistas → NEURO
            await supabase.from('volumetria_mobilemed')
              .update({ ESPECIALIDADE: 'NEURO' })
              .eq('arquivo_fonte', arquivoFonte)
              .ilike('ESTUDO_DESCRICAO', '%COLUNA%')
              .ilike('MEDICO', `%${neuro.nome}%`)
          }
        }
        
        offsetNeuro += limitNeuro
        if (neurologistas.length < limitNeuro) break
        await new Promise(resolve => setTimeout(resolve, 30))
      }
      
      // Colunas padrão (não neurologistas) → MUSCULO ESQUELETICO
      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'MUSCULO ESQUELETICO' })
        .eq('arquivo_fonte', arquivoFonte)
        .ilike('ESTUDO_DESCRICAO', '%COLUNA%')
        .eq('ESPECIALIDADE', 'COLUNAS')
      
      regrasAplicadas.push('v034')
    } catch (v034Err) {
      console.error(`⚠️ [${jobId}] Erro v034:`, v034Err)
    }

    // v044: MAMA → MAMO
    await supabase.from('volumetria_mobilemed')
      .update({ ESPECIALIDADE: 'MAMO' })
      .eq('arquivo_fonte', arquivoFonte)
      .eq('MODALIDADE', 'MG')
      .eq('ESPECIALIDADE', 'MAMA')
    regrasAplicadas.push('v044')

    // v008: De-Para Prioridades - buscar TODOS
    let offsetPrio = 0
    const limitPrio = 500
    
    while (true) {
      const { data: prioridadesDePara } = await supabase
        .from('valores_prioridade_de_para')
        .select('prioridade_original, nome_final')
        .eq('ativo', true)
        .range(offsetPrio, offsetPrio + limitPrio - 1)
      
      if (!prioridadesDePara || prioridadesDePara.length === 0) break
      
      for (const mapeamento of prioridadesDePara) {
        await supabase.from('volumetria_mobilemed')
          .update({ PRIORIDADE: mapeamento.nome_final })
          .eq('arquivo_fonte', arquivoFonte)
          .eq('PRIORIDADE', mapeamento.prioridade_original)
      }
      
      offsetPrio += limitPrio
      if (prioridadesDePara.length < limitPrio) break
      await new Promise(resolve => setTimeout(resolve, 30))
    }
    regrasAplicadas.push('v008')

    // v009: Prioridade padrão
    await supabase.from('volumetria_mobilemed')
      .update({ PRIORIDADE: 'ROTINA' })
      .eq('arquivo_fonte', arquivoFonte)
      .or('PRIORIDADE.is.null,PRIORIDADE.eq.')
    regrasAplicadas.push('v009')

    // v010: Mapeamento de nomes de clientes
    await supabase.from('volumetria_mobilemed')
      .update({ EMPRESA: 'HOSPITAL SANTA HELENA' })
      .eq('arquivo_fonte', arquivoFonte)
      .like('EMPRESA', '%SANTA HELENA%')
    regrasAplicadas.push('v010')

    // v010a: P-CEMVALENCA_MG
    await supabase.from('volumetria_mobilemed')
      .update({ EMPRESA: 'CEMVALENCA_MG' })
      .eq('arquivo_fonte', arquivoFonte)
      .eq('EMPRESA', 'P-CEMVALENCA_MG')
    regrasAplicadas.push('v010a')

    // v010b: Separação CEMVALENCA
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

    // v011: Categorias de exames - buscar TODOS os exames do cadastro
    console.log(`🏷️ [${jobId}] v011: Buscando todos os exames do cadastro para aplicar categorias...`)
    
    let offsetCadastro = 0
    const limitCadastro = 500
    let totalCategoriasAplicadas = 0
    
    while (true) {
      const { data: cadastroExames, error: cadastroError } = await supabase
        .from('cadastro_exames')
        .select('nome, categoria')
        .eq('ativo', true)
        .not('categoria', 'is', null)
        .range(offsetCadastro, offsetCadastro + limitCadastro - 1)
      
      if (cadastroError) {
        console.error(`❌ [${jobId}] Erro ao buscar cadastro_exames:`, cadastroError)
        break
      }
      
      if (!cadastroExames || cadastroExames.length === 0) break
      
      console.log(`📋 [${jobId}] v011: Processando lote ${Math.floor(offsetCadastro / limitCadastro) + 1} - ${cadastroExames.length} exames`)
      
      for (const exame of cadastroExames) {
        if (exame.nome && exame.categoria) {
          const { count } = await supabase
            .from('volumetria_mobilemed')
            .update({ CATEGORIA: exame.categoria, updated_at: new Date().toISOString() }, { count: 'exact' })
            .eq('arquivo_fonte', arquivoFonte)
            .eq('ESTUDO_DESCRICAO', exame.nome)
            .or('CATEGORIA.is.null,CATEGORIA.eq.')
          
          if (count && count > 0) {
            totalCategoriasAplicadas += count
          }
        }
      }
      
      offsetCadastro += limitCadastro
      
      // Se retornou menos que o limite, chegamos ao fim
      if (cadastroExames.length < limitCadastro) break
      
      // Pequena pausa para não sobrecarregar
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    
    console.log(`✅ [${jobId}] v011: ${totalCategoriasAplicadas} registros atualizados com categoria`)
    regrasAplicadas.push('v011')

    // v012-v014: Especialidades automáticas
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

    // v015: Status padrão
    await supabase.from('volumetria_mobilemed')
      .update({ status: 'ativo' })
      .eq('arquivo_fonte', arquivoFonte)
      .or('status.is.null,status.eq.')
    regrasAplicadas.push('v015')

    // v016: Período referência
    await supabase.from('volumetria_mobilemed')
      .update({ periodo_referencia: periodoReferencia })
      .eq('arquivo_fonte', arquivoFonte)
      .or('periodo_referencia.is.null,periodo_referencia.eq.')
    regrasAplicadas.push('v016')

    // v018-v019: Prioridades
    await supabase.from('volumetria_mobilemed')
      .update({ PRIORIDADE: 'URGENTE' })
      .eq('arquivo_fonte', arquivoFonte)
      .in('PRIORIDADE', ['URG', 'EMERGENCIA', 'EMERGÊNCIA'])

    await supabase.from('volumetria_mobilemed')
      .update({ PRIORIDADE: 'ROTINA' })
      .eq('arquivo_fonte', arquivoFonte)
      .in('PRIORIDADE', ['ROT', 'AMBULATORIO', 'AMBULATÓRIO', 'INTERNADO'])
    
    regrasAplicadas.push('v018-v019')

    // v020: Modalidade mamografia
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

    // v021: Categoria oncologia - corrigido para aplicar apenas onde CATEGORIA está vazio
    // Aplicar para exames com ONCO no nome
    await supabase.from('volumetria_mobilemed')
      .update({ CATEGORIA: 'ONCO' })
      .eq('arquivo_fonte', arquivoFonte)
      .ilike('ESTUDO_DESCRICAO', '%ONCO%')
      .or('CATEGORIA.is.null,CATEGORIA.eq.')
    
    // Aplicar para exames com PET no nome
    await supabase.from('volumetria_mobilemed')
      .update({ CATEGORIA: 'ONCO' })
      .eq('arquivo_fonte', arquivoFonte)
      .ilike('ESTUDO_DESCRICAO', '%PET%')
      .or('CATEGORIA.is.null,CATEGORIA.eq.')
    
    // Aplicar para exames com CINTILOGRAFIA no nome
    await supabase.from('volumetria_mobilemed')
      .update({ CATEGORIA: 'ONCO' })
      .eq('arquivo_fonte', arquivoFonte)
      .ilike('ESTUDO_DESCRICAO', '%CINTILOGRAFIA%')
      .or('CATEGORIA.is.null,CATEGORIA.eq.')
    
    regrasAplicadas.push('v021')

    // v023: Correção valores nulos
    await supabase.from('volumetria_mobilemed')
      .update({ VALOR: 1 })
      .eq('arquivo_fonte', arquivoFonte)
      .or('VALOR.is.null,VALOR.eq.0')
    regrasAplicadas.push('v023')

    // v024: Duplicado padrão
    await supabase.from('volumetria_mobilemed')
      .update({ is_duplicado: false })
      .eq('arquivo_fonte', arquivoFonte)
      .is('is_duplicado', null)
    regrasAplicadas.push('v024')

    // v031: Modalidade e Especialidade do cadastro_exames - buscar TODOS, apenas onde está vazio
    console.log(`🔧 [${jobId}] v031: Aplicando modalidade/especialidade do cadastro (apenas onde vazio)...`)
    
    let offsetV031 = 0
    const limitV031 = 500
    let totalV031Aplicados = 0
    
    while (true) {
      const { data: cadastroCompleto, error: cadastroV031Error } = await supabase
        .from('cadastro_exames')
        .select('nome, modalidade, especialidade')
        .eq('ativo', true)
        .range(offsetV031, offsetV031 + limitV031 - 1)
      
      if (cadastroV031Error) {
        console.error(`❌ [${jobId}] Erro v031:`, cadastroV031Error)
        break
      }
      
      if (!cadastroCompleto || cadastroCompleto.length === 0) break
      
      console.log(`📋 [${jobId}] v031: Processando lote ${Math.floor(offsetV031 / limitV031) + 1} - ${cadastroCompleto.length} exames`)
      
      for (const exame of cadastroCompleto) {
        if (exame.nome) {
          // Atualizar MODALIDADE apenas onde está vazio
          if (exame.modalidade) {
            const { count: countMod } = await supabase
              .from('volumetria_mobilemed')
              .update({ MODALIDADE: exame.modalidade, updated_at: new Date().toISOString() }, { count: 'exact' })
              .eq('arquivo_fonte', arquivoFonte)
              .eq('ESTUDO_DESCRICAO', exame.nome)
              .or('MODALIDADE.is.null,MODALIDADE.eq.')
            
            if (countMod && countMod > 0) totalV031Aplicados += countMod
          }
          
          // Atualizar ESPECIALIDADE apenas onde está vazio
          if (exame.especialidade) {
            const { count: countEsp } = await supabase
              .from('volumetria_mobilemed')
              .update({ ESPECIALIDADE: exame.especialidade, updated_at: new Date().toISOString() }, { count: 'exact' })
              .eq('arquivo_fonte', arquivoFonte)
              .eq('ESTUDO_DESCRICAO', exame.nome)
              .or('ESPECIALIDADE.is.null,ESPECIALIDADE.eq.')
            
            if (countEsp && countEsp > 0) totalV031Aplicados += countEsp
          }
        }
      }
      
      offsetV031 += limitV031
      if (cadastroCompleto.length < limitV031) break
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    
    console.log(`✅ [${jobId}] v031: ${totalV031Aplicados} atualizações aplicadas`)
    regrasAplicadas.push('v031')

    // ===== v027: QUEBRA DE EXAMES =====
    console.log(`🔧 [${jobId}] v027: Aplicando quebra de exames...`)
    
    try {
      // Buscar todas as regras de quebra ativas
      const { data: regrasQuebra, error: errorRegras } = await supabase
        .from('regras_quebra_exames')
        .select('exame_original, exame_quebrado, categoria_quebrada')
        .eq('ativo', true)
      
      if (errorRegras) {
        console.error(`⚠️ [${jobId}] Erro ao buscar regras de quebra:`, errorRegras)
      } else if (regrasQuebra && regrasQuebra.length > 0) {
        // Agrupar quebras por exame original
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
        
        // Processar cada tipo de exame original
        for (const [exameOriginal, configsQuebra] of quebrasAgrupadas) {
          const quantidadeQuebras = configsQuebra.length
          
          // Buscar TODOS os registros deste exame original em lotes
          let offsetQuebra = 0
          const limitQuebra = 500
          
          while (true) {
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
            
            // Processar cada registro original
            for (const registroOriginal of registrosOriginais) {
              try {
                const valorOriginal = registroOriginal.VALOR || registroOriginal.VALORES || 1
                
                // Criar registros quebrados
                const registrosQuebrados = configsQuebra.map((config) => {
                  const novoRegistro = { ...registroOriginal }
                  delete novoRegistro.id
                  delete novoRegistro.created_at
                  delete novoRegistro.updated_at
                  
                  return {
                    ...novoRegistro,
                    ESTUDO_DESCRICAO: config.exame_quebrado,
                    VALOR: 1, // Cada exame quebrado vale 1
                    VALORES: 1,
                    CATEGORIA: config.categoria_quebrada || registroOriginal.CATEGORIA || 'SC',
                    updated_at: new Date().toISOString()
                  }
                })
                
                // Inserir registros quebrados
                const { error: errorInsert } = await supabase
                  .from('volumetria_mobilemed')
                  .insert(registrosQuebrados)
                
                if (errorInsert) {
                  console.error(`⚠️ [${jobId}] Erro ao inserir quebras:`, errorInsert)
                  continue
                }
                
                // Remover registro original
                const { error: errorDelete } = await supabase
                  .from('volumetria_mobilemed')
                  .delete()
                  .eq('id', registroOriginal.id)
                
                if (errorDelete) {
                  console.error(`⚠️ [${jobId}] Erro ao remover original:`, errorDelete)
                  continue
                }
                
                totalQuebrados++
                totalRegistrosCriados += quantidadeQuebras
                
              } catch (quebraErr: any) {
                console.error(`⚠️ [${jobId}] Erro ao quebrar registro:`, quebraErr.message)
              }
            }
            
            offsetQuebra += limitQuebra
            if (registrosOriginais.length < limitQuebra) break
            await new Promise(resolve => setTimeout(resolve, 30))
          }
        }
        
        console.log(`✅ [${jobId}] v027: ${totalQuebrados} exames quebrados → ${totalRegistrosCriados} registros criados`)
      } else {
        console.log(`ℹ️ [${jobId}] v027: Nenhuma regra de quebra ativa encontrada`)
      }
      
      regrasAplicadas.push('v027')
    } catch (v027Err: any) {
      console.error(`❌ [${jobId}] Erro v027:`, v027Err.message)
    }

    // Contar registros depois
    const { count: depoisCount } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', arquivoFonte)

    console.log(`✅ [${jobId}] Arquivo ${arquivoFonte} processado: ${antesCount} → ${depoisCount || 0} registros`)

    // Atualizar log de conclusão
    await supabase.from('processamento_regras_log').update({
      status: 'concluido',
      registros_antes: antesCount,
      registros_depois: depoisCount || 0,
      registros_excluidos: antesCount - (depoisCount || 0),
      regras_aplicadas: regrasAplicadas,
      completed_at: new Date().toISOString(),
      mensagem: 'Processamento concluído com sucesso'
    }).eq('id', jobId)

  } catch (error: any) {
    console.error(`❌ [${jobId}] Erro no arquivo ${arquivoFonte}:`, error)
    
    await supabase.from('processamento_regras_log').update({
      status: 'erro',
      erro: error.message || 'Erro desconhecido',
      regras_aplicadas: regrasAplicadas,
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
    const { arquivo_fonte, periodo_referencia } = body

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

    // Gerar ID único para o job
    const jobId = crypto.randomUUID()
    
    console.log(`📁 [${jobId}] Iniciando processamento: ${arquivo_fonte}`)
    console.log(`📅 [${jobId}] Período: ${periodo_referencia}`)

    // Iniciar processamento em background
    EdgeRuntime.waitUntil(
      aplicarRegrasArquivo(supabase, arquivo_fonte, periodo_referencia, jobId)
    )

    // Retornar resposta imediata
    return new Response(
      JSON.stringify({
        sucesso: true,
        job_id: jobId,
        arquivo: arquivo_fonte,
        mensagem: 'Processamento iniciado em background. Consulte o status via job_id.',
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
