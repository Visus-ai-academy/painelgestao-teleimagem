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

    // Receber opções do body da requisição
    const options = await req.json();
    console.log('Opções recebidas:', options);

    const tabelasLimpas: string[] = [];
    let totalLimpezas = 0;

    // Limpar tabela de cadastro de exames se solicitado
    if (options.cadastro_exames) {
      console.log('Limpando tabela cadastro_exames...');
      const { error: errorCadastro, count } = await supabase
        .from('cadastro_exames')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000');

      if (errorCadastro) {
        console.error('Erro ao limpar cadastro_exames:', errorCadastro);
      } else {
        console.log('Tabela cadastro_exames limpa com sucesso');
        tabelasLimpas.push('cadastro_exames');
        totalLimpezas += count || 0;
      }
    }

    // Limpar tabela de regras de quebra de exames se solicitado
    if (options.quebra_exames) {
      console.log('Limpando tabela regras_quebra_exames...');
      const { error: errorQuebra, count } = await supabase
        .from('regras_quebra_exames')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000');

      if (errorQuebra) {
        console.error('Erro ao limpar regras_quebra_exames:', errorQuebra);
      } else {
        console.log('Tabela regras_quebra_exames limpa com sucesso');
        tabelasLimpas.push('regras_quebra_exames');
        totalLimpezas += count || 0;
      }
    }

    // Limpar logs de processamento se solicitado
    if (options.logs_uploads) {
      console.log('Limpando logs de processamento...');
      const { error: errorLogs, count } = await supabase
        .from('processamento_uploads')
        .delete()
        .in('tipo_arquivo', ['cadastro_exames', 'quebra_exames']);

      if (errorLogs) {
        console.error('Erro ao limpar logs:', errorLogs);
      } else {
        console.log('Logs de processamento limpos com sucesso');
        tabelasLimpas.push('processamento_uploads');
        totalLimpezas += count || 0;
      }
    }

    // Log da operação de limpeza
    const { error: logError } = await supabase
      .from('processamento_uploads')
      .insert({
        arquivo_nome: 'limpeza_sistema',
        tipo_arquivo: 'sistema',
        tipo_dados: 'limpeza',
        status: 'concluido',
        registros_processados: totalLimpezas,
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
      message: `Limpeza realizada com sucesso. ${totalLimpezas} registros removidos.`,
      tabelas_limpas: tabelasLimpas,
      total_registros_removidos: totalLimpezas,
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