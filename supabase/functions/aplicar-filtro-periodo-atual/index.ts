import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para calcular datas do período atual (não-retroativo)
function calcularDatasPeriodoAtual(periodoReferencia: string) {
  console.log(`🗓️ Calculando datas para período atual: ${periodoReferencia}`);
  
  const [mesStr, anoStr] = periodoReferencia.toLowerCase().split('/');
  
  const meses = {
    'janeiro': 1, 'jan': 1,
    'fevereiro': 2, 'fev': 2,
    'março': 3, 'mar': 3,
    'abril': 4, 'abr': 4,
    'maio': 5, 'mai': 5,
    'junho': 6, 'jun': 6,
    'julho': 7, 'jul': 7,
    'agosto': 8, 'ago': 8,
    'setembro': 9, 'set': 9,
    'outubro': 10, 'out': 10,
    'novembro': 11, 'nov': 11,
    'dezembro': 12, 'dez': 12
  };
  
  const mes = meses[mesStr];
  const ano = anoStr.length === 2 ? 2000 + parseInt(anoStr) : parseInt(anoStr);
  
  if (!mes || !ano) {
    throw new Error(`Período inválido: ${periodoReferencia}`);
  }
  
  console.log(`📅 Mês: ${mes}, Ano: ${ano}`);
  
  // DATA_REALIZACAO: dia 01 ao último dia do mês de referência
  const inicioRealizacao = new Date(ano, mes - 1, 1);
  const fimRealizacao = new Date(ano, mes, 0); // último dia do mês
  
  // DATA_LAUDO: dia 01 do mês de referência até dia 07 do mês subsequente
  const inicioLaudo = new Date(ano, mes - 1, 1);
  const fimLaudo = new Date(ano, mes, 7);
  
  const result = {
    inicioRealizacao: inicioRealizacao.toISOString().split('T')[0],
    fimRealizacao: fimRealizacao.toISOString().split('T')[0],
    inicioLaudo: inicioLaudo.toISOString().split('T')[0],
    fimLaudo: fimLaudo.toISOString().split('T')[0]
  };
  
  console.log(`📊 Datas calculadas para período atual:`);
  console.log(`   - DATA_REALIZACAO: ${result.inicioRealizacao} a ${result.fimRealizacao}`);
  console.log(`   - DATA_LAUDO: ${result.inicioLaudo} a ${result.fimLaudo}`);
  console.log(`   - Manter registros DENTRO desses intervalos`);
  
  return result;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { periodo_referencia } = await req.json();
    
    if (!periodo_referencia) {
      throw new Error('período_referencia é obrigatório');
    }

    console.log(`🔧 Aplicando filtro de período atual para: ${periodo_referencia}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { inicioRealizacao, fimRealizacao, inicioLaudo, fimLaudo } = calcularDatasPeriodoAtual(periodo_referencia);
    
    let totalExcluidos = 0;
    const detalhes = [];

    // Arquivos não-retroativos que precisam do filtro do período atual
    const arquivosNaoRetroativos = [
      'volumetria_padrao',
      'volumetria_fora_padrao', 
      'volumetria_onco_padrao'
    ];

    for (const arquivo of arquivosNaoRetroativos) {
      console.log(`🗂️ Processando ${arquivo}...`);
      
      // 1. Excluir registros com DATA_REALIZACAO fora do período do mês
      const { error: errorRealizacao, count: countRealizacao } = await supabase
        .from('volumetria_mobilemed')
        .delete({ count: 'exact' })
        .eq('arquivo_fonte', arquivo)
        .or(`DATA_REALIZACAO.lt.${inicioRealizacao},DATA_REALIZACAO.gt.${fimRealizacao}`);

      if (errorRealizacao) {
        console.error(`❌ Erro ao filtrar DATA_REALIZACAO em ${arquivo}:`, errorRealizacao);
        detalhes.push(`${arquivo}: ERRO DATA_REALIZACAO - ${errorRealizacao.message}`);
      } else {
        const deletedCountRealizacao = countRealizacao || 0;
        totalExcluidos += deletedCountRealizacao;
        detalhes.push(`${arquivo}: ${deletedCountRealizacao} registros excluídos por DATA_REALIZACAO fora de ${inicioRealizacao} a ${fimRealizacao}`);
        console.log(`✅ ${arquivo}: ${deletedCountRealizacao} registros excluídos por DATA_REALIZACAO`);
      }

      // 2. Excluir registros com DATA_LAUDO fora do período permitido
      const { error: errorLaudo, count: countLaudo } = await supabase
        .from('volumetria_mobilemed')
        .delete({ count: 'exact' })
        .eq('arquivo_fonte', arquivo)
        .or(`DATA_LAUDO.lt.${inicioLaudo},DATA_LAUDO.gte.${new Date(new Date(fimLaudo).getTime() + 86400000).toISOString().split('T')[0]}`);

      if (errorLaudo) {
        console.error(`❌ Erro ao filtrar DATA_LAUDO em ${arquivo}:`, errorLaudo);
        detalhes.push(`${arquivo}: ERRO DATA_LAUDO - ${errorLaudo.message}`);
      } else {
        const deletedCountLaudo = countLaudo || 0;
        totalExcluidos += deletedCountLaudo;
        detalhes.push(`${arquivo}: ${deletedCountLaudo} registros excluídos por DATA_LAUDO fora de ${inicioLaudo} a ${fimLaudo}`);
        console.log(`✅ ${arquivo}: ${deletedCountLaudo} registros excluídos por DATA_LAUDO`);
      }
    }

    console.log(`🎯 Total de registros excluídos: ${totalExcluidos}`);

    return new Response(JSON.stringify({
      success: true,
      periodo_referencia,
      total_excluidos: totalExcluidos,
      detalhes,
      datas_aplicadas: {
        inicio_realizacao: inicioRealizacao,
        fim_realizacao: fimRealizacao,
        inicio_laudo: inicioLaudo,
        fim_laudo: fimLaudo
      },
      arquivos_processados: arquivosNaoRetroativos
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Erro ao aplicar filtro de período atual:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}