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
    
    // Clientes que precisam ser forçadamente retipificados (override)
    const CLIENTES_FORCAR_RETIPIFICACAO = ['RADI-IMAGEM'];
    
    // 1. Primeiro: Limpar tipos inválidos se houver período especificado
    if (periodo_referencia) {
      console.log('🧹 Verificando e limpando tipos de faturamento inválidos...');
      
      const { data: registrosInvalidos, error: checkError } = await supabaseClient
        .from('volumetria_mobilemed')
        .select('tipo_faturamento, COUNT(*)', { count: 'exact' })
        .eq('periodo_referencia', periodo_referencia)
        .not('tipo_faturamento', 'is', null)
        .not('tipo_faturamento', 'in', `(${TIPOS_VALIDOS_FATURAMENTO.join(',')})`);

      if (checkError) {
        console.error('❌ Erro ao verificar tipos inválidos:', checkError);
      } else if (registrosInvalidos && registrosInvalidos.length > 0) {
        console.log(`⚠️ Encontrados tipos inválidos que serão limpos:`, registrosInvalidos);
        
        // Limpar tipos inválidos (definir como NULL)
        const { error: cleanError } = await supabaseClient
          .from('volumetria_mobilemed')
          .update({ tipo_faturamento: null, tipo_cliente: null })
          .eq('periodo_referencia', periodo_referencia)
          .not('tipo_faturamento', 'in', `(${TIPOS_VALIDOS_FATURAMENTO.join(',')})`);

        if (cleanError) {
          console.error('❌ Erro ao limpar tipos inválidos:', cleanError);
        } else {
          console.log('✅ Tipos inválidos limpos com sucesso');
        }
      }
      
      // Forçar retipificação de clientes específicos que foram tipificados incorretamente
      for (const cliente of CLIENTES_FORCAR_RETIPIFICACAO) {
        console.log(`🔄 Forçando retipificação de ${cliente}...`);
        const { error: forceError, count } = await supabaseClient
          .from('volumetria_mobilemed')
          .update({ tipo_faturamento: null, tipo_cliente: null })
          .eq('periodo_referencia', periodo_referencia)
          .eq('EMPRESA', cliente);
        
        if (forceError) {
          console.error(`❌ Erro ao forçar retipificação de ${cliente}:`, forceError);
        } else {
          console.log(`✅ ${count || 0} registros de ${cliente} marcados para retipificação`);
        }
      }
    }

    // 2. Buscar registros que precisam de tipificação
    let query = supabaseClient
      .from('volumetria_mobilemed')
      .select('id, "EMPRESA", "MODALIDADE", "ESPECIALIDADE", "CATEGORIA", "PRIORIDADE", "MEDICO"');

    // Aplicar filtros conforme parâmetros
    if (periodo_referencia) {
      // Filtrar por período e apenas registros sem tipo de faturamento válido
      query = query.eq('periodo_referencia', periodo_referencia)
        .or(`tipo_faturamento.is.null,tipo_faturamento.not.in.(${TIPOS_VALIDOS_FATURAMENTO.join(',')})`);
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
      .select('cliente_nome, tipo_cliente, tipo_faturamento');

    if (parametrosError) {
      console.error('❌ Erro ao buscar parâmetros:', parametrosError);
      throw parametrosError;
    }

    // Criar mapa de parâmetros por nome de cliente (normalizado)
    const parametrosMap = new Map<string, { tipo_cliente: TipoCliente, tipo_faturamento?: TipoFaturamento }>();
    if (parametros) {
      parametros.forEach(p => {
        if (p.cliente_nome && p.tipo_cliente) {
          const nomeNormalizado = p.cliente_nome.toUpperCase().trim();
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

    // 5. Função para determinar tipo de faturamento
    // NOVA LÓGICA: Busca tipo_cliente dos parâmetros, depois aplica regras específicas para FT/NF
    function determinarTipoFaturamento(
      nomeCliente: string,
      modalidade: string,
      especialidade: string,
      categoria: string,
      prioridade: string,
      medico: string,
      parametrosMap: Map<string, { tipo_cliente: TipoCliente, tipo_faturamento?: TipoFaturamento }>
    ): { tipo_faturamento: TipoFaturamento, tipo_cliente: TipoCliente } {
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
      let tipo_cliente: TipoCliente = 'CO'; // Default
      let tipo_faturamento_param: TipoFaturamento | undefined = undefined;
      
      // Tentar buscar parâmetros (busca exata e parcial)
      if (parametrosMap.has(nomeUpper)) {
        const params = parametrosMap.get(nomeUpper)!;
        tipo_cliente = params.tipo_cliente;
        tipo_faturamento_param = params.tipo_faturamento;
      } else {
        // Tentar match parcial (cliente pode estar nos parâmetros com nome levemente diferente)
        for (const [clienteParam, params] of parametrosMap.entries()) {
          if (nomeUpper.includes(clienteParam) || clienteParam.includes(nomeUpper)) {
            tipo_cliente = params.tipo_cliente;
            tipo_faturamento_param = params.tipo_faturamento;
            break;
          }
        }
      }

      // PASSO 2: Para clientes CO, usar tipo_faturamento dos parâmetros (CO-FT ou CO-NF)
      if (tipo_cliente === 'CO') {
        // Usar tipo_faturamento configurado nos parâmetros, ou CO-FT como padrão
        const tipoFat = tipo_faturamento_param || 'CO-FT';
        return { tipo_faturamento: tipoFat as TipoFaturamento, tipo_cliente: 'CO' };
      }

      // PASSO 3: Para clientes NC e NC1, aplicar regras específicas para determinar FT ou NF
      const isClienteNC = CLIENTES_NC.some(nc => nomeUpper.includes(nc));
      
      if (!isClienteNC && tipo_cliente !== 'NC' && tipo_cliente !== 'NC1') {
        // Se não está na lista NC e não está configurado como NC/NC1, é CO
        return { tipo_faturamento: 'CO-FT', tipo_cliente: 'CO' };
      }

      // ===== REGRAS ESPECÍFICAS POR CLIENTE NC/NC1 PARA DETERMINAR FT OU NF =====
      // Agora o tipo_cliente já vem dos parâmetros, só determinar o sufixo -FT ou -NF

      // CEDIDIAG: FT = MEDICINA INTERNA (exceto Dr. Rodrigo Vaz de Lima)
      if (nomeUpper === 'CEDIDIAG') {
        if (isRodrigoVaz) {
          return { tipo_faturamento: `${tipo_cliente}-NF` as TipoFaturamento, tipo_cliente };
        }
        if (isMedicinaInterna) {
          return { tipo_faturamento: `${tipo_cliente}-FT` as TipoFaturamento, tipo_cliente };
        }
        return { tipo_faturamento: `${tipo_cliente}-NF` as TipoFaturamento, tipo_cliente };
      }

      // CBU: FT = Plantão OU (CT+MI) OU (MR+MI) (exceto Rodrigo Vaz)
      if (nomeUpper.includes('CBU')) {
        if (isRodrigoVaz) {
          return { tipo_faturamento: `${tipo_cliente}-NF` as TipoFaturamento, tipo_cliente };
        }
        if (isPlantao) {
          return { tipo_faturamento: `${tipo_cliente}-FT` as TipoFaturamento, tipo_cliente };
        }
        const isCT = modalidadeUpper === 'CT';
        const isMR = modalidadeUpper === 'MR' || modalidadeUpper === 'RM';
        if ((isCT && isMedicinaInterna) || (isMR && isMedicinaInterna)) {
          return { tipo_faturamento: `${tipo_cliente}-FT` as TipoFaturamento, tipo_cliente };
        }
        return { tipo_faturamento: `${tipo_cliente}-NF` as TipoFaturamento, tipo_cliente };
      }

      // CLIRAM: FT = Cardio E Plantão (ambos)
      if (nomeUpper.includes('CLIRAM')) {
        if (isCardio && isPlantao) {
          return { tipo_faturamento: `${tipo_cliente}-FT` as TipoFaturamento, tipo_cliente };
        }
        return { tipo_faturamento: `${tipo_cliente}-NF` as TipoFaturamento, tipo_cliente };
      }

      // RADI-IMAGEM: FT = Plantão OU MI OU Equipe2 OU Cardio OU Neurobrain OU Mamas
      if (nomeUpper.includes('RADI-IMAGEM') || nomeUpper.includes('RADI_IMAGEM')) {
        if (isPlantao || isMedicinaInterna || temMedicoEquipe2 || isCardio || isNeurobrain || isMamas) {
          return { tipo_faturamento: `${tipo_cliente}-FT` as TipoFaturamento, tipo_cliente };
        }
        return { tipo_faturamento: `${tipo_cliente}-NF` as TipoFaturamento, tipo_cliente };
      }

      // RADMED: FT = Plantão OU ((CT/MR) E (MI/MUSCULO/NEURO)) (exceto Rodrigo Vaz)
      if (nomeUpper.includes('RADMED')) {
        if (isRodrigoVaz) {
          return { tipo_faturamento: `${tipo_cliente}-NF` as TipoFaturamento, tipo_cliente };
        }
        if (isPlantao) {
          return { tipo_faturamento: `${tipo_cliente}-FT` as TipoFaturamento, tipo_cliente };
        }
        const isCTouMR = modalidadeUpper === 'CT' || modalidadeUpper === 'MR' || modalidadeUpper === 'RM';
        const isMusculoEsqueletico = especialidadeUpper.includes('MUSCULO ESQUELETICO');
        const isNeuro = especialidadeUpper.includes('NEURO');
        if (isCTouMR && (isMedicinaInterna || isMusculoEsqueletico || isNeuro)) {
          return { tipo_faturamento: `${tipo_cliente}-FT` as TipoFaturamento, tipo_cliente };
        }
        return { tipo_faturamento: `${tipo_cliente}-NF` as TipoFaturamento, tipo_cliente };
      }

      // CEMVALENCA_RX: FT = apenas RX
      if (nomeUpper.includes('CEMVALENCA_RX')) {
        if (modalidadeUpper === 'RX') {
          return { tipo_faturamento: `${tipo_cliente}-FT` as TipoFaturamento, tipo_cliente };
        }
        return { tipo_faturamento: `${tipo_cliente}-NF` as TipoFaturamento, tipo_cliente };
      }

      // CEMVALENCA_PL: FT = apenas PLANTÃO
      if (nomeUpper.includes('CEMVALENCA_PL')) {
        if (isPlantao) {
          return { tipo_faturamento: `${tipo_cliente}-FT` as TipoFaturamento, tipo_cliente };
        }
        return { tipo_faturamento: `${tipo_cliente}-NF` as TipoFaturamento, tipo_cliente };
      }

      // CEMVALENCA: FT = Plantão OU MI OU Equipe2 OU Cardio OU Neurobrain OU MAMA
      if (nomeUpper.includes('CEMVALENCA') && !nomeUpper.includes('CEMVALENCA_RX') && !nomeUpper.includes('CEMVALENCA_PL')) {
        if (isPlantao || isMedicinaInterna || isCardio || isMamas || isNeurobrain || temMedicoEquipe2) {
          return { tipo_faturamento: `${tipo_cliente}-FT` as TipoFaturamento, tipo_cliente };
        }
        return { tipo_faturamento: `${tipo_cliente}-NF` as TipoFaturamento, tipo_cliente };
      }

      // RMPADUA: FT = Plantão OU MI OU Equipe2 OU Cardio OU Neurobrain
      if (nomeUpper.includes('RMPADUA')) {
        if (isPlantao || isMedicinaInterna || isCardio || isNeurobrain || temMedicoEquipe2) {
          return { tipo_faturamento: `${tipo_cliente}-FT` as TipoFaturamento, tipo_cliente };
        }
        return { tipo_faturamento: `${tipo_cliente}-NF` as TipoFaturamento, tipo_cliente };
      }

      // Outros clientes NC: Cardio OU Plantão
      const isCardioOuPlantao = CLIENTES_CARDIO_OU_PLANTAO.some(nc => nomeUpper.includes(nc));
      if (isCardioOuPlantao) {
        if (isCardio || isPlantao) {
          return { tipo_faturamento: `${tipo_cliente}-FT` as TipoFaturamento, tipo_cliente };
        }
        return { tipo_faturamento: `${tipo_cliente}-NF` as TipoFaturamento, tipo_cliente };
      }

      // Qualquer outro cliente NC/NC1 sem regra específica:
      // Se tem tipo_faturamento configurado nos parâmetros, usar esse
      if (tipo_faturamento_param) {
        // Se for NC-FT ou NC1-FT nos parâmetros, mas chegou aqui sem passar por regras específicas,
        // significa que não tem regras hardcoded, então aplicar o tipo dos parâmetros
        return { tipo_faturamento: tipo_faturamento_param, tipo_cliente };
      }
      // Se não tem tipo_faturamento nos parâmetros, usar padrão NF
      return { tipo_faturamento: `${tipo_cliente}-NF` as TipoFaturamento, tipo_cliente };
    }

    // 6. Calcular tipificação para todos os registros primeiro
    console.log(`📊 Calculando tipificação para ${registros.length} registros...`);
    
    const updates = registros.map(registro => {
      const { tipo_faturamento, tipo_cliente } = determinarTipoFaturamento(
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
        tipo_faturamento,
        tipo_cliente
      };
    });

    console.log(`✅ Tipificação calculada. Iniciando atualização em massa...`);

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

    const resultado = {
      sucesso: true,
      registros_encontrados: registros.length,
      registros_processados: registrosProcessados,
      registros_atualizados: registrosAtualizados,
      registros_erro: erros,
      breakdown_tipos: estatisticas,
      tipos_validos: TIPOS_VALIDOS_FATURAMENTO,
      regras_aplicadas: [
        'TIPOS VÁLIDOS: CO-FT (CO faturado), CO-NF (CO não faturado), NC-FT (NC faturado), NC-NF (NC não faturado), NC1-NF (NC1 não faturado)',
        'TIPOS DE CLIENTE: CO (Consolidado), NC (Não Consolidado), NC1 (Não Consolidado tipo 1)',
        'Clientes NC: CBU, CDICARDIO, CDIGOIAS, CICOMANGRA, CISP, CLIRAM, CRWANDERLEY, DIAGMAX-PR, GOLD, PRODIMAGEM, RADMED, TRANSDUSON, ZANELLO, CEMVALENCA, RMPADUA, RADI-IMAGEM',
        'Tipos inválidos foram automaticamente limpos e reprocessados'
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