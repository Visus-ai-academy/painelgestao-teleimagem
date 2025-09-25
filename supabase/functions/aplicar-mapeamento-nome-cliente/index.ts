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

    const { arquivo_fonte } = await req.json();
    console.log(`[aplicar-mapeamento-nome-cliente] Iniciando para arquivo: ${arquivo_fonte || 'TODOS'}`);

    // Construir filtro dinâmico baseado no arquivo_fonte
    let query = supabase
      .from('volumetria_mobilemed')
      .select('id, "EMPRESA"')
      .not('EMPRESA', 'is', null);

    if (arquivo_fonte && arquivo_fonte !== 'TODOS') {
      query = query.eq('arquivo_fonte', arquivo_fonte);
    }

    // Buscar todos os registros de volumetria com EMPRESA
    const { data: registrosVolumetria, error: errorVolumetria } = await query;

    if (errorVolumetria) {
      console.error('[aplicar-mapeamento-nome-cliente] Erro ao buscar volumetria:', errorVolumetria);
      throw errorVolumetria;
    }

    console.log(`[aplicar-mapeamento-nome-cliente] Encontrados ${registrosVolumetria?.length || 0} registros para processar`);

    if (!registrosVolumetria || registrosVolumetria.length === 0) {
      return new Response(
        JSON.stringify({
          sucesso: true,
          total_processados: 0,
          total_atualizados: 0,
          mensagem: 'Nenhum registro encontrado para processar'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar mapeamento completo de clientes (nome_mobilemed -> nome_fantasia)
    const { data: clientes, error: errorClientes } = await supabase
      .from('clientes')
      .select('nome_mobilemed, nome_fantasia')
      .not('nome_mobilemed', 'is', null)
      .not('nome_fantasia', 'is', null);

    if (errorClientes) {
      console.error('[aplicar-mapeamento-nome-cliente] Erro ao buscar clientes:', errorClientes);
      throw errorClientes;
    }

    console.log(`[aplicar-mapeamento-nome-cliente] Carregados ${clientes?.length || 0} mapeamentos de clientes`);

    // Criar mapa para lookup rápido
    const mapeamentoClientes: Record<string, string> = {};
    clientes?.forEach(cliente => {
      if (cliente.nome_mobilemed && cliente.nome_fantasia) {
        mapeamentoClientes[cliente.nome_mobilemed] = cliente.nome_fantasia;
      }
    });

    console.log(`[aplicar-mapeamento-nome-cliente] Mapeamentos únicos criados: ${Object.keys(mapeamentoClientes).length}`);

    let totalProcessados = 0;
    let totalAtualizados = 0;
    const tamanhoLote = 100;

    // Processar em lotes
    for (let i = 0; i < registrosVolumetria.length; i += tamanhoLote) {
      const lote = registrosVolumetria.slice(i, i + tamanhoLote);
      console.log(`[aplicar-mapeamento-nome-cliente] Processando lote ${Math.floor(i/tamanhoLote) + 1}/${Math.ceil(registrosVolumetria.length/tamanhoLote)}`);

      const atualizacoes: Array<{id: string, novoNome: string, nomeOriginal: string}> = [];

      for (const registro of lote) {
        totalProcessados++;
        const nomeOriginal = registro.EMPRESA;
        const nomeFantasia = mapeamentoClientes[nomeOriginal];

        if (nomeFantasia && nomeFantasia !== nomeOriginal) {
          atualizacoes.push({
            id: registro.id,
            novoNome: nomeFantasia,
            nomeOriginal: nomeOriginal
          });
        }
      }

      // Aplicar atualizações do lote
      for (const atualizacao of atualizacoes) {
        const { error: updateError } = await supabase
          .from('volumetria_mobilemed')
          .update({ 
            'EMPRESA': atualizacao.novoNome,
            updated_at: new Date().toISOString()
          })
          .eq('id', atualizacao.id);

        if (updateError) {
          console.error(`[aplicar-mapeamento-nome-cliente] Erro ao atualizar registro ${atualizacao.id}:`, updateError);
        } else {
          totalAtualizados++;
          console.log(`[aplicar-mapeamento-nome-cliente] Atualizado: "${atualizacao.nomeOriginal}" → "${atualizacao.novoNome}"`);
        }
      }

      console.log(`[aplicar-mapeamento-nome-cliente] Lote processado: ${atualizacoes.length} atualizações`);
    }

    // Log da operação
    const resultadoFinal = {
      sucesso: true,
      total_processados: totalProcessados,
      total_atualizados: totalAtualizados,
      arquivo_fonte: arquivo_fonte || 'TODOS',
      data_processamento: new Date().toISOString(),
      mapeamentos_disponiveis: Object.keys(mapeamentoClientes).length
    };

    console.log(`[aplicar-mapeamento-nome-cliente] Finalizado:`, resultadoFinal);

    return new Response(
      JSON.stringify(resultadoFinal),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[aplicar-mapeamento-nome-cliente] Erro:', error);
    return new Response(
      JSON.stringify({
        sucesso: false,
        erro: error.message,
        data_erro: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});