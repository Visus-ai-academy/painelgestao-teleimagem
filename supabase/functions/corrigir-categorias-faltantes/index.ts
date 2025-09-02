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

    console.log('🔧 INICIANDO CORREÇÃO FINAL DAS CATEGORIAS');

    // 1. Buscar registros sem categoria dos últimos uploads
    const { data: registrosSemCategoria, error: errorBusca } = await supabase
      .from('volumetria_mobilemed')
      .select('id, "ESTUDO_DESCRICAO", "CATEGORIA", arquivo_fonte')
      .gte('created_at', new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()) // últimas 3 horas
      .or('"CATEGORIA".is.null,"CATEGORIA".eq.');

    if (errorBusca) {
      throw new Error(`Erro ao buscar registros: ${errorBusca.message}`);
    }

    console.log(`📦 Encontrados ${registrosSemCategoria?.length || 0} registros sem categoria`);

    if (!registrosSemCategoria || registrosSemCategoria.length === 0) {
      return new Response(JSON.stringify({
        sucesso: true,
        mensagem: 'Nenhum registro sem categoria encontrado',
        registros_corrigidos: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 2. Buscar mapeamentos do cadastro de exames
    const { data: cadastroExames } = await supabase
      .from('cadastro_exames')
      .select('nome, categoria')
      .eq('ativo', true)
      .neq('categoria', null)
      .neq('categoria', '');

    const mapeamentoCategorias = new Map();
    cadastroExames?.forEach(exame => {
      const nomeKey = exame.nome.toUpperCase().trim();
      if (exame.categoria) {
        mapeamentoCategorias.set(nomeKey, exame.categoria);
      }
    });

    console.log(`📋 Carregados ${cadastroExames?.length || 0} mapeamentos de categoria`);

    // 3. Processar correções em lotes
    let corrigidos = 0;
    const tamanhoLote = 50;

    for (let i = 0; i < registrosSemCategoria.length; i += tamanhoLote) {
      const lote = registrosSemCategoria.slice(i, i + tamanhoLote);
      
      for (const registro of lote) {
        const nomeExame = registro.ESTUDO_DESCRICAO?.toUpperCase().trim();
        let categoria = 'SC'; // Categoria padrão
        
        // Buscar categoria específica no mapeamento
        if (nomeExame && mapeamentoCategorias.has(nomeExame)) {
          categoria = mapeamentoCategorias.get(nomeExame);
        }

        // Atualizar registro
        const { error: errorUpdate } = await supabase
          .from('volumetria_mobilemed')
          .update({
            "CATEGORIA": categoria,
            updated_at: new Date().toISOString()
          })
          .eq('id', registro.id);

        if (!errorUpdate) {
          corrigidos++;
          if (categoria !== 'SC') {
            console.log(`✅ ${registro.ESTUDO_DESCRICAO} → ${categoria}`);
          }
        } else {
          console.error(`❌ Erro ao corrigir ${registro.id}:`, errorUpdate);
        }
      }

      // Log de progresso
      if (i % 1000 === 0) {
        console.log(`📊 Progresso: ${i + lote.length}/${registrosSemCategoria.length}`);
      }
    }

    // 4. Verificação final
    const { data: verificacaoFinal } = await supabase
      .from('volumetria_mobilemed')
      .select(`
        arquivo_fonte,
        COUNT(*) as total,
        COUNT(CASE WHEN "CATEGORIA" IS NOT NULL AND "CATEGORIA" != '' THEN 1 END) as com_categoria
      `)
      .gte('created_at', new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())
      .groupBy('arquivo_fonte');

    const resultado = {
      sucesso: true,
      registros_encontrados: registrosSemCategoria.length,
      registros_corrigidos: corrigidos,
      mapeamentos_utilizados: cadastroExames?.length || 0,
      verificacao_final: verificacaoFinal || [],
      data_processamento: new Date().toISOString(),
      resumo: {
        categoria_padrao_aplicada: corrigidos - (cadastroExames?.length || 0),
        categoria_especifica_aplicada: Math.min(corrigidos, cadastroExames?.length || 0)
      }
    };

    console.log('📊 Resultado final da correção:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Erro na correção de categorias:', error);
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        erro: error.message,
        detalhes: error.stack 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});