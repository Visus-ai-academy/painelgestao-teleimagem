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

    // 1. Buscar registros da volumetria
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

    // 2. Buscar mapeamentos do cadastro de exames (direto)
    const { data: cadastroExames } = await supabase
      .from('cadastro_exames')
      .select('nome, categoria, especialidade, modalidade')
      .eq('ativo', true);

    const mapeamentoCadastro = new Map();
    cadastroExames?.forEach(exame => {
      mapeamentoCadastro.set(exame.nome.toUpperCase().trim(), {
        categoria: exame.categoria || 'SC',
        especialidade: exame.especialidade || null,
        modalidade: exame.modalidade || null
      });
    });

    console.log(`📋 Carregados ${cadastroExames?.length || 0} mapeamentos do cadastro_exames (direto)`);

    // 3. Buscar mapeamentos da tabela valores_referencia_de_para COM vinculação ao cadastro_exames
    const { data: valoresReferencia } = await supabase
      .from('valores_referencia_de_para')
      .select('estudo_descricao, cadastro_exame_id')
      .eq('ativo', true)
      .not('cadastro_exame_id', 'is', null);

    // Para cada valor de referência vinculado, buscar dados do cadastro_exames
    const mapeamentoForaPadrao = new Map();
    
    if (valoresReferencia && valoresReferencia.length > 0) {
      // Buscar os cadastro_exames vinculados
      const cadastroExameIds = [...new Set(valoresReferencia.map(v => v.cadastro_exame_id).filter(Boolean))];
      
      const { data: examesVinculados } = await supabase
        .from('cadastro_exames')
        .select('id, categoria, especialidade, modalidade')
        .in('id', cadastroExameIds);

      const exameMap = new Map();
      examesVinculados?.forEach(e => exameMap.set(e.id, e));

      // Criar mapeamento de nome fora do padrão -> dados do cadastro vinculado
      valoresReferencia.forEach(valor => {
        const exame = exameMap.get(valor.cadastro_exame_id);
        if (exame) {
          mapeamentoForaPadrao.set(valor.estudo_descricao.toUpperCase().trim(), {
            categoria: exame.categoria || 'SC',
            especialidade: exame.especialidade || null,
            modalidade: exame.modalidade || null
          });
        }
      });

      console.log(`🔗 Carregados ${mapeamentoForaPadrao.size} mapeamentos de exames fora do padrão VINCULADOS`);
    }

    // 4. Processar registros em lotes
    let registrosCorrigidos = 0;
    let registrosSemMapeamento = 0;
    const tamanhoLote = 10;

    for (let i = 0; i < registrosSemCategoria.length; i += tamanhoLote) {
      const lote = registrosSemCategoria.slice(i, i + tamanhoLote);
      
      for (const registro of lote) {
        const estudoDescricaoNormalizado = registro.ESTUDO_DESCRICAO?.toUpperCase().trim() || '';
        
        // Prioridade 1: Buscar no mapeamento de exames fora do padrão (vinculados)
        let mapeamento = mapeamentoForaPadrao.get(estudoDescricaoNormalizado);
        
        // Prioridade 2: Buscar diretamente no cadastro de exames
        if (!mapeamento) {
          mapeamento = mapeamentoCadastro.get(estudoDescricaoNormalizado);
        }
        
        if (mapeamento) {
          // Aplicar os valores do mapeamento
          const updateData: any = {
            updated_at: new Date().toISOString()
          };

          // Só atualizar se tiver valor no mapeamento
          if (mapeamento.categoria) {
            updateData["CATEGORIA"] = mapeamento.categoria;
          }
          if (mapeamento.especialidade) {
            updateData["ESPECIALIDADE"] = mapeamento.especialidade;
          }
          if (mapeamento.modalidade) {
            updateData["MODALIDADE"] = mapeamento.modalidade;
          }

          // Só atualiza se tiver algo para atualizar
          if (Object.keys(updateData).length > 1) {
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
          }
        } else {
          registrosSemMapeamento++;
          if (registrosSemMapeamento <= 10) {
            console.log(`⚠️ Sem mapeamento para: ${registro.ESTUDO_DESCRICAO}`);
          }
        }
      }
    }

    if (registrosSemMapeamento > 10) {
      console.log(`⚠️ ... e mais ${registrosSemMapeamento - 10} registros sem mapeamento`);
    }

    const resultado = {
      sucesso: true,
      arquivo_fonte: arquivo_fonte || 'TODOS',
      registros_encontrados: registrosSemCategoria.length,
      registros_corrigidos: registrosCorrigidos,
      registros_sem_mapeamento: registrosSemMapeamento,
      mapeamentos_cadastro_direto: cadastroExames?.length || 0,
      mapeamentos_fora_padrao_vinculados: mapeamentoForaPadrao.size,
      data_processamento: new Date().toISOString(),
      detalhes: {
        observacao: 'Correções aplicadas usando vinculação valores_referencia_de_para → cadastro_exames',
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
