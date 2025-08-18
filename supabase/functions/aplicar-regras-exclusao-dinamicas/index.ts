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

    console.log(`Iniciando aplicação de regras de exclusão dinâmicas para arquivo: ${arquivo_fonte}`);

    // Buscar regras de exclusão ativas
    const { data: regrasExclusao, error: errorRegras } = await supabase
      .from('regras_exclusao')
      .select('*')
      .eq('ativo', true)
      .eq('aplicar_incremental', true)
      .order('prioridade', { ascending: true });

    if (errorRegras) {
      throw new Error(`Erro ao buscar regras de exclusão: ${errorRegras.message}`);
    }

    if (!regrasExclusao || regrasExclusao.length === 0) {
      console.log('Nenhuma regra de exclusão dinâmica ativa encontrada');
      return new Response(JSON.stringify({
        sucesso: true,
        arquivo_fonte,
        total_regras_aplicadas: 0,
        total_registros_excluidos: 0,
        mensagem: 'Nenhuma regra de exclusão dinâmica ativa'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    let totalExcluidos = 0;
    const regrasAplicadas: any[] = [];

    for (const regra of regrasExclusao) {
      try {
        console.log(`Aplicando regra: ${regra.nome_regra}`);
        
        let whereConditions = [];
        let valores = [];
        let contadorParam = 1;

        // Construir condições WHERE baseadas nos critérios da regra
        const criterios = typeof regra.criterios === 'string' 
          ? JSON.parse(regra.criterios) 
          : regra.criterios;

        for (const [campo, valor] of Object.entries(criterios)) {
          if (campo === 'valor' && valor === 0) {
            whereConditions.push(`(COALESCE("VALORES", 0) = 0)`);
          } else if (campo === 'status' && valor === 'CANCELADO') {
            whereConditions.push(`"STATUS" = $${contadorParam}`);
            valores.push(valor);
            contadorParam++;
          } else if (campo === 'empresa') {
            whereConditions.push(`"EMPRESA" = $${contadorParam}`);
            valores.push(valor);
            contadorParam++;
          } else if (campo === 'modalidade') {
            whereConditions.push(`"MODALIDADE" = $${contadorParam}`);
            valores.push(valor);
            contadorParam++;
          } else if (campo === 'especialidade') {
            whereConditions.push(`"ESPECIALIDADE" = $${contadorParam}`);
            valores.push(valor);
            contadorParam++;
          }
        }

        if (whereConditions.length > 0) {
          // Contar registros que serão excluídos
          const queryCount = `
            SELECT COUNT(*) as total
            FROM volumetria_mobilemed 
            WHERE arquivo_fonte = $${contadorParam} 
            AND (${whereConditions.join(' AND ')})
          `;
          valores.push(arquivo_fonte);

          const { data: countResult, error: countError } = await supabase
            .rpc('execute_sql', { 
              query: queryCount,
              params: valores 
            });

          if (countError) {
            console.warn(`Erro ao contar registros para regra ${regra.nome_regra}:`, countError);
            continue;
          }

          const totalParaExcluir = countResult?.[0]?.total || 0;

          if (totalParaExcluir > 0) {
            // Executar exclusão
            const queryDelete = `
              DELETE FROM volumetria_mobilemed 
              WHERE arquivo_fonte = $${contadorParam} 
              AND (${whereConditions.join(' AND ')})
            `;

            const { error: deleteError } = await supabase
              .rpc('execute_sql', { 
                query: queryDelete,
                params: valores 
              });

            if (deleteError) {
              console.error(`Erro ao executar exclusão para regra ${regra.nome_regra}:`, deleteError);
              continue;
            }

            totalExcluidos += totalParaExcluir;
            regrasAplicadas.push({
              nome_regra: regra.nome_regra,
              prioridade: regra.prioridade,
              registros_excluidos: totalParaExcluir,
              motivo: regra.motivo_exclusao
            });

            console.log(`Regra ${regra.nome_regra}: ${totalParaExcluir} registros excluídos`);
          }
        }
      } catch (regraError) {
        console.error(`Erro ao aplicar regra ${regra.nome_regra}:`, regraError);
        continue;
      }
    }

    // Log da operação
    const { error: logError } = await supabase
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'REGRAS_EXCLUSAO_DINAMICAS',
        record_id: arquivo_fonte,
        new_data: {
          arquivo_fonte,
          total_regras_aplicadas: regrasAplicadas.length,
          total_registros_excluidos: totalExcluidos,
          regras_aplicadas: regrasAplicadas,
          regra: 'extra_005'
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
      total_regras_aplicadas: regrasAplicadas.length,
      total_registros_excluidos: totalExcluidos,
      regras_aplicadas: regrasAplicadas,
      regra_aplicada: 'extra_005 - Regras Exclusão Dinâmicas',
      data_processamento: new Date().toISOString(),
      observacao: 'Exclusões baseadas em regras configuradas dinamicamente'
    };

    console.log('Regras de exclusão dinâmicas concluídas:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Erro geral nas regras de exclusão dinâmicas:', error);
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