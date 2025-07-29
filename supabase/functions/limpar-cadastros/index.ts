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

    console.log('Iniciando limpeza de cadastros...');

    // Limpar tabela de cadastro de exames
    const { error: errorCadastro } = await supabase
      .from('cadastro_exames')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

    if (errorCadastro) {
      console.error('Erro ao limpar cadastro_exames:', errorCadastro);
      throw errorCadastro;
    }

    console.log('Tabela cadastro_exames limpa com sucesso');

    // Limpar tabela de regras de quebra de exames
    const { error: errorQuebra } = await supabase
      .from('regras_quebra_exames')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

    if (errorQuebra) {
      console.error('Erro ao limpar regras_quebra_exames:', errorQuebra);
      throw errorQuebra;
    }

    console.log('Tabela regras_quebra_exames limpa com sucesso');

    // Limpar logs de processamento relacionados
    const { error: errorLogs } = await supabase
      .from('processamento_uploads')
      .delete()
      .in('tipo_arquivo', ['cadastro_exames', 'quebra_exames']);

    if (errorLogs) {
      console.error('Erro ao limpar logs:', errorLogs);
      throw errorLogs;
    }

    console.log('Logs de processamento limpos com sucesso');

    // Log da operação de limpeza
    const { error: logError } = await supabase
      .from('processamento_uploads')
      .insert({
        arquivo_nome: 'limpeza_sistema',
        tipo_arquivo: 'sistema',
        tipo_dados: 'limpeza',
        status: 'concluido',
        registros_processados: 0,
        registros_inseridos: 0,
        registros_atualizados: 0,
        registros_erro: 0,
        tamanho_arquivo: 0
      });

    if (logError) {
      console.error('Erro ao registrar log de limpeza:', logError);
    }

    const resultado = {
      sucesso: true,
      message: 'Limpeza realizada com sucesso',
      tabelas_limpas: ['cadastro_exames', 'regras_quebra_exames', 'processamento_uploads'],
      timestamp: new Date().toISOString()
    };

    console.log('Limpeza concluída:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Erro na limpeza:', error);
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