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

    // Buscar arquivo_fonte do body (opcional)
    const body = await req.json().catch(() => ({}));
    const { arquivo_fonte } = body;

    console.log(`🔧 INICIANDO CORREÇÃO - Arquivo: ${arquivo_fonte || 'TODOS'}`);

    // 1. Buscar registros sem categoria/especialidade/modalidade ou com valores incorretos
    let query = supabase
      .from('volumetria_mobilemed')
      .select('id, "ESTUDO_DESCRICAO", "CATEGORIA", "ESPECIALIDADE", "MODALIDADE", arquivo_fonte');
    
    // Filtrar por arquivo_fonte se fornecido
    if (arquivo_fonte) {
      query = query.eq('arquivo_fonte', arquivo_fonte);
    }

    const { data: registrosSemCategoria, error: errorBusca } = await query;

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

    // 2. Buscar mapeamentos no cadastro de exames (incluindo modalidade)
    const { data: cadastroExames } = await supabase
      .from('cadastro_exames')
      .select('nome, categoria, especialidade, modalidade')
      .eq('ativo', true);

    const mapeamentoCadastro = new Map();
    cadastroExames?.forEach(exame => {
      mapeamentoCadastro.set(exame.nome.toUpperCase(), {
        categoria: exame.categoria || 'SC',
        especialidade: exame.especialidade || 'GERAL',
        modalidade: exame.modalidade || null
      });
    });

    console.log(`📋 Carregados ${cadastroExames?.length || 0} mapeamentos do cadastro`);

    // 3. Processar registros em lotes
    let registrosCorrigidos = 0;
    const tamanhoLote = 10;

    for (let i = 0; i < registrosSemCategoria.length; i += tamanhoLote) {
      const lote = registrosSemCategoria.slice(i, i + tamanhoLote);
      
      for (const registro of lote) {
        // Buscar mapeamento no cadastro de exames
        const mapeamento = mapeamentoCadastro.get(registro.ESTUDO_DESCRICAO?.toUpperCase());
        
        if (mapeamento) {
          // Sempre aplicar os valores do cadastro (sobrescrever se necessário)
          const updateData: any = {
            "CATEGORIA": mapeamento.categoria,
            "ESPECIALIDADE": mapeamento.especialidade,
            updated_at: new Date().toISOString()
          };

          // Adicionar modalidade se disponível no cadastro
          if (mapeamento.modalidade) {
            updateData["MODALIDADE"] = mapeamento.modalidade;
          }

          // Atualizar registro
          const { error: errorUpdate } = await supabase
            .from('volumetria_mobilemed')
            .update(updateData)
            .eq('id', registro.id);

          if (!errorUpdate) {
            registrosCorrigidos++;
            const modalidadeLog = mapeamento.modalidade ? `, Mod: ${mapeamento.modalidade}` : '';
            console.log(`✅ Corrigido: ${registro.ESTUDO_DESCRICAO} -> Cat: ${mapeamento.categoria}, Esp: ${mapeamento.especialidade}${modalidadeLog}`);
          } else {
            console.error(`❌ Erro ao corrigir ${registro.id}:`, errorUpdate);
          }
        } else {
          console.log(`⚠️ Sem mapeamento para: ${registro.ESTUDO_DESCRICAO}`);
        }
      }
    }

    const resultado = {
      sucesso: true,
      arquivo_fonte: arquivo_fonte || 'TODOS',
      registros_encontrados: registrosSemCategoria.length,
      registros_corrigidos: registrosCorrigidos,
      mapeamentos_utilizados: cadastroExames?.length || 0,
      data_processamento: new Date().toISOString(),
      detalhes: {
        observacao: 'Correções aplicadas consultando cadastro_exames',
        campos_corrigidos: 'MODALIDADE, ESPECIALIDADE, CATEGORIA'
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