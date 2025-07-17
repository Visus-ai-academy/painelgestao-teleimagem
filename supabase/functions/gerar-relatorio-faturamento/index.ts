import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FaturamentoRequest {
  cliente_id: string;
  periodo: string;
  data_inicio: string;
  data_fim: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { cliente_id, periodo, data_inicio, data_fim }: FaturamentoRequest = await req.json();

    console.log(`Gerando relatório para cliente ${cliente_id}, período ${periodo}`);

    // Buscar dados do cliente
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', cliente_id)
      .single();

    if (clienteError || !cliente) {
      throw new Error(`Cliente não encontrado: ${clienteError?.message}`);
    }

    // Buscar exames do período
    console.log(`Buscando exames para cliente ${cliente_id} entre ${data_inicio} e ${data_fim}`);
    
    const { data: exames, error: examesError } = await supabase
      .from('exames_realizados')
      .select('*')
      .eq('cliente_id', cliente_id)
      .gte('data_exame', data_inicio)
      .lte('data_exame', data_fim)
      .order('data_exame', { ascending: true });

    if (examesError) {
      console.error('Erro ao buscar exames:', examesError);
      throw new Error(`Erro ao buscar exames: ${examesError.message}`);
    }

    console.log(`Exames encontrados: ${exames?.length || 0}`);

    if (!exames || exames.length === 0) {
      console.log('Nenhum exame encontrado, gerando relatório vazio');
      // Retornar relatório vazio ao invés de erro 404
      const relatorio = {
        cliente: {
          nome: cliente.nome,
          cnpj: cliente.cnpj,
          email: cliente.email
        },
        periodo: periodo,
        resumo: {
          total_laudos: 0,
          valor_bruto: 0,
          franquia: 0,
          ajuste: 0,
          valor_total: 0,
          irrf: 0,
          csll: 0,
          pis: 0,
          cofins: 0,
          impostos: 0,
          valor_a_pagar: 0
        },
        exames: []
      };

      const nomeArquivo = `relatorio_${cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}.json`;
      const linkRelatorio = `#relatorio-${cliente_id}-${periodo}`;

      return new Response(
        JSON.stringify({ 
          success: true, 
          relatorio,
          linkRelatorio,
          nomeArquivo,
          message: `Relatório gerado para ${cliente.nome} - Período sem exames` 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Calcular totais
    const total_laudos = exames.length;
    const valor_bruto = exames.reduce((sum, exame) => sum + (exame.valor_bruto || 0), 0);
    const franquia = 0;
    const ajuste = 0;
    const valor_total = valor_bruto + franquia + ajuste;
    
    // Impostos
    const irrf = valor_total * 0.015;
    const csll = valor_total * 0.01;
    const pis = valor_total * 0.0065;
    const cofins = valor_total * 0.03;
    const impostos = irrf + csll + pis + cofins;
    const valor_a_pagar = valor_total - impostos;

    // Gerar dados do relatório
    const relatorio = {
      cliente: {
        nome: cliente.nome,
        cnpj: cliente.cnpj,
        email: cliente.email
      },
      periodo: periodo,
      resumo: {
        total_laudos,
        valor_bruto,
        franquia,
        ajuste,
        valor_total,
        irrf,
        csll,
        pis,
        cofins,
        impostos,
        valor_a_pagar
      },
      exames: exames.map(exame => ({
        data_estudo: exame.data_exame,
        paciente: exame.paciente,
        medico: exame.medico,
        modalidade: exame.modalidade,
        especialidade: exame.especialidade,
        categoria: exame.categoria || '',
        prioridade: exame.prioridade || '',
        valor: exame.valor_bruto || 0
      }))
    };

    console.log(`Relatório gerado com ${exames.length} exames, valor total: R$ ${valor_total.toFixed(2)}`);

    // Gerar nome único para o relatório
    const nomeArquivo = `relatorio_${cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}.json`;
    const linkRelatorio = `#relatorio-${cliente_id}-${periodo}`;

    return new Response(
      JSON.stringify({ 
        success: true, 
        relatorio,
        linkRelatorio,
        nomeArquivo,
        message: `Relatório gerado com sucesso para ${cliente.nome}` 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Erro ao gerar relatório:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

serve(handler);