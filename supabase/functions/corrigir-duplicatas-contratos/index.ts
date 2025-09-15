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

    console.log('Iniciando correção de duplicatas de contratos...');

    let correcoes = 0;
    let transferencias = 0;
    let erros = 0;
    const resultados: any[] = [];

    // 1. Buscar todos os clientes ativos com contratos mas sem parâmetros
    const { data: clientesComContrato, error: clientesError } = await supabase
      .from('clientes')
      .select(`
        id,
        nome,
        nome_fantasia,
        contratos_clientes!inner(id, numero_contrato)
      `)
      .eq('ativo', true);

    if (clientesError) throw clientesError;

    console.log(`Encontrados ${clientesComContrato?.length || 0} clientes com contratos para verificar`);

    // 2. Para cada cliente com contrato, verificar se há cliente duplicado com parâmetros
    for (const cliente of clientesComContrato || []) {
      try {
        // Buscar possível cliente duplicado com mesmo nome_fantasia mas nome diferente
        const possiveisNomesDuplicados = [
          `${cliente.nome}_2`,
          `${cliente.nome}2`,
          `${cliente.nome} 2`,
          cliente.nome.replace('_2', '').replace('2', '') + '_2'
        ];

        const { data: clienteDuplicado, error: duplicadoError } = await supabase
          .from('clientes')
          .select(`
            id,
            nome,
            nome_fantasia,
            parametros_faturamento!inner(id, numero_contrato, status)
          `)
          .eq('ativo', true)
          .eq('nome_fantasia', cliente.nome_fantasia)
          .in('nome', possiveisNomesDuplicados)
          .eq('parametros_faturamento.status', 'A')
          .limit(1)
          .maybeSingle();

        if (duplicadoError) {
          console.error(`Erro ao buscar duplicado para ${cliente.nome}:`, duplicadoError);
          continue;
        }

        // Se encontrou duplicado com parâmetros
        if (clienteDuplicado && clienteDuplicado.parametros_faturamento?.length > 0) {
          const parametros = clienteDuplicado.parametros_faturamento[0];
          const contrato = cliente.contratos_clientes[0];

          // Verificar se já tem parâmetros no cliente principal
          const { data: parametrosExistentes } = await supabase
            .from('parametros_faturamento')
            .select('id')
            .eq('cliente_id', cliente.id)
            .eq('status', 'A')
            .limit(1)
            .maybeSingle();

          if (parametrosExistentes) {
            console.log(`Cliente ${cliente.nome} já tem parâmetros, pulando...`);
            continue;
          }

          // Atualizar número do contrato com o número correto dos parâmetros
          if (parametros.numero_contrato && parametros.numero_contrato !== contrato.numero_contrato) {
            const { error: updateContratoError } = await supabase
              .from('contratos_clientes')
              .update({
                numero_contrato: parametros.numero_contrato,
                updated_at: new Date().toISOString(),
                observacoes_contratuais: `Número corrigido de ${contrato.numero_contrato} para ${parametros.numero_contrato} em ${new Date().toLocaleDateString('pt-BR')}`
              })
              .eq('id', contrato.id);

            if (updateContratoError) throw updateContratoError;
          }

          // Transferir parâmetros do duplicado para o principal
          const { error: transferParamsError } = await supabase
            .from('parametros_faturamento')
            .update({
              cliente_id: cliente.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', parametros.id);

          if (transferParamsError) throw transferParamsError;

          // Desativar cliente duplicado
          const { error: desativarError } = await supabase
            .from('clientes')
            .update({
              ativo: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', clienteDuplicado.id);

          if (desativarError) throw desativarError;

          resultados.push({
            cliente: cliente.nome,
            sucesso: true,
            contrato_antigo: contrato.numero_contrato,
            contrato_novo: parametros.numero_contrato,
            cliente_duplicado_desativado: clienteDuplicado.nome
          });

          correcoes++;
          transferencias++;

          console.log(`✅ Corrigido ${cliente.nome}: ${contrato.numero_contrato} → ${parametros.numero_contrato}`);
        }

      } catch (e) {
        console.error(`Erro ao corrigir ${cliente.nome}:`, e);
        resultados.push({
          cliente: cliente.nome,
          sucesso: false,
          erro: String(e?.message || e)
        });
        erros++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total_correcoes: correcoes,
      total_transferencias: transferencias,
      total_erros: erros,
      resultados,
      mensagem: `Corrigidos ${correcoes} contratos com números corretos dos parâmetros`
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Erro na correção de duplicatas:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error?.message || String(error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});