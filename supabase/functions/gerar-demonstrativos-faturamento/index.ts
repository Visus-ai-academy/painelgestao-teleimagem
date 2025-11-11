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

      // Buscar volumetria usando multiple search strategies
      const aliasSet = new Set<string>([
        cliente.nome?.trim(),
        cliente.nome_fantasia?.trim() || cliente.nome?.trim(),
        cliente.nome_mobilemed?.trim() || cliente.nome?.trim()
      ].filter(Boolean));

      // Add sibling clients with same nome_fantasia
      if (cliente.nome_fantasia) {
        const { data: siblings } = await supabase
          .from('clientes')
          .select('nome, nome_mobilemed')
          .eq('nome_fantasia', cliente.nome_fantasia)
          .eq('ativo', true);
        (siblings || []).forEach((s: any) => {
          if (s?.nome) aliasSet.add(s.nome.trim());
          if (s?.nome_mobilemed) aliasSet.add(s.nome_mobilemed.trim());
        });
      }

      const nomesBusca = Array.from(aliasSet);

      // ✅ FIX 1: Include ID in volumetria queries to prevent data loss
      const { data: volumetriaEmpresa } = await supabase
        .from('volumetria_mobilemed')
        .select('id, EMPRESA, Cliente_Nome_Fantasia, MODALIDADE, ESPECIALIDADE, CATEGORIA, PRIORIDADE, VALORES, ESTUDO_DESCRICAO, MEDICO, tipo_faturamento')
        .eq('periodo_referencia', periodo)
        .in('EMPRESA', nomesBusca);

      const fantasiaBusca = cliente.nome_fantasia ? [cliente.nome_fantasia] : [];
      const { data: volumetriaFantasia } = fantasiaBusca.length > 0
        ? await supabase
            .from('volumetria_mobilemed')
            .select('id, EMPRESA, Cliente_Nome_Fantasia, MODALIDADE, ESPECIALIDADE, CATEGORIA, PRIORIDADE, VALORES, ESTUDO_DESCRICAO, MEDICO, tipo_faturamento')
            .eq('periodo_referencia', periodo)
            .in('Cliente_Nome_Fantasia', fantasiaBusca)
        : { data: [] };

      // ✅ FIX 2: Proper deduplication using ID to prevent exam loss
      const volumetriaMap = new Map();
      [...(volumetriaEmpresa || []), ...(volumetriaFantasia || [])].forEach(item => {
        const key = item.id ? item.id.toString() : `fallback_${item.EMPRESA}_${item.VALORES}_${Math.random()}`;
        volumetriaMap.set(key, item);
      });
      let volumetria = Array.from(volumetriaMap.values());

      // Log para debug - contagem de exames ANTES dos filtros
      const examesTotaisAntesFiltros = volumetria.reduce((acc, vol) => acc + (Number(vol.VALORES) || 0), 0);
      console.log(`📊 ${cliente.nome_fantasia}: ${volumetria.length} registros, ${examesTotaisAntesFiltros} exames (antes filtros)`);

      // Pattern-based search apenas para clientes que precisam (se aplicável)
      // nomeFantasia já foi declarado acima (linha 107)
      let padroesBusca: string[] = [];
      
      // PRN pode precisar de pattern search se não estiver agrupado na volumetria
      if (nomeFantasia === 'PRN') {
        padroesBusca = ['PRN%'];
      } else if (nomeFantasia.includes('AKCPALMAS') || nomeFantasia.includes('AKC')) {
        padroesBusca = ['AKC%', 'AKCPALMAS%'];
      }
      // CEDIDIAG removido - agrupamento já feito na volumetria (CEDI-RJ e CEDI-RO já vêm como CEDIDIAG)
      
      if (padroesBusca.length > 0) {
        for (const padrao of padroesBusca) {
          const { data: volEmp } = await supabase
            .from('volumetria_mobilemed')
            .select('id, *')
            .eq('periodo_referencia', periodo)
            .ilike('EMPRESA', padrao);
          
          const { data: volFant } = await supabase
            .from('volumetria_mobilemed')
            .select('id, *')
            .eq('periodo_referencia', periodo)
            .ilike('Cliente_Nome_Fantasia', padrao);
          
          [...(volEmp || []), ...(volFant || [])].forEach(item => {
            const key = item.id ? item.id.toString() : `pattern_${item.EMPRESA}_${item.VALORES}_${Math.random()}`;
            volumetriaMap.set(key, item);
          });
        }
        
        volumetria = Array.from(volumetriaMap.values());
        
        // Log pós-pattern search
        const examesAposPattern = volumetria.reduce((acc, vol) => acc + (Number(vol.VALORES) || 0), 0);
        console.log(`📊 ${nomeFantasia}: ${volumetria.length} registros, ${examesAposPattern} exames (após pattern search)`);
      }

      // CRITICAL: Filter out NC-NF and EXCLUSAO records FIRST
      volumetria = volumetria.filter(vol => {
        const tipoFat = vol.tipo_faturamento;
        return tipoFat !== 'NC-NF' && tipoFat !== 'EXCLUSAO';
      });
      console.log(`🔍 Após remover NC-NF/EXCLUSAO: ${volumetria.length} registros`);

      // Apply client-specific filters for NC-FT clients
      const nomeUpper = nomeFantasia.toUpperCase();
      
      // CEDIDIAG: Only MEDICINA INTERNA, exclude specific doctors
      if (nomeUpper === 'CEDIDIAG' && volumetria.length > 0) {
        const antesFiltroCedi = volumetria.length;
        volumetria = volumetria.filter(vol => {
          const especialidade = (vol.ESPECIALIDADE || '').toString().toUpperCase();
          const medico = (vol.MEDICO || '').toString();
          
          const isMedicinaInterna = especialidade.includes('MEDICINA INTERNA');
          const isExcludedDoctor = medico.includes('Rodrigo Vaz') || medico.includes('Rodrigo Lima');
          
          return isMedicinaInterna && !isExcludedDoctor;
        });
        console.log(`🔍 CEDIDIAG: ${antesFiltroCedi} → ${volumetria.length} registros (removidos ${antesFiltroCedi - volumetria.length})`);
      }
      
      // CBU: Only specific modalities/specialties OR plantão
      if (nomeUpper.includes('CBU') && volumetria.length > 0) {
        const antesFiltro = volumetria.length;
        const examesTotaisAntes = volumetria.reduce((acc, vol) => acc + (Number(vol.VALORES) || 0), 0);
        
        volumetria = volumetria.filter(vol => {
          const prioridade = (vol.PRIORIDADE || '').toString().toUpperCase();
          const especialidade = (vol.ESPECIALIDADE || '').toString().toUpperCase();
          const modalidade = (vol.MODALIDADE || '').toString().toUpperCase();
          
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
      
      // RADMED: CT ou MR com MEDICINA INTERNA ou MUSCULO ESQUELETICO + NEURO
      if (nomeUpper.includes('RADMED') && volumetria.length > 0) {
        const antesFiltro = volumetria.length;
        
        volumetria = volumetria.filter(vol => {
          const prioridade = (vol.PRIORIDADE || '').toString().toUpperCase();
          const especialidade = (vol.ESPECIALIDADE || '').toString().toUpperCase();
          const modalidade = (vol.MODALIDADE || '').toString().toUpperCase();
          
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
        console.log(`🔍 RADMED: ${antesFiltro} → ${volumetria.length} registros (removidos ${antesFiltro - volumetria.length})`);
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
      
      // CEMVALENCA: Only MEDICINA INTERNA and MAMO (mamografia) specialties
      if (nomeUpper.includes('CEMVALENCA') && !nomeUpper.includes('CEMVALENCA_RX') && !nomeUpper.includes('CEMVALENCA_PL') && volumetria.length > 0) {
        const ESPECIALIDADES_FATURADAS = ['MEDICINA INTERNA', 'MAMO'];
        const antesFiltro = volumetria.length;
        
        volumetria = volumetria.filter(vol => {
          const especialidade = (vol.ESPECIALIDADE || '').toString().toUpperCase();
          return ESPECIALIDADES_FATURADAS.some(esp => especialidade.includes(esp));
        });
        console.log(`🔍 CEMVALENCA: ${antesFiltro} → ${volumetria.length} registros (removidos ${antesFiltro - volumetria.length})`);
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
      
      // RMPADUA: Plantão MI Equipe2 + Cardio
      if (nomeUpper.includes('RMPADUA') && volumetria.length > 0) {
        const MEDICOS_EQUIPE_2 = ['Dr. Antonio Gualberto Chianca Filho', 'Dr. Daniel Chrispim', 'Dr. Efraim Da Silva Ferreira', 'Dr. Felipe Falcão de Sá', 'Dr. Guilherme N. Schincariol', 'Dr. Gustavo Andreis', 'Dr. João Carlos Dantas do Amaral', 'Dr. João Fernando Miranda Pompermayer', 'Dr. Leonardo de Paula Ribeiro Figueiredo', 'Dr. Raphael Sanfelice João', 'Dr. Thiago P. Martins', 'Dr. Virgílio Oliveira Barreto', 'Dra. Adriana Giubilei Pimenta', 'Dra. Aline Andrade Dorea', 'Dra. Camila Amaral Campos', 'Dra. Cynthia Mendes Vieira de Morais', 'Dra. Fernanda Gama Barbosa', 'Dra. Kenia Menezes Fernandes', 'Dra. Lara M. Durante Bacelar', 'Dr. Aguinaldo Cunha Zuppani', 'Dr. Alex Gueiros de Barros', 'Dr. Eduardo Caminha Nunes', 'Dr. Márcio D\'Andréa Rossi', 'Dr. Rubens Pereira Moura Filho', 'Dr. Wesley Walber da Silva', 'Dra. Luna Azambuja Satte Alam', 'Dra. Roberta Bertoldo Sabatini Treml', 'Dra. Thais Nogueira D. Gastaldi', 'Dra. Vanessa da Costa Maldonado'];
        const antesFiltro = volumetria.length;
        
        volumetria = volumetria.filter(vol => {
          const prioridade = (vol.PRIORIDADE || '').toString().toUpperCase();
          const especialidade = (vol.ESPECIALIDADE || '').toString().toUpperCase();
          const medico = (vol.MEDICO || '').toString();
          
          const isPlantao = prioridade === 'PLANTÃO' || prioridade === 'PLANTAO';
          const isMedicinaInterna = especialidade.includes('MEDICINA INTERNA');
          const isCardio = especialidade.includes('CARDIO');
          const temMedicoEquipe2 = MEDICOS_EQUIPE_2.some(med => medico.includes(med));
          
          // Regra 1: Plantão de Medicina Interna laudado pela Equipe 2
          if (isPlantao && isMedicinaInterna && temMedicoEquipe2) {
            return true;
          }
          
          // Regra 2: Todos os exames de Cardio
          if (isCardio) {
            return true;
          }
          
          return false;
        });
        console.log(`🔍 RMPADUA (Plantão MI Equipe2 + Cardio): ${antesFiltro} → ${volumetria.length} registros (removidos ${antesFiltro - volumetria.length})`);
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
      
      // Calculate total volume for price range selection (IGUAL RELATÓRIO)
      const volumeTotal = volumetria.reduce((sum, v) => sum + (Number(v.VALORES) || 0), 0);
      
      // Função para buscar preço POR EXAME (IGUAL RELATÓRIO)
      const buscarPreco = (exame: any) => {
        if (!precosCliente || precosCliente.length === 0) return 0;

        const modalidadeN = norm(exame.MODALIDADE);
        const especialidadeN = norm(exame.ESPECIALIDADE);
        const categoriaN = norm(exame.CATEGORIA || 'SC');
        const prioridadeN = norm(exame.PRIORIDADE || '');

        let pool: any[] = [];

        // 1) Match EXATO com categoria
        let candidatos = (precosCliente || []).filter((p: any) =>
          (p.ativo ?? true) === true &&
          norm(p.modalidade) === modalidadeN &&
          norm(p.especialidade) === especialidadeN &&
          norm(p.categoria || 'SC') === categoriaN
        );

        if (candidatos.length === 0) {
          // 2) Fallback: ignorar categoria (modalidade+especialidade)
          candidatos = (precosCliente || []).filter((p: any) =>
            (p.ativo ?? true) === true &&
            norm(p.modalidade) === modalidadeN &&
            norm(p.especialidade) === especialidadeN
          );
        }

        if (candidatos.length === 0) {
          // 3) Fallback: somente modalidade
          candidatos = (precosCliente || []).filter((p: any) =>
            (p.ativo ?? true) === true &&
            norm(p.modalidade) === modalidadeN
          );
        }

        if (candidatos.length === 0) return 0;

        // Preferência por cliente
        let candidatosCliente = candidatos.filter((p: any) => p.cliente_id === cliente.id);
        if (candidatosCliente.length === 0) candidatosCliente = candidatos.filter((p: any) => !p.cliente_id);

        // Filtro por prioridade (preferência), com fallback
        const priMatch = candidatosCliente.filter((p: any) => norm(p.prioridade || '') === prioridadeN);
        pool = priMatch.length > 0 ? priMatch : candidatosCliente;

        // Selecionar faixa por volume do período (IGUAL RELATÓRIO)
        const porFaixa = pool
          .filter((p: any) =>
            (p.volume_inicial == null || volumeTotal >= p.volume_inicial) &&
            (p.volume_final == null || volumeTotal <= p.volume_final)
          )
          .sort((a: any, b: any) => (b.volume_inicial || 0) - (a.volume_inicial || 0));

        const selecionado = porFaixa[0] || pool[0];
        if (!selecionado) return 0;

        // ✅ USAR SEMPRE valor_base da linha encontrada (a prioridade já foi considerada na seleção)
        const valor = Number(selecionado.valor_base) || 0;
        return valor;
      };

      // Calcular valores POR EXAME (IGUAL RELATÓRIO)
      const examesCalculados = volumetria.map(v => {
        if (v.tipo_faturamento === 'NC-NF' || v.tipo_faturamento === 'EXCLUSAO') {
          return null;
        }
        
        const valorUnitario = buscarPreco(v);
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
      }).filter(e => e !== null);

      // Calcular valor total dos exames (IGUAL RELATÓRIO)
      valorExamesCalculado = examesCalculados.reduce((sum, e: any) => sum + e.valor_total, 0);

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

      for (const exame of examesCalculados) {
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

      // Clientes Simples Nacional NÃO têm retenção de impostos (IGUAL RELATÓRIO)
      if (parametros && !parametros.simples) {
        const pis = valorBruto * 0.0065;
        const cofins = valorBruto * 0.03;
        const csll = valorBruto * 0.01;
        const irrf = valorBruto * 0.015;
        
        // ISS específico do cliente
        if (parametros.percentual_iss) {
          valorISS = valorBruto * (parametros.percentual_iss / 100);
          if (parametros.impostos_ab_min) {
            valorISS = Math.max(valorISS, parametros.impostos_ab_min);
          }
        }
        
        valorIRRF = pis + cofins + csll + irrf;
        console.log(`💰 ${nomeFantasia}: Regime NORMAL - ISS: ${valorISS}, Federais: ${valorIRRF}`);
      } else {
        console.log(`💰 ${nomeFantasia}: Simples Nacional - SEM retenção`);
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
          percentual_iss: parametros?.percentual_iss,
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

    // Generate reports automatically
    let relatoriosGerados = 0;
    let relatoriosComErro = 0;

    for (const demonstrativo of demonstrativos) {
      try {
        const { error: pdfError } = await supabase.functions.invoke('gerar-relatorio-faturamento', {
          body: {
            cliente_id: demonstrativo.cliente_id,
            periodo: demonstrativo.periodo,
            demonstrativo_data: demonstrativo
          }
        });

        if (pdfError) {
          console.error(`Erro ao gerar PDF para cliente ${demonstrativo.cliente_nome}:`, pdfError);
          relatoriosComErro++;
        } else {
          relatoriosGerados++;
        }
      } catch (error) {
        console.error(`Erro ao gerar relatório para ${demonstrativo.cliente_nome}:`, error);
        relatoriosComErro++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        demonstrativos,
        resumo: {
          ...resumo,
          relatorios_gerados: relatoriosGerados,
          relatorios_com_erro: relatoriosComErro
        }
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