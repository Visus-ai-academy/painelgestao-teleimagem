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

    console.log(`Iniciando aplicação de especialidade automática para arquivo: ${arquivo_fonte}`);

    // REGRA extra_007: Definir especialidade baseada em modalidade e estudo
    const regrasEspecialidade = [
      { modalidades: ['CT'], especialidade: 'TOMOGRAFIA' },
      { modalidades: ['MR'], especialidade: 'RESSONANCIA' },
      { modalidades: ['US'], especialidade: 'ULTRASSOM' },
      { modalidades: ['MG'], especialidade: 'MAMOGRAFIA' },
      { modalidades: ['RX', 'DX', 'CR'], especialidade: 'RX' },
      { modalidades: ['DO'], especialidade: 'DENSITOMETRIA' },
      { modalidades: ['NM'], especialidade: 'MEDICINA_NUCLEAR' }
    ];

    // Buscar registros sem especialidade ou com especialidade vazia
    const { data: registrosSemEspecialidade, error: errorBusca } = await supabase
      .from('volumetria_mobilemed')
      .select('id, "MODALIDADE", "ESTUDO_DESCRICAO", "ESPECIALIDADE"')
      .eq('arquivo_fonte', arquivo_fonte)
      .or('"ESPECIALIDADE".is.null,"ESPECIALIDADE".eq.""');

    if (errorBusca) {
      throw new Error(`Erro ao buscar registros sem especialidade: ${errorBusca.message}`);
    }

    if (!registrosSemEspecialidade || registrosSemEspecialidade.length === 0) {
      console.log('Nenhum registro sem especialidade encontrado');
      return new Response(JSON.stringify({
        sucesso: true,
        arquivo_fonte,
        registros_processados: 0,
        mensagem: 'Nenhum registro sem especialidade encontrado'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    let totalProcessados = 0;
    const exemplosCorrigan: any[] = [];

    for (const regra of regrasEspecialidade) {
      // Aplicar especialidade baseada na modalidade
      const { data: resultadoUpdate, error: errorUpdate } = await supabase
        .from('volumetria_mobilemed')
        .update({ 
          "ESPECIALIDADE": regra.especialidade,
          updated_at: new Date().toISOString()
        })
        .eq('arquivo_fonte', arquivo_fonte)
        .in('MODALIDADE', regra.modalidades)
        .or('"ESPECIALIDADE".is.null,"ESPECIALIDADE".eq.""')
        .select('id, "MODALIDADE", "ESPECIALIDADE"');

      if (errorUpdate) {
        console.warn(`Erro ao aplicar especialidade para modalidades ${regra.modalidades.join(',')}:`, errorUpdate);
        continue;
      }

      const processados = resultadoUpdate?.length || 0;
      totalProcessados += processados;

      if (processados > 0) {
        exemplosCorrigan.push({
          modalidades: regra.modalidades,
          especialidade_aplicada: regra.especialidade,
          quantidade_processada: processados
        });

        console.log(`Especialidade ${regra.especialidade} aplicada a ${processados} registros com modalidade ${regra.modalidades.join(',')}`);
      }
    }

    // Aplicar especialidade baseada no estudo (regras específicas)
    const regrasEspecialidadePorEstudo = [
      { estudos: ['MAMOGRAFIA', 'MAMOGRAFICA'], especialidade: 'MAMOGRAFIA' },
      { estudos: ['DENSITOMETRIA', 'DEXA'], especialidade: 'DENSITOMETRIA' },
      { estudos: ['ECOCARDIOGRAFIA', 'ECO'], especialidade: 'ECOCARDIOGRAFIA' },
      { estudos: ['DOPPLER'], especialidade: 'DOPPLER' }
    ];

    for (const regra of regrasEspecialidadePorEstudo) {
      for (const estudo of regra.estudos) {
        const { data: resultadoUpdate, error: errorUpdate } = await supabase
          .from('volumetria_mobilemed')
          .update({ 
            "ESPECIALIDADE": regra.especialidade,
            updated_at: new Date().toISOString()
          })
          .eq('arquivo_fonte', arquivo_fonte)
          .ilike('ESTUDO_DESCRICAO', `%${estudo}%`)
          .or('"ESPECIALIDADE".is.null,"ESPECIALIDADE".eq.""')
          .select('id, "ESTUDO_DESCRICAO", "ESPECIALIDADE"');

        if (errorUpdate) {
          console.warn(`Erro ao aplicar especialidade para estudo ${estudo}:`, errorUpdate);
          continue;
        }

        const processados = resultadoUpdate?.length || 0;
        totalProcessados += processados;

        if (processados > 0) {
          exemplosCorrigan.push({
            estudo_base: estudo,
            especialidade_aplicada: regra.especialidade,
            quantidade_processada: processados
          });

          console.log(`Especialidade ${regra.especialidade} aplicada a ${processados} registros com estudo contendo ${estudo}`);
        }
      }
    }

    // Para registros que ainda não têm especialidade, aplicar "GERAL"
    const { data: registrosRestantes, error: errorRestantes } = await supabase
      .from('volumetria_mobilemed')
      .update({ 
        "ESPECIALIDADE": 'GERAL',
        updated_at: new Date().toISOString()
      })
      .eq('arquivo_fonte', arquivo_fonte)
      .or('"ESPECIALIDADE".is.null,"ESPECIALIDADE".eq.""')
      .select('id');

    if (!errorRestantes && registrosRestantes) {
      const restantes = registrosRestantes.length;
      totalProcessados += restantes;
      
      if (restantes > 0) {
        exemplosCorrigan.push({
          especialidade_aplicada: 'GERAL',
          quantidade_processada: restantes,
          observacao: 'Especialidade padrão para registros sem classificação específica'
        });
      }
    }

    // Log da operação
    const { error: logError } = await supabase
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'APLICACAO_ESPECIALIDADE_AUTOMATICA',
        record_id: arquivo_fonte,
        new_data: {
          arquivo_fonte,
          registros_processados: totalProcessados,
          exemplos_aplicados: exemplosCorrigan,
          regra: 'extra_007'
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
      registros_processados: totalProcessados,
      exemplos_aplicados: exemplosCorrigan,
      regra_aplicada: 'extra_007 - Aplicação Especialidade Automática',
      data_processamento: new Date().toISOString(),
      observacao: 'Especialidades definidas automaticamente baseadas em modalidade e tipo de estudo'
    };

    console.log('Aplicação de especialidade automática concluída:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Erro geral na aplicação de especialidade automática:', error);
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