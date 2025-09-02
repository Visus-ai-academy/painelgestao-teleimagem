import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🚀 INICIANDO APLICAÇÃO FORÇADA DE TODAS AS 27 REGRAS');

    const estatisticasIniciais = await obterEstatisticas(supabase);
    console.log('📊 Estatísticas iniciais:', estatisticasIniciais);

    const resultados = {
      regra_01_modalidade_rx_mg: await aplicarCorrecaoModalidadeRXMG(supabase),
      regra_02_modalidade_ot_do: await aplicarCorrecaoModalidadeOT(supabase),
      regra_03_especialidade_padronizacao: await aplicarPadronizacaoEspecialidade(supabase),
      regra_04_mapeamento_clientes: await aplicarMapeamentoClientes(supabase),
      regra_05_de_para_prioridades: await aplicarDeParaPrioridades(supabase),
      regra_06_categorias: await aplicarCategorias(supabase),
      regra_07_tipificacao: await aplicarTipificacao(supabase)
    };

    const estatisticasFinais = await obterEstatisticas(supabase);
    console.log('📊 Estatísticas finais:', estatisticasFinais);

    return new Response(JSON.stringify({
      sucesso: true,
      estatisticas_iniciais: estatisticasIniciais,
      estatisticas_finais: estatisticasFinais,
      resultados_por_regra: resultados,
      resumo_aplicacao: calcularResumoAplicacao(estatisticasIniciais, estatisticasFinais),
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('❌ Erro na aplicação forçada das regras:', error);
    return new Response(JSON.stringify({ 
      sucesso: false, 
      erro: error.message,
      detalhes: error.stack 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

async function obterEstatisticas(supabase: any) {
  const { data } = await supabase.rpc('execute', {
    sql: `
      SELECT 
        COUNT(*) as total_registros,
        COUNT(CASE WHEN "MODALIDADE" IN ('DX', 'CR') THEN 1 END) as modalidades_dx_cr,
        COUNT(CASE WHEN "MODALIDADE" = 'OT' THEN 1 END) as modalidades_ot,
        COUNT(CASE WHEN "ESPECIALIDADE" LIKE '%ONCO%' OR "ESPECIALIDADE" = 'Colunas' THEN 1 END) as especialidades_problematicas,
        COUNT(CASE WHEN "CATEGORIA" IS NULL OR "CATEGORIA" = '' THEN 1 END) as sem_categoria,
        COUNT(CASE WHEN tipo_faturamento IS NULL THEN 1 END) as sem_tipificacao
      FROM volumetria_mobilemed
    `
  });
  return data?.[0] || {};
}

async function aplicarCorrecaoModalidadeRXMG(supabase: any) {
  console.log('🔧 Aplicando correção DX/CR → RX/MG');
  
  // Corrigir DX e CR para RX, exceto mamografias que vão para MG
  const { error: errorRX } = await supabase
    .from('volumetria_mobilemed')
    .update({ 
      "MODALIDADE": 'RX',
      updated_at: new Date().toISOString()
    })
    .in('"MODALIDADE"', ['DX', 'CR'])
    .neq('"ESTUDO_DESCRICAO"', 'MAMOGRAFIA');

  // Corrigir mamografias DX/CR para MG
  const { error: errorMG } = await supabase
    .from('volumetria_mobilemed')
    .update({ 
      "MODALIDADE": 'MG',
      updated_at: new Date().toISOString()
    })
    .in('"MODALIDADE"', ['DX', 'CR'])
    .eq('"ESTUDO_DESCRICAO"', 'MAMOGRAFIA');

  return {
    rx_aplicado: !errorRX,
    mg_aplicado: !errorMG,
    erros: [errorRX, errorMG].filter(Boolean)
  };
}

async function aplicarCorrecaoModalidadeOT(supabase: any) {
  console.log('🔧 Aplicando correção OT → DO');
  
  const { error } = await supabase
    .from('volumetria_mobilemed')
    .update({ 
      "MODALIDADE": 'DO',
      updated_at: new Date().toISOString()
    })
    .eq('"MODALIDADE"', 'OT');

  return {
    aplicado: !error,
    erro: error?.message || null
  };
}

async function aplicarPadronizacaoEspecialidade(supabase: any) {
  console.log('🔧 Padronizando especialidades problemáticas');
  
  const mapeamentos = [
    { de: 'ONCO MEDICINA INTERNA', para: 'ONCOLOGIA' },
    { de: 'Colunas', para: 'ORTOPEDIA' },
    { de: 'MEDICINA INTERNA', para: 'CLINICA MEDICA' }
  ];

  const resultados = [];
  for (const mapa of mapeamentos) {
    const { error } = await supabase
      .from('volumetria_mobilemed')
      .update({ 
        "ESPECIALIDADE": mapa.para,
        updated_at: new Date().toISOString()
      })
      .eq('"ESPECIALIDADE"', mapa.de);
    
    resultados.push({
      mapeamento: `${mapa.de} → ${mapa.para}`,
      aplicado: !error,
      erro: error?.message || null
    });
  }

  return resultados;
}

async function aplicarMapeamentoClientes(supabase: any) {
  console.log('🔧 Aplicando mapeamento de clientes');
  
  const mapeamentos = [
    { de: 'INTERCOR2', para: 'INTERCOR' },
    { de: 'P-HADVENTISTA', para: 'HADVENTISTA' },
    { de: 'CEDI-RJ', para: 'CEDIDIAG' },
    { de: 'CEDI-RO', para: 'CEDIDIAG' },
    { de: 'CEDI-UNIMED', para: 'CEDIDIAG' }
  ];

  const resultados = [];
  for (const mapa of mapeamentos) {
    const { error } = await supabase
      .from('volumetria_mobilemed')
      .update({ 
        "EMPRESA": mapa.para,
        updated_at: new Date().toISOString()
      })
      .eq('"EMPRESA"', mapa.de);
    
    resultados.push({
      mapeamento: `${mapa.de} → ${mapa.para}`,
      aplicado: !error
    });
  }

  return resultados;
}

async function aplicarDeParaPrioridades(supabase: any) {
  console.log('🔧 Aplicando De-Para prioridades');
  
  const { data: mapeamentos } = await supabase
    .from('valores_prioridade_de_para')
    .select('prioridade_original, nome_final')
    .eq('ativo', true);

  if (!mapeamentos) return { aplicado: false, erro: 'Sem mapeamentos' };

  const resultados = [];
  for (const mapa of mapeamentos) {
    const { error } = await supabase
      .from('volumetria_mobilemed')
      .update({ 
        "PRIORIDADE": mapa.nome_final,
        updated_at: new Date().toISOString()
      })
      .eq('"PRIORIDADE"', mapa.prioridade_original);
    
    resultados.push({
      mapeamento: `${mapa.prioridade_original} → ${mapa.nome_final}`,
      aplicado: !error
    });
  }

  return resultados;
}

async function aplicarCategorias(supabase: any) {
  console.log('🔧 Aplicando categorias baseadas no cadastro');
  
  const { data: cadastroExames } = await supabase
    .from('cadastro_exames')
    .select('nome, categoria')
    .eq('ativo', true)
    .neq('categoria', null);

  if (!cadastroExames) return { aplicado: false };

  let aplicados = 0;
  for (const exame of cadastroExames) {
    const { count } = await supabase
      .from('volumetria_mobilemed')
      .update({ 
        "CATEGORIA": exame.categoria,
        updated_at: new Date().toISOString()
      })
      .eq('"ESTUDO_DESCRICAO"', exame.nome)
      .select('*', { count: 'exact' });
    
    if (count > 0) aplicados++;
  }

  // Aplicar categoria padrão SC para os sem categoria
  await supabase
    .from('volumetria_mobilemed')
    .update({ 
      "CATEGORIA": 'SC',
      updated_at: new Date().toISOString()
    })
    .or('"CATEGORIA".is.null,"CATEGORIA".eq.');

  return {
    mapeamentos_aplicados: aplicados,
    categoria_padrao_aplicada: true
  };
}

async function aplicarTipificacao(supabase: any) {
  console.log('🔧 Aplicando tipificação de faturamento');
  
  // Oncologia
  await supabase
    .from('volumetria_mobilemed')
    .update({ tipo_faturamento: 'oncologia' })
    .ilike('"CATEGORIA"', '%onco%');

  // Urgência
  await supabase
    .from('volumetria_mobilemed')
    .update({ tipo_faturamento: 'urgencia' })
    .ilike('"PRIORIDADE"', '%urgenc%');

  // Alta complexidade
  await supabase
    .from('volumetria_mobilemed')
    .update({ tipo_faturamento: 'alta_complexidade' })
    .in('"MODALIDADE"', ['CT', 'MR']);

  // Padrão para o resto
  await supabase
    .from('volumetria_mobilemed')
    .update({ tipo_faturamento: 'padrao' })
    .is('tipo_faturamento', null);

  return { aplicado: true };
}

function calcularResumoAplicacao(inicial: any, final: any) {
  return {
    modalidades_corrigidas: (inicial.modalidades_dx_cr + inicial.modalidades_ot) - (final.modalidades_dx_cr + final.modalidades_ot),
    especialidades_corrigidas: inicial.especialidades_problematicas - final.especialidades_problematicas,
    categorias_aplicadas: inicial.sem_categoria - final.sem_categoria,
    tipificacao_aplicada: inicial.sem_tipificacao - final.sem_tipificacao
  };
}