// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import { corsHeaders } from "../_shared/cors.ts";

interface DemonstrativoCliente {
  cliente_id: string;
  cliente_nome: string;
  periodo: string;
  total_exames: number;
  valor_exames: number;
  valor_franquia: number;
  valor_portal_laudos: number;
  valor_integracao: number;
  valor_bruto: number;
  valor_impostos: number;
  valor_total: number;
  detalhes_franquia: any;
  detalhes_exames: any[];
  detalhes_tributacao: any;
  tipo_faturamento?: string;
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

    const { periodo, clientes: clientesFiltro } = await req.json();
    
    if (!periodo) {
      throw new Error('Período é obrigatório');
    }

    // Buscar clientes ativos
    let clientesQuery = supabase
      .from('clientes')
      .select(`
        id,
        nome,
        nome_fantasia,
        nome_mobilemed,
        ativo,
        parametros_faturamento(
          id,
          status,
          ativo,
          aplicar_franquia,
          valor_franquia,
          volume_franquia,
          frequencia_continua,
          frequencia_por_volume,
          valor_acima_franquia,
          valor_integracao,
          valor_portal_laudos,
          portal_laudos,
          cobrar_integracao,
          impostos_ab_min,
          percentual_iss,
          simples
        ),
        contratos_clientes(
          tipo_faturamento,
          numero_contrato
        )
      `)
      .eq('ativo', true);

    if (Array.isArray(clientesFiltro) && clientesFiltro.length > 0) {
      const looksUuid = typeof clientesFiltro[0] === 'string' && /[0-9a-fA-F-]{36}/.test(clientesFiltro[0]);
      if (looksUuid) {
        clientesQuery = clientesQuery.in('id', clientesFiltro);
      } else {
        clientesQuery = clientesQuery.in('nome', clientesFiltro);
      }
    }

    const { data: clientes, error: clientesError } = await clientesQuery.order('nome');

    if (clientesError) {
      throw clientesError;
    }

    if (!clientes || clientes.length === 0) {
      throw new Error('Nenhum cliente ativo encontrado');
    }

    const demonstrativos: DemonstrativoCliente[] = [];
    const clientesProcessados = new Set<string>(); // Track by nome_fantasia to avoid duplicates

    for (const cliente of clientes) {
      try {
        const parametros = Array.isArray(cliente.parametros_faturamento)
          ? (cliente.parametros_faturamento.find((p: any) => p?.ativo === true || p?.status === 'A' || p?.status === 'Ativo') || cliente.parametros_faturamento[0])
          : cliente.parametros_faturamento;
        const contrato = cliente.contratos_clientes?.[0];
        const tipoFaturamento = contrato?.tipo_faturamento || 'CO-FT';

      // Regras de faturamento:
      // - CO-NF DEVE gerar demonstrativo e relatório (mas não envia email/NF)
      // - NC1-NF DEVE gerar demonstrativo e relatório (mas não envia email/NF)
      // - NC-NF não gera faturamento e pode ser ignorado aqui
      const tiposNaoFaturados = ['NC-NF'];
      if (tiposNaoFaturados.includes(tipoFaturamento)) {
        console.log(`⚠️ Cliente ${cliente.nome} pulado - Tipo faturamento: ${tipoFaturamento} (não gera demonstrativo)`);
        continue;
      }

      // Group clients by nome_fantasia to avoid duplicate demonstrativos
      const nomeFantasia = cliente.nome_fantasia || cliente.nome;
      if (clientesProcessados.has(nomeFantasia)) {
        console.log(`⚠️ Cliente ${cliente.nome} pulado - Já processado como ${nomeFantasia}`);
        continue;
      }
      clientesProcessados.add(nomeFantasia);

      // Buscar volumetria usando multiple search strategies - OTIMIZADO
      const aliasSet = new Set<string>([
        cliente.nome?.trim(),
        cliente.nome_fantasia?.trim() || cliente.nome?.trim(),
        cliente.nome_mobilemed?.trim() || cliente.nome?.trim()
      ].filter(Boolean));

      // Add sibling clients with same nome_fantasia - OTIMIZADO
      if (cliente.nome_fantasia) {
        const { data: siblings } = await supabase
          .from('clientes')
          .select('nome, nome_mobilemed')
          .eq('nome_fantasia', cliente.nome_fantasia)
          .eq('ativo', true)
          .limit(10); // Limitar para evitar queries muito grandes
        (siblings || []).forEach((s: any) => {
          if (s?.nome) aliasSet.add(s.nome.trim());
          if (s?.nome_mobilemed) aliasSet.add(s.nome_mobilemed.trim());
        });
      }

      const nomesBusca = Array.from(aliasSet);

      // ✅ OTIMIZADO: Busca única de volumetria com OR combinado
      const { data: volumetriaCombinada } = await supabase
        .from('volumetria_mobilemed')
        .select('id, EMPRESA, Cliente_Nome_Fantasia, MODALIDADE, ESPECIALIDADE, CATEGORIA, PRIORIDADE, VALORES, ESTUDO_DESCRICAO, MEDICO, tipo_faturamento')
        .eq('periodo_referencia', periodo)
        .or(
          nomesBusca.map(nome => `EMPRESA.eq.${nome},Cliente_Nome_Fantasia.eq.${nome}`).join(',')
        );

      // ✅ Deduplicação por ID
      const volumetriaMap = new Map();
      (volumetriaCombinada || []).forEach(item => {
        const key = item.id ? item.id.toString() : `fallback_${item.EMPRESA}_${item.VALORES}_${Math.random()}`;
        volumetriaMap.set(key, item);
      });
      let volumetria = Array.from(volumetriaMap.values());

      // Log REDUZIDO para debug - apenas contagem
      const examesTotaisAntesFiltros = volumetria.reduce((acc, vol) => acc + (Number(vol.VALORES) || 0), 0);
      console.log(`📊 ${cliente.nome_fantasia}: ${volumetria.length} registros, ${examesTotaisAntesFiltros} exames (antes filtros)`);

      // Pattern-based search SIMPLIFICADO - apenas para casos específicos
      let padroesBusca: string[] = [];
      
      // Apenas casos essenciais que precisam de pattern search
      if (nomeFantasia === 'PRN') {
        padroesBusca = ['PRN%'];
      } else if (nomeFantasia.includes('AKC')) {
        padroesBusca = ['AKC%'];
      }
      
      if (padroesBusca.length > 0) {
        // Busca única com todos os padrões
        const { data: volPattern } = await supabase
          .from('volumetria_mobilemed')
          .select('id, *')
          .eq('periodo_referencia', periodo)
          .or(
            padroesBusca.map(p => `EMPRESA.ilike.${p},Cliente_Nome_Fantasia.ilike.${p}`).join(',')
          );
        
        (volPattern || []).forEach(item => {
          const key = item.id ? item.id.toString() : `pattern_${item.EMPRESA}_${item.VALORES}_${Math.random()}`;
          volumetriaMap.set(key, item);
        });
        
        volumetria = Array.from(volumetriaMap.values());
      }

      // CRITICAL: Apply client tipo_faturamento from contract to all volumetria records
      // The tipo_faturamento and tipo_cliente should already be set by aplicar-tipificacao-faturamento
      // during volumetria processing, so we don't need to override anymore
      console.log(`✅ Cliente ${nomeFantasia}: ${volumetria.length} registros (tipo_faturamento já aplicado)`);

      // Filter out NC-NF and EXCLUSAO records based on CLIENT tipo_faturamento
      if (tipoFaturamento === 'NC-NF' || tipoFaturamento === 'EXCLUSAO') {
        console.log(`⚠️ Cliente ${nomeFantasia} é ${tipoFaturamento} - Pulando processamento`);
        continue;
      }
      console.log(`✅ Cliente ${nomeFantasia}: ${volumetria.length} registros com tipo_faturamento=${tipoFaturamento}`);

      // Apply client-specific filters for NC-FT clients
      const nomeUpper = nomeFantasia.toUpperCase();
      
      // CEDIDIAG (inclui CEDI-RJ, CEDI-RO, CEDI-UNIMED): Only MEDICINA INTERNA, exclude Dr. Rodrigo Vaz de Lima
      if (nomeUpper === 'CEDIDIAG' && volumetria.length > 0) {
        const antesFiltroCedi = volumetria.length;
        volumetria = volumetria.filter(vol => {
          const especialidade = (vol.ESPECIALIDADE || '').toString().toUpperCase();
          const medico = (vol.MEDICO || '').toString().toUpperCase();
          
          // Excluir todos os exames do médico "Dr. Rodrigo Vaz de Lima"
          const isExcludedDoctor = medico.includes('RODRIGO VAZ') || medico.includes('RODRIGO VAZ DE LIMA');
          if (isExcludedDoctor) {
            return false;
          }
          
          const isMedicinaInterna = especialidade.includes('MEDICINA INTERNA');
          return isMedicinaInterna;
        });
        console.log(`🔍 CEDIDIAG (excluído Rodrigo Vaz de Lima): ${antesFiltroCedi} → ${volumetria.length} registros (removidos ${antesFiltroCedi - volumetria.length})`);
      }
      
      // CBU: Only specific modalities/specialties OR plantão, exclude Dr. Rodrigo Vaz de Lima
      if (nomeUpper.includes('CBU') && volumetria.length > 0) {
        const antesFiltro = volumetria.length;
        const examesTotaisAntes = volumetria.reduce((acc, vol) => acc + (Number(vol.VALORES) || 0), 0);
        
        volumetria = volumetria.filter(vol => {
          const prioridade = (vol.PRIORIDADE || '').toString().toUpperCase();
          const especialidade = (vol.ESPECIALIDADE || '').toString().toUpperCase();
          const modalidade = (vol.MODALIDADE || '').toString().toUpperCase();
          const medico = (vol.MEDICO || '').toString().toUpperCase();
          
          // Excluir todos os exames do médico "Dr. Rodrigo Vaz de Lima"
          if (medico.includes('RODRIGO VAZ') || medico.includes('RODRIGO VAZ DE LIMA')) {
            return false;
          }
          
          // Plantão sempre fatura
          if (prioridade === 'PLANTÃO' || prioridade === 'PLANTAO') {
            return true;
          }
          
          const isMedicinaInterna = especialidade.includes('MEDICINA INTERNA');
          const isMusculoEsqueletico = especialidade.includes('MUSCULO ESQUELETICO');
          
          // CT apenas com MEDICINA INTERNA fatura
          const isCT = modalidade === 'CT';
          if (isCT && isMedicinaInterna) {
            return true;
          }
          
          // MR com MEDICINA INTERNA fatura
          const isMR = modalidade === 'MR';
          if (isMR && isMedicinaInterna) {
            return true;
          }
          
          return false;
        });
        
        const examesTotaisDepois = volumetria.reduce((acc, vol) => acc + (Number(vol.VALORES) || 0), 0);
        console.log(`🔍 CBU: ${antesFiltro} → ${volumetria.length} registros | ${examesTotaisAntes} → ${examesTotaisDepois} exames (removidos ${examesTotaisAntes - examesTotaisDepois})`);
      }
      
      // CLIRAM: Only Cardio + Plantão
      if (nomeUpper.includes('CLIRAM') && volumetria.length > 0) {
        const antesFiltro = volumetria.length;
        
        volumetria = volumetria.filter(vol => {
          const prioridade = (vol.PRIORIDADE || '').toString().toUpperCase();
          const especialidade = (vol.ESPECIALIDADE || '').toString().toUpperCase();
          
          // Apenas exames com Cardio E Plantão
          const isCardio = especialidade.includes('CARDIO');
          const isPlantao = prioridade === 'PLANTÃO' || prioridade === 'PLANTAO';
          
          return isCardio && isPlantao;
        });
        console.log(`🔍 CLIRAM (Cardio+Plantão): ${antesFiltro} → ${volumetria.length} registros (removidos ${antesFiltro - volumetria.length})`);
      }
      
      // RADI-IMAGEM: Plantão MI Equipe2 + Cardio + Mamas
      if ((nomeUpper.includes('RADI-IMAGEM') || nomeUpper.includes('RADI_IMAGEM')) && volumetria.length > 0) {
        const MEDICOS_EQUIPE_2 = ['Dr. Antonio Gualberto Chianca Filho', 'Dr. Daniel Chrispim', 'Dr. Efraim Da Silva Ferreira', 'Dr. Felipe Falcão de Sá', 'Dr. Guilherme N. Schincariol', 'Dr. Gustavo Andreis', 'Dr. João Carlos Dantas do Amaral', 'Dr. João Fernando Miranda Pompermayer', 'Dr. Leonardo de Paula Ribeiro Figueiredo', 'Dr. Raphael Sanfelice João', 'Dr. Thiago P. Martins', 'Dr. Virgílio Oliveira Barreto', 'Dra. Adriana Giubilei Pimenta', 'Dra. Aline Andrade Dorea', 'Dra. Camila Amaral Campos', 'Dra. Cynthia Mendes Vieira de Morais', 'Dra. Fernanda Gama Barbosa', 'Dra. Kenia Menezes Fernandes', 'Dra. Lara M. Durante Bacelar', 'Dr. Aguinaldo Cunha Zuppani', 'Dr. Alex Gueiros de Barros', 'Dr. Eduardo Caminha Nunes', 'Dr. Márcio D\'Andréa Rossi', 'Dr. Rubens Pereira Moura Filho', 'Dr. Wesley Walber da Silva', 'Dra. Luna Azambuja Satte Alam', 'Dra. Roberta Bertoldo Sabatini Treml', 'Dra. Thais Nogueira D. Gastaldi', 'Dra. Vanessa da Costa Maldonado'];
        const antesFiltro = volumetria.length;
        
        volumetria = volumetria.filter(vol => {
          const prioridade = (vol.PRIORIDADE || '').toString().toUpperCase();
          const especialidade = (vol.ESPECIALIDADE || '').toString().toUpperCase();
          const medico = (vol.MEDICO || '').toString();
          
          const isPlantao = prioridade === 'PLANTÃO' || prioridade === 'PLANTAO';
          const isMedicinaInterna = especialidade.includes('MEDICINA INTERNA');
          const isCardio = especialidade.includes('CARDIO');
          const isMamas = especialidade.includes('MAMA');
          const temMedicoEquipe2 = MEDICOS_EQUIPE_2.some(med => medico.includes(med));
          
          // Regra 1: Plantão de Medicina Interna laudado pela Equipe 2
          if (isPlantao && isMedicinaInterna && temMedicoEquipe2) {
            return true;
          }
          
          // Regra 2: Todos os exames de Cardio
          if (isCardio) {
            return true;
          }
          
          // Regra 3: Todos os exames de MAMAS
          if (isMamas) {
            return true;
          }
          
          return false;
        });
        console.log(`🔍 RADI-IMAGEM (Plantão MI Equipe2 + Cardio + Mamas): ${antesFiltro} → ${volumetria.length} registros (removidos ${antesFiltro - volumetria.length})`);
      }
      
      // RADMED: Excluir médico "Rodrigo Vaz de Lima" + CT ou MR com MEDICINA INTERNA ou MUSCULO ESQUELETICO + NEURO
      if (nomeUpper.includes('RADMED') && volumetria.length > 0) {
        const antesFiltro = volumetria.length;
        const examesTotaisAntes = volumetria.reduce((acc, vol) => acc + (Number(vol.VALORES) || 0), 0);
        
        // Debug: listar médicos únicos antes do filtro
        const medicosUnicos = [...new Set(volumetria.map(v => (v.MEDICO || '').toString()))];
        console.log(`🔍 RADMED: Médicos únicos na volumetria (${medicosUnicos.length}):`, medicosUnicos.slice(0, 10));
        
        volumetria = volumetria.filter(vol => {
          const prioridade = (vol.PRIORIDADE || '').toString().toUpperCase();
          const especialidade = (vol.ESPECIALIDADE || '').toString().toUpperCase();
          const modalidade = (vol.MODALIDADE || '').toString().toUpperCase();
          const medico = (vol.MEDICO || '').toString().toUpperCase();
          
          // Excluir todos os exames do médico "Rodrigo Vaz de Lima" e variações
          const isRodrigoVaz = 
            medico.includes('RODRIGO VAZ') || 
            medico.includes('RODRIGO VAZ DE LIMA') ||
            medico.includes('DR. RODRIGO') ||
            medico.includes('DR RODRIGO') ||
            (medico.includes('RODRIGO') && medico.includes('LIMA')) ||
            (medico.includes('VAZ') && medico.includes('LIMA'));
          
          if (isRodrigoVaz) {
            console.log(`❌ RADMED: Excluindo exame do médico: ${vol.MEDICO}`);
            return false;
          }
          
          // Plantão sempre fatura
          if (prioridade === 'PLANTÃO' || prioridade === 'PLANTAO') {
            return true;
          }
          
          // CT ou MR (RM) com MEDICINA INTERNA, MUSCULO ESQUELETICO ou NEURO faturam
          const isCTouMR = modalidade === 'CT' || modalidade === 'MR' || modalidade === 'RM';
          const isMedicinaInterna = especialidade.includes('MEDICINA INTERNA');
          const isMusculoEsqueletico = especialidade.includes('MUSCULO ESQUELETICO');
          const isNeuro = especialidade.includes('NEURO');
          
          return isCTouMR && (isMedicinaInterna || isMusculoEsqueletico || isNeuro);
        });
        
        const examesTotaisDepois = volumetria.reduce((acc, vol) => acc + (Number(vol.VALORES) || 0), 0);
        console.log(`🔍 RADMED (excluído Rodrigo Vaz de Lima): ${antesFiltro} → ${volumetria.length} registros | Exames: ${examesTotaisAntes} → ${examesTotaisDepois} (removidos ${examesTotaisAntes - examesTotaisDepois})`);
      }
      
      // CEMVALENCA_RX: Only RX modality
      if (nomeUpper.includes('CEMVALENCA_RX') && volumetria.length > 0) {
        const antesFiltro = volumetria.length;
        
        volumetria = volumetria.filter(vol => {
          const modalidade = (vol.MODALIDADE || '').toString().toUpperCase();
          return modalidade === 'RX';
        });
        console.log(`🔍 CEMVALENCA_RX: ${antesFiltro} → ${volumetria.length} registros (removidos ${antesFiltro - volumetria.length})`);
      }
      
      // CEMVALENCA_PL: Only PLANTÃO priority
      if (nomeUpper.includes('CEMVALENCA_PL') && volumetria.length > 0) {
        const antesFiltro = volumetria.length;
        
        volumetria = volumetria.filter(vol => {
          const prioridade = (vol.PRIORIDADE || '').toString().toUpperCase();
          return prioridade === 'PLANTÃO' || prioridade === 'PLANTAO';
        });
        console.log(`🔍 CEMVALENCA_PL: ${antesFiltro} → ${volumetria.length} registros (removidos ${antesFiltro - volumetria.length})`);
      }
      
      // CEMVALENCA: Plantão + Medicina Interna + Equipe 2 + Cardio + Neurobrain
      if (nomeUpper.includes('CEMVALENCA') && !nomeUpper.includes('CEMVALENCA_RX') && !nomeUpper.includes('CEMVALENCA_PL') && volumetria.length > 0) {
        const MEDICOS_EQUIPE_2 = ['Dr. Antonio Gualberto Chianca Filho', 'Dr. Daniel Chrispim', 'Dr. Efraim Da Silva Ferreira', 'Dr. Felipe Falcão de Sá', 'Dr. Guilherme N. Schincariol', 'Dr. Gustavo Andreis', 'Dr. João Carlos Dantas do Amaral', 'Dr. João Fernando Miranda Pompermayer', 'Dr. Leonardo de Paula Ribeiro Figueiredo', 'Dr. Raphael Sanfelice João', 'Dr. Thiago P. Martins', 'Dr. Virgílio Oliveira Barreto', 'Dra. Adriana Giubilei Pimenta', 'Dra. Aline Andrade Dorea', 'Dra. Camila Amaral Campos', 'Dra. Cynthia Mendes Vieira de Morais', 'Dra. Fernanda Gama Barbosa', 'Dra. Kenia Menezes Fernandes', 'Dra. Lara M. Durante Bacelar', 'Dr. Aguinaldo Cunha Zuppani', 'Dr. Alex Gueiros de Barros', 'Dr. Eduardo Caminha Nunes', 'Dr. Márcio D\'Andréa Rossi', 'Dr. Rubens Pereira Moura Filho', 'Dr. Wesley Walber da Silva', 'Dra. Luna Azambuja Satte Alam', 'Dra. Roberta Bertoldo Sabatini Treml', 'Dra. Thais Nogueira D. Gastaldi', 'Dra. Vanessa da Costa Maldonado'];
        const antesFiltro = volumetria.length;
        
        volumetria = volumetria.filter(vol => {
          const prioridade = (vol.PRIORIDADE || '').toString().toUpperCase();
          const especialidade = (vol.ESPECIALIDADE || '').toString().toUpperCase();
          const categoria = (vol.CATEGORIA || '').toString().toUpperCase();
          const medico = (vol.MEDICO || '').toString();
          
          // Aplicar OR lógico: qualquer uma das condições abaixo inclui o exame
          const isPlantao = prioridade === 'PLANTÃO' || prioridade === 'PLANTAO';
          const isMedicinaInterna = especialidade.includes('MEDICINA INTERNA');
          const isCardio = especialidade.includes('CARDIO');
          const isNeurobrain = categoria.includes('NEUROBRAIN');
          const temMedicoEquipe2 = MEDICOS_EQUIPE_2.some(med => medico.includes(med));
          
          // Retorna true se qualquer condição for verdadeira
          return isPlantao || isMedicinaInterna || isCardio || isNeurobrain || temMedicoEquipe2;
        });
        console.log(`🔍 CEMVALENCA (Plantão OU MI OU Equipe2 OU Cardio OU Neurobrain): ${antesFiltro} → ${volumetria.length} registros (removidos ${antesFiltro - volumetria.length})`);
      }
      
      // Clientes com regra específica: apenas Cardio OU Plantão
      const CLIENTES_CARDIO_OU_PLANTAO = ['CDICARDIO', 'CDIGOIAS', 'CISP', 'CLIRAM', 'CRWANDERLEY', 
                                           'DIAGMAX-PR', 'GOLD', 'PRODIMAGEM', 'TRANSDUSON', 'ZANELLO'];
      const isCardioOuPlantao = CLIENTES_CARDIO_OU_PLANTAO.some(nc => nomeUpper.includes(nc));
      
      if (isCardioOuPlantao && volumetria.length > 0) {
        const antesFiltro = volumetria.length;
        
        volumetria = volumetria.filter(vol => {
          const prioridade = (vol.PRIORIDADE || '').toString().toUpperCase();
          const especialidade = (vol.ESPECIALIDADE || '').toString().toUpperCase();
          
          // Exames de Cardio OU Plantão
          const isCardio = especialidade.includes('CARDIO');
          const isPlantao = prioridade === 'PLANTÃO' || prioridade === 'PLANTAO';
          
          return isCardio || isPlantao;
        });
        console.log(`🔍 ${cliente.nome_fantasia || cliente.nome} (Cardio OU Plantão): ${antesFiltro} → ${volumetria.length} registros (removidos ${antesFiltro - volumetria.length})`);
      }
      
      // RMPADUA: Plantão OU Medicina Interna OU Equipe 2 OU Cardio OU Neurobrain
      if (nomeUpper.includes('RMPADUA') && volumetria.length > 0) {
        const MEDICOS_EQUIPE_2 = ['Dr. Antonio Gualberto Chianca Filho', 'Dr. Daniel Chrispim', 'Dr. Efraim Da Silva Ferreira', 'Dr. Felipe Falcão de Sá', 'Dr. Guilherme N. Schincariol', 'Dr. Gustavo Andreis', 'Dr. João Carlos Dantas do Amaral', 'Dr. João Fernando Miranda Pompermayer', 'Dr. Leonardo de Paula Ribeiro Figueiredo', 'Dr. Raphael Sanfelice João', 'Dr. Thiago P. Martins', 'Dr. Virgílio Oliveira Barreto', 'Dra. Adriana Giubilei Pimenta', 'Dra. Aline Andrade Dorea', 'Dra. Camila Amaral Campos', 'Dra. Cynthia Mendes Vieira de Morais', 'Dra. Fernanda Gama Barbosa', 'Dra. Kenia Menezes Fernandes', 'Dra. Lara M. Durante Bacelar', 'Dr. Aguinaldo Cunha Zuppani', 'Dr. Alex Gueiros de Barros', 'Dr. Eduardo Caminha Nunes', 'Dr. Márcio D\'Andréa Rossi', 'Dr. Rubens Pereira Moura Filho', 'Dr. Wesley Walber da Silva', 'Dra. Luna Azambuja Satte Alam', 'Dra. Roberta Bertoldo Sabatini Treml', 'Dra. Thais Nogueira D. Gastaldi', 'Dra. Vanessa da Costa Maldonado'];
        const antesFiltro = volumetria.length;
        
        volumetria = volumetria.filter(vol => {
          const prioridade = (vol.PRIORIDADE || '').toString().toUpperCase();
          const especialidade = (vol.ESPECIALIDADE || '').toString().toUpperCase();
          const categoria = (vol.CATEGORIA || '').toString().toUpperCase();
          const medico = (vol.MEDICO || '').toString();
          
          // Aplicar OR lógico: qualquer uma das condições abaixo inclui o exame
          const isPlantao = prioridade === 'PLANTÃO' || prioridade === 'PLANTAO';
          const isMedicinaInterna = especialidade.includes('MEDICINA INTERNA');
          const isCardio = especialidade.includes('CARDIO');
          const isNeurobrain = categoria.includes('NEUROBRAIN');
          const temMedicoEquipe2 = MEDICOS_EQUIPE_2.some(med => medico.includes(med));
          
          // Retorna true se qualquer condição for verdadeira
          return isPlantao || isMedicinaInterna || isCardio || isNeurobrain || temMedicoEquipe2;
        });
        console.log(`🔍 RMPADUA (Plantão OU MI OU Equipe2 OU Cardio OU Neurobrain): ${antesFiltro} → ${volumetria.length} registros (removidos ${antesFiltro - volumetria.length})`);
      }

      // Calculate total exams (all remaining records are billable)
      let totalExames = 0;
      for (const vol of volumetria) {
        totalExames += Number(vol.VALORES) || 0;
      }

      // Log final count
      console.log(`📊 ${nomeFantasia}: FINAL = ${totalExames} exames faturáveis`);

      // Ajustar categorias/especialidades usando cadastro_exames quando vierem como 'SC' ou vazias
      try {
        const norm = (s: any) => (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
        const categoriaCache = new Map<string, { categoria: string; especialidade: string }>();
        let atualizados = 0;
        for (const v of volumetria) {
          const cat = norm(v.CATEGORIA);
          if (!cat || cat === 'SC') {
            const descKey = norm(v.ESTUDO_DESCRICAO || '');
            if (!descKey) continue;
            let cached = categoriaCache.get(descKey);
            if (!cached) {
              const { data: ce } = await supabase
                .from('cadastro_exames')
                .select('categoria, especialidade, nome, ativo')
                .ilike('nome', v.ESTUDO_DESCRICAO || '')
                .eq('ativo', true)
                .limit(1)
                .maybeSingle();
              cached = { categoria: ce?.categoria?.toString() || '', especialidade: ce?.especialidade?.toString() || '' };
              categoriaCache.set(descKey, cached);
            }
            if (cached.categoria) {
              v.CATEGORIA = cached.categoria;
              atualizados++;
            }
            if ((!v.ESPECIALIDADE || !norm(v.ESPECIALIDADE)) && cached.especialidade) {
              v.ESPECIALIDADE = cached.especialidade;
            }
          }
        }
        if (atualizados > 0) {
          console.log(`🛠️ Categorias ajustadas via cadastro_exames: ${atualizados}`);
        }
      } catch (e) {
        console.log('⚠️ Erro ao ajustar categorias via cadastro_exames:', e?.message || e);
      }

      // Calculate exam values using prices
      let valorExamesCalculado = 0;

      // Get client prices
      const { data: precosCliente } = await supabase
        .from('precos_servicos')
        .select('*')
        .eq('cliente_id', cliente.id);

      const norm = (s: any) => (s ?? '').toString().trim().toUpperCase();
      
      // ✅ CORRIGIDO: Buscar cond_volume específico da linha de preço, não do contrato
      // Função para buscar preço POR EXAME usando RPC calcular_preco_exame
      const buscarPreco = async (exame: any) => {
        try {
          // 1. Buscar o preço específico para obter o cond_volume daquela linha
          const { data: precoRow, error: precoSearchErr } = await supabase
            .from('precos_servicos')
            .select('cond_volume')
            .eq('cliente_id', cliente.id)
            .eq('modalidade', exame.MODALIDADE || '')
            .eq('especialidade', exame.ESPECIALIDADE || '')
            .eq('ativo', true)
            .order('volume_inicial', { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle();

          // Usar cond_volume da linha de preço, ou padrão se não encontrado
          let condVolumeEspecifico = 'MOD/ESP/CAT'; // Padrão
          if (precoRow && precoRow.cond_volume) {
            condVolumeEspecifico = precoRow.cond_volume;
          }

          // 2. Chamar RPC com o cond_volume específico desta linha de preço
          const { data: precoData, error: precoErr } = await supabase
            .rpc('calcular_preco_exame', {
              p_cliente_id: cliente.id,
              p_modalidade: exame.MODALIDADE || '',
              p_especialidade: exame.ESPECIALIDADE || '',
              p_categoria: exame.CATEGORIA || 'N/A',
              p_prioridade: exame.PRIORIDADE || 'ROTINA',
              p_volume_total: 0, // Será calculado pela função baseado em cond_volume
              p_cond_volume: condVolumeEspecifico,
              p_periodo: periodo
            });

          if (precoErr) {
            console.error(`❌ Erro RPC calcular_preco_exame:`, precoErr);
            return 0;
          }

          return Number(precoData) || 0;
        } catch (e) {
          console.error(`❌ Erro ao calcular preço:`, e);
          return 0;
        }
      };

      // Calcular valores POR EXAME usando a função SQL
      const examesCalculados = await Promise.all(
        volumetria.map(async (v) => {
          if (v.tipo_faturamento === 'NC-NF' || v.tipo_faturamento === 'EXCLUSAO') {
            return null;
          }
          
          const valorUnitario = await buscarPreco(v);
          const quantidade = Number(v.VALORES) || 1;
          
          return {
            modalidade: v.MODALIDADE || '',
            especialidade: v.ESPECIALIDADE || '',
            categoria: v.CATEGORIA || '',
            prioridade: v.PRIORIDADE || '',
            quantidade: quantidade,
            valor_unitario: valorUnitario,
            valor_total: valorUnitario * quantidade
          };
        })
      );
      
      const examesCalculadosValidos = examesCalculados.filter(e => e !== null);

      // Calcular valor total dos exames
      valorExamesCalculado = examesCalculadosValidos.reduce((sum, e: any) => sum + e.valor_total, 0);

      // Agrupar para o detalhamento (soma dos valores já calculados)
      const gruposDetalhes: Record<string, {
        modalidade: string;
        especialidade: string;
        categoria: string;
        prioridade: string;
        quantidade: number;
        valor_total: number;
        valor_unitario: number;
      }> = {};

      for (const exame of examesCalculadosValidos) {
        const key = `${exame.modalidade}|${exame.especialidade}|${exame.categoria}|${exame.prioridade}`;
        
        if (!gruposDetalhes[key]) {
          gruposDetalhes[key] = {
            modalidade: exame.modalidade,
            especialidade: exame.especialidade,
            categoria: exame.categoria,
            prioridade: exame.prioridade,
            quantidade: 0,
            valor_total: 0,
            valor_unitario: 0
          };
        }
        
        gruposDetalhes[key].quantidade += exame.quantidade;
        gruposDetalhes[key].valor_total += exame.valor_total;
      }

      // Calcular valor unitário médio para cada grupo e montar detalhes
      const detalhesExames: any[] = [];
      for (const [key, grupo] of Object.entries(gruposDetalhes)) {
        grupo.valor_unitario = grupo.quantidade > 0 ? grupo.valor_total / grupo.quantidade : 0;
        
        detalhesExames.push({
          modalidade: grupo.modalidade,
          especialidade: grupo.especialidade,
          categoria: grupo.categoria,
          prioridade: grupo.prioridade,
          quantidade: grupo.quantidade,
          valor_unitario: grupo.valor_unitario,
          valor_total: grupo.valor_total,
          status: grupo.valor_unitario > 0 ? 'com_preco' : 'sem_preco'
        });
      }


      // ============================================
      // USAR RPC IGUAL AO RELATÓRIO (MESMA LÓGICA)
      // ============================================
      let valorFranquia = 0;
      let valorPortalLaudos = 0;
      let valorIntegracao = 0;
      let detalhesFranquia = {};

      console.log(`📋 Calculando adicionais para ${nomeFantasia} - Volume: ${totalExames}`);

      // Usar RPC calcular_faturamento_completo para obter franquia/portal/integração (IGUAL RELATÓRIO)
      try {
        const { data: calcData, error: calcErr } = await supabase
          .rpc('calcular_faturamento_completo', {
            p_cliente_id: cliente.id,
            p_periodo: periodo,
            p_volume_total: totalExames
          });

        if (!calcErr && calcData && Array.isArray(calcData) && calcData.length > 0) {
          const c = calcData[0];
          valorFranquia = Number(c.valor_franquia) || 0;
          valorPortalLaudos = Number(c.valor_portal_laudos) || 0;
          valorIntegracao = Number(c.valor_integracao) || 0;
          detalhesFranquia = c.detalhes_franquia || {};
          console.log(`✅ ${nomeFantasia}: Adicionais via RPC`, { valorFranquia, valorPortalLaudos, valorIntegracao });
        } else {
          console.warn(`⚠️ ${nomeFantasia}: RPC indisponível`, calcErr);
        }
      } catch (e) {
        console.warn(`⚠️ ${nomeFantasia}: Erro RPC:`, e?.message || e);
      }

      // Aplicar valores de Portal e Integração: se há valor no campo, cobrar sempre
      if (parametros) {
        // Franquia: respeitar flag aplicar_franquia (tem lógica de volume/frequência)
        if (!parametros.aplicar_franquia) {
          console.log(`📋 ${nomeFantasia}: Franquia DESABILITADA por parâmetro`);
          valorFranquia = 0;
          detalhesFranquia = { tipo: 'desabilitado', valor_aplicado: 0, motivo: 'Franquia desabilitada' };
        }

        // Portal: se há valor no parâmetro, usar (ignorar flag portal_laudos)
        if ((valorPortalLaudos ?? 0) === 0 && Number(parametros.valor_portal_laudos) > 0) {
          valorPortalLaudos = Number(parametros.valor_portal_laudos);
          console.log(`📋 ${nomeFantasia}: Portal aplicado do parâmetro: R$ ${valorPortalLaudos.toFixed(2)}`);
        }

        // Integração: se há valor no parâmetro, usar (ignorar flag cobrar_integracao)
        if ((valorIntegracao ?? 0) === 0 && Number(parametros.valor_integracao) > 0) {
          valorIntegracao = Number(parametros.valor_integracao);
          console.log(`📋 ${nomeFantasia}: Integração aplicada do parâmetro: R$ ${valorIntegracao.toFixed(2)}`);
        }

        // Forçar a mesma regra de franquia utilizada na auditoria (fonte única da verdade)
        // Esta regra SOBREPOE qualquer valor retornado pela RPC quando incompatível com a parametrização
        try {
          const volumeFranquia = Number(parametros.volume_franquia || 0);
          const valorFranquiaBase = Number(parametros.valor_franquia || 0);
          const valorAcimaFranquia = Number(parametros.valor_acima_franquia || 0);
          const frequenciaContinua = parametros.frequencia_continua === true;
          const frequenciaPorVolume = parametros.frequencia_por_volume === true;

          let regra = 'nao_aplica';
          let valorCalculado = 0;

          if (parametros.aplicar_franquia) {
            if (frequenciaContinua) {
              if (frequenciaPorVolume) {
                if (totalExames < volumeFranquia) {
                  valorCalculado = valorFranquiaBase;
                  regra = 'continua_sim_volume_sim_abaixo';
                } else {
                  valorCalculado = valorAcimaFranquia > 0 ? valorAcimaFranquia : 0;
                  regra = valorAcimaFranquia > 0 ? 'continua_sim_volume_sim_acima' : 'continua_sim_volume_sim_acima_sem_valor';
                }
              } else {
                valorCalculado = valorFranquiaBase;
                regra = 'continua_sim_volume_nao';
              }
            } else {
              if (frequenciaPorVolume) {
                if (totalExames < volumeFranquia) {
                  valorCalculado = valorFranquiaBase;
                  regra = 'continua_nao_volume_sim_abaixo';
                } else {
                  valorCalculado = 0;
                  regra = 'continua_nao_volume_sim_acima';
                }
              } else {
                if (totalExames < volumeFranquia) {
                  valorCalculado = valorFranquiaBase;
                  regra = 'continua_nao_volume_nao_abaixo';
                } else {
                  valorCalculado = 0;
                  regra = 'continua_nao_volume_nao_acima';
                }
              }
            }
          }


          // Se o valor retornado pela RPC divergir da regra, priorizar a regra
          if (valorFranquia !== valorCalculado) {
            console.log(`🔁 ${nomeFantasia}: Ajustando franquia (RPC=${valorFranquia}) → (Regra=${valorCalculado}) | regra=${regra}`);
            valorFranquia = valorCalculado;
          }

          detalhesFranquia = {
            ...(detalhesFranquia || {}),
            regra,
            volume_referencia: volumeFranquia,
            valor_base: valorFranquiaBase,
            valor_acima_volume: valorAcimaFranquia,
            total_exames_periodo: totalExames,
            valor_aplicado: valorFranquia,
          };
        } catch (e) {
          console.warn(`⚠️ ${nomeFantasia}: Falha ao consolidar regra de franquia`, e?.message || e);
        }
      } else {
        console.log(`📋 ${nomeFantasia}: Sem parâmetros encontrados`);
        detalhesFranquia = { tipo: 'nao_aplica', valor_aplicado: 0, motivo: 'Cliente sem parâmetros de faturamento' };
      }

      // ✅ FIX 3: Calculate taxes properly
      const valorBruto = valorExamesCalculado + valorFranquia + valorPortalLaudos + valorIntegracao;
      let valorISS = 0;
      let valorIRRF = 0;

      console.log(`💰 ${nomeFantasia} - Valores calculados:`, {
        valorExamesCalculado,
        valorFranquia,
        valorPortalLaudos,
        valorIntegracao,
        valorBruto,
        percentual_iss: parametros?.percentual_iss,
        simples: parametros?.simples
      });

      // IMPORTANTE: Seguir a mesma lógica do relatório
      // Clientes Simples Nacional NÃO têm retenção de impostos
      // Se não há parâmetros, considerar Simples Nacional (sem retenção)
      
      if (parametros && !parametros.simples) {
        // Regime Normal: calcular impostos federais (PIS, COFINS, CSLL, IRRF)
        let pis = valorBruto * 0.0065;
        let cofins = valorBruto * 0.03;
        let csll = valorBruto * 0.01;
        let irrf = valorBruto * 0.015;
        
        // REGRA 1: Se IRRF < R$ 10,00, zerar APENAS o IRRF
        if (irrf < 10) {
          console.log(`⚠️ ${nomeFantasia}: IRRF ${irrf.toFixed(2)} < R$ 10,00 - IRRF zerado`);
          irrf = 0;
        }
        
        // REGRA 2: Se (PIS + COFINS + CSLL) < R$ 10,00, zerar estes três
        const somaImpostosFederais = pis + cofins + csll;
        if (somaImpostosFederais < 10) {
          console.log(`⚠️ ${nomeFantasia}: (PIS+COFINS+CSLL) ${somaImpostosFederais.toFixed(2)} < R$ 10,00 - PIS/COFINS/CSLL zerados`);
          pis = 0;
          cofins = 0;
          csll = 0;
        }
        
        // ISS específico do cliente
        if (parametros.percentual_iss) {
          valorISS = valorBruto * (parametros.percentual_iss / 100);
          if (parametros.impostos_ab_min) {
            valorISS = Math.max(valorISS, parametros.impostos_ab_min);
          }
        }
        
        valorIRRF = pis + cofins + csll + irrf;
        console.log(`💰 ${nomeFantasia}: Regime NORMAL - ISS: ${valorISS.toFixed(2)}, Federais: PIS=${pis.toFixed(2)} COFINS=${cofins.toFixed(2)} CSLL=${csll.toFixed(2)} IRRF=${irrf.toFixed(2)} Total=${valorIRRF.toFixed(2)}`);
      } else {
        if (!parametros) {
          console.log(`⚠️ ${nomeFantasia}: SEM parâmetros cadastrados - tratando como Simples Nacional (SEM retenção)`);
        } else {
          console.log(`💰 ${nomeFantasia}: Simples Nacional - SEM retenção`);
        }
      }

      const totalImpostos = valorISS + valorIRRF;
      const valorLiquido = valorBruto - totalImpostos;

      console.log(`💰 ${nomeFantasia} - Impostos:`, {
        valorISS,
        valorIRRF,
        totalImpostos,
        valorLiquido
      });

      const demonstrativo: DemonstrativoCliente = {
        cliente_id: cliente.id,
        cliente_nome: cliente.nome_fantasia || cliente.nome,
        periodo,
        total_exames: totalExames,
        valor_exames: valorExamesCalculado,
        valor_franquia: valorFranquia,
        valor_portal_laudos: valorPortalLaudos,
        valor_integracao: valorIntegracao,
        valor_bruto: valorBruto,
        valor_impostos: totalImpostos,
        valor_total: valorLiquido,
        detalhes_franquia: detalhesFranquia,
        detalhes_exames: detalhesExames,
        detalhes_tributacao: {
          simples_nacional: parametros?.simples || false,
          percentual_iss: parametros?.percentual_iss || 0,
          valor_iss: valorISS,
          valor_irrf: valorIRRF,
          base_calculo: valorBruto,
          impostos_ab_min: parametros?.impostos_ab_min || 0,
          total_impostos: totalImpostos,
          valor_liquido: valorLiquido
        },
        tipo_faturamento: tipoFaturamento
      };

      console.log(`✅ ${nomeFantasia} - Demonstrativo final:`, {
        total_exames: demonstrativo.total_exames,
        valor_exames: demonstrativo.valor_exames,
        valor_franquia: demonstrativo.valor_franquia,
        valor_portal_laudos: demonstrativo.valor_portal_laudos,
        valor_integracao: demonstrativo.valor_integracao,
        valor_bruto: demonstrativo.valor_bruto,
        valor_impostos: demonstrativo.valor_impostos,
        valor_total: demonstrativo.valor_total
      });

      // Include if has exams OR net value > 0
      if (totalExames > 0 && valorLiquido > 0) {
        demonstrativos.push(demonstrativo);
      } else {
        console.log(`⏭️ ${nomeFantasia} pulado (valores zerados): exames=${totalExames}, líquido=${valorLiquido}`);
      }
      
    } catch (clienteError: any) {
      const clienteNome = cliente?.nome_fantasia || cliente?.nome || 'Cliente desconhecido';
      console.error(`❌ ERRO ao processar cliente ${clienteNome}:`, clienteError);
      console.error(`📋 Stack trace:`, clienteError.stack);
      // Continue processing other clients instead of failing the entire batch
    }
  }

    // ✅ FIX 4: Calculate summary correctly
    const resumo = {
      clientes_processados: demonstrativos.length,
      total_clientes_processados: demonstrativos.length,
      periodo,
      total_exames_geral: demonstrativos.reduce((acc, dem) => acc + (dem.total_exames || 0), 0),
      valor_exames_geral: demonstrativos.reduce((acc, dem) => acc + (dem.valor_exames || 0), 0),
      valor_franquias_geral: demonstrativos.reduce((acc, dem) => acc + (dem.valor_franquia || 0), 0),
      valor_portal_geral: demonstrativos.reduce((acc, dem) => acc + (dem.valor_portal_laudos || 0), 0),
      valor_integracao_geral: demonstrativos.reduce((acc, dem) => acc + (dem.valor_integracao || 0), 0),
      valor_bruto_geral: demonstrativos.reduce((acc, dem) => acc + (dem.valor_bruto || 0), 0),
      valor_impostos_geral: demonstrativos.reduce((acc, dem) => acc + (dem.valor_impostos || 0), 0),
      valor_liquido_geral: demonstrativos.reduce((acc, dem) => acc + (dem.valor_total || 0), 0),
      valor_total_geral: demonstrativos.reduce((acc, dem) => acc + (dem.valor_total || 0), 0), // compatibility
      clientes_simples_nacional: demonstrativos.filter(dem => dem.detalhes_tributacao?.simples_nacional).length,
      clientes_regime_normal: demonstrativos.filter(dem => !dem.detalhes_tributacao?.simples_nacional).length
    };

    // Save demonstrativos to database first
    console.log('💾 Salvando demonstrativos no banco de dados...');
    try {
      const recordsToInsert = demonstrativos.map((demo) => ({
        cliente_id: demo.cliente_id,
        cliente_nome: demo.cliente_nome,
        periodo_referencia: periodo,
        total_exames: demo.total_exames || 0,
        valor_exames: demo.valor_exames || 0,
        valor_franquia: demo.valor_franquia || 0,
        valor_portal_laudos: demo.valor_portal_laudos || 0,
        valor_integracao: demo.valor_integracao || 0,
        valor_bruto_total: demo.valor_bruto || 0,
        valor_total_impostos: demo.valor_impostos || 0,
        valor_liquido: demo.valor_total || 0,
        detalhes_exames: demo.detalhes_exames || [],
        detalhes_franquia: demo.detalhes_franquia || {},
        parametros_utilizados: demo.detalhes_tributacao || {},
        status: 'calculado'
      }));

      const { error: insertError } = await supabase
        .from('demonstrativos_faturamento_calculados')
        .upsert(recordsToInsert, {
          onConflict: 'cliente_nome,periodo_referencia',
          ignoreDuplicates: false
        });

      if (insertError) {
        console.error('❌ Erro ao gravar demonstrativos no banco:', insertError);
      } else {
        console.log(`✅ ${demonstrativos.length} demonstrativos gravados no banco`);
      }
    } catch (dbError: any) {
      console.error('❌ Erro ao gravar no banco:', dbError);
    }

    // ✅ OTIMIZAÇÃO CRÍTICA: Não gerar relatórios PDF aqui!
    // A geração de PDFs é LENTA e deve ser feita separadamente pelo botão "Gerar Relatórios"
    // Isso elimina o timeout da edge function e torna o processo muito mais rápido
    console.log(`✅ Demonstrativos salvos. PDFs serão gerados separadamente pelo usuário.`);

    return new Response(
      JSON.stringify({
        success: true,
        demonstrativos,
        resumo
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Erro na geração de demonstrativos:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Erro ao gerar demonstrativos de faturamento'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});