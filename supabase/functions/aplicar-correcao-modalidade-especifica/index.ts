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

    console.log(`Iniciando correção modalidade específica para arquivo: ${arquivo_fonte}`);

    // REGRA v030: Correções específicas baseadas em ESTUDO_DESCRICAO
    const correcoesEspecificas = [
      { estudo: 'TOMOGRAFIA COMPUTADORIZADA', modalidade_correta: 'CT' },
      { estudo: 'RESSONANCIA MAGNETICA', modalidade_correta: 'MR' },
      { estudo: 'ULTRASSONOGRAFIA', modalidade_correta: 'US' },
      { estudo: 'DOPPLER', modalidade_correta: 'US' },
      { estudo: 'ECOCARDIOGRAFIA', modalidade_correta: 'US' },
      { estudo: 'DENSITOMETRIA', modalidade_correta: 'DX' },
      { estudo: 'PANORAMICA', modalidade_correta: 'DX' },
      { estudo: 'TELERADIOGRAFIA', modalidade_correta: 'DX' }
    ];

    let totalCorrigidos = 0;
    const exemplosCorrigan: any[] = [];

    for (const correcao of correcoesEspecificas) {
      // Buscar registros que precisam de correção
      const { data: registrosParaCorrigir, error: errorBusca } = await supabase
        .from('volumetria_mobilemed')
        .select('id, "ESTUDO_DESCRICAO", "MODALIDADE"')
        .eq('arquivo_fonte', arquivo_fonte)
        .ilike('ESTUDO_DESCRICAO', `%${correcao.estudo}%`)
        .neq('MODALIDADE', correcao.modalidade_correta);

      if (errorBusca) {
        throw new Error(`Erro ao buscar registros para correção: ${errorBusca.message}`);
      }

      if (registrosParaCorrigir && registrosParaCorrigir.length > 0) {
        // Aplicar correção
        const { data: resultadoUpdate, error: errorUpdate } = await supabase
          .from('volumetria_mobilemed')
          .update({ 
            "MODALIDADE": correcao.modalidade_correta,
            updated_at: new Date().toISOString()
          })
          .eq('arquivo_fonte', arquivo_fonte)
          .ilike('ESTUDO_DESCRICAO', `%${correcao.estudo}%`)
          .neq('MODALIDADE', correcao.modalidade_correta)
          .select('id, "ESTUDO_DESCRICAO", "MODALIDADE"');

        if (errorUpdate) {
          throw new Error(`Erro ao aplicar correção: ${errorUpdate.message}`);
        }

        const corrigidos = resultadoUpdate?.length || 0;
        totalCorrigidos += corrigidos;

        if (corrigidos > 0) {
          exemplosCorrigan.push({
            estudo_descricao: correcao.estudo,
            modalidade_anterior: registrosParaCorrigir[0].MODALIDADE,
            modalidade_nova: correcao.modalidade_correta,
            quantidade_corrigida: corrigidos
          });
        }

        console.log(`Correção ${correcao.estudo}: ${corrigidos} registros atualizados`);
      }
    }

    // Log da operação
    const { error: logError } = await supabase
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'CORRECAO_MODALIDADE_ESPECIFICA',
        record_id: arquivo_fonte,
        new_data: {
          arquivo_fonte,
          total_corrigidos: totalCorrigidos,
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
      total_corrigidos: totalCorrigidos,
      exemplos_corrigidos: exemplosCorrigan,
      regra_aplicada: 'v030 - Correção Modalidade Específica',
      data_processamento: new Date().toISOString(),
      observacao: 'Correções específicas baseadas no tipo de estudo realizado'
    };

    console.log('Correção modalidade específica concluída:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Erro geral na correção modalidade específica:', error);
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