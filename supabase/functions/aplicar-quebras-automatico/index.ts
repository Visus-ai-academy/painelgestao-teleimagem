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

    const { lote_upload } = await req.json();
    
    console.log(`Aplicando quebras automáticas para lote: ${lote_upload}`);

    // 1. Buscar registros que precisam de quebra no lote específico
    const { data: registrosPendentes, error: errorPendentes } = await supabase
      .from('volumetria_mobilemed')
      .select(`
        *,
        regras_quebra_exames!inner(
          exame_original,
          exame_quebrado,
          categoria_quebrada,
          ativo
        )
      `)
      .eq('lote_upload', lote_upload)
      .eq('regras_quebra_exames.ativo', true);

    if (errorPendentes) {
      throw new Error(`Erro ao buscar registros pendentes: ${errorPendentes.message}`);
    }

    if (!registrosPendentes || registrosPendentes.length === 0) {
      return new Response(JSON.stringify({
        sucesso: true,
        mensagem: 'Nenhum registro pendente de quebra encontrado',
        registros_processados: 0,
        lote_upload
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`Encontrados ${registrosPendentes.length} registros para processar quebras`);

    let totalProcessados = 0;
    let totalQuebrados = 0;
    const registrosParaRemover: string[] = [];

    // 2. Processar cada registro
    for (const registro of registrosPendentes) {
      try {
        // Buscar todas as regras de quebra para este exame
        const { data: todasRegras, error: errorRegras } = await supabase
          .from('regras_quebra_exames')
          .select('*')
          .eq('exame_original', registro.ESTUDO_DESCRICAO)
          .eq('ativo', true);

        if (errorRegras || !todasRegras || todasRegras.length === 0) {
          continue;
        }

        console.log(`Quebrando exame ${registro.ESTUDO_DESCRICAO} em ${todasRegras.length} partes`);

        // 3. Criar registros quebrados
        const registrosQuebrados = todasRegras.map((regra) => {
          const novoRegistro = { ...registro };
          delete novoRegistro.id;
          delete novoRegistro.created_at;
          delete novoRegistro.updated_at;
          delete novoRegistro.regras_quebra_exames;

          return {
            ...novoRegistro,
            ESTUDO_DESCRICAO: regra.exame_quebrado,
            VALORES: 1, // Valor fixo de 1 para cada exame quebrado
            CATEGORIA: regra.categoria_quebrada || registro.CATEGORIA || 'SC',
            processamento_pendente: false
          };
        });

        // 4. Inserir registros quebrados
        const { error: errorInsert } = await supabase
          .from('volumetria_mobilemed')
          .insert(registrosQuebrados);

        if (errorInsert) {
          console.error(`Erro ao inserir registros quebrados para ${registro.id}:`, errorInsert.message);
          continue;
        }

        // 5. Marcar para remoção
        registrosParaRemover.push(registro.id);
        totalProcessados++;
        totalQuebrados += todasRegras.length;

      } catch (error: any) {
        console.error(`Erro ao processar registro ${registro.id}:`, error.message);
      }
    }

    // 6. Remover registros originais
    if (registrosParaRemover.length > 0) {
      const { error: errorDelete } = await supabase
        .from('volumetria_mobilemed')
        .delete()
        .in('id', registrosParaRemover);

      if (errorDelete) {
        console.error('Erro ao remover registros originais:', errorDelete.message);
      }
    }

    const resultado = {
      sucesso: true,
      lote_upload,
      registros_processados: totalProcessados,
      registros_quebrados: totalQuebrados,
      data_processamento: new Date().toISOString()
    };

    console.log('Quebras automáticas aplicadas:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Erro ao aplicar quebras automáticas:', error);
    
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