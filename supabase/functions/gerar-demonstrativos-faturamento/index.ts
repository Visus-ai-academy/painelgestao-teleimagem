import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import { corsHeaders } from "../_shared/cors.ts";

interface DemonstrativoCliente {
  cliente_id: string;
  cliente_nome: string;
  periodo: string;
  total_exames: number;
  valor_exames: number;
  valor_franquia: number;
  valor_portal_laudos: number;
  valor_integracao: number;
  valor_bruto: number;
  valor_impostos: number;
  valor_total: number;
  detalhes_franquia: any;
  detalhes_exames: any[];
  detalhes_tributacao: any;
  tipo_faturamento?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { periodo, clientes: clientesFiltro } = await req.json();
    console.log('Período recebido:', periodo);
    
    if (!periodo) {
      throw new Error('Período é obrigatório');
    }

    // Buscar clientes ativos
    const { data: clientes, error: clientesError } = await supabase
      .from('clientes')
      .select(`
        id,
        nome,
        nome_fantasia,
        nome_mobilemed,
        ativo,
        parametros_faturamento(
          status,
          tipo_faturamento
        )
      `)
      .eq('ativo', true)
      .order('nome');

    if (clientesError) {
      throw new Error(`Erro ao buscar clientes: ${clientesError.message}`);
    }

    console.log(`Total de clientes ativos: ${clientes?.length || 0}`);

    // Aplicar filtro opcional de clientes
    const clientesProcessar = (clientesFiltro && Array.isArray(clientesFiltro) && clientesFiltro.length > 0)
      ? (clientes || []).filter((c: any) => {
          const nomes = [c.nome, c.nome_fantasia, c.nome_mobilemed]
            .filter(Boolean)
            .map((n: string) => n.trim());
          return clientesFiltro.some((f: string) => nomes.includes(f));
        })
      : (clientes || []);

    const demonstrativos: DemonstrativoCliente[] = [];

    for (const cliente of clientesProcessar) {
      console.log(`Processando cliente: ${cliente.nome_fantasia || cliente.nome}`);

      // Buscar parâmetros ativos
      const parametroAtivo = cliente.parametros_faturamento?.find((p: any) => p.status === 'A');
      const tipoFaturamento = parametroAtivo?.tipo_faturamento || 'CO-FT';

      // Pular clientes NC-NF
      if (tipoFaturamento === 'NC-NF') {
        console.log(`Pulando cliente NC-NF: ${cliente.nome}`);
        continue;
      }

      // Buscar volumetria do cliente
      const nomesBusca = [cliente.nome, cliente.nome_fantasia, cliente.nome_mobilemed]
        .filter(Boolean)
        .map(n => n?.trim())
        .filter(n => n && n.length > 0);

      const { data: volumetria } = await supabase
        .from('volumetria_mobilemed')
        .select('*')
        .eq('periodo_referencia', periodo)
        .in('"EMPRESA"', nomesBusca);

      if (!volumetria || volumetria.length === 0) {
        console.log(`Sem volumetria para ${cliente.nome}`);
        continue;
      }

      console.log(`Encontrada volumetria: ${volumetria.length} registros`);

      // Contar exames totais
      let totalExames = 0;
      for (const vol of volumetria) {
        totalExames += vol.VALORES || 0;
      }

      // Criar demonstrativo básico
      const demonstrativo: DemonstrativoCliente = {
        cliente_id: cliente.id,
        cliente_nome: cliente.nome_fantasia || cliente.nome,
        periodo,
        total_exames: totalExames,
        valor_exames: 0,
        valor_franquia: 0,
        valor_portal_laudos: 0,
        valor_integracao: 0,
        valor_bruto: 0,
        valor_impostos: 0,
        valor_total: 0,
        detalhes_franquia: {},
        detalhes_exames: [],
        detalhes_tributacao: {},
        tipo_faturamento: tipoFaturamento
      };

      demonstrativos.push(demonstrativo);
      console.log(`Demonstrativo básico criado para ${cliente.nome}: ${totalExames} exames`);
    }

    console.log(`Total de demonstrativos gerados: ${demonstrativos.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        demonstrativos,
        resumo: {
          clientes_processados: demonstrativos.length,
          total_clientes_processados: demonstrativos.length,
          periodo
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Erro na geração de demonstrativos:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Erro ao gerar demonstrativos de faturamento'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});