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

    const requestBody = await req.json().catch(() => ({}));
    const { arquivo_fonte } = requestBody;

    console.log('📦 Dados recebidos:', requestBody);

    if (!arquivo_fonte || arquivo_fonte === '') {
      console.error('❌ ERRO: Parâmetro arquivo_fonte não fornecido');
      return new Response(JSON.stringify({ 
        sucesso: false, 
        erro: 'Parâmetro arquivo_fonte é obrigatório',
        dados_recebidos: requestBody,
        exemplo_uso: { arquivo_fonte: 'volumetria_padrao' }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Validar arquivo_fonte
    const arquivosValidos = [
      'volumetria_padrao',
      'volumetria_fora_padrao', 
      'volumetria_padrao_retroativo',
      'volumetria_fora_padrao_retroativo',
      'volumetria_onco_padrao',
      'arquivo_1_padrao',
      'arquivo_2_padrao',
      'arquivo_3_padrao', 
      'arquivo_4_padrao',
      'arquivo_5_padrao'
    ];

    if (!arquivosValidos.includes(arquivo_fonte)) {
      throw new Error(`Arquivo fonte inválido: ${arquivo_fonte}. Deve ser um dos: ${arquivosValidos.join(', ')}`);
    }

    console.log(`Iniciando correção de modalidade OT para DO no arquivo: ${arquivo_fonte}`);

    // 1. Buscar registros que precisam ser corrigidos
    const { data: registrosParaCorrigir, error: errorBusca } = await supabase
      .from('volumetria_mobilemed')
      .select('id, "ESTUDO_DESCRICAO", "MODALIDADE"')
      .eq('arquivo_fonte', arquivo_fonte)
      .eq('MODALIDADE', 'OT');

    if (errorBusca) {
      throw new Error(`Erro ao buscar registros para correção: ${errorBusca.message}`);
    }

    if (!registrosParaCorrigir || registrosParaCorrigir.length === 0) {
      console.log(`Nenhum exame OT encontrado no arquivo: ${arquivo_fonte}`);
      return new Response(JSON.stringify({
        sucesso: true,
        arquivo_fonte,
        registros_encontrados: 0,
        registros_corrigidos: 0,
        mensagem: 'Nenhum exame OT encontrado para correção'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`Encontrados ${registrosParaCorrigir.length} exames OT para correção`);

    // 2. Aplicar correção - atualizar modalidade para "DO"
    const { data: resultadoUpdate, error: errorUpdate } = await supabase
      .from('volumetria_mobilemed')
      .update({ 
        "MODALIDADE": 'DO',
        updated_at: new Date().toISOString()
      })
      .eq('arquivo_fonte', arquivo_fonte)
      .eq('MODALIDADE', 'OT')
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
      modalidade_nova: 'DO'
    }));

    // 4. Log da operação
    const { error: logError } = await supabase
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'CORRECAO_AUTOMATICA',
        record_id: arquivo_fonte,
        new_data: {
          arquivo_fonte,
          registros_encontrados: registrosParaCorrigir.length,
          registros_corrigidos: registrosCorrigidos,
          exemplos_corrigidos: exemplosCorrigan,
          regra: 'v031',
          tipo_correcao: 'MODALIDADE_OT'
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
      regra_aplicada: 'v031 - Correção de Modalidade OT para DO',
      data_processamento: new Date().toISOString(),
      observacao: 'Todos os exames com MODALIDADE "OT" foram alterados para "DO"'
    };

    console.log('Correção de modalidade OT concluída:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Erro geral na correção de modalidade OT:', error);
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