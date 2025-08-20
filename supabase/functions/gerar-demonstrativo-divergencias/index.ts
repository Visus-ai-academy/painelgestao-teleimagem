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

  console.log('[gerar-demonstrativo-divergencias] INÍCIO DA FUNÇÃO');
  
  try {
    const { periodo } = await req.json();
    console.log('[gerar-demonstrativo-divergencias] Período:', periodo);

    if (!periodo) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Parâmetro periodo é obrigatório' 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar registros de volumetria sem preço configurado (exames não localizados)
    console.log('[gerar-demonstrativo-divergencias] Buscando divergências...');

    const { data: divergencias, error } = await supabase
      .from('volumetria_mobilemed')
      .select(`
        "EMPRESA",
        "Cliente_Nome_Fantasia",
        "ESTUDO_DESCRICAO",
        "MODALIDADE",
        "ESPECIALIDADE", 
        "CATEGORIA",
        "PRIORIDADE",
        "VALORES",
        COUNT(*) as quantidade
      `)
      .eq('periodo_referencia', periodo)
      .not('"Cliente_Nome_Fantasia"', 'is', null);

    if (error) {
      console.error('[gerar-demonstrativo-divergencias] Erro ao buscar dados:', error);
      throw error;
    }

    console.log(`[gerar-demonstrativo-divergencias] Total de registros encontrados: ${divergencias?.length || 0}`);

    // Verificar preços para cada combinação
    const divergenciasDetalhadas = [];
    const clientesProcessados = new Set();

    for (const registro of divergencias || []) {
      const clienteNome = registro.Cliente_Nome_Fantasia;
      
      if (!clientesProcessados.has(clienteNome)) {
        // Buscar cliente na tabela clientes
        const { data: cliente } = await supabase
          .from('clientes')
          .select('id, nome_fantasia')
          .eq('nome_fantasia', clienteNome)
          .single();

        if (cliente) {
          // Verificar se tem preço configurado para esta combinação
          const { data: preco } = await supabase
            .rpc('calcular_preco_exame', {
              p_cliente_id: cliente.id,
              p_modalidade: registro.MODALIDADE,
              p_especialidade: registro.ESPECIALIDADE,
              p_prioridade: registro.PRIORIDADE,
              p_categoria: registro.CATEGORIA,
              p_volume_total: 1
            });

          if (!preco || preco <= 0) {
            divergenciasDetalhadas.push({
              cliente: clienteNome,
              exame: registro.ESTUDO_DESCRICAO,
              modalidade: registro.MODALIDADE,
              especialidade: registro.ESPECIALIDADE,
              categoria: registro.CATEGORIA,
              prioridade: registro.PRIORIDADE,
              valor_volumetria: registro.VALORES,
              motivo: 'Preço não configurado para esta combinação',
              tipo: 'sem_preco'
            });
          }
        } else {
          divergenciasDetalhadas.push({
            cliente: clienteNome,
            exame: registro.ESTUDO_DESCRICAO,
            modalidade: registro.MODALIDADE,
            especialidade: registro.ESPECIALIDADE,
            categoria: registro.CATEGORIA,
            prioridade: registro.PRIORIDADE,
            valor_volumetria: registro.VALORES,
            motivo: 'Cliente não encontrado no cadastro',
            tipo: 'cliente_nao_encontrado'
          });
        }
        
        clientesProcessados.add(clienteNome);
      }
    }

    // Gerar resumo
    const resumo = {
      periodo,
      total_divergencias: divergenciasDetalhadas.length,
      por_tipo: {
        sem_preco: divergenciasDetalhadas.filter(d => d.tipo === 'sem_preco').length,
        cliente_nao_encontrado: divergenciasDetalhadas.filter(d => d.tipo === 'cliente_nao_encontrado').length
      },
      clientes_com_problema: [...clientesProcessados].length
    };

    console.log('[gerar-demonstrativo-divergencias] Resumo:', resumo);

    return new Response(JSON.stringify({
      success: true,
      periodo,
      resumo,
      divergencias: divergenciasDetalhadas,
      message: `Demonstrativo de divergências gerado: ${divergenciasDetalhadas.length} problemas encontrados`
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error('[gerar-demonstrativo-divergencias] Erro:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error?.message || 'Erro desconhecido' 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});