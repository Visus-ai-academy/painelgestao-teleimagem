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

    console.log('🎯 SISTEMA DE GARANTIA 100% DAS REGRAS - INICIANDO');

    const relatorio = {
      modalidades: await corrigirModalidades(supabase),
      especialidades: await corrigirEspecialidades(supabase),
      clientes: await corrigirClientes(supabase),
      categorias: await garantirCategorias(supabase),
      tipificacao: await garantirTipificacao(supabase)
    };

    const verificacaoFinal = await verificarStatus(supabase);

    const resultado = {
      sucesso: true,
      sistema: 'GARANTIA_100_REGRAS',
      relatorio_correcoes: relatorio,
      status_final: verificacaoFinal,
      regras_aplicadas: calcularRegrasAplicadas(verificacaoFinal),
      data_processamento: new Date().toISOString()
    };

    console.log('🎉 SISTEMA CONCLUÍDO:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('❌ Erro no sistema de garantia:', error);
    return new Response(JSON.stringify({ 
      sucesso: false, 
      erro: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

async function corrigirModalidades(supabase: any) {
  console.log('🔧 Garantindo correção de modalidades...');
  
  // DX/CR para RX (exceto mamografias)
  const { count: rxCount, error: rxError } = await supabase
    .from('volumetria_mobilemed')
    .update({ "MODALIDADE": 'RX', updated_at: new Date().toISOString() })
    .in('"MODALIDADE"', ['DX', 'CR'])
    .neq('"ESTUDO_DESCRICAO"', 'MAMOGRAFIA')
    .select('*', { count: 'exact' });

  // Mamografias DX/CR para MG
  const { count: mgCount, error: mgError } = await supabase
    .from('volumetria_mobilemed')
    .update({ "MODALIDADE": 'MG', updated_at: new Date().toISOString() })
    .in('"MODALIDADE"', ['DX', 'CR'])
    .eq('"ESTUDO_DESCRICAO"', 'MAMOGRAFIA')
    .select('*', { count: 'exact' });

  // OT para DO
  const { count: doCount, error: doError } = await supabase
    .from('volumetria_mobilemed')
    .update({ "MODALIDADE": 'DO', updated_at: new Date().toISOString() })
    .eq('"MODALIDADE"', 'OT')
    .select('*', { count: 'exact' });

  return {
    rx_corrigidos: rxCount || 0,
    mg_corrigidos: mgCount || 0, 
    do_corrigidos: doCount || 0,
    erros: [rxError, mgError, doError].filter(Boolean)
  };
}

async function corrigirEspecialidades(supabase: any) {
  console.log('🔧 Garantindo correção de especialidades...');
  
  const correcoes = [
    { de: 'ONCO MEDICINA INTERNA', para: 'ONCOLOGIA' },
    { de: 'Colunas', para: 'ORTOPEDIA' }
    // REMOVIDA regra incorreta de MEDICINA INTERNA
  ];

  const resultados = [];
  
  for (const corr of correcoes) {
    const { count, error } = await supabase
      .from('volumetria_mobilemed')
      .update({ "ESPECIALIDADE": corr.para, updated_at: new Date().toISOString() })
      .eq('"ESPECIALIDADE"', corr.de)
      .select('*', { count: 'exact' });
    
    console.log(`✅ ${corr.de} → ${corr.para}: ${count || 0} registros`);
    
    resultados.push({
      de: corr.de,
      para: corr.para,
      registros_corrigidos: count || 0,
      erro: error?.message || null
    });
  }

  return resultados;
}

async function corrigirClientes(supabase: any) {
  console.log('🔧 Garantindo correção de clientes...');
  
  const mapeamentos = [
    { de: 'INTERCOR2', para: 'INTERCOR' },
    { de: 'P-HADVENTISTA', para: 'HADVENTISTA' },
    { de: 'CEDI-RJ', para: 'CEDIDIAG' },
    { de: 'CEDI-RO', para: 'CEDIDIAG' },
    { de: 'CEDI-UNIMED', para: 'CEDIDIAG' }
  ];

  const resultados = [];
  
  for (const mapa of mapeamentos) {
    const { count, error } = await supabase
      .from('volumetria_mobilemed')
      .update({ "EMPRESA": mapa.para, updated_at: new Date().toISOString() })
      .eq('"EMPRESA"', mapa.de)
      .select('*', { count: 'exact' });
    
    resultados.push({
      de: mapa.de,
      para: mapa.para,
      registros_corrigidos: count || 0
    });
  }

  return resultados;
}

async function garantirCategorias(supabase: any) {
  console.log('🔧 Garantindo categorias...');
  
  // Aplicar categoria padrão para registros sem categoria
  const { count: padrao, error: erroPadrao } = await supabase
    .from('volumetria_mobilemed')
    .update({ "CATEGORIA": 'SC', updated_at: new Date().toISOString() })
    .or('"CATEGORIA".is.null,"CATEGORIA".eq.')
    .select('*', { count: 'exact' });

  return {
    categoria_padrao_aplicada: padrao || 0,
    erro: erroPadrao?.message || null
  };
}

async function garantirTipificacao(supabase: any) {
  console.log('🔧 Garantindo tipificação...');
  
  // Oncologia
  const { count: onco } = await supabase
    .from('volumetria_mobilemed')
    .update({ tipo_faturamento: 'oncologia' })
    .ilike('"CATEGORIA"', '%onco%')
    .select('*', { count: 'exact' });

  // Urgência
  const { count: urgencia } = await supabase
    .from('volumetria_mobilemed')
    .update({ tipo_faturamento: 'urgencia' })
    .ilike('"PRIORIDADE"', '%urgenc%')
    .select('*', { count: 'exact' });

  // Alta complexidade
  const { count: alta } = await supabase
    .from('volumetria_mobilemed')
    .update({ tipo_faturamento: 'alta_complexidade' })
    .in('"MODALIDADE"', ['CT', 'MR'])
    .select('*', { count: 'exact' });

  // Padrão
  const { count: padrao } = await supabase
    .from('volumetria_mobilemed')
    .update({ tipo_faturamento: 'padrao' })
    .is('tipo_faturamento', null)
    .select('*', { count: 'exact' });

  return {
    oncologia: onco || 0,
    urgencia: urgencia || 0,
    alta_complexidade: alta || 0,
    padrao: padrao || 0
  };
}

async function verificarStatus(supabase: any) {
  const { data } = await supabase
    .from('volumetria_mobilemed')
    .select(`
      arquivo_fonte,
      COUNT(*) as total,
      COUNT(CASE WHEN "MODALIDADE" IN ('DX', 'CR', 'OT') THEN 1 END) as modalidades_problematicas,
      COUNT(CASE WHEN "ESPECIALIDADE" = 'ONCO MEDICINA INTERNA' THEN 1 END) as especialidades_problematicas,
      COUNT(CASE WHEN "CATEGORIA" IS NULL OR "CATEGORIA" = '' THEN 1 END) as sem_categoria,
      COUNT(CASE WHEN tipo_faturamento IS NULL THEN 1 END) as sem_tipificacao
    `)
    .group('arquivo_fonte');
  
  return data || [];
}

function calcularRegrasAplicadas(status: any[]) {
  const totais = status.reduce((acc, arquivo) => ({
    total: acc.total + arquivo.total,
    modalidades_ok: acc.modalidades_ok + (arquivo.total - arquivo.modalidades_problematicas),
    especialidades_ok: acc.especialidades_ok + (arquivo.total - arquivo.especialidades_problematicas),
    categorias_ok: acc.categorias_ok + (arquivo.total - arquivo.sem_categoria),
    tipificacao_ok: acc.tipificacao_ok + (arquivo.total - arquivo.sem_tipificacao)
  }), { total: 0, modalidades_ok: 0, especialidades_ok: 0, categorias_ok: 0, tipificacao_ok: 0 });

  return {
    regra_modalidades: Math.round((totais.modalidades_ok / totais.total) * 100),
    regra_especialidades: Math.round((totais.especialidades_ok / totais.total) * 100),
    regra_categorias: Math.round((totais.categorias_ok / totais.total) * 100),
    regra_tipificacao: Math.round((totais.tipificacao_ok / totais.total) * 100),
    media_geral: Math.round(((totais.modalidades_ok + totais.especialidades_ok + totais.categorias_ok + totais.tipificacao_ok) / (totais.total * 4)) * 100)
  };
}