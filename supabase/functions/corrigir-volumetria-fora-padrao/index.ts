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

    console.log('🔧 INICIANDO CORREÇÃO DO VOLUMETRIA_FORA_PADRAO');

    // 1. Buscar registros sem categoria/especialidade
    const { data: registrosSemCategoria, error: errorBusca } = await supabase
      .from('volumetria_mobilemed')
      .select('id, "ESTUDO_DESCRICAO", "CATEGORIA", "ESPECIALIDADE"')
      .eq('arquivo_fonte', 'volumetria_fora_padrao')
      .or('"CATEGORIA".is.null,"CATEGORIA".eq.,"ESPECIALIDADE".is.null,"ESPECIALIDADE".eq.');

    if (errorBusca) {
      throw new Error(`Erro ao buscar registros: ${errorBusca.message}`);
    }

    console.log(`📦 Encontrados ${registrosSemCategoria?.length || 0} registros para correção`);

    if (!registrosSemCategoria || registrosSemCategoria.length === 0) {
      return new Response(JSON.stringify({
        sucesso: true,
        mensagem: 'Nenhum registro encontrado para correção',
        registros_corrigidos: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 2. Buscar mapeamentos no cadastro de exames
    const { data: cadastroExames } = await supabase
      .from('cadastro_exames')
      .select('nome, categoria, especialidade')
      .eq('ativo', true);

    const mapeamentoCadastro = new Map();
    cadastroExames?.forEach(exame => {
      mapeamentoCadastro.set(exame.nome.toUpperCase(), {
        categoria: exame.categoria || 'SC',
        especialidade: exame.especialidade || 'GERAL'
      });
    });

    console.log(`📋 Carregados ${cadastroExames?.length || 0} mapeamentos do cadastro`);

    // 3. Processar registros em lotes
    let registrosCorrigidos = 0;
    const tamanhoLote = 10;

    for (let i = 0; i < registrosSemCategoria.length; i += tamanhoLote) {
      const lote = registrosSemCategoria.slice(i, i + tamanhoLote);
      
      for (const registro of lote) {
        let categoria = registro.CATEGORIA;
        let especialidade = registro.ESPECIALIDADE;

        // Aplicar mapeamento se disponível
        const mapeamento = mapeamentoCadastro.get(registro.ESTUDO_DESCRICAO?.toUpperCase());
        if (mapeamento) {
          categoria = categoria || mapeamento.categoria;
          especialidade = especialidade || mapeamento.especialidade;
        }

        // Garantir valores padrão
        categoria = categoria || 'SC';
        especialidade = especialidade || 'GERAL';

        // Atualizar registro
        const { error: errorUpdate } = await supabase
          .from('volumetria_mobilemed')
          .update({
            "CATEGORIA": categoria,
            "ESPECIALIDADE": especialidade,
            updated_at: new Date().toISOString()
          })
          .eq('id', registro.id);

        if (!errorUpdate) {
          registrosCorrigidos++;
          console.log(`✅ Corrigido: ${registro.ESTUDO_DESCRICAO} -> Cat: ${categoria}, Esp: ${especialidade}`);
        } else {
          console.error(`❌ Erro ao corrigir ${registro.id}:`, errorUpdate);
        }
      }
    }

    // 4. Verificação final
    const { data: verificacaoFinal } = await supabase
      .from('volumetria_mobilemed')
      .select(`
        arquivo_fonte,
        COUNT(*) as total,
        COUNT(CASE WHEN "CATEGORIA" IS NOT NULL AND "CATEGORIA" != '' THEN 1 END) as com_categoria,
        COUNT(CASE WHEN "ESPECIALIDADE" IS NOT NULL AND "ESPECIALIDADE" != '' THEN 1 END) as com_especialidade
      `)
      .eq('arquivo_fonte', 'volumetria_fora_padrao');

    const resultado = {
      sucesso: true,
      arquivo_fonte: 'volumetria_fora_padrao',
      registros_encontrados: registrosSemCategoria.length,
      registros_corrigidos: registrosCorrigidos,
      mapeamentos_utilizados: cadastroExames?.length || 0,
      verificacao_final: verificacaoFinal?.[0] || null,
      data_processamento: new Date().toISOString(),
      detalhes: {
        categoria_aplicada: 'SC (padrão) ou mapeamento do cadastro',
        especialidade_aplicada: 'GERAL (padrão) ou mapeamento do cadastro'
      }
    };

    console.log('📊 Resultado final:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Erro na correção volumetria_fora_padrao:', error);
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