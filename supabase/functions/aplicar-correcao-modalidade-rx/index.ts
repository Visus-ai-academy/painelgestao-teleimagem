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

    const { arquivo_fonte } = await req.json();

    if (!arquivo_fonte) {
      throw new Error('Parâmetro arquivo_fonte é obrigatório');
    }

    // Validar arquivo_fonte
    const arquivosValidos = [
      'volumetria_padrao',
      'volumetria_fora_padrao', 
      'volumetria_padrao_retroativo',
      'volumetria_fora_padrao_retroativo',
      'volumetria_onco_padrao'
    ];

    if (!arquivosValidos.includes(arquivo_fonte)) {
      throw new Error(`Arquivo fonte inválido: ${arquivo_fonte}. Deve ser um dos: ${arquivosValidos.join(', ')}`);
    }

    console.log(`Iniciando correção de modalidade RX para arquivo: ${arquivo_fonte}`);

    // 1. Buscar registros que precisam ser corrigidos
    // Critério 1: MODALIDADE = 'CR' OU 'DX' E ESTUDO_DESCRICAO ≠ 'MAMOGRAFIA' → RX
    const { data: registrosParaRX, error: errorBuscaRX } = await supabase
      .from('volumetria_mobilemed')
      .select('id, "ESTUDO_DESCRICAO", "MODALIDADE"')
      .eq('arquivo_fonte', arquivo_fonte)
      .in('MODALIDADE', ['CR', 'DX'])
      .neq('ESTUDO_DESCRICAO', 'MAMOGRAFIA');

    // Critério 2: MODALIDADE = 'CR' OU 'DX' E ESTUDO_DESCRICAO = 'MAMOGRAFIA' → MG
    const { data: registrosParaMG, error: errorBuscaMG } = await supabase
      .from('volumetria_mobilemed')
      .select('id, "ESTUDO_DESCRICAO", "MODALIDADE"')
      .eq('arquivo_fonte', arquivo_fonte)
      .in('MODALIDADE', ['CR', 'DX'])
      .eq('ESTUDO_DESCRICAO', 'MAMOGRAFIA');

    if (errorBuscaRX) {
      throw new Error(`Erro ao buscar registros RX para correção: ${errorBuscaRX.message}`);
    }

    if (errorBuscaMG) {
      throw new Error(`Erro ao buscar registros MG para correção: ${errorBuscaMG.message}`);
    }

    const totalRegistros = (registrosParaRX?.length || 0) + (registrosParaMG?.length || 0);

    if (totalRegistros === 0) {
      console.log(`Nenhum exame encontrado para correção no arquivo: ${arquivo_fonte}`);
      return new Response(JSON.stringify({
        sucesso: true,
        arquivo_fonte,
        registros_encontrados: 0,
        registros_corrigidos_rx: 0,
        registros_corrigidos_mg: 0,
        mensagem: 'Nenhum exame encontrado para correção'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`Encontrados ${registrosParaRX?.length || 0} exames para RX e ${registrosParaMG?.length || 0} exames para MG`);

    // 2. Aplicar correções
    // Correção 1: MODALIDADE = 'CR' OU 'DX' E ESTUDO_DESCRICAO ≠ 'MAMOGRAFIA' → RX
    const { data: resultadoUpdateRX, error: errorUpdateRX } = await supabase
      .from('volumetria_mobilemed')
      .update({ 
        "MODALIDADE": 'RX',
        updated_at: new Date().toISOString()
      })
      .eq('arquivo_fonte', arquivo_fonte)
      .in('MODALIDADE', ['CR', 'DX'])
      .neq('ESTUDO_DESCRICAO', 'MAMOGRAFIA')
      .select('id, "ESTUDO_DESCRICAO", "MODALIDADE"');

    // Correção 2: MODALIDADE = 'CR' OU 'DX' E ESTUDO_DESCRICAO = 'MAMOGRAFIA' → MG
    const { data: resultadoUpdateMG, error: errorUpdateMG } = await supabase
      .from('volumetria_mobilemed')
      .update({ 
        "MODALIDADE": 'MG',
        updated_at: new Date().toISOString()
      })
      .eq('arquivo_fonte', arquivo_fonte)
      .in('MODALIDADE', ['CR', 'DX'])
      .eq('ESTUDO_DESCRICAO', 'MAMOGRAFIA')
      .select('id, "ESTUDO_DESCRICAO", "MODALIDADE"');

    if (errorUpdateRX) {
      throw new Error(`Erro ao aplicar correção RX: ${errorUpdateRX.message}`);
    }

    if (errorUpdateMG) {
      throw new Error(`Erro ao aplicar correção MG: ${errorUpdateMG.message}`);
    }

    const registrosCorrigidosRX = resultadoUpdateRX?.length || 0;
    const registrosCorrigidosMG = resultadoUpdateMG?.length || 0;

    console.log(`Correções aplicadas: ${registrosCorrigidosRX} para RX, ${registrosCorrigidosMG} para MG`);

    // 3. Criar relatório de correções
    const exemplosRX = (registrosParaRX || []).slice(0, 3).map(registro => ({
      estudo_descricao: registro.ESTUDO_DESCRICAO,
      modalidade_anterior: registro.MODALIDADE,
      modalidade_nova: 'RX'
    }));

    const exemplosMG = (registrosParaMG || []).slice(0, 3).map(registro => ({
      estudo_descricao: registro.ESTUDO_DESCRICAO,
      modalidade_anterior: registro.MODALIDADE,
      modalidade_nova: 'MG'
    }));

    // 4. Log da operação
    const { error: logError } = await supabase
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'CORRECAO_MODALIDADE_RX_MG',
        record_id: arquivo_fonte,
        new_data: {
          arquivo_fonte,
          registros_encontrados_rx: registrosParaRX?.length || 0,
          registros_encontrados_mg: registrosParaMG?.length || 0,
          registros_corrigidos_rx: registrosCorrigidosRX,
          registros_corrigidos_mg: registrosCorrigidosMG,
          exemplos_rx: exemplosRX,
          exemplos_mg: exemplosMG,
          regra: 'v030'
        },
        user_email: 'system',
        severity: 'info'
      });

    if (logError) {
      console.error('Erro ao registrar log:', logError);
    }

    const resultado = {
      sucesso: true,
      arquivo_fonte,
      registros_encontrados_rx: registrosParaRX?.length || 0,
      registros_encontrados_mg: registrosParaMG?.length || 0,
      registros_corrigidos_rx: registrosCorrigidosRX,
      registros_corrigidos_mg: registrosCorrigidosMG,
      exemplos_rx: exemplosRX,
      exemplos_mg: exemplosMG,
      regra_aplicada: 'v030 - Correção de Modalidade para Exames RX e Mamografias',
      data_processamento: new Date().toISOString(),
      observacao: 'CR/DX não-mamografia → RX; CR/DX mamografia → MG'
    };

    console.log('Correção de modalidade RX concluída:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Erro geral na correção de modalidade RX:', error);
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        erro: error.message,
        detalhes: error.stack 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});