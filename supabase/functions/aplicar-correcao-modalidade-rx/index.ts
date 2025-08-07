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
    const { data: registrosParaCorrigir, error: errorBusca } = await supabase
      .from('volumetria_mobilemed')
      .select('id, "ESTUDO_DESCRICAO", "MODALIDADE"')
      .eq('arquivo_fonte', arquivo_fonte)
      .like('ESTUDO_DESCRICAO', 'RX %');

    if (errorBusca) {
      throw new Error(`Erro ao buscar registros para correção: ${errorBusca.message}`);
    }

    if (!registrosParaCorrigir || registrosParaCorrigir.length === 0) {
      console.log(`Nenhum exame RX encontrado no arquivo: ${arquivo_fonte}`);
      return new Response(JSON.stringify({
        sucesso: true,
        arquivo_fonte,
        registros_encontrados: 0,
        registros_corrigidos: 0,
        mensagem: 'Nenhum exame RX encontrado para correção'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`Encontrados ${registrosParaCorrigir.length} exames RX para correção`);

    // 2. Aplicar correção - atualizar modalidade para "RX"
    const { data: resultadoUpdate, error: errorUpdate } = await supabase
      .from('volumetria_mobilemed')
      .update({ 
        "MODALIDADE": 'RX',
        updated_at: new Date().toISOString()
      })
      .eq('arquivo_fonte', arquivo_fonte)
      .like('ESTUDO_DESCRICAO', 'RX %')
      .select('id, "ESTUDO_DESCRICAO", "MODALIDADE"');

    if (errorUpdate) {
      throw new Error(`Erro ao aplicar correção: ${errorUpdate.message}`);
    }

    const registrosCorrigidos = resultadoUpdate?.length || 0;

    console.log(`Correção aplicada com sucesso: ${registrosCorrigidos} registros atualizados`);

    // 3. Criar relatório de correções
    const exemplosCorrigan = registrosParaCorrigir.slice(0, 5).map(registro => ({
      estudo_descricao: registro.ESTUDO_DESCRICAO,
      modalidade_anterior: registro.MODALIDADE,
      modalidade_nova: 'RX'
    }));

    // 4. Log da operação
    const { error: logError } = await supabase
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'CORRECAO_MODALIDADE_RX',
        record_id: arquivo_fonte,
        new_data: {
          arquivo_fonte,
          registros_encontrados: registrosParaCorrigir.length,
          registros_corrigidos: registrosCorrigidos,
          exemplos_corrigidos: exemplosCorrigan,
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
      registros_encontrados: registrosParaCorrigir.length,
      registros_corrigidos: registrosCorrigidos,
      exemplos_corrigidos: exemplosCorrigan,
      regra_aplicada: 'v030 - Correção de Modalidade para Exames RX',
      data_processamento: new Date().toISOString(),
      observacao: 'Todos os exames com ESTUDO_DESCRICAO iniciando com "RX " tiveram modalidade alterada para "RX"'
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