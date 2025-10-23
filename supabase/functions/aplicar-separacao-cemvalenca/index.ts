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

    const { periodo_referencia } = await req.json();
    console.log(`[separacao-cemvalenca] Iniciando separação para período: ${periodo_referencia || 'TODOS'}`);

    // Construir query base
    let query = supabase
      .from('volumetria_mobilemed')
      .select('id, "EMPRESA", "MODALIDADE", "PRIORIDADE"')
      .eq('EMPRESA', 'CEMVALENCA');

    // Filtrar por período se especificado
    if (periodo_referencia) {
      query = query.eq('periodo_referencia', periodo_referencia);
    }

    // Buscar registros do CEMVALENCA
    const { data: registros, error: errorRegistros } = await query;

    if (errorRegistros) {
      console.error('[separacao-cemvalenca] Erro ao buscar registros:', errorRegistros);
      throw errorRegistros;
    }

    if (!registros || registros.length === 0) {
      return new Response(
        JSON.stringify({
          sucesso: true,
          total_processados: 0,
          mensagem: 'Nenhum registro CEMVALENCA encontrado'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[separacao-cemvalenca] Encontrados ${registros.length} registros para processar`);

    let totalCEMVALENCA_PL = 0;
    let totalCEMVALENCA_RX = 0;
    let totalCEMVALENCA = 0;
    let erros = 0;

    // Processar em lotes de 50
    const tamanhoLote = 50;
    for (let i = 0; i < registros.length; i += tamanhoLote) {
      const lote = registros.slice(i, i + tamanhoLote);
      console.log(`[separacao-cemvalenca] Processando lote ${Math.floor(i/tamanhoLote) + 1}/${Math.ceil(registros.length/tamanhoLote)}`);

      for (const registro of lote) {
        try {
          let novoNomeCliente = 'CEMVALENCA';

          // REGRA 1: PLANTÃO = CEMVALENCA_PL (independente da modalidade)
          if (registro.PRIORIDADE === 'PLANTÃO') {
            novoNomeCliente = 'CEMVALENCA_PL';
            totalCEMVALENCA_PL++;
          }
          // REGRA 2: RX (não PLANTÃO) = CEMVALENCA_RX
          else if (registro.MODALIDADE === 'RX') {
            novoNomeCliente = 'CEMVALENCA_RX';
            totalCEMVALENCA_RX++;
          }
          // REGRA 3: Resto = CEMVALENCA
          else {
            totalCEMVALENCA++;
          }

          // Atualizar apenas se o nome mudou
          if (novoNomeCliente !== registro.EMPRESA) {
            const { error: updateError } = await supabase
              .from('volumetria_mobilemed')
              .update({ 
                'EMPRESA': novoNomeCliente,
                updated_at: new Date().toISOString()
              })
              .eq('id', registro.id);

            if (updateError) {
              console.error(`[separacao-cemvalenca] Erro ao atualizar ${registro.id}:`, updateError);
              erros++;
            } else {
              console.log(`[separacao-cemvalenca] ${registro.id}: CEMVALENCA → ${novoNomeCliente} (${registro.MODALIDADE}/${registro.PRIORIDADE})`);
            }
          }
        } catch (error: any) {
          console.error(`[separacao-cemvalenca] Erro no registro ${registro.id}:`, error);
          erros++;
        }
      }
    }

    // Log da operação
    const resultado = {
      sucesso: true,
      periodo_referencia: periodo_referencia || 'TODOS',
      total_registros_processados: registros.length,
      CEMVALENCA_PL: totalCEMVALENCA_PL,
      CEMVALENCA_RX: totalCEMVALENCA_RX,
      CEMVALENCA: totalCEMVALENCA,
      erros,
      data_processamento: new Date().toISOString()
    };

    console.log('[separacao-cemvalenca] Finalizado:', resultado);

    // Registrar no audit log
    await supabase.from('audit_logs').insert({
      table_name: 'volumetria_mobilemed',
      operation: 'SEPARACAO_CEMVALENCA',
      record_id: periodo_referencia || 'TODOS',
      new_data: resultado,
      user_email: 'system',
      severity: 'info'
    });

    return new Response(
      JSON.stringify(resultado),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[separacao-cemvalenca] Erro:', error);
    return new Response(
      JSON.stringify({
        sucesso: false,
        erro: error.message,
        data_erro: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
