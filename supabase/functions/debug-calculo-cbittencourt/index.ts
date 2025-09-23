import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const clienteId = '90b4a4bc-a53a-4bf9-83c4-7a025c275cdd'; // C.BITTENCOURT

    console.log('🔍 Investigando problema de cálculo para C.BITTENCOURT');
    console.log('Exame problemático: RX/MUSCULO ESQUELETICO/SC/URGÊNCIA');

    // 1. Verificar volumetria
    const { data: volumetria } = await supabase
      .from('volumetria_mobilemed')
      .select('*')
      .ilike('"EMPRESA"', '%BITTENCOURT%')
      .eq('"MODALIDADE"', 'RX')
      .eq('"ESPECIALIDADE"', 'MUSCULO ESQUELETICO')
      .eq('"CATEGORIA"', 'SC')
      .eq('"PRIORIDADE"', 'URGÊNCIA');

    console.log(`📊 Volumetria encontrada: ${volumetria?.length || 0} registros`);
    console.log('Primeiros 3 registros:', volumetria?.slice(0, 3));

    // 2. Verificar preços configurados
    const { data: precos } = await supabase
      .from('precos_servicos')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('modalidade', 'RX')
      .eq('especialidade', 'MUSCULO ESQUELETICO')
      .eq('categoria', 'SC')
      .eq('prioridade', 'URGÊNCIA');

    console.log(`💰 Preços encontrados: ${precos?.length || 0} configurações`);
    console.log('Preços configurados:', precos);

    // 3. Testar função RPC calcular_preco_exame
    const totalExames = volumetria?.reduce((sum, v) => sum + (v.VALORES || 0), 0) || 0;
    console.log(`📈 Total de exames: ${totalExames}`);

    const { data: rpcResult, error: rpcError } = await supabase.rpc('calcular_preco_exame', {
      p_cliente_id: clienteId,
      p_modalidade: 'RX',
      p_especialidade: 'MUSCULO ESQUELETICO',
      p_prioridade: 'URGÊNCIA',
      p_categoria: 'SC',
      p_quantidade: totalExames,
      is_plantao: false
    });

    console.log('🔧 Resultado RPC calcular_preco_exame:', rpcResult);
    if (rpcError) {
      console.error('❌ Erro RPC:', rpcError);
    }

    // 4. Cálculo manual para comparação
    let precoCalculadoManual = 0;
    if (precos && precos.length > 0) {
      for (const preco of precos) {
        const volInicial = preco.volume_inicial || 1;
        const volFinal = preco.volume_final || 999999;
        
        console.log(`📊 Testando faixa: ${volInicial}-${volFinal} para volume ${totalExames}`);
        
        if (totalExames >= volInicial && totalExames <= volFinal) {
          precoCalculadoManual = preco.valor_urgencia || preco.valor_base || 0;
          console.log(`✅ Volume ${totalExames} se encaixa na faixa ${volInicial}-${volFinal}`);
          console.log(`💵 Preço unitário encontrado: R$ ${precoCalculadoManual}`);
          break;
        }
      }
    }

    const precoTotalManual = precoCalculadoManual * totalExames;

    // 5. Comparar com demonstrativo atual
    const { data: demonstrativo } = await supabase
      .from('demonstrativos_faturamento')
      .select('detalhes_exames')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })
      .limit(1);

    let exameNoDemonstrativo = null;
    if (demonstrativo && demonstrativo[0]?.detalhes_exames) {
      exameNoDemonstrativo = demonstrativo[0].detalhes_exames.find((d: any) => 
        d.modalidade === 'RX' && 
        d.especialidade === 'MUSCULO ESQUELETICO' && 
        d.categoria === 'SC' && 
        d.prioridade === 'URGÊNCIA'
      );
    }

    console.log('📋 Exame no demonstrativo atual:', exameNoDemonstrativo);

    return new Response(
      JSON.stringify({
        sucesso: true,
        cliente: 'C.BITTENCOURT',
        exame_analisado: 'RX/MUSCULO ESQUELETICO/SC/URGÊNCIA',
        volumetria: {
          registros_encontrados: volumetria?.length || 0,
          total_exames: totalExames,
          amostra: volumetria?.slice(0, 3) || []
        },
        precos_configurados: {
          total_configuracoes: precos?.length || 0,
          configuracoes: precos || []
        },
        calculos: {
          rpc_result: rpcResult,
          rpc_error: rpcError,
          calculo_manual: {
            preco_unitario: precoCalculadoManual,
            preco_total: precoTotalManual,
            logica: `Volume ${totalExames} exames → Preço R$ ${precoCalculadoManual} → Total R$ ${precoTotalManual}`
          }
        },
        demonstrativo_atual: exameNoDemonstrativo,
        diagnostico: {
          problema_identificado: rpcResult?.[0] === 0 && precoCalculadoManual > 0,
          preco_esperado: precoTotalManual,
          preco_calculado_rpc: rpcResult?.[0] || 0,
          diferenca: precoTotalManual - (rpcResult?.[0] || 0)
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Erro na função:', error);
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        erro: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});