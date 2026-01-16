import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔧 Iniciando correção de modalidades CR/DX → RX/MG');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Primeiro: Buscar registros CR/DX com mamografia e corrigir para MG
    console.log('📋 Buscando registros CR/DX com mamografia...');
    
    const { data: mamografias, error: errorBuscaMG } = await supabase
      .from('volumetria_mobilemed')
      .select('id, "ESTUDO_DESCRICAO"')
      .in('MODALIDADE', ['CR', 'DX'])
      .limit(10000);
    
    if (errorBuscaMG) {
      console.error('❌ Erro ao buscar mamografias:', errorBuscaMG.message);
    }
    
    // Filtrar mamografias manualmente
    const idsMG = mamografias?.filter(r => {
      const desc = (r.ESTUDO_DESCRICAO || '').toLowerCase();
      return desc.includes('mamografia') || desc.includes('tomossintese') || desc.includes('tomo de mama');
    }).map(r => r.id) || [];
    
    let totalMG = 0;
    if (idsMG.length > 0) {
      const { error: updateMGError } = await supabase
        .from('volumetria_mobilemed')
        .update({ MODALIDADE: 'MG', updated_at: new Date().toISOString() })
        .in('id', idsMG);
      
      if (updateMGError) {
        console.error('❌ Erro ao atualizar MG:', updateMGError.message);
      } else {
        totalMG = idsMG.length;
        console.log(`✅ ${totalMG} registros corrigidos para MG`);
      }
    }

    // 2. Corrigir CR/DX restantes → RX (em lotes para evitar timeout)
    console.log('📋 Corrigindo CR/DX restantes → RX...');
    
    let totalRX = 0;
    let continuar = true;
    let tentativas = 0;
    const maxTentativas = 20; // Evitar loop infinito
    
    while (continuar && tentativas < maxTentativas) {
      tentativas++;
      
      // Buscar IDs em lotes
      const { data: registros, error: selectError } = await supabase
        .from('volumetria_mobilemed')
        .select('id')
        .in('MODALIDADE', ['CR', 'DX'])
        .limit(500);
      
      if (selectError) {
        console.error('❌ Erro ao buscar registros:', selectError.message);
        break;
      }
      
      if (!registros || registros.length === 0) {
        continuar = false;
        break;
      }
      
      const ids = registros.map(r => r.id);
      
      const { error: updateError } = await supabase
        .from('volumetria_mobilemed')
        .update({ MODALIDADE: 'RX', updated_at: new Date().toISOString() })
        .in('id', ids);
      
      if (updateError) {
        console.error('❌ Erro ao atualizar lote:', updateError.message);
        break;
      }
      
      totalRX += ids.length;
      console.log(`✅ Lote ${tentativas}: ${ids.length} registros corrigidos (Total RX: ${totalRX})`);
      
      // Pequena pausa para não sobrecarregar
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // 3. Verificar se ainda restam
    const { count: restantes } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .in('MODALIDADE', ['CR', 'DX']);

    console.log(`🎯 Correção concluída! MG: ${totalMG}, RX: ${totalRX}, Restantes: ${restantes || 0}`);

    // 4. Log de auditoria
    await supabase.from('audit_logs').insert({
      table_name: 'volumetria_mobilemed',
      operation: 'CORRECAO_MODALIDADE_CR_DX',
      record_id: 'BATCH',
      new_data: {
        corrigidos_MG: totalMG,
        corrigidos_RX: totalRX,
        restantes: restantes || 0,
        timestamp: new Date().toISOString()
      },
      user_email: 'system',
      severity: 'info'
    });

    return new Response(JSON.stringify({
      sucesso: true,
      corrigidos_MG: totalMG,
      corrigidos_RX: totalRX,
      total_corrigidos: totalMG + totalRX,
      restantes: restantes || 0,
      mensagem: `Correção concluída: ${totalMG} para MG, ${totalRX} para RX. Restam: ${restantes || 0}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Erro:', error);
    return new Response(JSON.stringify({
      sucesso: false,
      erro: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
