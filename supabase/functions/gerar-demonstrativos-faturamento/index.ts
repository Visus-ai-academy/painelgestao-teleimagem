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
          aplicar_franquia,
          valor_franquia,
          volume_franquia,
          frequencia_continua,
          frequencia_por_volume,
          valor_acima_franquia,
          valor_integracao,
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
      const parametros = cliente.parametros_faturamento?.[0];
      const contrato = cliente.contratos_clientes?.[0];
      const tipoFaturamento = contrato?.tipo_faturamento || 'CO-FT';

      // Pular clientes que não devem gerar faturamento
      const tiposNaoFaturados = ['NC-NF', 'CO-NF', 'NC1-NF'];
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

      // Pattern-based search for grouped clients (PRN, AKCPALMAS, etc.)
      // nomeFantasia já foi declarado acima (linha 107)
      let padroesBusca: string[] = [];
      
      if (nomeFantasia === 'PRN') {
        padroesBusca = ['PRN%'];
      } else if (['CEDIDIAG', 'CEDI-RJ', 'CEDI-RO'].includes(nomeFantasia)) {
        padroesBusca = ['CEDI%'];
      } else if (nomeFantasia.includes('AKCPALMAS') || nomeFantasia.includes('AKC')) {
        padroesBusca = ['AKC%', 'AKCPALMAS%'];
      }
      
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
      
      // CLIRAM: Only specific specialties OR plantão OR specific doctors
      if (nomeUpper.includes('CLIRAM') && volumetria.length > 0) {
        const ESPECIALIDADES_FATURADAS = ['MUSCULO ESQUELETICO', 'NEURO', 'PEDIATRIA'];
        const MEDICOS_FATURADOS = ['JOAO VITOR DE SOUSA', 'DR. JOAO VITOR DE SOUSA'];
        const antesFiltro = volumetria.length;
        
        volumetria = volumetria.filter(vol => {
          const prioridade = (vol.PRIORIDADE || '').toString().toUpperCase();
          const especialidade = (vol.ESPECIALIDADE || '').toString().toUpperCase();
          const medico = (vol.MEDICO || '').toString().toUpperCase();
          
          // Plantão sempre fatura
          if (prioridade === 'PLANTÃO' || prioridade === 'PLANTAO') {
            return true;
          }
          
          // Especialidades faturadas
          const temEspecialidadeFaturada = ESPECIALIDADES_FATURADAS.some(esp => 
            especialidade.includes(esp)
          );
          
          // Médicos faturados
          const temMedicoFaturado = MEDICOS_FATURADOS.some(med => 
            medico.includes(med)
          );
          
          return temEspecialidadeFaturada || temMedicoFaturado;
        });
        console.log(`🔍 CLIRAM: ${antesFiltro} → ${volumetria.length} registros (removidos ${antesFiltro - volumetria.length})`);
      }
      
      // RADI-IMAGEM: Specific rules
      if ((nomeUpper.includes('RADI-IMAGEM') || nomeUpper === 'RADI_IMAGEM') && volumetria.length > 0) {
        const ESPECIALIDADES_FATURADAS = ['MUSCULO ESQUELETICO', 'NEURO', 'PEDIATRIA'];
        const MEDICOS_FATURADOS = ['JOAO VITOR DE SOUSA', 'DR. JOAO VITOR DE SOUSA'];
        const antesFiltro = volumetria.length;
        
        volumetria = volumetria.filter(vol => {
          const prioridade = (vol.PRIORIDADE || '').toString().toUpperCase();
          const especialidade = (vol.ESPECIALIDADE || '').toString().toUpperCase();
          const medico = (vol.MEDICO || '').toString().toUpperCase();
          
          // Plantão sempre fatura
          if (prioridade === 'PLANTÃO' || prioridade === 'PLANTAO') {
            return true;
          }
          
          // MAMA sempre fatura para RADI-IMAGEM
          if (especialidade.includes('MAMA')) {
            return true;
          }
          
          // Especialidades faturadas
          const temEspecialidadeFaturada = ESPECIALIDADES_FATURADAS.some(esp => 
            especialidade.includes(esp)
          );
          
          // Médicos faturados
          const temMedicoFaturado = MEDICOS_FATURADOS.some(med => 
            medico.includes(med)
          );
          
          return temEspecialidadeFaturada || temMedicoFaturado;
        });
        console.log(`🔍 RADI-IMAGEM: ${antesFiltro} → ${volumetria.length} registros (removidos ${antesFiltro - volumetria.length})`);
      }
      
      // RADMED: Similar to CBU
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
          
          // Apenas CT com MEDICINA INTERNA ou MUSCULO ESQUELETICO faturam
          const isCT = modalidade === 'CT';
          const isMedicinaInterna = especialidade.includes('MEDICINA INTERNA');
          const isMusculoEsqueletico = especialidade.includes('MUSCULO ESQUELETICO');
          
          return isCT && (isMedicinaInterna || isMusculoEsqueletico);
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
      
      // CISP: Only Cardio, Medicina Interna or Plantão
      if (nomeUpper.includes('CISP') && volumetria.length > 0) {
        const ESPECIALIDADES_FATURADAS = ['CARDIO', 'MEDICINA INTERNA'];
        const antesFiltro = volumetria.length;
        
        volumetria = volumetria.filter(vol => {
          const prioridade = (vol.PRIORIDADE || '').toString().toUpperCase();
          const especialidade = (vol.ESPECIALIDADE || '').toString().toUpperCase();
          
          // Plantão sempre fatura
          if (prioridade === 'PLANTÃO' || prioridade === 'PLANTAO') {
            return true;
          }
          
          // Apenas Cardio e Medicina Interna faturam
          return ESPECIALIDADES_FATURADAS.some(esp => especialidade.includes(esp));
        });
        console.log(`🔍 CISP: ${antesFiltro} → ${volumetria.length} registros (removidos ${antesFiltro - volumetria.length})`);
      }
      
      // Other NC clients with standard rules
      const OUTROS_NC = ['CDICARDIO', 'CDIGOIAS', 'CRWANDERLEY', 'DIAGMAX-PR', 
                        'GOLD', 'PRODIMAGEM', 'TRANSDUSON', 'ZANELLO', 'RMPADUA'];
      const isOutroNC = OUTROS_NC.some(nc => nomeUpper.includes(nc));
      
      if (isOutroNC && tipoFaturamento === 'NC-FT' && volumetria.length > 0) {
        const ESPECIALIDADES_FATURADAS = ['MUSCULO ESQUELETICO', 'NEURO', 'PEDIATRIA'];
        const antesFiltro = volumetria.length;
        
        volumetria = volumetria.filter(vol => {
          const prioridade = (vol.PRIORIDADE || '').toString().toUpperCase();
          const especialidade = (vol.ESPECIALIDADE || '').toString().toUpperCase();
          
          // Plantão sempre fatura
          if (prioridade === 'PLANTÃO' || prioridade === 'PLANTAO') {
            return true;
          }
          
          // Apenas especialidades específicas faturam
          return ESPECIALIDADES_FATURADAS.some(esp => especialidade.includes(esp));
        });
        console.log(`🔍 ${nomeFantasia} (NC-FT): ${antesFiltro} → ${volumetria.length} registros (removidos ${antesFiltro - volumetria.length})`);
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
      const detalhesExames = [];

      // Group volumetria by modalidade/especialidade/categoria/prioridade
      const gruposExames: Record<string, any> = {};
      
      for (const vol of volumetria) {
        if (vol.tipo_faturamento === 'NC-NF' || vol.tipo_faturamento === 'EXCLUSAO') {
          continue;
        }
        
        const modalidade = (vol.MODALIDADE || '').toString();
        const especialidade = (vol.ESPECIALIDADE || '').toString();
        const categoria = (vol.CATEGORIA || 'SC').toString();
        const prioridade = (vol.PRIORIDADE || '').toString();
        const key = `${modalidade}|${especialidade}|${categoria}|${prioridade}`;
        const qtd = Number(vol.VALORES || 0) || 0;
        
        if (!gruposExames[key]) {
          gruposExames[key] = { modalidade, especialidade, categoria, prioridade, quantidade: 0 };
        }
        gruposExames[key].quantidade += qtd;
      }

      // Get client prices (incluir volume_total)
      const { data: precosCliente } = await supabase
        .from('precos_servicos')
        .select('modalidade, especialidade, categoria, prioridade, valor_base, volume_inicial, volume_final, volume_total, considera_prioridade_plantao, ativo')
        .eq('cliente_id', cliente.id)
        .eq('ativo', true);

      const norm = (s: string) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

      // Calcular volumes agrupados por condicionante ANTES do loop
      const volumesPorCondicionante: Record<string, number> = {
        'TOTAL': totalExames
      };

      // Agrupar por MOD
      const volumesPorMod: Record<string, number> = {};
      for (const [key, grupo] of Object.entries(gruposExames)) {
        const mod = norm(grupo.modalidade);
        volumesPorMod[mod] = (volumesPorMod[mod] || 0) + grupo.quantidade;
      }

      // Agrupar por MOD/ESP
      const volumesPorModEsp: Record<string, number> = {};
      for (const [key, grupo] of Object.entries(gruposExames)) {
        const modEsp = `${norm(grupo.modalidade)}/${norm(grupo.especialidade)}`;
        volumesPorModEsp[modEsp] = (volumesPorModEsp[modEsp] || 0) + grupo.quantidade;
      }

      // Agrupar por MOD/ESP/CAT
      const volumesPorModEspCat: Record<string, number> = {};
      for (const [key, grupo] of Object.entries(gruposExames)) {
        const modEspCat = `${norm(grupo.modalidade)}/${norm(grupo.especialidade)}/${norm(grupo.categoria || 'SC')}`;
        volumesPorModEspCat[modEspCat] = (volumesPorModEspCat[modEspCat] || 0) + grupo.quantidade;
      }

      console.log('📊 Volumes agrupados calculados:', {
        total: volumesPorCondicionante['TOTAL'],
        por_modalidade: Object.keys(volumesPorMod).length,
        por_mod_esp: Object.keys(volumesPorModEsp).length,
        por_mod_esp_cat: Object.keys(volumesPorModEspCat).length
      });


      // Calculate prices for each group
      for (const [key, grupo] of Object.entries(gruposExames)) {
        let valorUnitario = 0;
        let matchedBy = 'none';
        
        if (precosCliente && precosCliente.length > 0) {
          const modalidadeN = norm(grupo.modalidade);
          const especialidadeN = norm(grupo.especialidade);
          const categoriaN = norm(grupo.categoria || 'SC');
          const prioridadeN = norm(grupo.prioridade || '');

          // 1) Match EXATO com categoria
          let candidatos = precosCliente.filter((p: any) =>
            norm(p.modalidade) === modalidadeN &&
            norm(p.especialidade) === especialidadeN &&
            norm(p.categoria || 'SC') === categoriaN
          );

          let poolPrioridade: any[] = [];
          if (candidatos.length > 0) {
            const preferPri = candidatos.filter((p: any) => norm(p.prioridade || '') === prioridadeN);
            poolPrioridade = preferPri.length > 0 ? preferPri : candidatos;
            matchedBy = 'modalidade+especialidade+categoria';
          } else {
            // 2) Fallback: ignorar categoria (modalidade+especialidade)
            candidatos = precosCliente.filter((p: any) =>
              norm(p.modalidade) === modalidadeN &&
              norm(p.especialidade) === especialidadeN
            );
            if (candidatos.length > 0) {
              const preferPri2 = candidatos.filter((p: any) => norm(p.prioridade || '') === prioridadeN);
              poolPrioridade = preferPri2.length > 0 ? preferPri2 : candidatos;
              matchedBy = 'modalidade+especialidade';
            } else {
              // 3) Fallback: somente modalidade
              candidatos = precosCliente.filter((p: any) => norm(p.modalidade) === modalidadeN);
              if (candidatos.length > 0) {
                const preferPri3 = candidatos.filter((p: any) => norm(p.prioridade || '') === prioridadeN);
                poolPrioridade = preferPri3.length > 0 ? preferPri3 : candidatos;
                matchedBy = 'modalidade';
              }
            }
          }

          if (poolPrioridade.length > 0) {
            // Determinar o volume a ser usado baseado na condicionante
            let volumeParaFaixa = 0;
            
            // Verificar se algum preço tem volume_total preenchido
            const temCondicionante = poolPrioridade.some((p: any) => p.volume_total);
            
            if (temCondicionante) {
              // Usar o primeiro preço para pegar a condicionante (todos do pool devem ter a mesma)
              const condicionante = norm(poolPrioridade[0].volume_total || '');
              
              if (condicionante === 'MOD') {
                volumeParaFaixa = volumesPorMod[modalidadeN] || 0;
              } else if (condicionante === 'MOD/ESP') {
                const chave = `${modalidadeN}/${especialidadeN}`;
                volumeParaFaixa = volumesPorModEsp[chave] || 0;
              } else if (condicionante === 'MOD/ESP/CAT') {
                const chave = `${modalidadeN}/${especialidadeN}/${categoriaN}`;
                volumeParaFaixa = volumesPorModEspCat[chave] || 0;
              } else if (condicionante === 'TOTAL') {
                volumeParaFaixa = volumesPorCondicionante['TOTAL'];
              }
              
              console.log(`📐 Volume calculado para ${grupo.modalidade}/${grupo.especialidade}:`, {
                condicionante: poolPrioridade[0].volume_total,
                volume: volumeParaFaixa
              });

              // Filtrar por faixa de volume
              const poolFaixa = poolPrioridade
                .filter((p: any) =>
                  (p.volume_inicial == null || volumeParaFaixa >= p.volume_inicial) &&
                  (p.volume_final == null || volumeParaFaixa <= p.volume_final)
                )
                .sort((a: any, b: any) => (b.volume_inicial || 0) - (a.volume_inicial || 0));

              const escolhido = poolFaixa[0] || poolPrioridade[0];
              if (escolhido) {
                valorUnitario = escolhido.valor_base ?? 0;
              }
            } else {
              // SEM condicionante = SEM faixa de volume = preço fixo
              // Pegar qualquer preço do pool (todos devem ter o mesmo valor_base)
              const escolhido = poolPrioridade[0];
              if (escolhido) {
                valorUnitario = escolhido.valor_base ?? 0;
              }
            }
          }
        }
        
        const valorTotalGrupo = valorUnitario * grupo.quantidade;
        valorExamesCalculado += valorTotalGrupo;

        if (valorUnitario === 0) {
          console.log('⚠️ Sem preço para grupo:', {
            cliente: nomeFantasia,
            modalidade: grupo.modalidade,
            especialidade: grupo.especialidade,
            categoria: grupo.categoria,
            prioridade: grupo.prioridade,
            quantidade: grupo.quantidade
          });
        } else {
          console.log('💵 Preço aplicado:', {
            cliente: nomeFantasia,
            by: matchedBy,
            modalidade: grupo.modalidade,
            especialidade: grupo.especialidade,
            categoria: grupo.categoria,
            prioridade: grupo.prioridade,
            quantidade: grupo.quantidade,
            valorUnitario
          });
        }

        detalhesExames.push({
          modalidade: grupo.modalidade,
          especialidade: grupo.especialidade,
          categoria: grupo.categoria,
          prioridade: grupo.prioridade,
          quantidade: grupo.quantidade,
          valor_unitario: valorUnitario,
          valor_total: valorTotalGrupo,
          status: valorUnitario > 0 ? 'com_preco' : 'sem_preco'
        });
      }

      // Calculate franchise, portal and integration directly (without RPC)
      let valorFranquia = 0;
      let valorPortalLaudos = 0;
      let valorIntegracao = 0;
      let detalhesFranquia = {};

      console.log(`📋 Calculando franquia para ${nomeFantasia} - Volume: ${totalExames}`);
      console.log('📋 Parâmetros encontrados:', JSON.stringify(parametros, null, 2));

      // Calcular franquia baseado nos parâmetros do cliente
      if (parametros) {
        // Portal de Laudos
        if (parametros.portal_laudos && parametros.valor_integracao > 0) {
          valorPortalLaudos = Number(parametros.valor_integracao);
        }

        // Integração
        if (parametros.cobrar_integracao && parametros.valor_integracao > 0) {
          valorIntegracao = Number(parametros.valor_integracao);
        }

        // Franquia - Nova lógica consolidada
        if (parametros.aplicar_franquia) {
          const volumeFranquia = parametros.volume_franquia || 0;
          const valorFranquiaBase = Number(parametros.valor_franquia || 0);
          const valorAcimaFranquia = Number(parametros.valor_acima_franquia || 0);
          const frequenciaContinua = parametros.frequencia_continua;
          const frequenciaPorVolume = parametros.frequencia_por_volume;
          
          console.log(`📋 ${nomeFantasia}: Aplica franquia = ${parametros.aplicar_franquia}`);
          console.log(`📋 ${nomeFantasia}: Freq contínua = ${frequenciaContinua}`);
          console.log(`📋 ${nomeFantasia}: Freq por volume = ${frequenciaPorVolume}`);
          console.log(`📋 ${nomeFantasia}: Volume franquia = ${volumeFranquia}`);
          console.log(`📋 ${nomeFantasia}: Valor franquia = ${valorFranquiaBase}`);
          console.log(`📋 ${nomeFantasia}: Valor acima franquia = ${valorAcimaFranquia}`);
          console.log(`📋 ${nomeFantasia}: Total exames = ${totalExames}`);
          
          // LÓGICA CONSOLIDADA DE FRANQUIA
          if (frequenciaContinua === true) {
            // Frequência Contínua = SIM
            if (frequenciaPorVolume === true) {
              // Frequência por Volume = SIM
              if (totalExames < volumeFranquia) {
                // Volume abaixo do threshold → cobra valor base
                valorFranquia = valorFranquiaBase;
                detalhesFranquia = {
                  tipo: 'continua_sim_volume_sim_abaixo',
                  volume_base: volumeFranquia,
                  volume_atual: totalExames,
                  valor_aplicado: valorFranquia,
                  motivo: `Frequência Contínua=Sim + Volume < ${volumeFranquia}: cobra valor base ${valorFranquiaBase}`
                };
              } else {
                // Volume >= threshold → cobra valor acima franquia (se existir) ou NÃO cobra
                if (valorAcimaFranquia > 0) {
                  valorFranquia = valorAcimaFranquia;
                  detalhesFranquia = {
                    tipo: 'continua_sim_volume_sim_acima',
                    volume_base: volumeFranquia,
                    volume_atual: totalExames,
                    valor_aplicado: valorFranquia,
                    motivo: `Frequência Contínua=Sim + Volume >= ${volumeFranquia}: cobra valor acima ${valorAcimaFranquia}`
                  };
                } else {
                  valorFranquia = 0;
                  detalhesFranquia = {
                    tipo: 'continua_sim_volume_sim_acima_sem_valor',
                    volume_base: volumeFranquia,
                    volume_atual: totalExames,
                    valor_aplicado: 0,
                    motivo: `Frequência Contínua=Sim + Volume >= ${volumeFranquia} + Sem valor acima: NÃO cobra`
                  };
                }
              }
            } else {
              // Frequência por Volume = NÃO ou vazio → SEMPRE cobra valor base
              valorFranquia = valorFranquiaBase;
              detalhesFranquia = {
                tipo: 'continua_sim_volume_nao',
                volume_atual: totalExames,
                valor_aplicado: valorFranquia,
                motivo: `Frequência Contínua=Sim + Freq por Volume≠Sim: SEMPRE cobra ${valorFranquiaBase}`
              };
            }
          } else {
            // Frequência Contínua = NÃO
            if (frequenciaPorVolume === true || frequenciaPorVolume === null || frequenciaPorVolume === undefined) {
              // Frequência por Volume = SIM ou vazio
              if (totalExames < volumeFranquia) {
                // Volume abaixo do threshold → cobra franquia
                valorFranquia = valorFranquiaBase;
                detalhesFranquia = {
                  tipo: 'continua_nao_volume_sim_abaixo',
                  volume_base: volumeFranquia,
                  volume_atual: totalExames,
                  valor_aplicado: valorFranquia,
                  motivo: `Frequência Contínua=Não + Volume < ${volumeFranquia}: cobra ${valorFranquiaBase}`
                };
              } else {
                // Volume >= threshold → NÃO cobra
                valorFranquia = 0;
                detalhesFranquia = {
                  tipo: 'continua_nao_volume_sim_acima',
                  volume_base: volumeFranquia,
                  volume_atual: totalExames,
                  valor_aplicado: 0,
                  motivo: `Frequência Contínua=Não + Volume >= ${volumeFranquia}: NÃO cobra`
                };
              }
            } else {
              // Frequência por Volume = NÃO
              if (totalExames < volumeFranquia) {
                // Volume abaixo do threshold → cobra franquia
                valorFranquia = valorFranquiaBase;
                detalhesFranquia = {
                  tipo: 'continua_nao_volume_nao_abaixo',
                  volume_base: volumeFranquia,
                  volume_atual: totalExames,
                  valor_aplicado: valorFranquia,
                  motivo: `Frequência Contínua=Não + Freq por Volume=Não + Volume < ${volumeFranquia}: cobra ${valorFranquiaBase}`
                };
              } else {
                // Volume >= threshold → NÃO cobra
                valorFranquia = 0;
                detalhesFranquia = {
                  tipo: 'continua_nao_volume_nao_acima',
                  volume_base: volumeFranquia,
                  volume_atual: totalExames,
                  valor_aplicado: 0,
                  motivo: `Frequência Contínua=Não + Freq por Volume=Não + Volume >= ${volumeFranquia}: NÃO cobra`
                };
              }
            }
          }
          
          console.log(`📋 ${nomeFantasia}: Franquia calculada = R$ ${valorFranquia.toFixed(2)}`);
          console.log(`📋 ${nomeFantasia}: Detalhes:`, detalhesFranquia);
        } else {
          detalhesFranquia = {
            tipo: 'nao_aplica',
            valor_aplicado: 0,
            motivo: 'Cliente não possui franquia configurada'
          };
          console.log(`📋 ${nomeFantasia}: Não aplica franquia`);
        }
      } else {
        console.log(`📋 ${nomeFantasia}: Sem parâmetros de faturamento encontrados`);
        detalhesFranquia = {
          tipo: 'nao_aplica',
          valor_aplicado: 0,
          motivo: 'Cliente não possui parâmetros de faturamento configurados'
        };
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

      // Clientes Simples Nacional NÃO têm retenção de impostos
      if (parametros && !parametros.simples && parametros.percentual_iss) {
        valorISS = valorBruto * (parametros.percentual_iss / 100);
        if (parametros.impostos_ab_min) {
          valorISS = Math.max(valorISS, parametros.impostos_ab_min);
        }
        
        // IRRF para regime normal
        valorIRRF = valorBruto * 0.015;
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
      if (totalExames > 0 || valorLiquido > 0) {
        demonstrativos.push(demonstrativo);
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