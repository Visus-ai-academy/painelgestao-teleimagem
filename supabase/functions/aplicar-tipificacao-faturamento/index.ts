import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tipos de Faturamento Definidos:
// CO-FT: CO com faturamento
// CO-NF: CO não faturado
// NC-FT: NC faturado
// NC-NF: NC não faturado
// NC1-NF: NC1 não faturado
type TipoFaturamento = "CO-FT" | "CO-NF" | "NC-FT" | "NC-NF" | "NC1-NF";

// Tipos de Cliente Definidos:
// CO: Cliente do tipo CO
// NC: Cliente do tipo NC
// NC1: Cliente do tipo NC1
type TipoCliente = "CO" | "NC" | "NC1";

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

    const { arquivo_fonte, lote_upload, periodo_referencia } = await req.json();

    console.log(`🔄 Aplicando tipificação de faturamento - Arquivo: ${arquivo_fonte}, Lote: ${lote_upload}, Período: ${periodo_referencia}`);

    // 1. Buscar registros que precisam de tipificação
    let query = supabaseClient
      .from('volumetria_mobilemed')
      .select('id, "EMPRESA", "MODALIDADE", "ESPECIALIDADE", "CATEGORIA", "PRIORIDADE", "MEDICO"');

    // Aplicar filtros conforme parâmetros
    if (periodo_referencia) {
      // Filtrar por período e apenas registros sem tipo de faturamento
      query = query.eq('periodo_referencia', periodo_referencia).is('tipo_faturamento', null);
    } else if (arquivo_fonte && lote_upload) {
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

    // 2. Lista de médicos da Equipe 2 (usada por múltiplos clientes NC)
    const MEDICOS_EQUIPE_2 = [
      'Dr. Antonio Gualberto Chianca Filho', 'Dr. Daniel Chrispim', 'Dr. Efraim Da Silva Ferreira', 
      'Dr. Felipe Falcão de Sá', 'Dr. Guilherme N. Schincariol', 'Dr. Gustavo Andreis', 
      'Dr. João Carlos Dantas do Amaral', 'Dr. João Fernando Miranda Pompermayer', 
      'Dr. Leonardo de Paula Ribeiro Figueiredo', 'Dr. Raphael Sanfelice João', 'Dr. Thiago P. Martins', 
      'Dr. Virgílio Oliveira Barreto', 'Dra. Adriana Giubilei Pimenta', 'Dra. Aline Andrade Dorea', 
      'Dra. Camila Amaral Campos', 'Dra. Cynthia Mendes Vieira de Morais', 'Dra. Fernanda Gama Barbosa', 
      'Dra. Kenia Menezes Fernandes', 'Dra. Lara M. Durante Bacelar', 'Dr. Aguinaldo Cunha Zuppani', 
      'Dr. Alex Gueiros de Barros', 'Dr. Eduardo Caminha Nunes', 'Dr. Márcio D\'Andréa Rossi', 
      'Dr. Rubens Pereira Moura Filho', 'Dr. Wesley Walber da Silva', 'Dra. Luna Azambuja Satte Alam', 
      'Dra. Roberta Bertoldo Sabatini Treml', 'Dra. Thais Nogueira D. Gastaldi', 'Dra. Vanessa da Costa Maldonado'
    ];

    // 3. Lista de clientes NC (sem faturamento por padrão)
    const CLIENTES_NC = [
      "CDICARDIO", "CDIGOIAS", "CISP", "CLIRAM", "CRWANDERLEY", "DIAGMAX-PR", 
      "GOLD", "PRODIMAGEM", "TRANSDUSON", "ZANELLO", "CEMVALENCA", "RMPADUA", "RADI-IMAGEM"
    ];

    // 4. Clientes NC que seguem regra: Cardio OU Plantão
    const CLIENTES_CARDIO_OU_PLANTAO = [
      'CDICARDIO', 'CDIGOIAS', 'CISP', 'CRWANDERLEY', 'DIAGMAX-PR', 'GOLD', 'PRODIMAGEM', 'TRANSDUSON', 'ZANELLO'
    ];

    // 5. Função para determinar tipo de faturamento usando MESMA lógica do demonstrativo
    function determinarTipoFaturamento(
      nomeCliente: string,
      modalidade: string,
      especialidade: string,
      categoria: string,
      prioridade: string,
      medico: string
    ): { tipo_faturamento: TipoFaturamento, tipo_cliente: TipoCliente } {
      const nomeUpper = nomeCliente.toUpperCase();
      const modalidadeUpper = (modalidade || '').toUpperCase();
      const especialidadeUpper = (especialidade || '').toUpperCase();
      const categoriaUpper = (categoria || '').toUpperCase();
      const prioridadeUpper = (prioridade || '').toUpperCase();
      const medicoStr = (medico || '').toString();
      const medicoUpper = medicoStr.toUpperCase();

      // Variáveis auxiliares reutilizáveis
      const isPlantao = prioridadeUpper === 'PLANTÃO' || prioridadeUpper === 'PLANTAO';
      const isMedicinaInterna = especialidadeUpper.includes('MEDICINA INTERNA');
      const isCardio = especialidadeUpper.includes('CARDIO');
      const isNeurobrain = categoriaUpper.includes('NEUROBRAIN');
      const isMamas = especialidadeUpper.includes('MAMA');
      const temMedicoEquipe2 = MEDICOS_EQUIPE_2.some(med => medicoStr.includes(med));
      const isRodrigoVaz = medicoUpper.includes('RODRIGO VAZ') || medicoUpper.includes('RODRIGO VAZ DE LIMA');

      // Verificar se é cliente NC
      const isClienteNC = CLIENTES_NC.some(nc => nomeUpper.includes(nc));
      
      if (!isClienteNC) {
        // Cliente CO: fatura tudo (CO-FT)
        return { tipo_faturamento: 'CO-FT', tipo_cliente: 'CO' };
      }

      // ===== REGRAS ESPECÍFICAS POR CLIENTE NC =====

      // CEDIDIAG: NC-FT = MEDICINA INTERNA (exceto Dr. Rodrigo Vaz de Lima)
      if (nomeUpper === 'CEDIDIAG') {
        if (isRodrigoVaz) {
          return { tipo_faturamento: 'NC-NF', tipo_cliente: 'NC' };
        }
        if (isMedicinaInterna) {
          return { tipo_faturamento: 'NC-FT', tipo_cliente: 'NC' };
        }
        return { tipo_faturamento: 'NC-NF', tipo_cliente: 'NC' };
      }

      // CBU: NC-FT = Plantão OU (CT+MI) OU (MR+MI) (exceto Rodrigo Vaz)
      if (nomeUpper.includes('CBU')) {
        if (isRodrigoVaz) {
          return { tipo_faturamento: 'NC-NF', tipo_cliente: 'NC' };
        }
        if (isPlantao) {
          return { tipo_faturamento: 'NC-FT', tipo_cliente: 'NC' };
        }
        const isCT = modalidadeUpper === 'CT';
        const isMR = modalidadeUpper === 'MR' || modalidadeUpper === 'RM';
        if ((isCT && isMedicinaInterna) || (isMR && isMedicinaInterna)) {
          return { tipo_faturamento: 'NC-FT', tipo_cliente: 'NC' };
        }
        return { tipo_faturamento: 'NC-NF', tipo_cliente: 'NC' };
      }

      // CLIRAM: NC-FT = Cardio E Plantão (ambos)
      if (nomeUpper.includes('CLIRAM')) {
        if (isCardio && isPlantao) {
          return { tipo_faturamento: 'NC-FT', tipo_cliente: 'NC' };
        }
        return { tipo_faturamento: 'NC-NF', tipo_cliente: 'NC' };
      }

      // RADI-IMAGEM: NC-FT = Plantão OU MI OU Equipe2 OU Cardio OU Neurobrain OU Mamas
      if (nomeUpper.includes('RADI-IMAGEM') || nomeUpper.includes('RADI_IMAGEM')) {
        if (isPlantao || isMedicinaInterna || temMedicoEquipe2 || isCardio || isNeurobrain || isMamas) {
          return { tipo_faturamento: 'NC-FT', tipo_cliente: 'NC' };
        }
        return { tipo_faturamento: 'NC-NF', tipo_cliente: 'NC' };
      }

      // RADMED: NC-FT = Plantão OU ((CT/MR) E (MI/MUSCULO/NEURO)) (exceto Rodrigo Vaz)
      if (nomeUpper.includes('RADMED')) {
        if (isRodrigoVaz) {
          return { tipo_faturamento: 'NC-NF', tipo_cliente: 'NC' };
        }
        if (isPlantao) {
          return { tipo_faturamento: 'NC-FT', tipo_cliente: 'NC' };
        }
        const isCTouMR = modalidadeUpper === 'CT' || modalidadeUpper === 'MR' || modalidadeUpper === 'RM';
        const isMusculoEsqueletico = especialidadeUpper.includes('MUSCULO ESQUELETICO');
        const isNeuro = especialidadeUpper.includes('NEURO');
        if (isCTouMR && (isMedicinaInterna || isMusculoEsqueletico || isNeuro)) {
          return { tipo_faturamento: 'NC-FT', tipo_cliente: 'NC' };
        }
        return { tipo_faturamento: 'NC-NF', tipo_cliente: 'NC' };
      }

      // CEMVALENCA_RX: NC-FT = apenas RX
      if (nomeUpper.includes('CEMVALENCA_RX')) {
        if (modalidadeUpper === 'RX') {
          return { tipo_faturamento: 'NC-FT', tipo_cliente: 'NC' };
        }
        return { tipo_faturamento: 'NC-NF', tipo_cliente: 'NC' };
      }

      // CEMVALENCA_PL: NC-FT = apenas PLANTÃO
      if (nomeUpper.includes('CEMVALENCA_PL')) {
        if (isPlantao) {
          return { tipo_faturamento: 'NC-FT', tipo_cliente: 'NC' };
        }
        return { tipo_faturamento: 'NC-NF', tipo_cliente: 'NC' };
      }

      // CEMVALENCA: NC-FT = Plantão OU MI OU Equipe2 OU Cardio OU Neurobrain OU MAMA
      if (nomeUpper.includes('CEMVALENCA') && !nomeUpper.includes('CEMVALENCA_RX') && !nomeUpper.includes('CEMVALENCA_PL')) {
        if (isPlantao || isMedicinaInterna || isCardio || isMamas || isNeurobrain || temMedicoEquipe2) {
          return { tipo_faturamento: 'NC-FT', tipo_cliente: 'NC' };
        }
        return { tipo_faturamento: 'NC-NF', tipo_cliente: 'NC' };
      }

      // RMPADUA: NC-FT = Plantão OU MI OU Equipe2 OU Cardio OU Neurobrain
      if (nomeUpper.includes('RMPADUA')) {
        if (isPlantao || isMedicinaInterna || isCardio || isNeurobrain || temMedicoEquipe2) {
          return { tipo_faturamento: 'NC-FT', tipo_cliente: 'NC' };
        }
        return { tipo_faturamento: 'NC-NF', tipo_cliente: 'NC' };
      }

      // Outros clientes NC: Cardio OU Plantão
      const isCardioOuPlantao = CLIENTES_CARDIO_OU_PLANTAO.some(nc => nomeUpper.includes(nc));
      if (isCardioOuPlantao) {
        if (isCardio || isPlantao) {
          return { tipo_faturamento: 'NC-FT', tipo_cliente: 'NC' };
        }
        return { tipo_faturamento: 'NC-NF', tipo_cliente: 'NC' };
      }

      // Qualquer outro cliente NC sem regra específica: NC-NF
      return { tipo_faturamento: 'NC-NF', tipo_cliente: 'NC' };
    }

    // 5. Calcular tipificação para todos os registros primeiro
    console.log(`📊 Calculando tipificação para ${registros.length} registros...`);
    
    const updates = registros.map(registro => {
      const { tipo_faturamento, tipo_cliente } = determinarTipoFaturamento(
        registro.EMPRESA || '',
        registro.MODALIDADE || '',
        registro.ESPECIALIDADE || '',
        registro.CATEGORIA || '',
        registro.PRIORIDADE || '',
        registro.MEDICO || ''
      );

      return {
        id: registro.id,
        tipo_faturamento,
        tipo_cliente
      };
    });

    console.log(`✅ Tipificação calculada. Iniciando atualização em massa...`);

    // 6. Processar updates em batches maiores (1000 por vez) usando upsert
    // 6. Processar updates em batches agrupando por tipo para reduzir chamadas
    const BATCH_SIZE = 1000;
    let registrosProcessados = 0;
    let registrosAtualizados = 0;
    let erros = 0;

    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(updates.length / BATCH_SIZE);

      console.log(`🔄 Atualizando batch ${batchNum}/${totalBatches} - ${batch.length} registros`);

      // Agrupar por par (tipo_faturamento, tipo_cliente) para atualizar em massa
      const grupos = batch.reduce((acc, u) => {
        const key = `${u.tipo_faturamento}|${u.tipo_cliente}`;
        if (!acc[key]) {
          acc[key] = {
            tipo_faturamento: u.tipo_faturamento as TipoFaturamento,
            tipo_cliente: u.tipo_cliente as TipoCliente,
            ids: [] as string[],
          };
        }
        acc[key].ids.push(u.id);
        return acc;
      }, {} as Record<string, { tipo_faturamento: TipoFaturamento; tipo_cliente: TipoCliente; ids: string[] }>);

      try {
        const gruposArray = Object.values(grupos);

        // Processar cada grupo sequencialmente para evitar problemas de concorrência
        for (const g of gruposArray) {
          if (!g.ids.length) continue;

          // Sub-dividir grupos grandes em chunks menores (200 IDs por vez)
          const chunkSize = 200;
          for (let j = 0; j < g.ids.length; j += chunkSize) {
            const idsChunk = g.ids.slice(j, j + chunkSize);
            
            const { error, count } = await supabaseClient
              .from('volumetria_mobilemed')
              .update({
                tipo_faturamento: g.tipo_faturamento,
                tipo_cliente: g.tipo_cliente,
              })
              .in('id', idsChunk);

            if (error) {
              console.error(`❌ Erro ao atualizar grupo ${g.tipo_faturamento}/${g.tipo_cliente} (${idsChunk.length} IDs):`, error);
              erros += idsChunk.length;
            } else {
              const updated = count ?? idsChunk.length;
              registrosAtualizados += updated;
              console.log(`✅ Atualizado: ${updated} registros do grupo ${g.tipo_faturamento}/${g.tipo_cliente}`);
            }
          }
        }

        registrosProcessados += batch.length;
        console.log(`✅ Batch ${batchNum} concluído. Total atualizado: ${registrosAtualizados}`);
      } catch (error) {
        console.error(`❌ Exceção no batch ${batchNum}:`, error);
        erros += batch.length;
      }
    }

    console.log(`📊 Processamento concluído: ${registrosAtualizados} atualizados, ${erros} erros`);

    // 7. Estatísticas finais
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
      registros_erro: erros,
      estatisticas_tipos: estatisticas,
      regras_aplicadas: [
        'Tipificação baseada nas MESMAS REGRAS usadas no demonstrativo de faturamento',
        'tipo_cliente: CO (cliente do tipo CO) / NC (Cliente do tipo NC)',
        'tipo_faturamento: CO-FT (CO com faturamento) / NC-FT (NC faturado) / NC-NF (NC não faturado)',
        'Regras específicas por cliente NC implementadas'
      ],
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