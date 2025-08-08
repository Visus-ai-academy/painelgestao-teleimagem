import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Definição dos tipos de faturamento
type TipoFaturamento = "CO-FT" | "NC-NF" | "NC-FT";

// Lista de clientes NC (não consolidados) - Regra F005
const CLIENTES_NC_ORIGINAL = [
  "CDICARDIO",
  "CDIGOIAS", 
  "CISP",
  "CLIRAM",
  "CRWANDERLEY",
  "DIAGMAX-PR",
  "GOLD",
  "PRODIMAGEM",
  "TRANSDUSON",
  "ZANELLO"
];

// Lista de clientes NC adicionais - Regra F006
const CLIENTES_NC_ADICIONAIS = [
  "CEMVALENCA",
  "RMPADUA",
  "RADI-IMAGEM"
];

// Todos os clientes NC
const CLIENTES_NC = [...CLIENTES_NC_ORIGINAL, ...CLIENTES_NC_ADICIONAIS];

// Especialidades que geram faturamento para clientes NC (NC-FT)
const ESPECIALIDADES_NC_FATURADAS = ["CARDIO"];

// Médicos específicos que geram NC-FT para clientes NC adicionais - Regra F006
const MEDICOS_NC_FATURADOS = [
  "Dr. Antonio Gualberto Chianca Filho",
  "Dr. Daniel Chrispim",
  "Dr. Efraim Da Silva Ferreira",
  "Dr. Felipe Falcão de Sá",
  "Dr. Guilherme N. Schincariol",
  "Dr. Gustavo Andreis",
  "Dr. João Carlos Dantas do Amaral",
  "Dr. João Fernando Miranda Pompermayer",
  "Dr. Leonardo de Paula Ribeiro Figueiredo",
  "Dr. Raphael Sanfelice João",
  "Dr. Thiago P. Martins",
  "Dr. Virgílio Oliveira Barreto",
  "Dra. Adriana Giubilei Pimenta",
  "Dra. Aline Andrade Dorea",
  "Dra. Camila Amaral Campos",
  "Dra. Cynthia Mendes Vieira de Morais",
  "Dra. Fernanda Gama Barbosa",
  "Dra. Kenia Menezes Fernandes",
  "Dra. Lara M. Durante Bacelar",
  "Dr. Aguinaldo Cunha Zuppani",
  "Dr. Alex Gueiros de Barros",
  "Dr. Eduardo Caminha Nunes",
  "Dr. Márcio D'Andréa Rossi",
  "Dr. Rubens Pereira Moura Filho",
  "Dr. Wesley Walber da Silva",
  "Dra. Luna Azambuja Satte Alam",
  "Dra. Roberta Bertoldo Sabatini Treml",
  "Dra. Thais Nogueira D. Gastaldi",
  "Dra. Vanessa da Costa Maldonado"
];

// Função para determinar o tipo de faturamento
function determinarTipoFaturamento(
  cliente: string,
  especialidade?: string,
  prioridade?: string,
  medico?: string,
  estudoDescricao?: string
): TipoFaturamento {
  // Clientes CO (consolidados) - sempre CO-FT
  if (!CLIENTES_NC.includes(cliente)) {
    return "CO-FT";
  }

  // REGRA F005 - Clientes NC originais
  if (CLIENTES_NC_ORIGINAL.includes(cliente)) {
    const temEspecialidadeFaturada = especialidade && ESPECIALIDADES_NC_FATURADAS.includes(especialidade);
    const ehPlantao = prioridade === "PLANTÃO";

    if (temEspecialidadeFaturada || ehPlantao || (estudoDescricao && ["ANGIOTC VENOSA TORAX CARDIOLOGIA", "RM CRANIO NEUROBRAIN"].includes(estudoDescricao))) {
      return "NC-FT";
    }
    return "NC-NF";
  }

  // REGRA F006 - Clientes NC adicionais (CEMVALENCA, RMPADUA, RADI-IMAGEM)
  if (CLIENTES_NC_ADICIONAIS.includes(cliente)) {
    const temEspecialidadeFaturada = especialidade && ESPECIALIDADES_NC_FATURADAS.includes(especialidade);
    const ehPlantao = prioridade === "PLANTÃO";
    const temMedicoFaturado = medico && MEDICOS_NC_FATURADOS.includes(medico);
    
    // Exceção especial para RADI-IMAGEM: incluir especialidade MAMA
    const temMamaRadiImagem = cliente === "RADI-IMAGEM" && especialidade === "MAMA";

    // NC-FT: especialidades específicas OU prioridade plantão OU médicos específicos OU MAMA para RADI-IMAGEM
    if (temEspecialidadeFaturada || ehPlantao || temMedicoFaturado || temMamaRadiImagem) {
      return "NC-FT";
    }
    return "NC-NF";
  }

  // Fallback (não deveria chegar aqui)
  return "NC-NF";
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
        const tipoFaturamento = determinarTipoFaturamento(
          registro.EMPRESA,
          registro.ESPECIALIDADE,
          registro.PRIORIDADE,
          registro.MEDICO,
          registro.ESTUDO_DESCRICAO
        );

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
      regras_aplicadas: ['F005 - Clientes NC Originais', 'F006 - Clientes NC Adicionais'],
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