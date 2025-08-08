import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para determinar o tipo de faturamento - Duplicada aqui para ser autônoma
function determinarTipoFaturamento(
  cliente: string,
  especialidade?: string,
  prioridade?: string,
  medico?: string,
  estudoDescricao?: string
): string {
  // Listas de clientes NC
  const CLIENTES_NC_ORIGINAL = ["CDICARDIO", "CDIGOIAS", "CISP", "CLIRAM", "CRWANDERLEY", "DIAGMAX-PR", "GOLD", "PRODIMAGEM", "TRANSDUSON", "ZANELLO"];
  const CLIENTES_NC_ADICIONAIS = ["CEMVALENCA", "RMPADUA", "RADI-IMAGEM"];
  const CLIENTES_NC = [...CLIENTES_NC_ORIGINAL, ...CLIENTES_NC_ADICIONAIS];
  const ESPECIALIDADES_NC_FATURADAS = ["CARDIO"];
  const MEDICOS_NC_FATURADOS = ["Dr. Antonio Gualberto Chianca Filho", "Dr. Daniel Chrispim", "Dr. Efraim Da Silva Ferreira", "Dr. Felipe Falcão de Sá", "Dr. Guilherme N. Schincariol", "Dr. Gustavo Andreis", "Dr. João Carlos Dantas do Amaral", "Dr. João Fernando Miranda Pompermayer", "Dr. Leonardo de Paula Ribeiro Figueiredo", "Dr. Raphael Sanfelice João", "Dr. Thiago P. Martins", "Dr. Virgílio Oliveira Barreto", "Dra. Adriana Giubilei Pimenta", "Dra. Aline Andrade Dorea", "Dra. Camila Amaral Campos", "Dra. Cynthia Mendes Vieira de Morais", "Dra. Fernanda Gama Barbosa", "Dra. Kenia Menezes Fernandes", "Dra. Lara M. Durante Bacelar", "Dr. Aguinaldo Cunha Zuppani", "Dr. Alex Gueiros de Barros", "Dr. Eduardo Caminha Nunes", "Dr. Márcio D'Andréa Rossi", "Dr. Rubens Pereira Moura Filho", "Dr. Wesley Walber da Silva", "Dra. Luna Azambuja Satte Alam", "Dra. Roberta Bertoldo Sabatini Treml", "Dra. Thais Nogueira D. Gastaldi", "Dra. Vanessa da Costa Maldonado"];

  // REGRA F007 - Clientes especiais com lógica própria
  const CLIENTES_F007 = ["CBU", "CEDI_RJ", "CEDI_RO", "CEDI_UNIMED", "RADMED"];
  const MEDICO_EXCECAO_F007 = "Dr. Rodrigo Vaz de Lima";

  // REGRA F007 - Clientes especiais (aplicação prioritária)
  if (["CBU", "CEDI_RJ", "CEDI_RO", "CEDI_UNIMED", "RADMED"].includes(cliente)) {
    if (prioridade === "PLANTÃO") return "CO-FT";
    if (especialidade === "MEDICINA INTERNA" && medico !== "Dr. Rodrigo Vaz de Lima") {
      return "CO-FT";
    }
    return "NC-NF";
  }

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

    console.log('🔄 Aplicando tipificação retroativa em dados existentes...');

    // 1. Atualizar dados de volumetria existentes sem tipificação
    const { data: registrosVolumetria, error: selectVolumetriaError } = await supabaseClient
      .from('volumetria_mobilemed')
      .select('id, "EMPRESA", "ESPECIALIDADE", "PRIORIDADE", "MEDICO", "ESTUDO_DESCRICAO"')
      .is('tipo_faturamento', null)
      .limit(5000); // Processar em lotes para evitar timeout

    if (selectVolumetriaError) {
      console.error('❌ Erro ao buscar registros de volumetria:', selectVolumetriaError);
      throw selectVolumetriaError;
    }

    console.log(`📊 Encontrados ${registrosVolumetria?.length || 0} registros de volumetria sem tipificação`);

    let volumetriaAtualizados = 0;

    if (registrosVolumetria && registrosVolumetria.length > 0) {
      // Processar em lotes de 100
      const BATCH_SIZE = 100;
      for (let i = 0; i < registrosVolumetria.length; i += BATCH_SIZE) {
        const lote = registrosVolumetria.slice(i, i + BATCH_SIZE);
        
        const updatePromises = lote.map(async (registro) => {
          const tipoFaturamento = determinarTipoFaturamento(
            registro.EMPRESA,
            registro.ESPECIALIDADE,
            registro.PRIORIDADE,
            registro.MEDICO,
            registro.ESTUDO_DESCRICAO
          );

          const { error } = await supabaseClient
            .from('volumetria_mobilemed')
            .update({ tipo_faturamento: tipoFaturamento })
            .eq('id', registro.id);

          if (error) {
            console.error(`❌ Erro ao atualizar volumetria ${registro.id}:`, error);
            return false;
          }
          return true;
        });

        const results = await Promise.all(updatePromises);
        volumetriaAtualizados += results.filter(Boolean).length;
        
        console.log(`✅ Lote ${Math.floor(i/BATCH_SIZE) + 1} de volumetria processado - ${volumetriaAtualizados} atualizados`);
      }
    }

    // 2. Atualizar dados de faturamento existentes sem tipificação
    const { data: registrosFaturamento, error: selectFaturamentoError } = await supabaseClient
      .from('faturamento')
.select('id, cliente_nome, especialidade, prioridade, medico, nome_exame')
      .is('tipo_faturamento', null)
      .limit(5000); // Processar em lotes para evitar timeout

    if (selectFaturamentoError) {
      console.error('❌ Erro ao buscar registros de faturamento:', selectFaturamentoError);
      throw selectFaturamentoError;
    }

    console.log(`📊 Encontrados ${registrosFaturamento?.length || 0} registros de faturamento sem tipificação`);

    let faturamentoAtualizados = 0;

    if (registrosFaturamento && registrosFaturamento.length > 0) {
      // Processar em lotes de 100
      const BATCH_SIZE = 100;
      for (let i = 0; i < registrosFaturamento.length; i += BATCH_SIZE) {
        const lote = registrosFaturamento.slice(i, i + BATCH_SIZE);
        
        const updatePromises = lote.map(async (registro) => {
          const tipoFaturamento = determinarTipoFaturamento(
            registro.cliente_nome,
            registro.especialidade,
            registro.prioridade,
            registro.medico,
            registro.nome_exame
          );

          const { error } = await supabaseClient
            .from('faturamento')
            .update({ tipo_faturamento: tipoFaturamento })
            .eq('id', registro.id);

          if (error) {
            console.error(`❌ Erro ao atualizar faturamento ${registro.id}:`, error);
            return false;
          }
          return true;
        });

        const results = await Promise.all(updatePromises);
        faturamentoAtualizados += results.filter(Boolean).length;
        
        console.log(`✅ Lote ${Math.floor(i/BATCH_SIZE) + 1} de faturamento processado - ${faturamentoAtualizados} atualizados`);
      }
    }

    // 3. Gerar estatísticas finais
    const { data: statsVolumetria } = await supabaseClient
      .from('volumetria_mobilemed')
      .select('tipo_faturamento')
      .not('tipo_faturamento', 'is', null);

    const { data: statsFaturamento } = await supabaseClient
      .from('faturamento')
      .select('tipo_faturamento')
      .not('tipo_faturamento', 'is', null);

    const estatisticasVolumetria = statsVolumetria?.reduce((acc: any, record: any) => {
      acc[record.tipo_faturamento] = (acc[record.tipo_faturamento] || 0) + 1;
      return acc;
    }, {}) || {};

    const estatisticasFaturamento = statsFaturamento?.reduce((acc: any, record: any) => {
      acc[record.tipo_faturamento] = (acc[record.tipo_faturamento] || 0) + 1;
      return acc;
    }, {}) || {};

    const resultado = {
      sucesso: true,
      volumetria_atualizados: volumetriaAtualizados,
      faturamento_atualizados: faturamentoAtualizados,
      total_atualizados: volumetriaAtualizados + faturamentoAtualizados,
      estatisticas_volumetria: estatisticasVolumetria,
      estatisticas_faturamento: estatisticasFaturamento,
      regras_aplicadas: ['F005 - Clientes NC Originais', 'F006 - Clientes NC Adicionais', 'F007 - Clientes especiais (CBU, CEDI_RJ, CEDI_RO, CEDI_UNIMED, RADMED)'],
      data_processamento: new Date().toISOString()
    };

    console.log('✅ Tipificação retroativa concluída:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('❌ Erro na tipificação retroativa:', error);

    return new Response(JSON.stringify({
      sucesso: false,
      erro: error.message,
      detalhes: 'Erro ao aplicar tipificação retroativa'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});