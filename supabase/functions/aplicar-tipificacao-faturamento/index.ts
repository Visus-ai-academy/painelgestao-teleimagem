import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tipos de Faturamento Definidos:
// CO-FT: CO com faturamento
// NC-FT: NC faturado
// NC-NF: NC não faturado
type TipoFaturamento = "CO-FT" | "NC-FT" | "NC-NF";

// Lista de clientes NC (Cliente do tipo NC)
const CLIENTES_NC = [
  "CDICARDIO",
  "CDIGOIAS", 
  "CISP",
  "CLIRAM",
  "CRWANDERLEY",
  "DIAGMAX-PR",
  "GOLD",
  "PRODIMAGEM",
  "TRANSDUSON",
  "ZANELLO",
  "CEMVALENCA",
  "RMPADUA",
  "RADI-IMAGEM"
];

// Função para determinar o tipo de cliente
function determinarTipoCliente(cliente: string): "CO" | "NC" {
  return CLIENTES_NC.includes(cliente) ? "NC" : "CO";
}

// Função para determinar o tipo de faturamento
function determinarTipoFaturamento(cliente: string): TipoFaturamento {
  const tipoCliente = determinarTipoCliente(cliente);
  
  if (tipoCliente === "CO") {
    return "CO-FT"; // CO com faturamento
  } else {
    // Para clientes NC, determinar se é faturado ou não faturado
    // Por enquanto, todos os NC são não faturados por padrão
    return "NC-NF"; // NC não faturado
  }
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

    const { arquivo_fonte, lote_upload } = await req.json();

    console.log(`🔄 Aplicando tipificação de faturamento - Arquivo: ${arquivo_fonte}, Lote: ${lote_upload}`);


    // 1. Buscar registros que precisam de tipificação
    let query = supabaseClient
      .from('volumetria_mobilemed')
      .select('id, "EMPRESA", "ESPECIALIDADE", "PRIORIDADE", "MEDICO", "ESTUDO_DESCRICAO"');

    // Aplicar filtros conforme parâmetros
    if (arquivo_fonte && lote_upload) {
      query = query.eq('arquivo_fonte', arquivo_fonte).eq('lote_upload', lote_upload);
    } else if (arquivo_fonte) {
      query = query.eq('arquivo_fonte', arquivo_fonte);
    } else if (lote_upload) {
      query = query.eq('lote_upload', lote_upload);
    } else {
      // Buscar apenas registros sem tipo de faturamento
      query = query.is('tipo_faturamento', null);
    }

    const { data: registros, error: selectError } = await query;

    if (selectError) {
      console.error('❌ Erro ao buscar registros:', selectError);
      throw selectError;
    }

    if (!registros || registros.length === 0) {
      console.log('ℹ️ Nenhum registro encontrado para tipificação');
      return new Response(JSON.stringify({
        sucesso: true,
        registros_processados: 0,
        message: 'Nenhum registro encontrado para tipificação'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`📊 Processando ${registros.length} registros para tipificação`);

    // 2. Processar registros em lotes de 500
    const BATCH_SIZE = 500;
    let registrosProcessados = 0;
    let registrosAtualizados = 0;

    for (let i = 0; i < registros.length; i += BATCH_SIZE) {
      const lote = registros.slice(i, i + BATCH_SIZE);
      
      console.log(`🔄 Processando lote ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(registros.length/BATCH_SIZE)} - ${lote.length} registros`);

      // Preparar atualizações em massa
      const updates = lote.map(registro => {
        const tipoFaturamento = determinarTipoFaturamento(registro.EMPRESA);

        registrosProcessados++;

        return {
          id: registro.id,
          tipo_faturamento: tipoFaturamento
        };
      });

      // Executar atualizações em paralelo (grupos de 50)
      const PARALLEL_SIZE = 50;
      for (let j = 0; j < updates.length; j += PARALLEL_SIZE) {
        const parallelUpdates = updates.slice(j, j + PARALLEL_SIZE);
        
        const updatePromises = parallelUpdates.map(async (update) => {
          const { error } = await supabaseClient
            .from('volumetria_mobilemed')
            .update({ tipo_faturamento: update.tipo_faturamento })
            .eq('id', update.id);

          if (error) {
            console.error(`❌ Erro ao atualizar registro ${update.id}:`, error);
            return false;
          }
          return true;
        });

        const results = await Promise.all(updatePromises);
        registrosAtualizados += results.filter(Boolean).length;
      }
    }

    // 3. Estatísticas finais
    const { data: stats, error: statsError } = await supabaseClient
      .from('volumetria_mobilemed')
      .select('tipo_faturamento')
      .not('tipo_faturamento', 'is', null);

    let estatisticas = {};
    if (!statsError && stats) {
      const contadores = stats.reduce((acc: any, record: any) => {
        acc[record.tipo_faturamento] = (acc[record.tipo_faturamento] || 0) + 1;
        return acc;
      }, {});
      estatisticas = contadores;
    }

    const resultado = {
      sucesso: true,
      registros_encontrados: registros.length,
      registros_processados: registrosProcessados,
      registros_atualizados: registrosAtualizados,
      estatisticas_tipos: estatisticas,
      regras_aplicadas: ['Determinação do Tipo de Cliente: CO (cliente do tipo CO) / NC (Cliente do tipo NC)', 'Tipos de Faturamento: CO-FT (CO com faturamento) / NC-FT (NC faturado) / NC-NF (NC não faturado)'],
      data_processamento: new Date().toISOString()
    };

    console.log('✅ Tipificação de faturamento concluída:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('❌ Erro na tipificação de faturamento:', error);

    return new Response(JSON.stringify({
      sucesso: false,
      erro: error.message,
      detalhes: 'Erro ao aplicar tipificação de faturamento'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});