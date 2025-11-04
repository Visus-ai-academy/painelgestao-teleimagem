import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PeriodoFaturamento {
  ano: number;
  mes: number;
}

/**
 * Calcula o período de referência baseado na DATA_LAUDO aplicando a regra do dia 8 ao dia 7
 * Regra: Se DATA_LAUDO está entre dia 8 de um mês e dia 7 do mês seguinte, 
 * o periodo_referencia é o mês que começa no dia 8
 * 
 * Exemplos:
 * - DATA_LAUDO = 08/09/2025 → periodo_referencia = '2025-09' (set/2025)
 * - DATA_LAUDO = 07/10/2025 → periodo_referencia = '2025-09' (set/2025)
 * - DATA_LAUDO = 08/10/2025 → periodo_referencia = '2025-10' (out/2025)
 * - DATA_LAUDO = 07/09/2025 → periodo_referencia = '2025-08' (ago/2025)
 */
function calcularPeriodoReferencia(dataLaudo: string): { data_referencia: string; periodo_referencia: string } {
  const data = new Date(dataLaudo + 'T00:00:00');
  const dia = data.getDate();
  const mes = data.getMonth() + 1; // JavaScript months are 0-indexed
  const ano = data.getFullYear();
  
  let mesReferencia: number;
  let anoReferencia: number;
  
  // Se o dia é >= 8, o período de referência é o mês atual
  // Se o dia é < 8, o período de referência é o mês anterior
  if (dia >= 8) {
    mesReferencia = mes;
    anoReferencia = ano;
  } else {
    // Dia 1-7: pertence ao período do mês anterior
    if (mes === 1) {
      mesReferencia = 12;
      anoReferencia = ano - 1;
    } else {
      mesReferencia = mes - 1;
      anoReferencia = ano;
    }
  }
  
  const periodo_referencia = `${anoReferencia}-${String(mesReferencia).padStart(2, '0')}`;
  const data_referencia = `${anoReferencia}-${String(mesReferencia).padStart(2, '0')}-01`;
  
  return { data_referencia, periodo_referencia };
}

/**
 * Aplica a Regra v024 - Definição Data Referência
 * Calcula automaticamente o período de referência com base na DATA_LAUDO de cada exame,
 * aplicando a regra do dia 8 ao dia 7
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { 
      arquivo_fonte, 
      lote_upload,
      aplicar_todos = false 
    } = await req.json();

    console.log('🔧 Iniciando aplicação da Regra v024 - Definição Data Referência (dia 8 ao dia 7)');
    console.log('📁 Arquivo fonte:', arquivo_fonte);
    console.log('📦 Lote upload:', lote_upload);
    console.log('🌐 Aplicar todos:', aplicar_todos);

    // Buscar registros que precisam ter o período calculado
    let selectQuery = supabase
      .from('volumetria_mobilemed')
      .select('id, "DATA_LAUDO"');

    // Aplicar filtros conforme necessário
    if (!aplicar_todos) {
      if (arquivo_fonte) {
        selectQuery = selectQuery.eq('arquivo_fonte', arquivo_fonte);
      }
      if (lote_upload) {
        selectQuery = selectQuery.eq('lote_upload', lote_upload);
      }
    }

    const { data: registros, error: selectError } = await selectQuery;

    if (selectError) {
      console.error('❌ Erro ao buscar registros:', selectError);
      return new Response(
        JSON.stringify({ 
          sucesso: false, 
          erro: `Erro ao buscar registros: ${selectError.message}` 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    if (!registros || registros.length === 0) {
      console.log('⚠️ Nenhum registro encontrado para processar');
      return new Response(
        JSON.stringify({ 
          sucesso: true,
          registros_atualizados: 0,
          mensagem: 'Nenhum registro encontrado para processar'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`📊 ${registros.length} registros encontrados para processar`);

    // Processar em lotes de 100 registros
    const BATCH_SIZE = 100;
    let totalAtualizados = 0;
    const periodoStats: Record<string, number> = {};

    for (let i = 0; i < registros.length; i += BATCH_SIZE) {
      const batch = registros.slice(i, i + BATCH_SIZE);
      
      for (const registro of batch) {
        if (!registro.DATA_LAUDO) {
          console.warn(`⚠️ Registro ${registro.id} sem DATA_LAUDO, pulando...`);
          continue;
        }

        const { data_referencia, periodo_referencia } = calcularPeriodoReferencia(registro.DATA_LAUDO);

        const { error: updateError } = await supabase
          .from('volumetria_mobilemed')
          .update({
            data_referencia,
            periodo_referencia
          })
          .eq('id', registro.id);

        if (updateError) {
          console.error(`❌ Erro ao atualizar registro ${registro.id}:`, updateError);
        } else {
          totalAtualizados++;
          periodoStats[periodo_referencia] = (periodoStats[periodo_referencia] || 0) + 1;
        }
      }

      console.log(`⏳ Processados ${Math.min(i + BATCH_SIZE, registros.length)} de ${registros.length} registros...`);
    }

    // Log da operação para auditoria
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'REGRA_V024_DATA_REFERENCIA_AUTOMATICA',
        record_id: `${arquivo_fonte || 'ALL'}_${lote_upload || 'ALL'}`,
        new_data: {
          registros_processados: registros.length,
          registros_atualizados: totalAtualizados,
          periodos_calculados: periodoStats,
          arquivo_fonte,
          lote_upload,
          aplicar_todos
        },
        user_email: 'system',
        severity: 'info'
      });

    console.log(`✅ Regra v024 aplicada com sucesso: ${totalAtualizados} registros atualizados`);
    console.log('📊 Distribuição por período:', periodoStats);

    const resultado = {
      sucesso: true,
      registros_processados: registros.length,
      registros_atualizados: totalAtualizados,
      periodos_calculados: periodoStats,
      mensagem: `Regra v024 aplicada: ${totalAtualizados} registros atualizados automaticamente com base na DATA_LAUDO`
    };

    return new Response(
      JSON.stringify(resultado),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Erro geral na aplicação da Regra v024:', error);
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        erro: `Erro interno: ${error.message}` 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});