import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    
    if (!periodo) {
      throw new Error('Período é obrigatório');
    }

    console.log(`Gerando demonstrativos para o período: ${periodo}`);

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

    // Aplicar filtro opcional de clientes (por nome/nome_fantasia/nome_mobilemed)
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

      // Buscar volumetria por EMPRESA e por Cliente_Nome_Fantasia (deduplicando)
      const { data: volEmp } = await supabase
        .from('volumetria_mobilemed')
        .select('*')
        .eq('periodo_referencia', periodo)
        .in('"EMPRESA"', nomesBusca);

      const { data: volFant } = await supabase
        .from('volumetria_mobilemed')
        .select('*')
        .eq('periodo_referencia', periodo)
        .in('"Cliente_Nome_Fantasia"', nomesBusca);

      const combinado = [...(volEmp || []), ...(volFant || [])];

      const volumetria = Array.from(
        new Map((combinado || []).map((r: any) => [r.id ?? `${r.DATA_REALIZACAO}|${r.MODALIDADE}|${r.ESPECIALIDADE}|${r.CATEGORIA}|${r.PRIORIDADE}|${r.VALORES}`, r])).values()
      );

      if (!volumetria || volumetria.length === 0) {
        console.log(`Sem volumetria para ${cliente.nome}`);
        continue;
      }

      console.log(`Encontrada volumetria: ${volumetria.length} registros`);

      // Agrupar volumetria por modalidade/especialidade/categoria/prioridade
      const grupos = new Map();
      let totalExames = 0;

      for (const vol of volumetria) {
        const chave = `${vol.MODALIDADE}-${vol.ESPECIALIDADE}-${vol.CATEGORIA || 'SC'}-${vol.PRIORIDADE}`;
        if (!grupos.has(chave)) {
          grupos.set(chave, {
            modalidade: vol.MODALIDADE,
            especialidade: vol.ESPECIALIDADE,
            categoria: vol.CATEGORIA || 'SC',
            prioridade: vol.PRIORIDADE,
            quantidade: 0,
            valor_unitario: 0
          });
        }
        const grupo = grupos.get(chave);
        grupo.quantidade += vol.VALORES || 0;
        totalExames += vol.VALORES || 0;
      }

      let valorExames = 0;
      const detalhesExames = [];

      // Calcular preços para cada grupo
      for (const grupo of grupos.values()) {
        // Buscar preço na tabela precos_servicos
        const { data: precos } = await supabase
          .from('precos_servicos')
          .select('valor_base, valor_urgencia, volume_inicial, volume_final')
          .eq('cliente_id', cliente.id)
          .eq('ativo', true)
          .ilike('modalidade', grupo.modalidade)
          .ilike('especialidade', grupo.especialidade)
          .ilike('categoria', grupo.categoria)
          .ilike('prioridade', grupo.prioridade)
          .gte('volume_final', grupo.quantidade)
          .lte('volume_inicial', grupo.quantidade)
          .order('volume_inicial')
          .limit(1);

        let preco = 0;

        if (precos && precos.length > 0) {
          const precoItem = precos[0];
          const isUrgencia = grupo.prioridade.toUpperCase().includes('URGÊNCIA') || 
                           grupo.prioridade.toUpperCase().includes('PLANTÃO');
          preco = isUrgencia ? (precoItem.valor_urgencia || precoItem.valor_base) : precoItem.valor_base;
        }

        // Fallback: tentar com ROTINA se não encontrou
        if (preco <= 0) {
          const { data: precosRotina } = await supabase
            .from('precos_servicos')
            .select('valor_base')
            .eq('cliente_id', cliente.id)
            .eq('ativo', true)
            .ilike('modalidade', grupo.modalidade)
            .ilike('especialidade', grupo.especialidade)
            .ilike('categoria', grupo.categoria)
            .ilike('prioridade', 'ROTINA')
            .gte('volume_final', grupo.quantidade)
            .lte('volume_inicial', grupo.quantidade)
            .limit(1);

          if (precosRotina && precosRotina.length > 0) {
            preco = precosRotina[0].valor_base;
          }
        }

        // Fallback: tentar com categoria SC
        if (preco <= 0 && grupo.categoria !== 'SC') {
          const { data: precosSC } = await supabase
            .from('precos_servicos')
            .select('valor_base, valor_urgencia')
            .eq('cliente_id', cliente.id)
            .eq('ativo', true)
            .ilike('modalidade', grupo.modalidade)
            .ilike('especialidade', grupo.especialidade)
            .ilike('categoria', 'SC')
            .ilike('prioridade', grupo.prioridade)
            .gte('volume_final', grupo.quantidade)
            .lte('volume_inicial', grupo.quantidade)
            .limit(1);

          if (precosSC && precosSC.length > 0) {
            const precoItem = precosSC[0];
            const isUrgencia = grupo.prioridade.toUpperCase().includes('URGÊNCIA') || 
                             grupo.prioridade.toUpperCase().includes('PLANTÃO');
            preco = isUrgencia ? (precoItem.valor_urgencia || precoItem.valor_base) : precoItem.valor_base;
          }
        }

        if (preco > 0) {
          grupo.valor_unitario = preco;
          const valorGrupo = grupo.quantidade * preco;
          valorExames += valorGrupo;

          detalhesExames.push({
            modalidade: grupo.modalidade,
            especialidade: grupo.especialidade,
            categoria: grupo.categoria,
            prioridade: grupo.prioridade,
            quantidade: grupo.quantidade,
            valor_unitario: preco,
            valor_total: valorGrupo
          });

          console.log(`Preço encontrado: ${grupo.modalidade}/${grupo.especialidade} = R$ ${preco} x ${grupo.quantidade} = R$ ${valorGrupo}`);
        } else {
          console.warn(`Preço não encontrado para: ${grupo.modalidade}/${grupo.especialidade}/${grupo.categoria}/${grupo.prioridade}`);
        }
      }

      // Calcular franquia, portal e integração usando função existente
      const { data: calculoCompleto } = await supabase.rpc('calcular_faturamento_completo', {
        p_cliente_id: cliente.id,
        p_periodo: periodo,
        p_volume_total: totalExames
      });

      const valorFranquia = calculoCompleto?.[0]?.valor_franquia || 0;
      const valorPortal = calculoCompleto?.[0]?.valor_portal_laudos || 0;
      const valorIntegracao = calculoCompleto?.[0]?.valor_integracao || 0;

      const valorBruto = valorExames + valorFranquia + valorPortal + valorIntegracao;
      const valorImpostos = valorBruto * 0.075; // 7.5% de impostos aproximado
      const valorTotal = valorBruto + valorImpostos;

      const demonstrativo: DemonstrativoCliente = {
        cliente_id: cliente.id,
        cliente_nome: cliente.nome_fantasia || cliente.nome,
        periodo,
        total_exames: totalExames,
        valor_exames: valorExames,
        valor_franquia: valorFranquia,
        valor_portal_laudos: valorPortal,
        valor_integracao: valorIntegracao,
        valor_bruto: valorBruto,
        valor_impostos: valorImpostos,
        valor_total: valorTotal,
        detalhes_franquia: calculoCompleto?.[0]?.detalhes_franquia || {},
        detalhes_exames: detalhesExames,
        detalhes_tributacao: {
          simples_nacional: true,
          percentual_iss: 7.5,
          valor_iss: valorImpostos,
          base_calculo: valorBruto
        },
        tipo_faturamento: tipoFaturamento
      };

      demonstrativos.push(demonstrativo);

      console.log(`Demonstrativo criado para ${cliente.nome}: ${totalExames} exames, R$ ${valorTotal.toFixed(2)}`);
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