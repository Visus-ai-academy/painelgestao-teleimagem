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
      
      // REGRA v002: Exclusões por período (apenas para retroativos)
      if (arquivoAtual.includes('retroativo')) {
        console.log('  ⚡ Aplicando v002 - Exclusões por período')
        await supabase.from('volumetria_mobilemed')
          .delete()
          .eq('arquivo_fonte', arquivoAtual)
          .neq('PERIODO_REFERENCIA', periodo_referencia.replace('/', '/20'))
        regrasAplicadasArquivo.add('v002')
      }

      // REGRA v003: Exclusões por data laudo (apenas para retroativos)
      if (arquivoAtual.includes('retroativo')) {
        console.log('  ⚡ Aplicando v003 - Exclusões por data laudo')
        const anoMes = periodo_referencia.replace('/', '/20')
        await supabase.from('volumetria_mobilemed')
          .delete()
          .eq('arquivo_fonte', arquivoAtual)
          .not('DATA_LAUDO', 'like', `${anoMes}%`)
        regrasAplicadasArquivo.add('v003')
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

      // REGRA v007: Colunas → Músculo Esquelético  
      console.log('  ⚡ Aplicando v007 - Colunas → Músculo Esquelético')
      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'Músculo Esquelético' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('ESPECIALIDADE', 'Colunas')
      regrasAplicadasArquivo.add('v007')

      // REGRA v008: Normalização modalidade
      console.log('  ⚡ Aplicando v008 - Normalização modalidade US')
      await supabase.from('volumetria_mobilemed')
        .update({ ESPECIALIDADE: 'US' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('MODALIDADE', 'US')
        .or('ESPECIALIDADE.is.null,ESPECIALIDADE.eq.')
      regrasAplicadasArquivo.add('v008')

      // REGRA v009: Aplicação prioridade padrão
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

      // REGRA v011: Aplicação categoria padrão
      console.log('  ⚡ Aplicando v011 - Categoria padrão')
      await supabase.from('volumetria_mobilemed')
        .update({ CATEGORIA: 'GERAL' })
        .eq('arquivo_fonte', arquivoAtual)
        .or('CATEGORIA.is.null,CATEGORIA.eq.')
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

      // REGRA v022: Categoria pediatria
      console.log('  ⚡ Aplicando v022 - Categoria pediatria')
      await supabase.from('volumetria_mobilemed')
        .update({ CATEGORIA: 'PEDIATRIA' })
        .eq('arquivo_fonte', arquivoAtual)
        .like('ESTUDO_DESCRICAO', '%ped%')
      regrasAplicadasArquivo.add('v022')

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

      // REGRA v025: Aplicação tipo faturamento padrão
      console.log('  ⚡ Aplicando v025 - Tipo faturamento padrão')
      await supabase.from('volumetria_mobilemed')
        .update({ tipo_faturamento: 'padrao' })
        .eq('arquivo_fonte', arquivoAtual)
        .or('tipo_faturamento.is.null,tipo_faturamento.eq.')
      regrasAplicadasArquivo.add('v025')

      // REGRA v026: Tipo faturamento urgência
      console.log('  ⚡ Aplicando v026 - Tipo faturamento urgência')
      await supabase.from('volumetria_mobilemed')
        .update({ tipo_faturamento: 'urgencia' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('PRIORIDADE', 'URGENTE')
      regrasAplicadasArquivo.add('v026')

      // REGRA v027: Tipo faturamento oncologia
      console.log('  ⚡ Aplicando v027 - Tipo faturamento oncologia')
      await supabase.from('volumetria_mobilemed')
        .update({ tipo_faturamento: 'oncologia' })
        .eq('arquivo_fonte', arquivoAtual)
        .eq('CATEGORIA', 'ONCOLOGIA')
      regrasAplicadasArquivo.add('v027')

      console.log(`  ✅ Aplicadas ${regrasAplicadasArquivo.size} regras para ${arquivoAtual}`)

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