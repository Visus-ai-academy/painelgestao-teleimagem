import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FilaItem {
  id: string;
  volumetria_id: string;
  arquivo_fonte: string;
  lote_upload: string;
  tipos_processamento: string[];
  prioridade: string;
  tentativas: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🚀 Iniciando processamento de regras avançadas...');

    // 1. Buscar itens pendentes na fila (prioridade alta primeiro)
    const { data: filaItens, error: filaError } = await supabase
      .from('fila_processamento_avancado')
      .select('*')
      .eq('status', 'pendente')
      .lt('tentativas', 3)
      .order('prioridade', { ascending: false }) // 'alta' vem primeiro
      .order('created_at', { ascending: true })
      .limit(100);

    if (filaError) {
      throw new Error(`Erro ao buscar fila: ${filaError.message}`);
    }

    console.log(`📋 Encontrados ${filaItens?.length || 0} itens na fila`);

    if (!filaItens || filaItens.length === 0) {
      return new Response(JSON.stringify({
        sucesso: true,
        mensagem: 'Nenhum item pendente na fila',
        processados: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    let totalProcessados = 0;
    let totalErros = 0;
    const resultados: any[] = [];

    // 2. Processar cada item da fila
    for (const item of filaItens as FilaItem[]) {
      console.log(`🔄 Processando item ${item.id} - Arquivo: ${item.arquivo_fonte}`);
      
      try {
        // Marcar como processando
        await supabase
          .from('fila_processamento_avancado')
          .update({ 
            status: 'processando',
            tentativas: item.tentativas + 1 
          })
          .eq('id', item.id);

        const resultadoItem = {
          item_id: item.id,
          volumetria_id: item.volumetria_id,
          arquivo_fonte: item.arquivo_fonte,
          tipos_processamento: item.tipos_processamento,
          sucesso: true,
          detalhes: {} as any
        };

        // 3. Processar cada tipo de regra necessária
        for (const tipo of item.tipos_processamento) {
          console.log(`  ⚙️ Aplicando regra: ${tipo}`);
          
          switch (tipo) {
            case 'v002_v003':
              // Regras v002/v003 já foram aplicadas pelo trigger
              resultadoItem.detalhes.v002_v003 = 'Aplicada via trigger';
              break;

            case 'quebras':
              // Aplicar quebras de exames
              const resultadoQuebras = await aplicarQuebrasExames(supabase, item);
              resultadoItem.detalhes.quebras = resultadoQuebras;
              break;

            case 'exclusoes':
              // Aplicar regras de exclusão específicas
              const resultadoExclusoes = await aplicarRegraExclusoes(supabase, item);
              resultadoItem.detalhes.exclusoes = resultadoExclusoes;
              break;

            case 'valor_onco':
              // Aplicar valores específicos de oncologia
              const resultadoOnco = await aplicarValorOnco(supabase, item);
              resultadoItem.detalhes.valor_onco = resultadoOnco;
              break;

            default:
              console.warn(`⚠️ Tipo de processamento desconhecido: ${tipo}`);
          }
        }

        // Marcar como concluído
        await supabase
          .from('fila_processamento_avancado')
          .update({ 
            status: 'concluido',
            processado_em: new Date().toISOString(),
            erro_detalhes: null
          })
          .eq('id', item.id);

        resultados.push(resultadoItem);
        totalProcessados++;
        console.log(`✅ Item ${item.id} processado com sucesso`);

      } catch (itemError: any) {
        console.error(`❌ Erro ao processar item ${item.id}:`, itemError.message);
        
        // Marcar erro e incrementar tentativas
        await supabase
          .from('fila_processamento_avancado')
          .update({ 
            status: item.tentativas >= 2 ? 'erro' : 'pendente',
            erro_detalhes: itemError.message
          })
          .eq('id', item.id);

        resultados.push({
          item_id: item.id,
          sucesso: false,
          erro: itemError.message
        });
        
        totalErros++;
      }
    }

    const resposta = {
      sucesso: true,
      processados: totalProcessados,
      erros: totalErros,
      total_itens: filaItens.length,
      resultados: resultados,
      timestamp: new Date().toISOString()
    };

    console.log('🎉 Processamento concluído:', resposta);

    return new Response(JSON.stringify(resposta), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('💥 Erro geral no processamento:', error);
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        erro: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

// ========================================
// FUNÇÕES AUXILIARES PARA REGRAS ESPECÍFICAS
// ========================================

async function aplicarQuebrasExames(supabase: any, item: FilaItem) {
  console.log(`    🔨 Aplicando quebra de exames para ${item.volumetria_id}`);
  
  try {
    // Buscar o registro original
    const { data: registro, error } = await supabase
      .from('volumetria_mobilemed')
      .select('*')
      .eq('id', item.volumetria_id)
      .single();

    if (error || !registro) {
      return { sucesso: false, erro: 'Registro não encontrado' };
    }

    // Buscar regras de quebra para este exame
    const { data: regrasQuebra, error: regrasError } = await supabase
      .from('regras_quebra_exames')
      .select('*')
      .eq('exame_original', registro.ESTUDO_DESCRICAO)
      .eq('ativo', true);

    if (regrasError || !regrasQuebra || regrasQuebra.length === 0) {
      return { sucesso: true, quebras_aplicadas: 0, motivo: 'Nenhuma regra de quebra encontrada' };
    }

    let quebrasAplicadas = 0;

    // Para cada regra de quebra, criar um novo registro
    for (const regra of regrasQuebra) {
      const novoRegistro = {
        ...registro,
        id: crypto.randomUUID(),
        ESTUDO_DESCRICAO: regra.exame_quebrado,
        VALORES: 1, // Cada quebra vale 1
        CATEGORIA: regra.categoria_quebrada || registro.CATEGORIA,
        processamento_pendente: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: insertError } = await supabase
        .from('volumetria_mobilemed')  
        .insert(novoRegistro);

      if (!insertError) {
        quebrasAplicadas++;
      }
    }

    // Remover o registro original
    if (quebrasAplicadas > 0) {
      await supabase
        .from('volumetria_mobilemed')
        .delete()
        .eq('id', item.volumetria_id);
    }

    return { 
      sucesso: true, 
      quebras_aplicadas: quebrasAplicadas,
      exame_original: registro.ESTUDO_DESCRICAO 
    };

  } catch (error: any) {
    return { sucesso: false, erro: error.message };
  }
}

async function aplicarRegraExclusoes(supabase: any, item: FilaItem) {
  console.log(`    🚫 Aplicando regras de exclusão para ${item.volumetria_id}`);
  
  try {
    // Por enquanto, apenas validar que o registro ainda existe
    const { data: registro, error } = await supabase
      .from('volumetria_mobilemed')
      .select('EMPRESA, ESTUDO_DESCRICAO, DATA_REALIZACAO')
      .eq('id', item.volumetria_id)
      .single();

    if (error || !registro) {
      return { sucesso: false, erro: 'Registro não encontrado para exclusão' };
    }

    // Aplicar regras de exclusão específicas (implementar conforme necessário)
    return { 
      sucesso: true, 
      exclusoes_aplicadas: 0,
      motivo: 'Nenhuma regra de exclusão específica aplicada' 
    };

  } catch (error: any) {
    return { sucesso: false, erro: error.message };
  }
}

async function aplicarValorOnco(supabase: any, item: FilaItem) {
  console.log(`    🎯 Aplicando valor ONCO para ${item.volumetria_id}`);
  
  try {
    const { data: registro, error } = await supabase
      .from('volumetria_mobilemed')
      .select('CATEGORIA, VALORES, ESTUDO_DESCRICAO')
      .eq('id', item.volumetria_id)
      .single();

    if (error || !registro) {
      return { sucesso: false, erro: 'Registro não encontrado' };
    }

    // Se é categoria ONCO e valor está zerado, aplicar valor específico
    if (registro.CATEGORIA === 'ONCO' && (registro.VALORES === 0 || registro.VALORES === null)) {
      const { error: updateError } = await supabase
        .from('volumetria_mobilemed')
        .update({ VALORES: 2.5 }) // Valor padrão ONCO
        .eq('id', item.volumetria_id);

      if (updateError) {
        return { sucesso: false, erro: updateError.message };
      }

      return { 
        sucesso: true, 
        valor_aplicado: 2.5,
        exame: registro.ESTUDO_DESCRICAO 
      };
    }

    return { 
      sucesso: true, 
      valor_aplicado: 0,
      motivo: 'Não é ONCO ou já tem valor' 
    };

  } catch (error: any) {
    return { sucesso: false, erro: error.message };
  }
}