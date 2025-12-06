import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { cliente_id, periodo, demonstrativo_data } = body;
    
    if (!cliente_id || !periodo) {
      return new Response(JSON.stringify({
        success: false,
        error: "Parâmetros obrigatórios: cliente_id e periodo"
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar dados do cliente
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('nome, nome_fantasia, cnpj, cpf')
      .eq('id', cliente_id)
      .maybeSingle();

    if (!cliente) {
      return new Response(JSON.stringify({
        success: false,
        error: "Cliente não encontrado"
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar dados calculados se existirem
    const { data: demo } = await supabase
      .from('demonstrativos_faturamento_calculados')
      .select('*')
      .eq('cliente_id', cliente_id)
      .eq('periodo_referencia', periodo)
      .order('calculado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Buscar dados detalhados da volumetria para o QUADRO 2
    // Use the same Map approach as demonstrativo generation to avoid duplicates
    const volumetriaMap = new Map();
    
    // ✅ CORREÇÃO CRÍTICA: Buscar nome_mobilemed dos parâmetros (fonte de verdade para correlação nome fantasia x nome mobilemed)
    const { data: parametros } = await supabase
      .from('parametros_faturamento')
      .select('nome_mobilemed, nome_fantasia')
      .eq('cliente_id', cliente_id);

    // Coletar todos os nomes mobilemed + variantes do cliente
    const nomeVariants = new Set([
      cliente.nome,
      cliente.nome_fantasia,
      cliente.nome?.replace(/\s+/g, ''),
      cliente.nome_fantasia?.replace(/\s+/g, ''),
      cliente.nome?.replace(/_/g, ' '),
      cliente.nome_fantasia?.replace(/_/g, ' '),
    ].filter(Boolean));

    // ✅ CRÍTICO: Adicionar TODOS os nomes mobilemed dos parâmetros
    // Exemplos de correlações:
    // - CLINICA_RADI (nome_fantasia) → MEDIMAGEMPLUS (nome_mobilemed)
    // - IMD_CS (nome_fantasia) → IMD_CS, IMDBATATAIS, IMDGUARAI (possíveis na volumetria)
    // - MATRIZ_ESPLANADA (nome_fantasia) → UNIMED_UBERABA_MATRIZ (nome_mobilemed na volumetria)
    // - PRN (nome_fantasia) → PRN, PRN TELE_... (múltiplos nome_mobilemed)
    if (parametros && parametros.length > 0) {
      parametros.forEach(p => {
        if (p.nome_mobilemed) {
          // Adicionar o nome exato
          nomeVariants.add(p.nome_mobilemed);
          // Variação sem espaços
          nomeVariants.add(p.nome_mobilemed.replace(/\s+/g, ''));
          // Variação com underscores substituídos por espaços
          nomeVariants.add(p.nome_mobilemed.replace(/_/g, ' '));
          // Variação com espaços substituídos por underscores
          nomeVariants.add(p.nome_mobilemed.replace(/\s+/g, '_'));
          
          // ✅ NOVO: Para nomes compostos com TELE_ ou outros prefixos, adicionar também a parte base
          // Ex: "PRN TELE_ARARAQUARA" → adicionar também "PRN"
          if (p.nome_mobilemed.includes(' ')) {
            const partes = p.nome_mobilemed.split(' ');
            nomeVariants.add(partes[0]); // Primeira parte (ex: PRN)
          }
        }
        
        // Adicionar também nome_fantasia dos parâmetros como variante
        if (p.nome_fantasia) {
          nomeVariants.add(p.nome_fantasia);
          nomeVariants.add(p.nome_fantasia.replace(/\s+/g, ''));
          nomeVariants.add(p.nome_fantasia.replace(/_/g, ' '));
        }
      });
    }

    console.log(`🔍 [${cliente.nome_fantasia}] Buscando volumetria com ${nomeVariants.size} variantes:`, Array.from(nomeVariants).sort());

    // Buscar por cada variante do nome
    for (const nomeVariant of Array.from(nomeVariants)) {
      const { data: volEmpresa } = await supabase
        .from('volumetria_mobilemed')
        .select(`
          id,
          "DATA_REALIZACAO",
          "DATA_LAUDO",
          "NOME_PACIENTE",
          "MEDICO",
          "ESTUDO_DESCRICAO",
          "MODALIDADE",
          "ESPECIALIDADE",
          "CATEGORIA",
          "PRIORIDADE",
          "ACCESSION_NUMBER",
          "EMPRESA",
          "Cliente_Nome_Fantasia",
          "VALORES",
          tipo_faturamento
        `)
        .eq('periodo_referencia', periodo)
        .ilike('EMPRESA', `%${nomeVariant}%`);

      const { data: volFantasia } = await supabase
        .from('volumetria_mobilemed')
        .select(`
          id,
          "DATA_REALIZACAO",
          "DATA_LAUDO",
          "NOME_PACIENTE",
          "MEDICO",
          "ESTUDO_DESCRICAO",
          "MODALIDADE",
          "ESPECIALIDADE",
          "CATEGORIA",
          "PRIORIDADE",
          "ACCESSION_NUMBER",
          "EMPRESA",
          "Cliente_Nome_Fantasia",
          "VALORES",
          tipo_faturamento
        `)
        .eq('periodo_referencia', periodo)
        .ilike('Cliente_Nome_Fantasia', `%${nomeVariant}%`);

      [...(volEmpresa || []), ...(volFantasia || [])].forEach(item => {
        const key = item.id ? item.id.toString() : `fallback_${item.EMPRESA}_${item.VALORES}_${Math.random()}`;
        volumetriaMap.set(key, item);
      });
    }

    console.log(`📊 Total de exames encontrados na volumetria para ${cliente.nome_fantasia}: ${volumetriaMap.size}`);

    // Pattern-based search apenas para clientes que precisam (se aplicável)
    const nomeFantasia = cliente.nome_fantasia || cliente.nome;
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
          .select(`
            id,
            "DATA_REALIZACAO",
            "DATA_LAUDO",
            "NOME_PACIENTE",
            "MEDICO",
            "ESTUDO_DESCRICAO",
            "MODALIDADE",
            "ESPECIALIDADE",
            "CATEGORIA",
            "PRIORIDADE",
            "ACCESSION_NUMBER",
            "EMPRESA",
            "Cliente_Nome_Fantasia",
            "VALORES",
            tipo_faturamento
          `)
          .eq('periodo_referencia', periodo)
          .ilike('EMPRESA', padrao);
        
        const { data: volFant } = await supabase
          .from('volumetria_mobilemed')
          .select(`
            id,
            "DATA_REALIZACAO",
            "DATA_LAUDO",
            "NOME_PACIENTE",
            "MEDICO",
            "ESTUDO_DESCRICAO",
            "MODALIDADE",
            "ESPECIALIDADE",
            "CATEGORIA",
            "PRIORIDADE",
            "ACCESSION_NUMBER",
            "EMPRESA",
            "Cliente_Nome_Fantasia",
            "VALORES",
            tipo_faturamento
          `)
          .eq('periodo_referencia', periodo)
          .ilike('Cliente_Nome_Fantasia', padrao);
        
        [...(volEmp || []), ...(volFant || [])].forEach(item => {
          const key = item.id ? item.id.toString() : `pattern_${item.EMPRESA}_${item.VALORES}_${Math.random()}`;
          volumetriaMap.set(key, item);
        });
      }
      console.log(`📊 ${nomeFantasia}: Pattern search completado com ${volumetriaMap.size} registros únicos`);
    }

    let volumetria = Array.from(volumetriaMap.values());
    console.log('📊 Volumetria encontrada:', volumetria?.length || 0, 'registros (antes dos filtros)');

    // Apply client-specific billing rules for NC-FT clients
    let volumetriaFiltrada = volumetria || [];
    const nomeClienteUpper = (cliente.nome_fantasia || cliente.nome || '').toUpperCase();
    
    // CRITICAL: Filter out NC-NF and EXCLUSAO records FIRST
    volumetriaFiltrada = volumetriaFiltrada.filter(vol => {
      const tipoFat = vol.tipo_faturamento;
      return tipoFat !== 'NC-NF' && tipoFat !== 'EXCLUSAO';
    });
    console.log(`🔍 Após remover NC-NF/EXCLUSAO: ${volumetriaFiltrada.length} registros`);
    
    // Filtros de clientes específicos removidos - relatório deve refletir exatamente o demonstrativo
    // Os filtros de faturamento (NC-FT, NC-NF, etc.) já foram aplicados durante a geração do demonstrativo
    
    console.log(`✅ Após filtros gerais (NC-NF/EXCLUSAO removidos): ${volumetriaFiltrada.length} registros`);
    
    // Log para debug de clientes específicos
    if (nomeClienteUpper === 'CEDIDIAG' || nomeClienteUpper.includes('CLIRAM') || nomeClienteUpper.includes('RADI') || nomeClienteUpper.includes('CBU')) {
      const totalExames = volumetriaFiltrada.reduce((acc, vol) => acc + (vol.VALORES || 0), 0);
      console.log(`📊 ${nomeClienteUpper}: ${volumetriaFiltrada.length} registros | ${totalExames} exames (sem filtros adicionais - dados do demonstrativo)`);
    }
    
    // Todos os filtros específicos de clientes foram REMOVIDOS
    // O relatório agora usa exatamente os dados do demonstrativo calculado

    // Ajustar categorias/especialidades usando cadastro_exames quando vierem como 'SC' ou vazias
    try {
      const norm = (s: any) => (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
      const categoriaCache = new Map<string, { categoria: string; especialidade: string }>();
      let atualizados = 0;
      for (const v of volumetriaFiltrada) {
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

    // Buscar preços dos serviços para calcular valores
    const { data: precos } = await supabase
      .from('precos_servicos')
      .select('*')
      .eq('cliente_id', cliente_id);

    // Usar dados do demonstrativo se fornecido, senão usar dados calculados
    const dadosFinais = demonstrativo_data || demo || {};
    
    console.log('📋 Dados finais recebidos:', JSON.stringify(dadosFinais, null, 2));

    // Helpers de parsing de valores monetários (antes do uso)
    const parseValorBR = (str: string) => {
      if (!str) return 0;
      const cleaned = String(str)
        .replace(/R\$|\s/g, '')
        .replace(/\./g, '')
        .replace(',', '.');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    };

    const readNumber = (v: any) => {
      if (v == null) return 0;
      if (typeof v === 'number') return v;
      return parseValorBR(v);
    };

    // Calcular volume total do período para seleção de faixas de preço
    const volumeTotal = (volumetriaFiltrada || []).reduce((sum, v) => sum + (v.VALORES || 0), 0) || dadosFinais.total_exames || 0;

    // ✅ CORREÇÃO CRÍTICA: Função de busca de preço EXATA - SEM FALLBACKS
    // O relatório DEVE usar os mesmos valores do demonstrativo
    const buscarPrecoExato = (exame: any) => {
      if (!precos || precos.length === 0) return 0;

      const norm = (s: any) => (s ?? '').toString().trim().toUpperCase();

      const modalidadeN = norm(exame.MODALIDADE);
      const especialidadeN = norm(exame.ESPECIALIDADE);
      const categoriaN = norm(exame.CATEGORIA || 'N/A');
      const prioridadeN = norm(exame.PRIORIDADE || 'ROTINA');

      // BUSCA EXATA: Modalidade + Especialidade + Categoria + Prioridade
      // SEM FALLBACKS - Se não encontrar, retorna 0
      const candidatos = (precos || []).filter((p: any) =>
        (p.ativo ?? true) === true &&
        norm(p.modalidade) === modalidadeN &&
        norm(p.especialidade) === especialidadeN &&
        norm(p.categoria || 'N/A') === categoriaN &&
        norm(p.prioridade || 'ROTINA') === prioridadeN
      );

      if (candidatos.length === 0) {
        console.log(`⚠️ PREÇO NÃO ENCONTRADO (EXATO): ${modalidadeN} | ${especialidadeN} | ${categoriaN} | ${prioridadeN}`);
        return 0;
      }

      // Filtrar por cliente específico
      let candidatosCliente = candidatos.filter((p: any) => p.cliente_id === cliente_id);
      if (candidatosCliente.length === 0) candidatosCliente = candidatos;

      // Selecionar faixa por volume do período
      const porFaixa = candidatosCliente
        .filter((p: any) =>
          (p.volume_inicial == null || volumeTotal >= p.volume_inicial) &&
          (p.volume_final == null || volumeTotal <= p.volume_final)
        )
        .sort((a: any, b: any) => (b.volume_inicial || 0) - (a.volume_inicial || 0));

      const selecionado = porFaixa[0] || candidatosCliente[0];
      if (!selecionado) return 0;

      return Number(selecionado.valor_base) || 0;
    };

    // ✅ PRIORIDADE: Usar detalhes_exames do demonstrativo quando disponível
    // Isso garante que relatório = demonstrativo (mesmos valores)
    let examesDetalhados: any[] = [];
    
    if (dadosFinais?.detalhes_exames && Array.isArray(dadosFinais.detalhes_exames) && dadosFinais.detalhes_exames.length > 0) {
      // Usar dados já calculados do demonstrativo
      console.log(`✅ Usando ${dadosFinais.detalhes_exames.length} exames do demonstrativo calculado`);
      examesDetalhados = dadosFinais.detalhes_exames.map((e: any) => ({
        data_exame: '',
        paciente: '',
        medico: '',
        exame: '',
        modalidade: e.modalidade || '',
        especialidade: e.especialidade || '',
        categoria: e.categoria || '',
        prioridade: e.prioridade || '',
        accession_number: '',
        origem: '',
        quantidade: e.quantidade || 0,
        valor_unitario: e.valor_unitario || 0,
        valor_total: e.valor_total || 0,
        status: e.status || 'com_preco'
      }));
    } else {
      // Fallback: calcular a partir da volumetria usando busca EXATA
      console.log(`⚠️ Sem detalhes_exames no demonstrativo - calculando a partir da volumetria`);
      examesDetalhados = (volumetriaFiltrada || []).map(v => {
        const valorUnitario = buscarPrecoExato(v);
        const quantidade = v.VALORES || 1;
        
        return {
          data_exame: v.DATA_REALIZACAO || v.DATA_LAUDO || '',
          paciente: v.NOME_PACIENTE || '',
          medico: v.MEDICO || '',
          exame: v.ESTUDO_DESCRICAO || '',
          modalidade: v.MODALIDADE || '',
          especialidade: v.ESPECIALIDADE || '',
          categoria: v.CATEGORIA || '',
          prioridade: v.PRIORIDADE || '',
          accession_number: v.ACCESSION_NUMBER || '',
          origem: v.Cliente_Nome_Fantasia || v.EMPRESA || '',
          quantidade: quantidade,
          valor_unitario: valorUnitario,
          valor_total: valorUnitario * quantidade,
          status: valorUnitario > 0 ? 'com_preco' : 'sem_preco'
        };
      });
    }

    // Valores padrão para o relatório
    const totalLaudos = volumetriaFiltrada?.reduce((sum, v) => sum + (v.VALORES || 0), 0) || dadosFinais.total_exames || 0;
    
    // Usar valores do demonstrativo se disponível (já calculados corretamente)
    let valorExames = 0;
    let valorBruto = 0;
    let valorFranquia = 0;
    let valorPortal = 0;
    let valorIntegracao = 0;
    let valorLiquido = 0;
    let totalImpostos = 0;
    
    // Detecta presença de valores do demonstrativo (banco ou payload)
    const hasDemoValores = dadosFinais && (dadosFinais.valor_bruto != null || dadosFinais.valor_bruto_total != null || dadosFinais.valor_total_faturamento != null || dadosFinais.valor_exames != null);

    if (hasDemoValores) {
      // Demonstrativo disponível - usar e reconciliar valores
      const brutoInformado = readNumber(dadosFinais.valor_bruto ?? dadosFinais.valor_bruto_total ?? dadosFinais.valor_total_faturamento ?? 0);
      const liquidoInformado = readNumber(dadosFinais.valor_liquido);
      const examesInformado = readNumber(dadosFinais.valor_exames);

      valorFranquia = readNumber(dadosFinais.valor_franquia) 
        || readNumber(dadosFinais.franquia)
        || readNumber(dadosFinais.valorFranquia)
        || readNumber(dadosFinais?.custos?.franquia);

      valorPortal = readNumber(dadosFinais.valor_portal_laudos)
        || readNumber(dadosFinais.portal_laudos)
        || readNumber(dadosFinais.portal)
        || readNumber(dadosFinais.valor_portal)
        || readNumber(dadosFinais?.custos?.portal);

      valorIntegracao = readNumber(dadosFinais.valor_integracao)
        || readNumber(dadosFinais.integracao)
        || readNumber(dadosFinais.taxa_integracao)
        || readNumber(dadosFinais?.custos?.integracao);

      console.log('💰 Valores diretos (mapeados):', { valorFranquia, valorPortal, valorIntegracao });

      // Se ainda faltarem valores, tentar extrair das observações
      if (dadosFinais.observacoes) {
        const obs = String(dadosFinais.observacoes);
        console.log('📝 Buscando nas observações:', obs);
        
        if (valorFranquia === 0) {
          const patterns = [
            /Franquia[:\s]*R?\$?\s*([\d.,]+)/i,
            /valor[_\s]+franquia[:\s]*R?\$?\s*([\d.,]+)/i,
            /franc[:\s]*R?\$?\s*([\d.,]+)/i
          ];
          for (const pattern of patterns) {
            const match = obs.match(pattern);
            if (match) {
              valorFranquia = parseValorBR(match[1]);
              console.log('✅ Franquia encontrada:', valorFranquia, 'usando padrão:', pattern);
              break;
            }
          }
        }
        
        if (valorPortal === 0) {
          const patterns = [
            /Portal[^:]*[:\s]*R?\$?\s*([\d.,]+)/i,
            /valor[_\s]+portal[:\s]*R?\$?\s*([\d.,]+)/i,
            /portal[_\s]+laudos[:\s]*R?\$?\s*([\d.,]+)/i
          ];
          for (const pattern of patterns) {
            const match = obs.match(pattern);
            if (match) {
              valorPortal = parseValorBR(match[1]);
              console.log('✅ Portal encontrado:', valorPortal, 'usando padrão:', pattern);
              break;
            }
          }
        }
        
        if (valorIntegracao === 0) {
          const patterns = [
            /Integra[çc][ãa]o[:\s]*R?\$?\s*([\d.,]+)/i,
            /valor[_\s]+integra[çc][ãa]o[:\s]*R?\$?\s*([\d.,]+)/i,
            /integr[:\s]*R?\$?\s*([\d.,]+)/i
          ];
          for (const pattern of patterns) {
            const match = obs.match(pattern);
            if (match) {
              valorIntegracao = parseValorBR(match[1]);
              console.log('✅ Integração encontrada:', valorIntegracao, 'usando padrão:', pattern);
              break;
            }
          }
        }
      }
      
      // Complementar adicionais via RPC apenas quando NÃO informados explicitamente
      const temFranquiaInformada = ('valor_franquia' in dadosFinais) || ('franquia' in dadosFinais) || ('valorFranquia' in dadosFinais) || (dadosFinais?.custos && ('franquia' in dadosFinais.custos));
      const temPortalInformado = ('valor_portal_laudos' in dadosFinais) || ('portal_laudos' in dadosFinais) || ('portal' in dadosFinais) || ('valor_portal' in dadosFinais) || (dadosFinais?.custos && ('portal' in dadosFinais.custos));
      const temIntegracaoInformada = ('valor_integracao' in dadosFinais) || ('integracao' in dadosFinais) || ('taxa_integracao' in dadosFinais) || (dadosFinais?.custos && ('integracao' in dadosFinais.custos));

      const precisaComplementar = (!temFranquiaInformada && valorFranquia === 0) || (!temPortalInformado && valorPortal === 0) || (!temIntegracaoInformada && valorIntegracao === 0);

      if (precisaComplementar) {
        try {
          const { data: calcData2, error: calcErr2 } = await supabase
            .rpc('calcular_faturamento_completo', {
              p_cliente_id: cliente_id,
              p_periodo: periodo,
              p_volume_total: totalLaudos
            });
          if (!calcErr2 && calcData2 && Array.isArray(calcData2) && calcData2.length > 0) {
            const c2 = calcData2[0];
            if (!temFranquiaInformada && valorFranquia === 0) valorFranquia = Number(c2.valor_franquia) || 0;
            if (!temPortalInformado && valorPortal === 0) valorPortal = Number(c2.valor_portal_laudos) || 0;
            if (!temIntegracaoInformada && valorIntegracao === 0) valorIntegracao = Number(c2.valor_integracao) || 0;
            console.log('🧩 Adicionais complementados via RPC', { valorFranquia, valorPortal, valorIntegracao });
          } else {
            console.warn('⚠️ RPC complementar sem dados', calcErr2);
          }
        } catch (e) {
          console.warn('RPC calcular_faturamento_completo (reconciliar) falhou:', e?.message || e);
        }
      }
      
      // Reconciliar bruto com exames + adicionais
      if (examesInformado > 0) {
        valorExames = examesInformado;
        valorBruto = valorExames + valorFranquia + valorPortal + valorIntegracao;
      } else {
        valorBruto = brutoInformado;
        valorExames = Math.max(0, valorBruto - valorFranquia - valorPortal - valorIntegracao);
        if (!isFinite(valorBruto) || valorBruto <= 0) {
          valorBruto = valorExames + valorFranquia + valorPortal + valorIntegracao;
        }
      }

      console.log('📊 Cálculo final:', { 
        valorBruto, 
        valorFranquia, 
        valorPortal, 
        valorIntegracao, 
        valorExames,
        soma_componentes: valorExames + valorFranquia + valorPortal + valorIntegracao
      });

      // Se o valor líquido não foi fornecido, calcular com as alíquotas padrão
      if (liquidoInformado == null || isNaN(liquidoInformado) || liquidoInformado === 0) {
        let pisLocal = valorBruto * 0.0065;
        let cofinsLocal = valorBruto * 0.03;
        let csllLocal = valorBruto * 0.01;
        let irrfLocal = valorBruto * 0.015;
        
        // REGRA 1: Se IRRF < R$ 10,00, zerar APENAS o IRRF
        if (irrfLocal < 10) {
          console.log(`⚠️ IRRF ${irrfLocal.toFixed(2)} < R$ 10,00 - IRRF zerado`);
          irrfLocal = 0;
        }
        
        // REGRA 2: Se (PIS + COFINS + CSLL) < R$ 10,00, zerar estes três
        const somaImpostosFederais = pisLocal + cofinsLocal + csllLocal;
        if (somaImpostosFederais < 10) {
          console.log(`⚠️ (PIS+COFINS+CSLL) ${somaImpostosFederais.toFixed(2)} < R$ 10,00 - PIS/COFINS/CSLL zerados`);
          pisLocal = 0;
          cofinsLocal = 0;
          csllLocal = 0;
        }
        
        totalImpostos = pisLocal + cofinsLocal + csllLocal + irrfLocal;
        valorLiquido = valorBruto - totalImpostos;
        console.log(`💰 Impostos aplicados: PIS=${pisLocal.toFixed(2)} COFINS=${cofinsLocal.toFixed(2)} CSLL=${csllLocal.toFixed(2)} IRRF=${irrfLocal.toFixed(2)} Total=${totalImpostos.toFixed(2)}`);
      } else {
        valorLiquido = liquidoInformado;
        totalImpostos = valorBruto - valorLiquido;
      }
    } else {
      // Calcular do zero baseado na volumetria + parâmetros oficiais (RPC)
      // 1) Sempre calcular o valor dos exames pela volumetria/preços
      valorExames = examesDetalhados.reduce((sum, e) => sum + e.valor_total, 0);

      // 2) Tentar usar RPC calcular_faturamento_completo para obter APENAS os adicionais (franquia/portal/integração)
      try {
        const { data: calcData, error: calcErr } = await supabase
          .rpc('calcular_faturamento_completo', {
            p_cliente_id: cliente_id,
            p_periodo: periodo,
            p_volume_total: totalLaudos
          });

        if (!calcErr && calcData && Array.isArray(calcData) && calcData.length > 0) {
          const c = calcData[0];
          // Ignorar c.valor_exames e c.valor_total do RPC, pois a função não retorna o valor dos exames
          valorFranquia = Number(c.valor_franquia) || 0;
          valorPortal = Number(c.valor_portal_laudos) || 0;
          valorIntegracao = Number(c.valor_integracao) || 0;
          console.log('✅ Adicionais via RPC calcular_faturamento_completo', { valorFranquia, valorPortal, valorIntegracao });
        } else {
          console.warn('⚠️ RPC indisponível ou sem dados, mantendo adicionais atuais', calcErr);
        }
      } catch (e) {
        console.warn('Erro RPC calcular_faturamento_completo:', e?.message || e);
      }

      // 3) Valor bruto = exames + adicionais
      valorBruto = valorExames + valorFranquia + valorPortal + valorIntegracao;
      
      // Buscar parâmetros do cliente para verificar adicionais e regime
      const { data: parametros } = await supabase
        .from('parametros_faturamento')
        .select('simples, aplicar_franquia, portal_laudos, cobrar_integracao')
        .eq('cliente_id', cliente_id)
        .eq('ativo', true)
        .maybeSingle();
      
      // Respeitar flags dos parâmetros: só aplica se habilitado
      if (parametros) {
        if (!parametros.aplicar_franquia) {
          valorFranquia = 0;
        }
        if (!parametros.portal_laudos) {
          valorPortal = 0;
        }
        if (!parametros.cobrar_integracao) {
          valorIntegracao = 0;
        }
      }

      // Recalcular valor bruto após ajustes
      valorBruto = valorExames + valorFranquia + valorPortal + valorIntegracao;
      
      // Calcular impostos APENAS se NÃO for Simples Nacional
      if (parametros && !parametros.simples) {
        let pisLocal = valorBruto * 0.0065;
        let cofinsLocal = valorBruto * 0.03;
        let csllLocal = valorBruto * 0.01;
        let irrfLocal = valorBruto * 0.015;
        
        // REGRA: Se IRRF < R$ 10,00, zerar IRRF
        if (irrfLocal < 10) {
          console.log(`⚠️ IRRF ${irrfLocal.toFixed(2)} < R$ 10,00 - zerado`);
          irrfLocal = 0;
        }
        
        // REGRA: Se (PIS + COFINS + CSLL) < R$ 10,00, zerar todos
        const somaImpostosFederais = pisLocal + cofinsLocal + csllLocal;
        if (somaImpostosFederais < 10) {
          console.log(`⚠️ (PIS+COFINS+CSLL) ${somaImpostosFederais.toFixed(2)} < R$ 10,00 - zerados`);
          pisLocal = 0;
          cofinsLocal = 0;
          csllLocal = 0;
        }
        
        totalImpostos = pisLocal + cofinsLocal + csllLocal + irrfLocal;
        console.log(`💰 Cliente regime normal - Impostos: PIS=${pisLocal.toFixed(2)} COFINS=${cofinsLocal.toFixed(2)} CSLL=${csllLocal.toFixed(2)} IRRF=${irrfLocal.toFixed(2)} Total=${totalImpostos.toFixed(2)}`);
      } else {
        totalImpostos = 0;
        console.log(`💰 Cliente Simples Nacional - SEM retenção de impostos`);
      }
      
      valorLiquido = valorBruto - totalImpostos;

      // Último recurso: reconciliar com faturamento agregado se ainda estiver zerado/indefinido
      if (!isFinite(valorBruto) || valorBruto <= 0) {
        try {
          const { data: fatAgg, error: fatErr } = await supabase
            .from('faturamento')
            .select('total_bruto:sum(valor_bruto)')
            .eq('cliente_id', cliente_id)
            .eq('periodo_referencia', periodo)
            .single();

          if (!fatErr && fatAgg?.total_bruto != null && Number(fatAgg.total_bruto) > 0) {
            const totalBrutoAgg = Number(fatAgg.total_bruto);
            console.log('🔄 Usando valor_bruto agregado de faturamento:', totalBrutoAgg);
            valorBruto = totalBrutoAgg;
            // Ajustar valor dos exames para manter consistência com extras
            valorExames = Math.max(0, valorBruto - valorFranquia - valorPortal - valorIntegracao);
            
            // Recalcular impostos APENAS se NÃO for Simples Nacional
            if (parametros && !parametros.simples) {
              let pis2 = valorBruto * 0.0065;
              let cofins2 = valorBruto * 0.03;
              let csll2 = valorBruto * 0.01;
              let irrf2 = valorBruto * 0.015;
              
              // REGRA: Se IRRF < R$ 10,00, zerar IRRF
              if (irrf2 < 10) {
                console.log(`⚠️ IRRF ${irrf2.toFixed(2)} < R$ 10,00 - zerado (reconciliação)`);
                irrf2 = 0;
              }
              
              // REGRA: Se (PIS + COFINS + CSLL) < R$ 10,00, zerar todos
              const soma2 = pis2 + cofins2 + csll2;
              if (soma2 < 10) {
                console.log(`⚠️ (PIS+COFINS+CSLL) ${soma2.toFixed(2)} < R$ 10,00 - zerados (reconciliação)`);
                pis2 = 0;
                cofins2 = 0;
                csll2 = 0;
              }
              
              totalImpostos = pis2 + cofins2 + csll2 + irrf2;
            } else {
              totalImpostos = 0;
            }
            valorLiquido = valorBruto - totalImpostos;
          }
        } catch (e2) {
          console.warn('Não foi possível obter agregado de faturamento:', e2?.message || e2);
        }
      }
    }
    
    // Calcular componentes individuais dos impostos para exibição
    const pis = valorBruto * 0.0065;
    const cofins = valorBruto * 0.03;
    const csll = valorBruto * 0.01;
    const irrf = valorBruto * 0.015;

    // ============= GERAÇÃO DO PDF - MODELO TELEiMAGEM =============
    const pdf = new jsPDF('l', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);

    let currentY = margin + 10;
    let pageNumber = 1;
    const totalPages = Math.ceil(examesDetalhados.length / 25) + 1;

    const addText = (text: string, x: number, y: number, options: any = {}) => {
      pdf.setFontSize(options.fontSize || 10);
      pdf.setFont('helvetica', options.bold ? 'bold' : 'normal');
      
      if (options.align === 'center') {
        const textWidth = pdf.getTextWidth(text);
        x = x + (options.maxWidth || contentWidth) / 2 - textWidth / 2;
      } else if (options.align === 'right') {
        const textWidth = pdf.getTextWidth(text);
        x = x + (options.maxWidth || contentWidth) - textWidth;
      }
      
      pdf.text(text, x, y);
      return y + (options.fontSize || 10) * 0.35;
    };

    const formatarValor = (valor: number) => {
      if (isNaN(valor) || valor === null || valor === undefined) return 'R$ 0,00';
      return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };
    
    const addFooter = () => {
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Relatório gerado automaticamente pelo sistema visus.a.i. © 2025 - Todos os direitos reservados', 
        pageWidth / 2, pageHeight - 10, { align: 'center' });
      pdf.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
    };
    
    const addNewPage = () => {
      pdf.addPage();
      pageNumber++;
      currentY = margin;
    };

    // ================ PÁGINA 1 - CABEÇALHO ================
    currentY = addText('TELEiMAGEM', margin, currentY, {
      fontSize: 18,
      bold: true,
      align: 'center',
      maxWidth: contentWidth
    });
    
    currentY = addText('EXCELÊNCIA EM TELERRADIOLOGIA', margin, currentY + 5, {
      fontSize: 10,
      align: 'center',
      maxWidth: contentWidth
    });

    currentY += 8;

    currentY = addText('RELATÓRIO DE FATURAMENTO', margin, currentY, {
      fontSize: 14,
      bold: true,
      align: 'center',
      maxWidth: contentWidth
    });

    currentY += 10;

    // ================ INFORMAÇÕES DO CLIENTE E PERÍODO ================
    const clienteNome = cliente.nome_fantasia || cliente.nome;
    const documentoCliente = cliente.cnpj || cliente.cpf || 'N/A';
    const tipoDocumento = cliente.cnpj ? 'CNPJ' : cliente.cpf ? 'CPF' : '';
    const dataRelatorio = new Date().toLocaleDateString('pt-BR');
    
    currentY = addText(`Cliente: ${clienteNome} - ${tipoDocumento}: ${documentoCliente}`, margin, currentY, { fontSize: 10, bold: false });
    currentY = addText(`Período de Referência: ${periodo}`, margin, currentY + 5, { fontSize: 10, bold: true });
    currentY = addText(`Data de Emissão: ${dataRelatorio}`, margin, currentY + 5, { fontSize: 10 });

    currentY += 8;

    // ================ QUADRO 1 - RESUMO ================
    currentY = addText('QUADRO 1 - RESUMO', margin, currentY + 5, {
      fontSize: 12,
      bold: true
    });

    currentY += 10;

    // Tabela de resumo - Layout melhorado para refletir cálculo correto
    const resumoItems = [
      ['Total de Laudos:', totalLaudos.toString()],
      ['Valor dos Exames:', formatarValor(valorExames)],
      ['+ Franquia:', formatarValor(valorFranquia)],
      ['+ Portal de Laudos:', formatarValor(valorPortal)],
      ['+ Integração:', formatarValor(valorIntegracao)],
      ['= Valor Bruto Total:', formatarValor(valorBruto)],
    ];
    
    // Impostos
    resumoItems.push(['- PIS (0.65%):', formatarValor(pis)]);
    resumoItems.push(['- COFINS (3%):', formatarValor(cofins)]);
    resumoItems.push(['- CSLL (1%):', formatarValor(csll)]);
    resumoItems.push(['- IRRF (1.5%):', formatarValor(irrf)]);

    pdf.setDrawColor(200);
    pdf.setLineWidth(0.1);

    resumoItems.forEach((item, index) => {
      const itemY = currentY + (index * 6);
      
      if (index % 2 === 0) {
        pdf.setFillColor(245, 245, 245);
        pdf.rect(margin, itemY - 3, contentWidth, 6, 'F');
      }
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text(item[0], margin + 2, itemY);
      pdf.text(item[1], pageWidth - margin - 2, itemY, { align: 'right' });
      
      pdf.line(margin, itemY + 2, pageWidth - margin, itemY + 2);
    });

    currentY += (resumoItems.length * 6) + 8;

    // Verificar quebra de página antes do destaque
    if (currentY + 12 > pageHeight - margin) {
      addFooter();
      addNewPage();
    }

    // VALOR A PAGAR - Destaque
    pdf.setFillColor(230, 230, 230);
    pdf.rect(margin, currentY, contentWidth, 10, 'F');
    pdf.setDrawColor(100);
    pdf.rect(margin, currentY, contentWidth, 10, 'D');
    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.text('VALOR A PAGAR:', margin + 2, currentY + 7);
    pdf.text(formatarValor(valorLiquido), pageWidth - margin - 2, currentY + 7, { align: 'right' });

    // Rodapé página 1
    addFooter();

    // ================ PÁGINA 2+ - QUADRO 2 (DETALHAMENTO) ================
    if (examesDetalhados.length > 0) {
      addNewPage();
      
      currentY = addText('QUADRO 2 - DETALHAMENTO', margin, currentY + 10, {
        fontSize: 12,
        bold: true
      });
      
      currentY += 10;
      
      const headers = ['Data', 'Paciente', 'Médico', 'Exame', 'Modal.', 'Espec.', 'Categ.', 'Prior.', 'Accession', 'Origem', 'Qtd', 'Valor Total'];
      const colWidths = [16, 32, 36, 34, 12, 35, 12, 14, 24, 24, 8, 10];
      
      // Cabeçalho
      pdf.setFillColor(220, 220, 220);
      pdf.setDrawColor(100);
      pdf.rect(margin, currentY, contentWidth, 7, 'FD');
      
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      
      let headerX = margin;
      headers.forEach((header, i) => {
        pdf.text(header, headerX + 1, currentY + 5);
        headerX += colWidths[i];
      });
      
      currentY += 7;
      
      // Linhas de dados
      examesDetalhados.forEach((exame, index) => {
        if (currentY > pageHeight - 25) {
          addFooter();
          addNewPage();
          currentY = margin + 10;
          
          // Repetir cabeçalho
          pdf.setFillColor(220, 220, 220);
          pdf.rect(margin, currentY, contentWidth, 7, 'FD');
          pdf.setFontSize(7);
          pdf.setFont('helvetica', 'bold');
          
          let hX = margin;
          headers.forEach((h, i) => {
            pdf.text(h, hX + 1, currentY + 5);
            hX += colWidths[i];
          });
          currentY += 7;
        }
        
        if (index % 2 === 1) {
          pdf.setFillColor(248, 248, 248);
          pdf.rect(margin, currentY, contentWidth, 6, 'F');
        }
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        
        const dataFormatada = exame.data_exame ? 
          new Date(exame.data_exame + 'T00:00:00').toLocaleDateString('pt-BR') : '';
        
        const cells = [
          dataFormatada,
          (exame.paciente || '').substring(0, 21),
          (exame.medico || '').substring(0, 20),
          (exame.exame || '').substring(0, 18),
          (exame.modalidade || '').substring(0, 6),
          (exame.especialidade || '').substring(0, 24),
          (exame.categoria || '').substring(0, 6),
          (exame.prioridade || '').substring(0, 10),
          (exame.accession_number || '').substring(0, 22),
          (exame.origem || '').substring(0, 22),
          (exame.quantidade || 1).toString(),
          formatarValor(exame.valor_total)
        ];
        
        let cellX = margin;
        cells.forEach((cell, cellIndex) => {
          const align = cellIndex === 10 ? 'center' : cellIndex === 11 ? 'right' : 'left';
          const colStart = cellX;
          const colEnd = cellX + colWidths[cellIndex];
          
          if (align === 'right') {
            // Alinhar à direita: posição no final da coluna menos margem
            pdf.text(cell, colEnd - 1, currentY + 4.5, { align: 'right' });
          } else if (align === 'center') {
            // Centralizar na coluna
            pdf.text(cell, colStart + colWidths[cellIndex] / 2, currentY + 4.5, { align: 'center' });
          } else {
            // Alinhar à esquerda: posição no início da coluna mais margem
            pdf.text(cell, colStart + 1, currentY + 4.5);
          }
          
          cellX += colWidths[cellIndex];
        });
        
        pdf.setDrawColor(200);
        pdf.line(margin, currentY + 6, pageWidth - margin, currentY + 6);
        
        currentY += 6;
      });
    }

    // Rodapé última página
    addFooter();

    // ================ GERAR E FAZER UPLOAD ================
    const pdfBytes = pdf.output('arraybuffer');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `relatorio_${clienteNome.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}_${periodo}_${timestamp}.pdf`;
    
    let pdfUrl = null;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('relatorios-faturamento')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) {
      console.error('Erro no upload do PDF:', uploadError);
    } else {
      const { data: urlData } = supabase.storage
        .from('relatorios-faturamento')
        .getPublicUrl(fileName);
      
      pdfUrl = urlData.publicUrl;
    }

    // Resposta final
    const response = {
      success: true,
      message: "Relatório gerado com sucesso no padrão TELEiMAGEM (Quadro 1 + Quadro 2)",
      cliente: clienteNome,
      periodo: periodo,
      totalRegistros: examesDetalhados.length,
      dadosEncontrados: true,
      arquivos: pdfUrl ? [{ tipo: 'pdf', url: pdfUrl, nome: fileName }] : [],
      resumo: {
        total_laudos: totalLaudos,
        valor_bruto: valorBruto,
        valor_liquido: valorLiquido,
        franquia: valorFranquia,
        portal: valorPortal,
        integracao: valorIntegracao,
        impostos: {
          pis,
          cofins,
          csll,
          irrf,
          total: totalImpostos
        }
      },
      timestamp: new Date().toISOString()
    };
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Erro na geração do relatório:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Erro interno do servidor',
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});