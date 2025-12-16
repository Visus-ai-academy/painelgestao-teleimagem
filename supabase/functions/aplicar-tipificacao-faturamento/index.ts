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

    // TIPOS VÁLIDOS DE FATURAMENTO (para validação)
    const TIPOS_VALIDOS_FATURAMENTO = ['CO-FT', 'CO-NF', 'NC-FT', 'NC-NF', 'NC1-NF'];

    // 1. LIMPAR TODA A TIPIFICAÇÃO DO PERÍODO para retipificar do zero
    if (periodo_referencia) {
      console.log(`🧹 LIMPANDO TODA tipificação do período ${periodo_referencia} para retipificar do zero...`);
      const { error: clearAllError, count: clearCount } = await supabaseClient
        .from('volumetria_mobilemed')
        .update({ tipo_faturamento: null, tipo_cliente: null })
        .eq('periodo_referencia', periodo_referencia);

      if (clearAllError) {
        console.error('❌ Erro ao limpar tipificação:', clearAllError);
      } else {
        console.log(`✅ Limpa tipificação de ${clearCount || 0} registros do período ${periodo_referencia}`);
      }
    }

    // 2. Buscar TODOS os registros do período (já foram limpos acima)
    let query = supabaseClient
      .from('volumetria_mobilemed')
      .select('id, "EMPRESA", "MODALIDADE", "ESPECIALIDADE", "CATEGORIA", "PRIORIDADE", "MEDICO"');

    // Aplicar filtros conforme parâmetros
    if (periodo_referencia) {
      // Todos registros do período (já limpos, então todos têm tipo_faturamento = NULL)
      query = query.eq('periodo_referencia', periodo_referencia);
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

    // 2. Buscar parâmetros de todos os clientes para obter tipo_cliente e tipo_faturamento configurados
    console.log('🔍 Buscando parâmetros de clientes...');
    const { data: parametros, error: parametrosError } = await supabaseClient
      .from('parametros_faturamento')
      .select('nome_fantasia, tipo_cliente, tipo_faturamento');

    if (parametrosError) {
      console.error('❌ Erro ao buscar parâmetros:', parametrosError);
      throw parametrosError;
    }

    // Criar mapa de parâmetros por nome de cliente (normalizado)
    const parametrosMap = new Map<string, { tipo_cliente: TipoCliente, tipo_faturamento?: TipoFaturamento }>();
    if (parametros) {
      parametros.forEach(p => {
        if (p.nome_fantasia && p.tipo_cliente) {
          const nomeNormalizado = p.nome_fantasia.toUpperCase().trim();
          parametrosMap.set(nomeNormalizado, {
            tipo_cliente: p.tipo_cliente as TipoCliente,
            tipo_faturamento: p.tipo_faturamento as TipoFaturamento | undefined
          });
        }
      });
      console.log(`✅ ${parametrosMap.size} parâmetros de clientes carregados`);
    }

    // 3. Lista de médicos da Equipe 2 (usada por múltiplos clientes NC)
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
      "CBU", "CDICARDIO", "CDIGOIAS", "CICOMANGRA", "CISP", "CLIRAM", "CRWANDERLEY", "DIAGMAX-PR", 
      "GOLD", "PRODIMAGEM", "RADMED", "TRANSDUSON", "ZANELLO", "CEMVALENCA", "RMPADUA", "RADI-IMAGEM"
    ];

    // 4. Clientes NC que seguem regra: Cardio OU Plantão
    const CLIENTES_CARDIO_OU_PLANTAO = [
      'CDICARDIO', 'CDIGOIAS', 'CISP', 'CRWANDERLEY', 'DIAGMAX-PR', 'GOLD', 'PRODIMAGEM', 'TRANSDUSON', 'ZANELLO'
    ];

    // Set para rastrear clientes sem cadastro (para gerar alertas)
    const clientesSemCadastro = new Set<string>();

    // 5. Função para determinar tipo de faturamento
    // NOVA LÓGICA: NÃO tipifica clientes sem cadastro em parametros_faturamento
    function determinarTipoFaturamento(
      nomeCliente: string,
      modalidade: string,
      especialidade: string,
      categoria: string,
      prioridade: string,
      medico: string,
      parametrosMap: Map<string, { tipo_cliente: TipoCliente, tipo_faturamento?: TipoFaturamento }>
    ): { tipo_faturamento: TipoFaturamento | null, tipo_cliente: TipoCliente | null, semCadastro: boolean } {
      const nomeUpper = nomeCliente.toUpperCase().trim();
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

      // PASSO 1: Buscar tipo_cliente e tipo_faturamento dos parâmetros configurados
      let tipo_cliente: TipoCliente | null = null;
      let tipo_faturamento_param: TipoFaturamento | undefined = undefined;
      let encontradoNoParametros = false;
      
      // Tentar buscar parâmetros (busca exata e parcial)
      if (parametrosMap.has(nomeUpper)) {
        const params = parametrosMap.get(nomeUpper)!;
        tipo_cliente = params.tipo_cliente;
        tipo_faturamento_param = params.tipo_faturamento;
        encontradoNoParametros = true;
      } else {
        // Tentar match parcial (cliente pode estar nos parâmetros com nome levemente diferente)
        for (const [clienteParam, params] of parametrosMap.entries()) {
          if (nomeUpper.includes(clienteParam) || clienteParam.includes(nomeUpper)) {
            tipo_cliente = params.tipo_cliente;
            tipo_faturamento_param = params.tipo_faturamento;
            encontradoNoParametros = true;
            break;
          }
        }
      }

      // CRÍTICO: Se cliente NÃO foi encontrado nos parâmetros, NÃO tipificar
      // Deixar tipo_faturamento = NULL e registrar para alerta
      if (!encontradoNoParametros) {
        clientesSemCadastro.add(nomeCliente);
        return { tipo_faturamento: null, tipo_cliente: null, semCadastro: true };
      }

      // PASSO 2: Para clientes CO, usar tipo_faturamento dos parâmetros (CO-FT ou CO-NF)
      if (tipo_cliente === 'CO') {
        // Usar tipo_faturamento configurado nos parâmetros
        const tipoFat = tipo_faturamento_param || 'CO-FT';
        return { tipo_faturamento: tipoFat as TipoFaturamento, tipo_cliente: 'CO', semCadastro: false };
      }

      // PASSO 3: Para clientes NC e NC1, aplicar regras específicas para determinar FT ou NF
      const isClienteNC = CLIENTES_NC.some(nc => nomeUpper.includes(nc));

      // ===== REGRAS ESPECÍFICAS POR CLIENTE NC/NC1 PARA DETERMINAR FT OU NF =====
      // Agora o tipo_cliente já vem dos parâmetros, só determinar o sufixo -FT ou -NF

      // CEDIDIAG: FT = MEDICINA INTERNA (exceto Dr. Rodrigo Vaz de Lima)
      if (nomeUpper === 'CEDIDIAG') {
        if (isRodrigoVaz) {
          return { tipo_faturamento: `${tipo_cliente}-NF` as TipoFaturamento, tipo_cliente, semCadastro: false };
        }
        if (isMedicinaInterna) {
          return { tipo_faturamento: `${tipo_cliente}-FT` as TipoFaturamento, tipo_cliente, semCadastro: false };
        }
        return { tipo_faturamento: `${tipo_cliente}-NF` as TipoFaturamento, tipo_cliente, semCadastro: false };
      }

      // CBU: FT = Plantão OU (CT+MI) OU (MR+MI) (exceto Rodrigo Vaz)
      if (nomeUpper.includes('CBU')) {
        if (isRodrigoVaz) {
          return { tipo_faturamento: `${tipo_cliente}-NF` as TipoFaturamento, tipo_cliente, semCadastro: false };
        }
        if (isPlantao) {
          return { tipo_faturamento: `${tipo_cliente}-FT` as TipoFaturamento, tipo_cliente, semCadastro: false };
        }
        const isCT = modalidadeUpper === 'CT';
        const isMR = modalidadeUpper === 'MR' || modalidadeUpper === 'RM';
        if ((isCT && isMedicinaInterna) || (isMR && isMedicinaInterna)) {
          return { tipo_faturamento: `${tipo_cliente}-FT` as TipoFaturamento, tipo_cliente, semCadastro: false };
        }
        return { tipo_faturamento: `${tipo_cliente}-NF` as TipoFaturamento, tipo_cliente, semCadastro: false };
      }

      // CLIRAM: FT = Cardio E Plantão (ambos)
      if (nomeUpper.includes('CLIRAM')) {
        if (isCardio && isPlantao) {
          return { tipo_faturamento: `${tipo_cliente}-FT` as TipoFaturamento, tipo_cliente, semCadastro: false };
        }
        return { tipo_faturamento: `${tipo_cliente}-NF` as TipoFaturamento, tipo_cliente, semCadastro: false };
      }

      // RADI-IMAGEM: FT = Plantão OU MI OU Equipe2 OU Cardio OU Neurobrain OU Mamas
      if (nomeUpper.includes('RADI-IMAGEM') || nomeUpper.includes('RADI_IMAGEM')) {
        if (isPlantao || isMedicinaInterna || temMedicoEquipe2 || isCardio || isNeurobrain || isMamas) {
          return { tipo_faturamento: `${tipo_cliente}-FT` as TipoFaturamento, tipo_cliente, semCadastro: false };
        }
        return { tipo_faturamento: `${tipo_cliente}-NF` as TipoFaturamento, tipo_cliente, semCadastro: false };
      }

      // RADMED: FT = Plantão OU MI OU Cardio OU Neurobrain OU Equipe2 (exceto Rodrigo Vaz)
      if (nomeUpper.includes('RADMED')) {
        if (isRodrigoVaz) {
          return { tipo_faturamento: `${tipo_cliente}-NF` as TipoFaturamento, tipo_cliente, semCadastro: false };
        }
        if (isPlantao || isMedicinaInterna || isCardio || isNeurobrain || temMedicoEquipe2) {
          return { tipo_faturamento: `${tipo_cliente}-FT` as TipoFaturamento, tipo_cliente, semCadastro: false };
        }
        return { tipo_faturamento: `${tipo_cliente}-NF` as TipoFaturamento, tipo_cliente, semCadastro: false };
      }

      // CEMVALENCA_RX: FT = apenas RX
      if (nomeUpper.includes('CEMVALENCA_RX')) {
        if (modalidadeUpper === 'RX') {
          return { tipo_faturamento: `${tipo_cliente}-FT` as TipoFaturamento, tipo_cliente, semCadastro: false };
        }
        return { tipo_faturamento: `${tipo_cliente}-NF` as TipoFaturamento, tipo_cliente, semCadastro: false };
      }

      // CEMVALENCA_PL: FT = apenas PLANTÃO
      if (nomeUpper.includes('CEMVALENCA_PL')) {
        if (isPlantao) {
          return { tipo_faturamento: `${tipo_cliente}-FT` as TipoFaturamento, tipo_cliente, semCadastro: false };
        }
        return { tipo_faturamento: `${tipo_cliente}-NF` as TipoFaturamento, tipo_cliente, semCadastro: false };
      }

      // CEMVALENCA: FT = MI OU Cardio OU Neurobrain OU Equipe2 (Plantão vai para CEMVALENCA_PL, MAMA não fatura)
      if (nomeUpper.includes('CEMVALENCA') && !nomeUpper.includes('CEMVALENCA_RX') && !nomeUpper.includes('CEMVALENCA_PL')) {
        if (isMedicinaInterna || isCardio || isNeurobrain || temMedicoEquipe2) {
          return { tipo_faturamento: `${tipo_cliente}-FT` as TipoFaturamento, tipo_cliente, semCadastro: false };
        }
        return { tipo_faturamento: `${tipo_cliente}-NF` as TipoFaturamento, tipo_cliente, semCadastro: false };
      }

      // RMPADUA: FT = Plantão OU MI OU Equipe2 OU Cardio OU Neurobrain
      if (nomeUpper.includes('RMPADUA')) {
        if (isPlantao || isMedicinaInterna || isCardio || isNeurobrain || temMedicoEquipe2) {
          return { tipo_faturamento: `${tipo_cliente}-FT` as TipoFaturamento, tipo_cliente, semCadastro: false };
        }
        return { tipo_faturamento: `${tipo_cliente}-NF` as TipoFaturamento, tipo_cliente, semCadastro: false };
      }

      // Outros clientes NC: Cardio OU Plantão
      const isCardioOuPlantao = CLIENTES_CARDIO_OU_PLANTAO.some(nc => nomeUpper.includes(nc));
      if (isCardioOuPlantao) {
        if (isCardio || isPlantao) {
          return { tipo_faturamento: `${tipo_cliente}-FT` as TipoFaturamento, tipo_cliente, semCadastro: false };
        }
        return { tipo_faturamento: `${tipo_cliente}-NF` as TipoFaturamento, tipo_cliente, semCadastro: false };
      }

      // Qualquer outro cliente NC/NC1 sem regra específica:
      // Se tem tipo_faturamento configurado nos parâmetros, usar esse
      if (tipo_faturamento_param) {
        // Se for NC-FT ou NC1-FT nos parâmetros, mas chegou aqui sem passar por regras específicas,
        // significa que não tem regras hardcoded, então aplicar o tipo dos parâmetros
        return { tipo_faturamento: tipo_faturamento_param, tipo_cliente, semCadastro: false };
      }
      // Se não tem tipo_faturamento nos parâmetros, usar padrão NF
      return { tipo_faturamento: `${tipo_cliente}-NF` as TipoFaturamento, tipo_cliente, semCadastro: false };
    }

    // 6. Calcular tipificação para todos os registros primeiro
    console.log(`📊 Calculando tipificação para ${registros.length} registros...`);
    
    const allResults = registros.map(registro => {
      const resultado = determinarTipoFaturamento(
        registro.EMPRESA || '',
        registro.MODALIDADE || '',
        registro.ESPECIALIDADE || '',
        registro.CATEGORIA || '',
        registro.PRIORIDADE || '',
        registro.MEDICO || '',
        parametrosMap
      );

      return {
        id: registro.id,
        empresa: registro.EMPRESA || '',
        tipo_faturamento: resultado.tipo_faturamento,
        tipo_cliente: resultado.tipo_cliente,
        semCadastro: resultado.semCadastro
      };
    });

    // Filtrar apenas registros que têm cadastro (tipo_faturamento não é null)
    const updates = allResults.filter(r => !r.semCadastro && r.tipo_faturamento !== null);
    const registrosSemCadastro = allResults.filter(r => r.semCadastro);

    console.log(`✅ Tipificação calculada:`);
    console.log(`   - ${updates.length} registros COM cadastro serão tipificados`);
    console.log(`   - ${registrosSemCadastro.length} registros SEM cadastro (tipo_faturamento = NULL)`);
    
    if (clientesSemCadastro.size > 0) {
      console.warn(`⚠️ ALERTA: ${clientesSemCadastro.size} clientes na volumetria SEM CADASTRO em parametros_faturamento:`);
      Array.from(clientesSemCadastro).forEach(cliente => {
        console.warn(`   - ${cliente}`);
      });
    }

    console.log(`✅ Iniciando atualização em massa para ${updates.length} registros...`);

    // 7. Processar updates em batches agrupando por tipo para reduzir chamadas
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

    // 8. Estatísticas finais do período (se especificado)
    let estatisticas = {};
    if (periodo_referencia) {
      const { data: stats, error: statsError } = await supabaseClient
        .from('volumetria_mobilemed')
        .select('tipo_faturamento')
        .eq('periodo_referencia', periodo_referencia)
        .not('tipo_faturamento', 'is', null);

      if (!statsError && stats) {
        const contadores = stats.reduce((acc: any, record: any) => {
          acc[record.tipo_faturamento] = (acc[record.tipo_faturamento] || 0) + 1;
          return acc;
        }, {});
        estatisticas = contadores;
      }
    }

    // Preparar lista de clientes sem cadastro para alerta
    const alertaClientesSemCadastro = Array.from(clientesSemCadastro).map(cliente => {
      const registrosCliente = registrosSemCadastro.filter(r => r.empresa === cliente);
      return {
        cliente,
        registros: registrosCliente.length
      };
    }).sort((a, b) => b.registros - a.registros);

    const resultado = {
      sucesso: true,
      registros_encontrados: registros.length,
      registros_processados: registrosProcessados,
      registros_atualizados: registrosAtualizados,
      registros_erro: erros,
      registros_sem_cadastro: registrosSemCadastro.length,
      breakdown_tipos: estatisticas,
      tipos_validos: TIPOS_VALIDOS_FATURAMENTO,
      // ALERTA: Clientes na volumetria SEM cadastro em parametros_faturamento
      alerta_clientes_sem_cadastro: alertaClientesSemCadastro.length > 0 ? {
        mensagem: `${alertaClientesSemCadastro.length} cliente(s) na volumetria NÃO possuem cadastro em parametros_faturamento. Seus exames não foram tipificados.`,
        clientes: alertaClientesSemCadastro
      } : null,
      regras_aplicadas: [
        'TIPOS VÁLIDOS: CO-FT (CO faturado), CO-NF (CO não faturado), NC-FT (NC faturado), NC-NF (NC não faturado), NC1-NF (NC1 não faturado)',
        'TIPOS DE CLIENTE: CO (Consolidado), NC (Não Consolidado), NC1 (Não Consolidado tipo 1)',
        'Clientes NC: CBU, CDICARDIO, CDIGOIAS, CICOMANGRA, CISP, CLIRAM, CRWANDERLEY, DIAGMAX-PR, GOLD, PRODIMAGEM, RADMED, TRANSDUSON, ZANELLO, CEMVALENCA, RMPADUA, RADI-IMAGEM',
        'Tipos inválidos foram automaticamente limpos e reprocessados',
        'CLIENTES SEM CADASTRO: Não são tipificados (tipo_faturamento permanece NULL)'
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