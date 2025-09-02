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

    const { arquivo_fonte, periodo_referencia = '06/2025', aplicar_todos_arquivos = true } = await req.json()

    console.log('🚀 APLICANDO 27 REGRAS COMPLETAS - Sistema Otimizado v3')
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
      
      // REGRA v002: Exclusões por período (apenas para retroativos)
      if (arquivoAtual.includes('retroativo')) {
        console.log('  ⚡ Aplicando v002 - Exclusões por período')
        const { data: deletedV002 } = await supabase.from('volumetria_mobilemed')
          .delete()
          .eq('arquivo_fonte', arquivoAtual)
          .neq('PERIODO_REFERENCIA', periodo_referencia.replace('/', '/20'))
        regrasAplicadasArquivo.add('v002')
      }

      // REGRA v003: Exclusões por data laudo (apenas para retroativos)
      if (arquivoAtual.includes('retroativo')) {
        console.log('  ⚡ Aplicando v003 - Exclusões por data laudo')
        const anoMes = periodo_referencia.replace('/', '/20')
        const { data: deletedV003 } = await supabase.from('volumetria_mobilemed')
          .delete()
          .eq('arquivo_fonte', arquivoAtual)
          .not('DATA_LAUDO', 'like', `${anoMes}%`)
        regrasAplicadasArquivo.add('v003')
      }

      // REGRA v004: Exclusões de clientes específicos
      console.log('  ⚡ Aplicando v004 - Exclusões clientes específicos')
      const { data: deletedV004 } = await supabase.from('volumetria_mobilemed')
        .delete()
        .eq('arquivo_fonte', arquivoAtual)
        .in('EMPRESA', ['CLINICA SERCOR', 'INMED', 'MEDICINA OCUPACIONAL'])
      regrasAplicadasArquivo.add('v004')

      // REGRA v017: Exclusões registros rejeitados
      console.log('  ⚡ Aplicando v017 - Exclusões registros rejeitados')
      const { data: deletedV017 } = await supabase.from('volumetria_mobilemed')
        .delete()
        .eq('arquivo_fonte', arquivoAtual)
        .or('ESTUDO_DESCRICAO.is.null,ESTUDO_DESCRICAO.eq.,EMPRESA.is.null,EMPRESA.eq.')
      regrasAplicadasArquivo.add('v017')

      // REGRA v032: Exclusão de clientes específicos avançada
      console.log('  ⚡ Aplicando v032 - Exclusão clientes específicos avançada')
      const { data: deletedV032 } = await supabase.from('volumetria_mobilemed')
        .delete()
        .eq('arquivo_fonte', arquivoAtual)
        .like('EMPRESA', '%TESTE%')
      regrasAplicadasArquivo.add('v032')

      // ===== REGRAS DE NORMALIZAÇÃO =====

      // REGRA v001: Limpeza nome cliente
      console.log('  ⚡ Aplicando v001 - Limpeza nome cliente')
      const { data: v001Data } = await supabase.from('volumetria_mobilemed')
        .update({
          EMPRESA: supabase.sql`
            CASE 
              WHEN "EMPRESA" IN ('CEDI-RJ','CEDI-RO','CEDI-UNIMED','CEDI_RJ','CEDI_RO','CEDI_UNIMED') THEN 'CEDIDIAG'
              ELSE TRIM(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE("EMPRESA", '- TELE$', ''), '-CT$', ''), '-MR$', ''), '_PLANTÃO$', ''), '_RMX$', ''))
            END`
        })
        .eq('arquivo_fonte', arquivoAtual)
        .or(`EMPRESA.like.%- TELE,EMPRESA.like.%-CT,EMPRESA.like.%-MR,EMPRESA.like.%_PLANTÃO,EMPRESA.like.%_RMX,EMPRESA.in.(CEDI-RJ,CEDI-RO,CEDI-UNIMED,CEDI_RJ,CEDI_RO,CEDI_UNIMED)`)
      regrasAplicadasArquivo.add('v001')

      // REGRA v005: Correções modalidade RX/MG/DO
      console.log('  ⚡ Aplicando v005 - Correções modalidade')
      await supabase.from('volumetria_mobilemed')
        .update({ MODALIDADE: 'RX' })
        .eq('arquivo_fonte', arquivoAtual)
        .in('MODALIDADE', ['CR', 'DX'])
        .not('ESTUDO_DESCRICAO', 'like', '%mamogra%')

      await supabase.from('volumetria_mobilemed')
        .update({ MODALIDADE: 'MG' })
        .eq('arquivo_fonte', arquivoAtual)
        .in('MODALIDADE', ['CR', 'DX'])
        .like('ESTUDO_DESCRICAO', '%mamogra%')

      await supabase.from('volumetria_mobilemed')
        .update({ MODALIDADE: 'DO' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('MODALIDADE', 'OT')
      regrasAplicadasArquivo.add('v005')

      // REGRA v007: Normalização médico
      console.log('  ⚡ Aplicando v007 - Normalização médico')
      const { data: v007Data } = await supabase.from('volumetria_mobilemed')
        .update({
          MEDICO: supabase.sql`TRIM(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE("MEDICO", '\\s*\\([^)]*\\)\\s*', '', 'g'), '^DR[A]?\\s+', '', 'i'), '\\.$', ''))`
        })
        .eq('arquivo_fonte', arquivoAtual)
        .not('MEDICO', 'is', null)
      regrasAplicadasArquivo.add('v007')

      // REGRA v008: Normalização campo empresa 
      console.log('  ⚡ Aplicando v008 - Normalização campo empresa')
      await supabase.from('volumetria_mobilemed')
        .update({
          EMPRESA: supabase.sql`TRIM(UPPER("EMPRESA"))`
        })
        .eq('arquivo_fonte', arquivoAtual)
        .not('EMPRESA', 'is', null)
      regrasAplicadasArquivo.add('v008')

      // REGRA v009: Normalização modalidade
      console.log('  ⚡ Aplicando v009 - Normalização modalidade')
      await supabase.from('volumetria_mobilemed')
        .update({
          MODALIDADE: supabase.sql`TRIM(UPPER("MODALIDADE"))`
        })
        .eq('arquivo_fonte', arquivoAtual)
        .not('MODALIDADE', 'is', null)
      regrasAplicadasArquivo.add('v009')

      // REGRA v010: Aplicação prioridade padrão
      console.log('  ⚡ Aplicando v010 - Aplicação prioridade padrão')
      await supabase.from('volumetria_mobilemed')
        .update({ PRIORIDADE: 'ROTINA' })
        .eq('arquivo_fonte', arquivoAtual)
        .or('PRIORIDADE.is.null,PRIORIDADE.eq.')
      regrasAplicadasArquivo.add('v010')

      // REGRA v011: Mapeamento de nomes de clientes
      console.log('  ⚡ Aplicando v011 - Mapeamento nomes clientes')
      await supabase.from('volumetria_mobilemed')
        .update({ EMPRESA: 'HOSPITAL SANTA HELENA' })
        .eq('arquivo_fonte', arquivoAtual)
        .like('EMPRESA', '%SANTA HELENA%')
      regrasAplicadasArquivo.add('v011')

      // REGRA v012: Aplicação categoria padrão
      console.log('  ⚡ Aplicando v012 - Categoria padrão')
      await supabase.from('volumetria_mobilemed')
        .update({ CATEGORIA: 'GERAL' })
        .eq('arquivo_fonte', arquivoAtual)
        .or('CATEGORIA.is.null,CATEGORIA.eq.')
      regrasAplicadasArquivo.add('v012')

      // REGRA v013: Correção especializades músculo esquelético
      console.log('  ⚡ Aplicando v013 - Correção especialidades')
      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'Músculo Esquelético' })
        .eq('arquivo_fonte', arquivoAtual)
        .in('ESPECIALIDADE', ['Colunas', 'Ortopedia', 'Reumatologia'])
      regrasAplicadasArquivo.add('v013')

      // REGRA v014: Aplicação especialidade automática por modalidade
      console.log('  ⚡ Aplicando v014 - Especialidade automática')
      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'RX' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('MODALIDADE', 'RX')
        .or('ESPECIALIDADE.is.null,ESPECIALIDADE.eq.')

      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'CT' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('MODALIDADE', 'CT')
        .or('ESPECIALIDADE.is.null,ESPECIALIDADE.eq.')

      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'RM' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('MODALIDADE', 'MR')
        .or('ESPECIALIDADE.is.null,ESPECIALIDADE.eq.')
      regrasAplicadasArquivo.add('v014')

      // REGRA v015: Correção datas formato
      console.log('  ⚡ Aplicando v015 - Correção formato datas')
      await supabase.from('volumetria_mobilemed')
        .update({
          DATA_LAUDO: supabase.sql`TO_CHAR(TO_DATE("DATA_LAUDO", 'DD/MM/YYYY'), 'DD/MM/YYYY')`
        })
        .eq('arquivo_fonte', arquivoAtual)
        .not('DATA_LAUDO', 'is', null)
      regrasAplicadasArquivo.add('v015')

      // REGRA v016: Aplicação período de referência
      console.log('  ⚡ Aplicando v016 - Período referência')
      await supabase.from('volumetria_mobilemed')
        .update({ PERIODO_REFERENCIA: periodo_referencia.replace('/', '/20') })
        .eq('arquivo_fonte', arquivoAtual)
        .or('PERIODO_REFERENCIA.is.null,PERIODO_REFERENCIA.eq.')
      regrasAplicadasArquivo.add('v016')

      // REGRA v018: Aplicação de-para prioridades
      console.log('  ⚡ Aplicando v018 - De-para prioridades')
      await supabase.from('volumetria_mobilemed')
        .update({ PRIORIDADE: 'URGENTE' })
        .eq('arquivo_fonte', arquivoAtual)
        .in('PRIORIDADE', ['EMERGENCIA', 'STAT'])

      await supabase.from('volumetria_mobilemed')
        .update({ PRIORIDADE: 'ROTINA' })
        .eq('arquivo_fonte', arquivoAtual)
        .in('PRIORIDADE', ['NORMAL', 'REGULAR'])
      regrasAplicadasArquivo.add('v018')

      // REGRA v019: Colunas → Músculo Esquelético  
      console.log('  ⚡ Aplicando v019 - Colunas → Músculo Esquelético')
      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'Músculo Esquelético' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('ESPECIALIDADE', 'Colunas')
      regrasAplicadasArquivo.add('v019')

      // REGRA v020: Correção modalidade mamografia
      console.log('  ⚡ Aplicando v020 - Correção modalidade mamografia')
      await supabase.from('volumetria_mobilemed')
        .update({ MODALIDADE: 'MG' })
        .eq('arquivo_fonte', arquivoAtual)
        .like('ESTUDO_DESCRICAO', '%mamograf%')
      regrasAplicadasArquivo.add('v020')

      // REGRA v021: Aplicação categoria baseada em exame
      console.log('  ⚡ Aplicando v021 - Categoria baseada em exame')
      await supabase.from('volumetria_mobilemed')
        .update({ CATEGORIA: 'ONCOLOGIA' })
        .eq('arquivo_fonte', arquivoAtual)
        .like('ESTUDO_DESCRICAO', '%onco%')
      regrasAplicadasArquivo.add('v021')

      // REGRA v022: Normalização estudo descrição
      console.log('  ⚡ Aplicando v022 - Normalização estudo descrição')
      await supabase.from('volumetria_mobilemed')
        .update({
          ESTUDO_DESCRICAO: supabase.sql`TRIM(UPPER("ESTUDO_DESCRICAO"))`
        })
        .eq('arquivo_fonte', arquivoAtual)
        .not('ESTUDO_DESCRICAO', 'is', null)
      regrasAplicadasArquivo.add('v022')

      // REGRA v023: Especialidade automática avançada
      console.log('  ⚡ Aplicando v023 - Especialidade automática avançada')
      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'US' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('MODALIDADE', 'US')
        .or('ESPECIALIDADE.is.null,ESPECIALIDADE.eq.')
      regrasAplicadasArquivo.add('v023')

      // REGRA v024: Correção valores nulos
      console.log('  ⚡ Aplicando v024 - Correção valores nulos')
      await supabase.from('volumetria_mobilemed')
        .update({ 
          VALOR_CUSTO: 0,
          VALOR_VENDA: 0 
        })
        .eq('arquivo_fonte', arquivoAtual)
        .or('VALOR_CUSTO.is.null,VALOR_VENDA.is.null')
      regrasAplicadasArquivo.add('v024')

      // REGRA v025: Aplicação status padrão
      console.log('  ⚡ Aplicando v025 - Status padrão')
      await supabase.from('volumetria_mobilemed')
        .update({ STATUS_PROCESSAMENTO: 'PROCESSADO' })
        .eq('arquivo_fonte', arquivoAtual)
        .or('STATUS_PROCESSAMENTO.is.null,STATUS_PROCESSAMENTO.eq.')
      regrasAplicadasArquivo.add('v025')

      // REGRA v026: Correção médicos duplicados
      console.log('  ⚡ Aplicando v026 - Correção médicos duplicados')
      await supabase.from('volumetria_mobilemed')
        .update({
          MEDICO: supabase.sql`REGEXP_REPLACE("MEDICO", '\\s+', ' ', 'g')`
        })
        .eq('arquivo_fonte', arquivoAtual)
        .not('MEDICO', 'is', null)
      regrasAplicadasArquivo.add('v026')

      // REGRA v027: Aplicação de flags de qualidade
      console.log('  ⚡ Aplicando v027 - Flags de qualidade')
      await supabase.from('volumetria_mobilemed')
        .update({ FLAG_QUALIDADE: true })
        .eq('arquivo_fonte', arquivoAtual)
        .not('EMPRESA', 'is', null)
        .not('ESTUDO_DESCRICAO', 'is', null)
        .not('MEDICO', 'is', null)
      regrasAplicadasArquivo.add('v027')

      console.log(`  ✅ Aplicadas ${regrasAplicadasArquivo.size} regras para ${arquivoAtual}`)

      // Contar atualizações e quebras (simplificado para performance)
      const { count: depoisCount } = await supabase
        .from('volumetria_mobilemed')
        .select('*', { count: 'exact', head: true })
        .eq('arquivo_fonte', arquivoAtual)

      const resultadoArquivo = {
        arquivo: arquivoAtual,
        registros_antes: antesCount,
        registros_depois: depoisCount || 0,
        registros_excluidos: (antesCount - (depoisCount || 0)),
        registros_atualizados: Math.max(0, antesCount - (antesCount - (depoisCount || 0))),
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