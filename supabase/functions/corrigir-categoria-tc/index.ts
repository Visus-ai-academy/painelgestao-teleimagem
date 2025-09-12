import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔍 Iniciando correção de categoria TC baseada no cadastro de exames...');

    // 1. Primeiro, corrigir o cadastro de exames que tem categoria NULL
    const { error: errorUpdateCadastro } = await supabaseClient
      .from('cadastro_exames')
      .update({ categoria: 'SCORE' })
      .eq('nome', 'ANGIOTC ARTERIAS CORONARIAS COM SCORE DE CALCIO')
      .is('categoria', null);

    if (errorUpdateCadastro) {
      console.error('❌ Erro ao atualizar cadastro de exames:', errorUpdateCadastro);
    } else {
      console.log('✅ Cadastro de exames atualizado com categoria SCORE');
    }

    // 2. Buscar registros com categoria TC na volumetria
    const { data: registrosTC, error: errorSelect } = await supabaseClient
      .from('volumetria_mobilemed')
      .select('id, "CATEGORIA", "ESTUDO_DESCRICAO", "ESPECIALIDADE"')
      .eq('CATEGORIA', 'TC');

    if (errorSelect) {
      console.error('❌ Erro ao buscar registros TC:', errorSelect);
      throw errorSelect;
    }

    console.log(`📊 Encontrados ${registrosTC?.length || 0} registros com categoria TC`);

    let corrigidos = 0;
    
    if (registrosTC && registrosTC.length > 0) {
      // 3. Buscar a categoria correta no cadastro de exames
      const { data: categoriaCadastro } = await supabaseClient
        .from('cadastro_exames')
        .select('categoria')
        .eq('nome', 'ANGIOTC ARTERIAS CORONARIAS COM SCORE DE CALCIO')
        .single();

      const categoriaCorreta = categoriaCadastro?.categoria || 'SCORE';
      console.log(`🎯 Categoria correta encontrada no cadastro: ${categoriaCorreta}`);

      // 4. Aplicar a categoria correta na volumetria
      const { data, error: errorUpdate } = await supabaseClient
        .from('volumetria_mobilemed')
        .update({ 'CATEGORIA': categoriaCorreta })
        .eq('CATEGORIA', 'TC')
        .select('id');

      if (errorUpdate) {
        console.error('❌ Erro ao atualizar categoria:', errorUpdate);
        throw errorUpdate;
      }

      corrigidos = data?.length || 0;
      console.log(`✅ Corrigidos ${corrigidos} registros de TC para ${categoriaCorreta}`);

      // 5. Log da operação
      await supabaseClient
        .from('audit_logs')
        .insert({
          table_name: 'volumetria_mobilemed',
          operation: 'CORRECAO_CATEGORIA_TC_CADASTRO',
          record_id: 'bulk_update',
          new_data: {
            categoria_antiga: 'TC',
            categoria_nova: categoriaCorreta,
            registros_corrigidos: corrigidos,
            baseado_cadastro: true,
            timestamp: new Date().toISOString()
          },
          user_email: 'system',
          severity: 'info'
        });
    }

    const resultado = {
      sucesso: true,
      registros_encontrados: registrosTC?.length || 0,
      registros_corrigidos: corrigidos,
      categoria_aplicada: 'SCORE',
      detalhes: registrosTC?.map(r => ({
        estudo: r.ESTUDO_DESCRICAO,
        especialidade: r.ESPECIALIDADE,
        categoria_anterior: 'TC',
        categoria_nova: 'SCORE'
      })) || [],
      mensagem: `Correção concluída baseada no cadastro: ${corrigidos} registros atualizados de TC para SCORE`
    };

    console.log('🎉 Correção de categoria TC concluída:', resultado);

    return new Response(
      JSON.stringify(resultado),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Erro na correção de categoria TC:', error);
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        erro: error.message,
        detalhes: 'Erro ao corrigir categoria TC baseada no cadastro de exames'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});