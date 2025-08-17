import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PeriodoFaturamento {
  ano: number;
  mes: number;
}

/**
 * Converte o período de faturamento em data_referencia e periodo_referencia
 * Ex: {ano: 2025, mes: 6} -> data_referencia: '2025-06-01', periodo_referencia: 'jun/25'
 */
function gerarDataReferencia(periodo: PeriodoFaturamento): { data_referencia: string; periodo_referencia: string } {
  const mesNomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  
  const data_referencia = `${periodo.ano}-${String(periodo.mes).padStart(2, '0')}-01`;
  const periodo_referencia = `${mesNomes[periodo.mes - 1]}/${String(periodo.ano).slice(-2)}`;
  
  return { data_referencia, periodo_referencia };
}

/**
 * Aplica a Regra v024 - Definição Data Referência
 * Define data_referencia e periodo_referencia baseados no período de processamento,
 * independente das datas originais de realização/laudo dos exames
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
      periodo_faturamento, 
      arquivo_fonte, 
      lote_upload,
      aplicar_todos = false 
    } = await req.json();

    console.log('🔧 Iniciando aplicação da Regra v024 - Definição Data Referência');
    console.log('📅 Período:', periodo_faturamento);
    console.log('📁 Arquivo fonte:', arquivo_fonte);
    console.log('📦 Lote upload:', lote_upload);
    console.log('🌐 Aplicar todos:', aplicar_todos);

    if (!periodo_faturamento || !periodo_faturamento.ano || !periodo_faturamento.mes) {
      return new Response(
        JSON.stringify({ 
          sucesso: false, 
          erro: 'Período de faturamento é obrigatório (ano e mês)' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Gerar data_referencia e periodo_referencia corretos
    const { data_referencia, periodo_referencia } = gerarDataReferencia(periodo_faturamento);
    
    console.log(`📈 Definindo data_referencia: ${data_referencia}`);
    console.log(`📊 Definindo periodo_referencia: ${periodo_referencia}`);

    // Construir query baseada nos parâmetros
    let query = supabase
      .from('volumetria_mobilemed')
      .update({
        data_referencia,
        periodo_referencia,
        updated_at: 'now()'
      });

    // Aplicar filtros conforme necessário
    if (!aplicar_todos) {
      if (arquivo_fonte) {
        query = query.eq('arquivo_fonte', arquivo_fonte);
      }
      if (lote_upload) {
        query = query.eq('lote_upload', lote_upload);
      }
    }

    // Executar atualização
    const { data, error, count } = await query.select();

    if (error) {
      console.error('❌ Erro ao aplicar data_referencia:', error);
      return new Response(
        JSON.stringify({ 
          sucesso: false, 
          erro: `Erro ao atualizar registros: ${error.message}` 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    const registros_atualizados = data?.length || 0;

    // Log da operação para auditoria
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'REGRA_V024_DATA_REFERENCIA',
        record_id: `${arquivo_fonte || 'ALL'}_${lote_upload || 'ALL'}`,
        new_data: {
          data_referencia,
          periodo_referencia,
          registros_atualizados,
          periodo_faturamento,
          arquivo_fonte,
          lote_upload,
          aplicar_todos
        },
        user_email: 'system',
        severity: 'info'
      });

    console.log(`✅ Regra v024 aplicada com sucesso: ${registros_atualizados} registros atualizados`);

    const resultado = {
      sucesso: true,
      data_referencia,
      periodo_referencia,
      registros_atualizados,
      periodo_aplicado: `${periodo_faturamento.mes}/${periodo_faturamento.ano}`,
      mensagem: `Regra v024 aplicada: ${registros_atualizados} registros atualizados com período ${periodo_referencia}`
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