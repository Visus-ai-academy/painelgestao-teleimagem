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

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { arquivo_fonte = 'volumetria_padrao' } = await req.json();

    console.log(`🔍 DEBUG: Iniciando diagnóstico para ${arquivo_fonte}`);
    
    // 1. Contar registros sem categoria
    const { count: semCategoria } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', arquivo_fonte)
      .or('"CATEGORIA".is.null,"CATEGORIA".eq.""');

    console.log(`📊 Total sem categoria: ${semCategoria}`);

    // 2. Buscar um pequeno lote para teste
    const { data: amostra, error: errorAmostra } = await supabase
      .from('volumetria_mobilemed')
      .select('id, "ESTUDO_DESCRICAO", "MODALIDADE", "CATEGORIA"')
      .eq('arquivo_fonte', arquivo_fonte)
      .or('"CATEGORIA".is.null,"CATEGORIA".eq.""')
      .limit(5);

    console.log(`📋 Amostra:`, amostra);

    if (errorAmostra) {
      console.error('❌ Erro na amostra:', errorAmostra);
      throw errorAmostra;
    }

    // 3. Testar aplicação de categoria simples
    if (amostra && amostra.length > 0) {
      const primeiroRegistro = amostra[0];
      const categoriaTest = primeiroRegistro.MODALIDADE === 'RX' ? 'RX' : 
                           primeiroRegistro.MODALIDADE === 'MR' ? 'RM' :
                           primeiroRegistro.MODALIDADE === 'CT' ? 'TC' : 'GERAL';

      console.log(`🧪 TESTE: Aplicando categoria "${categoriaTest}" no registro ${primeiroRegistro.id}`);

      const { data: updateResult, error: updateError } = await supabase
        .from('volumetria_mobilemed')
        .update({ 
          "CATEGORIA": categoriaTest,
          updated_at: new Date().toISOString()
        })
        .eq('id', primeiroRegistro.id)
        .select();

      if (updateError) {
        console.error('❌ Erro no update:', updateError);
      } else {
        console.log('✅ Update bem-sucedido:', updateResult);
      }

      // 4. Verificar se realmente aplicou
      const { data: verificacao, error: errorVerif } = await supabase
        .from('volumetria_mobilemed')
        .select('"CATEGORIA"')
        .eq('id', primeiroRegistro.id)
        .single();

      console.log(`🔍 Verificação pós-update:`, verificacao);
    }

    // 5. Contar novamente
    const { count: semCategoriaPos } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', arquivo_fonte)
      .or('"CATEGORIA".is.null,"CATEGORIA".eq.""');

    console.log(`📊 Total sem categoria após teste: ${semCategoriaPos}`);

    const resultado = {
      success: true,
      arquivo_fonte,
      registros_sem_categoria_antes: semCategoria,
      registros_sem_categoria_depois: semCategoriaPos,
      amostra_testada: amostra?.length || 0,
      diferenca: (semCategoria || 0) - (semCategoriaPos || 0)
    };

    console.log('🎯 RESULTADO DEBUG:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('❌ Erro no debug:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});