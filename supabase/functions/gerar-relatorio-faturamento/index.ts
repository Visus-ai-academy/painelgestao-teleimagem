import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cliente_id, periodo } = await req.json();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar cliente
    const { data: cliente } = await supabase
      .from('clientes')
      .select('nome')
      .eq('id', cliente_id)
      .single();

    if (!cliente) {
      return new Response(JSON.stringify({ success: false, error: 'Cliente não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Calcular período
    const [ano, mes] = periodo.split('-');
    const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
    const dataInicio = `${ano}-${mes}-01`;
    const dataFim = `${ano}-${mes}-${ultimoDia}`;

    // Buscar faturamento
    const { data: dados } = await supabase
      .from('faturamento')
      .select('data_emissao, cliente, nome_exame, medico, modalidade, especialidade, quantidade, valor_bruto')
      .eq('paciente', cliente.nome)
      .gte('data_emissao', dataInicio)
      .lte('data_emissao', dataFim);

    if (!dados || dados.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Nenhum dado encontrado para ${cliente.nome} no período ${periodo}` 
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Agrupar registros únicos
    const unicos = new Map();
    dados.forEach(item => {
      const chave = `${item.data_emissao}_${item.cliente}_${item.nome_exame}_${item.medico}`;
      if (unicos.has(chave)) {
        const existente = unicos.get(chave);
        existente.quantidade += Number(item.quantidade) || 1;
        existente.valor_bruto += Number(item.valor_bruto) || 0;
      } else {
        unicos.set(chave, {
          ...item,
          quantidade: Number(item.quantidade) || 1,
          valor_bruto: Number(item.valor_bruto) || 0
        });
      }
    });

    const registros = Array.from(unicos.values());
    const totalRegistros = registros.length;
    const totalLaudos = registros.reduce((sum, r) => sum + r.quantidade, 0);
    const valorBruto = registros.reduce((sum, r) => sum + r.valor_bruto, 0);

    // Impostos
    const irrf = valorBruto * 0.015;
    const csll = valorBruto * 0.01;
    const pis = valorBruto * 0.0065;
    const cofins = valorBruto * 0.03;
    const valorLiquido = valorBruto - (irrf + csll + pis + cofins);

    return new Response(JSON.stringify({
      success: true,
      cliente: cliente.nome,
      periodo,
      total_registros: totalRegistros,
      total_laudos: totalLaudos,
      valor_bruto: valorBruto.toFixed(2),
      valor_liquido: valorLiquido.toFixed(2),
      message: `Relatório: ${totalRegistros} registros, ${totalLaudos} laudos, R$ ${valorBruto.toFixed(2)}`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Erro:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});