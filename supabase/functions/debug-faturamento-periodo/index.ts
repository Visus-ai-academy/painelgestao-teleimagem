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

  console.log('[debug-faturamento-periodo] INÍCIO DO DEBUG');
  
  try {
    const { periodo } = await req.json();
    console.log('[debug-faturamento-periodo] Período recebido:', periodo);

    if (!periodo || !/^\d{4}-\d{2}$/.test(periodo)) {
      return new Response(JSON.stringify({ success: false, error: 'Parâmetro periodo (YYYY-MM) é obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Verificar clientes na volumetria
    const { data: clientesVolumetria } = await supabase
      .from('volumetria_mobilemed')
      .select('"EMPRESA"')
      .eq('periodo_referencia', periodo)
      .not('"EMPRESA"', 'is', null);
    
    const nomesClientesSet = new Set();
    clientesVolumetria?.forEach(v => {
      if (v.EMPRESA) nomesClientesSet.add(v.EMPRESA);
    });
    const nomesClientesVolumetria = Array.from(nomesClientesSet);
    
    console.log(`[debug] Total clientes únicos na volumetria: ${nomesClientesVolumetria.length}`);
    console.log(`[debug] Primeiros 10: ${nomesClientesVolumetria.slice(0, 10).join(', ')}`);

    // 2. Buscar clientes cadastrados com contratos
    const { data: clientesCadastrados } = await supabase
      .from('clientes')
      .select(`
        id, nome, nome_mobilemed, email, ativo, status,
        contratos_clientes (
          id, tem_precos_configurados, status
        )
      `)
      .eq('ativo', true)
      .eq('status', 'Ativo');

    console.log(`[debug] Total clientes cadastrados: ${clientesCadastrados?.length || 0}`);

    // 3. Mapear clientes
    const clientesMap = new Map();
    clientesCadastrados?.forEach(cliente => {
      if (cliente.nome_mobilemed) {
        clientesMap.set(cliente.nome_mobilemed.toUpperCase().trim(), cliente);
      }
      if (cliente.nome) {
        clientesMap.set(cliente.nome.toUpperCase().trim(), cliente);
      }
    });

    // 4. Buscar mapeamentos
    const { data: mapeamentos } = await supabase
      .from('mapeamento_nomes_clientes')
      .select('nome_arquivo, nome_sistema')
      .eq('ativo', true);

    const mapeamentosMap = new Map();
    mapeamentos?.forEach(m => {
      mapeamentosMap.set(m.nome_arquivo.toUpperCase().trim(), m.nome_sistema.toUpperCase().trim());
    });

    console.log(`[debug] Mapeamentos carregados: ${mapeamentos?.length || 0}`);

    // 5. Analisar matching de clientes
    const clientesComPrecos: any[] = [];
    const clientesPendentes: any[] = [];
    
    nomesClientesVolumetria.forEach(nomeEmpresa => {
      let clienteExistente = clientesMap.get(nomeEmpresa.toUpperCase().trim());
      
      // Tentar com mapeamento
      if (!clienteExistente) {
        const nomeMapeado = mapeamentosMap.get(nomeEmpresa.toUpperCase().trim());
        if (nomeMapeado) {
          clienteExistente = clientesMap.get(nomeMapeado);
        }
      }
      
      if (clienteExistente) {
        const contratoAtivo = clienteExistente.contratos_clientes?.find(c => 
          c.status === 'ativo' && c.tem_precos_configurados === true
        );
        
        if (contratoAtivo) {
          clientesComPrecos.push({
            ...clienteExistente,
            nome_mobilemed: nomeEmpresa
          });
        } else {
          clientesPendentes.push({
            ...clienteExistente,
            nome_mobilemed: nomeEmpresa,
            motivo: 'Sem contrato ativo com preços'
          });
        }
      } else {
        clientesPendentes.push({
          nome: nomeEmpresa,
          motivo: 'Cliente não cadastrado'
        });
      }
    });

    console.log(`[debug] Clientes COM preços: ${clientesComPrecos.length}`);
    console.log(`[debug] Clientes PENDENTES: ${clientesPendentes.length}`);

    // 6. Testar primeiro cliente
    if (clientesComPrecos.length > 0) {
      const primeiroCliente = clientesComPrecos[0];
      console.log(`[debug] Testando primeiro cliente: ${primeiroCliente.nome}`);
      
      // Buscar dados volumetria
      const { data: vm, error: vmErr } = await supabase
        .from('volumetria_mobilemed')
        .select('"EMPRESA","MODALIDADE","ESPECIALIDADE","CATEGORIA","PRIORIDADE","ESTUDO_DESCRICAO","VALORES"')
        .eq('"EMPRESA"', primeiroCliente.nome_mobilemed)
        .eq('periodo_referencia', periodo)
        .limit(5);

      console.log(`[debug] Registros volumetria encontrados: ${vm?.length || 0}`);
      if (vm && vm.length > 0) {
        console.log(`[debug] Primeiro registro:`, vm[0]);
        
        // Testar cálculo de preço
        try {
          const { data: preco, error: precoErr } = await supabase.rpc('calcular_preco_exame', {
            p_cliente_id: primeiroCliente.id,
            p_modalidade: vm[0].MODALIDADE || '',
            p_especialidade: vm[0].ESPECIALIDADE || '',
            p_prioridade: vm[0].PRIORIDADE || '',
            p_categoria: vm[0].CATEGORIA || 'SC',
            p_volume_total: 100,
            p_is_plantao: false
          });

          console.log(`[debug] Resultado cálculo preço:`, { preco, precoErr });
        } catch (precoError) {
          console.log(`[debug] Erro no cálculo de preço:`, precoError);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      debug: {
        total_clientes_volumetria: nomesClientesVolumetria.length,
        total_clientes_cadastrados: clientesCadastrados?.length || 0,
        clientes_com_precos: clientesComPrecos.length,
        clientes_pendentes: clientesPendentes.length,
        mapeamentos: mapeamentos?.length || 0,
        primeiro_cliente_com_precos: clientesComPrecos[0]?.nome || null,
        primeiros_5_pendentes: clientesPendentes.slice(0, 5)
      }
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[debug-faturamento-periodo] Erro:', error);
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Erro desconhecido' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});