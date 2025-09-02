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
    
    const { lote_upload, arquivo_fonte } = requestData;
    
    if (!lote_upload) {
      throw new Error('Parâmetro obrigatório: lote_upload');
    }
    
    console.log('🏷️ Lote de upload:', lote_upload);
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('✅ Cliente Supabase criado');

    // Validar clientes diretamente via query otimizada
    console.log('🔍 Validando clientes do lote:', lote_upload);
    
    // Buscar registros que precisam validação
    const { data: registros, error: errorRegistros } = await supabaseClient
      .from('volumetria_mobilemed')
      .select('id, EMPRESA')
      .eq('lote_upload', lote_upload)
      .limit(1000); // Limite para evitar timeout

    if (errorRegistros) {
      throw new Error(`Erro ao buscar registros: ${errorRegistros.message}`);
    }

    if (!registros || registros.length === 0) {
      const result = {
        registros_atualizados: 0,
        registros_sem_cliente: 0,
        total_clientes_nao_encontrados: 0,
        clientes_nao_encontrados: [],
        data_processamento: new Date().toISOString()
      };
      
      console.log('✅ Nenhum registro encontrado para validação');
      const { data: validationResult, error } = { data: result, error: null };

    } else {
      // Buscar clientes ativos
      const { data: clientesAtivos } = await supabaseClient
        .from('clientes')
        .select('nome, nome_mobilemed')
        .eq('ativo', true);

      const clientesMap = new Map();
      if (clientesAtivos) {
        clientesAtivos.forEach(c => {
          if (c.nome_mobilemed) clientesMap.set(c.nome_mobilemed.toUpperCase().trim(), c);
          if (c.nome) clientesMap.set(c.nome.toUpperCase().trim(), c);
        });
      }

      let registrosAtualizados = 0;
      let registrosSemCliente = 0;
      const clientesNaoEncontrados = new Set();

      for (const registro of registros) {
        const empresaKey = registro.EMPRESA?.toUpperCase()?.trim();
        if (!empresaKey || !clientesMap.has(empresaKey)) {
          registrosSemCliente++;
          if (empresaKey) clientesNaoEncontrados.add(registro.EMPRESA);
        } else {
          registrosAtualizados++;
        }
      }

      const result = {
        registros_atualizados: registrosAtualizados,
        registros_sem_cliente: registrosSemCliente,
        total_clientes_nao_encontrados: clientesNaoEncontrados.size,
        clientes_nao_encontrados: Array.from(clientesNaoEncontrados),
        data_processamento: new Date().toISOString()
      };
      
      console.log('✅ Validação concluída:', result);
      const { data: validationResult, error } = { data: result, error: null };
    }

    const result = validationResult;
    if (error) {
      console.error('❌ Erro na validação:', error);
      throw new Error(`Erro na validação: ${error.message}`);
    }

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