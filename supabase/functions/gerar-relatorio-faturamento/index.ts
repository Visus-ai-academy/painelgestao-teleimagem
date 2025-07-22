import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { cliente_id, periodo } = body;
    
    console.log(`Gerando relatório para cliente: ${cliente_id}, período: ${periodo}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar cliente
    const { data: cliente } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', cliente_id)
      .single();

    if (!cliente) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cliente não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calcular datas
    const [ano, mes] = periodo.split('-');
    const data_inicio = `${ano}-${mes}-01`;
    const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
    const data_fim = `${ano}-${mes}-${ultimoDia.toString().padStart(2, '0')}`;

    // Buscar dados de faturamento
    const { data: faturamento } = await supabase
      .from('faturamento')
      .select('*')
      .eq('paciente', cliente.nome)
      .gte('data_emissao', data_inicio)
      .lte('data_emissao', data_fim);

    const total_laudos = faturamento?.length || 0;
    const valor_total = faturamento?.reduce((sum, item) => sum + (Number(item.valor_bruto) || 0), 0) || 0;

    // Gerar relatório simples
    const relatorio = {
      cliente: cliente.nome,
      periodo,
      total_laudos,
      valor_total: valor_total.toFixed(2),
      data_geracao: new Date().toISOString()
    };

    return new Response(
      JSON.stringify({ 
        success: true,
        relatorio,
        message: `Relatório gerado: ${total_laudos} laudos, R$ ${valor_total.toFixed(2)}`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);