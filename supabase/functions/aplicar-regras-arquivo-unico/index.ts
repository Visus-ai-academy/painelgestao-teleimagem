import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função para aplicar todas as regras em UM ÚNICO arquivo
async function aplicarRegrasArquivo(
  supabase: any,
  arquivoFonte: string,
  periodoReferencia: string
) {
  console.log(`🚀 Aplicando regras no arquivo: ${arquivoFonte}`)
  
  const regrasAplicadas: string[] = []
  let registrosProcessados = 0

  try {
    // Contar registros antes
    const { count: antesCount } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', arquivoFonte)

    if (!antesCount || antesCount === 0) {
      return {
        sucesso: true,
        arquivo: arquivoFonte,
        registros_antes: 0,
        registros_depois: 0,
        regras_aplicadas: [],
        mensagem: 'Arquivo sem registros'
      }
    }

    registrosProcessados = antesCount
    console.log(`📊 Registros encontrados: ${antesCount}`)

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

    // v001b: Normalizar sufixo _TELE
    const { data: clientesTele } = await supabase
      .from('volumetria_mobilemed')
      .select('"EMPRESA"')
      .eq('arquivo_fonte', arquivoFonte)
      .like('EMPRESA', '%_TELE')
    
    if (clientesTele && clientesTele.length > 0) {
      const empresasUnicas = [...new Set(clientesTele.map((c: any) => c.EMPRESA).filter(Boolean))]
      for (const empresaTele of empresasUnicas) {
        if (empresaTele && typeof empresaTele === 'string' && empresaTele.endsWith('_TELE')) {
          const empresaNormalizada = empresaTele.replace(/_TELE$/, '')
          await supabase.from('volumetria_mobilemed')
            .update({ EMPRESA: empresaNormalizada })
            .eq('arquivo_fonte', arquivoFonte)
            .eq('EMPRESA', empresaTele)
        }
      }
    }
    regrasAplicadas.push('v001b')

    // v001c: Normalização de nomes de médicos
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
            .eq('arquivo_fonte', arquivoFonte)
            .ilike('MEDICO', mapeamento.nome_origem_normalizado)
        }
      }
    }
    regrasAplicadas.push('v001c')

    // v001d: De-Para valores zerados
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
            .eq('arquivo_fonte', arquivoFonte)
            .ilike('ESTUDO_DESCRICAO', ref.estudo_descricao)
            .or('VALOR.is.null,VALOR.eq.0')
        }
      }
    }
    regrasAplicadas.push('v001d')

    // v005: Correções modalidade
    const { data: examesMAMO } = await supabase
      .from('cadastro_exames')
      .select('nome')
      .eq('especialidade', 'MAMO')
      .eq('ativo', true)
    
    if (examesMAMO && examesMAMO.length > 0) {
      for (const exame of examesMAMO) {
        if (exame.nome) {
          await supabase
            .from('volumetria_mobilemed')
            .update({ MODALIDADE: 'MG' })
            .eq('arquivo_fonte', arquivoFonte)
            .in('MODALIDADE', ['CR', 'DX'])
            .ilike('ESTUDO_DESCRICAO', exame.nome)
        }
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

    // v034: Colunas → NEURO/MUSCULO (chamada a função separada)
    try {
      const { data: v034Result, error: v034Error } = await supabase.functions.invoke(
        'aplicar-regra-colunas-musculo-neuro',
        { body: { arquivo_fonte: arquivoFonte } }
      )
      
      if (!v034Error && v034Result) {
        console.log(`✅ v034: ${v034Result.total_alterados_neuro || 0} → NEURO, ${v034Result.total_alterados_musculo || 0} → MUSCULO`)
        regrasAplicadas.push('v034')
      }
    } catch (v034Err) {
      console.error(`⚠️ Erro v034:`, v034Err)
    }

    // v044: MAMA → MAMO
    await supabase.from('volumetria_mobilemed')
      .update({ ESPECIALIDADE: 'MAMO' })
      .eq('arquivo_fonte', arquivoFonte)
      .eq('MODALIDADE', 'MG')
      .eq('ESPECIALIDADE', 'MAMA')
    regrasAplicadas.push('v044')

    // v008: De-Para Prioridades
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

    // v011: Categorias de exames
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
            .update({ CATEGORIA: exame.categoria })
            .eq('arquivo_fonte', arquivoFonte)
            .ilike('ESTUDO_DESCRICAO', exame.nome)
            .or('CATEGORIA.is.null,CATEGORIA.eq.')
        }
      }
    }
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

    // v021: Categoria oncologia
    await supabase.from('volumetria_mobilemed')
      .update({ CATEGORIA: 'ONCO' })
      .eq('arquivo_fonte', arquivoFonte)
      .or('ESTUDO_DESCRICAO.ilike.%ONCO%,ESTUDO_DESCRICAO.ilike.%PET%,ESTUDO_DESCRICAO.ilike.%CINTILOGRAFIA%')
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

    // v031: Dados do cadastro_exames
    const { data: cadastroCompleto } = await supabase
      .from('cadastro_exames')
      .select('nome, modalidade, especialidade, categoria, prioridade')
      .eq('ativo', true)
    
    if (cadastroCompleto && cadastroCompleto.length > 0) {
      for (const exame of cadastroCompleto) {
        if (exame.nome) {
          const updates: any = {}
          if (exame.modalidade) updates.MODALIDADE = exame.modalidade
          if (exame.especialidade) updates.ESPECIALIDADE = exame.especialidade
          if (exame.categoria) updates.CATEGORIA = exame.categoria
          if (exame.prioridade) updates.PRIORIDADE = exame.prioridade
          
          if (Object.keys(updates).length > 0) {
            updates.updated_at = new Date().toISOString()
            await supabase
              .from('volumetria_mobilemed')
              .update(updates)
              .eq('arquivo_fonte', arquivoFonte)
              .ilike('ESTUDO_DESCRICAO', exame.nome)
          }
        }
      }
    }
    regrasAplicadas.push('v031')

    // Contar registros depois
    const { count: depoisCount } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', arquivoFonte)

    console.log(`✅ Arquivo ${arquivoFonte} processado: ${antesCount} → ${depoisCount || 0} registros`)

    return {
      sucesso: true,
      arquivo: arquivoFonte,
      registros_antes: antesCount,
      registros_depois: depoisCount || 0,
      registros_excluidos: antesCount - (depoisCount || 0),
      regras_aplicadas: regrasAplicadas,
      mensagem: 'Processamento concluído com sucesso'
    }

  } catch (error: any) {
    console.error(`❌ Erro no arquivo ${arquivoFonte}:`, error)
    return {
      sucesso: false,
      arquivo: arquivoFonte,
      erro: error.message || 'Erro desconhecido',
      regras_aplicadas: regrasAplicadas
    }
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

    console.log(`📁 Processando arquivo: ${arquivo_fonte}`)
    console.log(`📅 Período: ${periodo_referencia}`)

    const resultado = await aplicarRegrasArquivo(supabase, arquivo_fonte, periodo_referencia)

    return new Response(
      JSON.stringify(resultado),
      { 
        status: resultado.sucesso ? 200 : 500,
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
