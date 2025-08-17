import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 VALIDAÇÃO DE CLIENTE INICIADA');
    
    const requestData = await req.json();
    console.log('📦 Dados recebidos:', JSON.stringify(requestData));
    
    const { lote_upload } = requestData;
    
    if (!lote_upload) {
      throw new Error('Parâmetro obrigatório: lote_upload');
    }
    
    console.log('🏷️ Lote de upload:', lote_upload);
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('✅ Cliente Supabase criado');

    // Chamar função do banco para validar clientes
    console.log('🔍 Chamando função de validação de cliente...');
    const { data: result, error } = await supabaseClient
      .rpc('aplicar_validacao_cliente_volumetria', { 
        lote_upload_param: lote_upload 
      });

    if (error) {
      console.error('❌ Erro na validação:', error);
      throw new Error(`Erro na validação: ${error.message}`);
    }

    console.log('✅ Validação concluída:', result);

    return new Response(JSON.stringify({
      success: true,
      registros_atualizados: result.registros_atualizados,
      registros_sem_cliente: result.registros_sem_cliente,
      total_clientes_nao_encontrados: result.total_clientes_nao_encontrados,
      clientes_nao_encontrados: result.clientes_nao_encontrados,
      data_processamento: result.data_processamento
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 ERRO CRÍTICO:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Erro interno do servidor',
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});