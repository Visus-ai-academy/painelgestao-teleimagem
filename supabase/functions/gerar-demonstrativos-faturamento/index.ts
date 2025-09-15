import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  detalhes_tributacao: {
    simples_nacional: boolean;
    percentual_iss?: number;
    valor_iss?: number;
    base_calculo?: number;
  };
  tipo_faturamento?: string; // ✅ ADICIONAR tipo_faturamento
  alertas?: string[]; // ✅ Novo campo para alertas de problemas
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

    const { periodo } = await req.json();
    
    if (!periodo) {
      throw new Error('Período é obrigatório');
    }

    console.log(`Gerando demonstrativos para o período: ${periodo}`);

    // Primeiro, buscar TODOS os clientes para fazer filtragem adequada
    const { data: todosClientes, error: clientesError } = await supabase
      .from('clientes')
      .select(`
        id,
        nome,
        nome_fantasia,
        nome_mobilemed,
        ativo,
        status,
        contratos_clientes(
          tipo_faturamento,
          cond_volume,
          status
        ),
        parametros_faturamento(
          status,
          tipo_faturamento,
          updated_at
        )
      `)
      .order('nome');

    if (clientesError) {
      throw new Error(`Erro ao buscar clientes: ${clientesError.message}`);
    }

    if (!todosClientes || todosClientes.length === 0) {
      console.log('❌ Nenhum cliente encontrado na tabela clientes');
      
      // ✅ FALLBACK: Se não há clientes cadastrados, buscar direto da volumetria
      console.log('🔄 Tentando buscar clientes direto da volumetria...');
      
      const { data: clientesVolumetria, error: volError } = await supabase
        .from('volumetria_mobilemed')
        .select('"EMPRESA"')
        .eq('periodo_referencia', periodo)
        .not('"EMPRESA"', 'is', null)
        .not('"EMPRESA"', 'eq', '')
        .limit(50000);

      if (volError || !clientesVolumetria || clientesVolumetria.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Nenhum cliente encontrado nem no cadastro nem na volumetria'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Criar lista fictícia de clientes da volumetria
      const nomesUnicos = [...new Set(clientesVolumetria.map(c => c.EMPRESA).filter(Boolean))];
      const clientesFallback = nomesUnicos.map((nome, index) => ({
        id: 'temp-' + (index + 1), // UUID temporário mais simples
        nome: nome,
        nome_fantasia: nome,
        nome_mobilemed: nome,
        ativo: true,
        status: 'Ativo',
        contratos_clientes: [{ tipo_faturamento: 'CO-FT' }],
        parametros_faturamento: [{ status: 'A', tipo_faturamento: 'CO-FT' }]
      }));

      console.log(`📋 Fallback: ${clientesFallback.length} clientes criados da volumetria`);
      var todosClientesFinal = clientesFallback;
    } else {
      console.log(`📊 Total de clientes encontrados no cadastro: ${todosClientes.length}`);
      var todosClientesFinal = todosClientes;
    }

    // ✅ SEPARAR clientes ativos dos inativos/cancelados (robusto para variações)
    const isStatusInativoOuCancelado = (status?: string) => {
      const s = (status || '').toString().toLowerCase();
      return s.startsWith('cancel') || s.startsWith('inativ');
    };

    // Helpers de parâmetros/contratos
    const getParametroAtivo = (pfList?: any[]) => {
      if (!pfList || pfList.length === 0) return null;
      const ativos = pfList.filter((pf) => {
        const st = (pf.status || '').toString().toUpperCase();
        return st === 'A' || st === 'ATIVO';
      });
      if (ativos.length === 0) return null;
      // Mais recente primeiro
      ativos.sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());
      return ativos[0];
    };

    const resolveTipoFaturamento = (c: any) => {
      const pfAtivo = getParametroAtivo(c.parametros_faturamento);
      if (pfAtivo?.tipo_faturamento) return pfAtivo.tipo_faturamento;
      const tipoContrato = c.contratos_clientes?.[0]?.tipo_faturamento;
      if (tipoContrato) return tipoContrato;
      // Fallback: lista conhecida (NC) ou CO-FT
      const nomeCliente = (c.nome_fantasia || c.nome || '').toUpperCase();
      const clientesNC = [
        'CDICARDIO','CDIGOIAS','CISP','CLIRAM','CRWANDERLEY','DIAGMAX-PR','GOLD','PRODIMAGEM','TRANSDUSON','ZANELLO','CEMVALENCA','RMPADUA','RADI-IMAGEM'
      ];
      return clientesNC.some((nc) => nomeCliente.includes(nc)) ? 'NC-FT' : 'CO-FT';
    };

    // Helper: identificar clientes NC-NF (via parâmetros ou contrato ou fallback)
    const isNCNF = (c: any) => {
      const pfAtivo = getParametroAtivo(c.parametros_faturamento);
      const tipoParam = pfAtivo?.tipo_faturamento?.toUpperCase?.();
      if (tipoParam === 'NC-NF') return true;
      const tipoContrato = c.contratos_clientes?.[0]?.tipo_faturamento?.toUpperCase?.();
      if (tipoContrato === 'NC-NF') return true;
      const nomeCliente = (c.nome_fantasia || c.nome || '').toUpperCase();
      const clientesNC = [
        'CDICARDIO', 'CDIGOIAS', 'CISP', 'CLIRAM', 'CRWANDERLEY', 'DIAGMAX-PR',
        'GOLD', 'PRODIMAGEM', 'TRANSDUSON', 'ZANELLO', 'CEMVALENCA', 'RMPADUA', 'RADI-IMAGEM'
      ];
      return clientesNC.some(nc => nomeCliente.includes(nc));
    };

    // ✅ Considerar APENAS clientes ativos e com parâmetro ATIVO (se existir) e NÃO NC-NF
    const clientesAtivos = todosClientesFinal.filter(c => {
      const pfAtivo = getParametroAtivo(c.parametros_faturamento);
      const paramStatusOk = pfAtivo ? !isStatusInativoOuCancelado(pfAtivo.status) : true;
      return (
        c.ativo && !isStatusInativoOuCancelado(c.status) && paramStatusOk && !isNCNF(c)
      );
    });
    
    // Clientes inativos/cancelados (para verificação de volumetria) – NÃO incluir no demonstrativo
    const clientesInativos = todosClientesFinal.filter(c => 
      !c.ativo || isStatusInativoOuCancelado(c.status) || isStatusInativoOuCancelado(getParametroAtivo(c.parametros_faturamento)?.status)
    );
    
    console.log(`📊 Clientes ativos: ${clientesAtivos.length}, Inativos/Cancelados: ${clientesInativos.length}`);

    // ✅ OTIMIZAÇÃO: Buscar clientes inativos com volumetria de forma mais eficiente
    const clientesInativosComVolumetria = [];
    const alertasClientes: string[] = [];
    
    if (clientesInativos.length > 0) {
      // Buscar volumetria em batch para todos os nomes de clientes inativos
      const nomesInativosParaBuscar = clientesInativos
        .filter(c => !isNCNF(c))
        .map(c => [c.nome, c.nome_mobilemed, c.nome_fantasia])
        .flat()
        .filter(Boolean);
      
      if (nomesInativosParaBuscar.length > 0) {
        const { data: volumetriaInativos } = await supabase
          .from('volumetria_mobilemed')
          .select('"EMPRESA"')
          .eq('periodo_referencia', periodo)
          .in('"EMPRESA"', nomesInativosParaBuscar)
          .not('"VALORES"', 'is', null);
        
        if (volumetriaInativos && volumetriaInativos.length > 0) {
          const empresasComVolumetria = new Set(volumetriaInativos.map(v => v.EMPRESA));
          
          for (const clienteInativo of clientesInativos) {
            if (isNCNF(clienteInativo)) continue;
            
            const nomeFantasia = clienteInativo.nome_fantasia || clienteInativo.nome;
            const nomes = [clienteInativo.nome, clienteInativo.nome_mobilemed, nomeFantasia].filter(Boolean);
            
            if (nomes.some(nome => empresasComVolumetria.has(nome))) {
              clientesInativosComVolumetria.push(clienteInativo);
              const status = !clienteInativo.ativo ? 'INATIVO' : 
                           clienteInativo.status === 'Cancelado' ? 'CANCELADO' : 'INATIVO';
              alertasClientes.push(`⚠️ Cliente ${status}: ${nomeFantasia} possui volumetria no período ${periodo} mas está ${status.toLowerCase()}`);
            }
          }
        }
      }
    }

    // ✅ LISTA FINAL: apenas clientes ativos (já sem NC-NF) + inativos com volumetria (já filtrado NC-NF)
    let clientes = [...clientesAtivos, ...clientesInativosComVolumetria];
    
    console.log('Clientes para demonstrativo: ' + clientes.length + ' (' + clientesAtivos.length + ' ativos + ' + clientesInativosComVolumetria.length + ' inativos com volumetria)');
    
    if (clientes.length === 0) {
      console.warn('⚠️ Nenhum cliente elegível após filtros. Aplicando fallback baseado na volumetria...');
      const { data: clientesVolumetriaAll, error: volAllErr } = await supabase
        .from('volumetria_mobilemed')
        .select('"EMPRESA"')
        .eq('periodo_referencia', periodo)
        .not('"EMPRESA"', 'is', null)
        .not('"EMPRESA"', 'eq', '')
        .limit(50000);

      if (volAllErr) {
        console.error('❌ Erro ao buscar volumetria para fallback:', volAllErr);
      } else {
        const nomesUnicos = [...new Set((clientesVolumetriaAll || []).map(c => c.EMPRESA).filter(Boolean))];
        
        // FILTRAR clientes NC-NF também no fallback
        const clientesFallbackFiltrados = [];
        for (const nome of nomesUnicos) {
          // Verificar se é cliente NC conhecido
          const nomeUpper = nome.toUpperCase();
          const clientesNC = [
            'CDICARDIO', 'CDIGOIAS', 'CISP', 'CLIRAM', 'CRWANDERLEY', 'DIAGMAX-PR',
            'GOLD', 'PRODIMAGEM', 'TRANSDUSON', 'ZANELLO', 'CEMVALENCA', 'RMPADUA', 'RADI-IMAGEM'
          ];
          const isClienteNC = clientesNC.some(nc => nomeUpper.includes(nc));
          
          if (!isClienteNC) { // Só incluir se NÃO for NC
            clientesFallbackFiltrados.push({
              id: 'temp-' + (clientesFallbackFiltrados.length + 1),
              nome,
              nome_fantasia: nome,
              nome_mobilemed: nome,
              ativo: true,
              status: 'Ativo',
              parametros_faturamento: [{ status: 'A', tipo_faturamento: 'CO-FT' }],
            });
          }
        }
        
        clientes = clientesFallbackFiltrados;
        console.log('Fallback aplicado: ' + clientes.length + ' clientes adicionados a partir da volumetria (excluindo NC).');
      }
    }

    if (alertasClientes.length > 0) {
      console.log(`ALERTA - Clientes inativos com volumetria:`, alertasClientes);
    }

    // Agrupar clientes para demonstrativo por nome_fantasia para evitar duplicatas 
    const clientesAgrupados = new Map();
    
    for (const cliente of clientes) {
      const nomeFantasia = cliente.nome_fantasia || cliente.nome;
      
      if (!clientesAgrupados.has(nomeFantasia)) {
        clientesAgrupados.set(nomeFantasia, {
          id: cliente.id,
          nome: cliente.nome,
          nome_fantasia: nomeFantasia,
          nomes_mobilemed: [
            cliente.nome, // Nome principal
            cliente.nome_mobilemed, // Nome MobileMed se existir
            nomeFantasia // Nome fantasia
          ].filter(Boolean), // Remove valores null/undefined
          parametros_faturamento: cliente.parametros_faturamento,
          tipo_faturamento: cliente.parametros_faturamento?.[0]?.tipo_faturamento || 'CO-FT' // ✅ ADICIONAR tipo_faturamento
        });
      } else {
        // Adicionar nomes adicionais para busca na volumetria
        const clienteExistente = clientesAgrupados.get(nomeFantasia);
        if (cliente.nome && !clienteExistente.nomes_mobilemed.includes(cliente.nome)) {
          clienteExistente.nomes_mobilemed.push(cliente.nome);
        }
        if (cliente.nome_mobilemed && !clienteExistente.nomes_mobilemed.includes(cliente.nome_mobilemed)) {
          clienteExistente.nomes_mobilemed.push(cliente.nome_mobilemed);
        }
      }
    }

    console.log(`📋 ${clientesAgrupados.size} clientes únicos após agrupamento por nome fantasia`);

    // Alertas já populados ao identificar clientes inativos com volumetria acima.


    const demonstrativos: DemonstrativoCliente[] = [];
    let processados = 0;

    // Processar cada cliente agrupado
    for (const cliente of clientesAgrupados.values()) {
      try {
        console.log('Processando cliente:', cliente.nome_fantasia);
        
        // ✅ Resolver cliente_id válido (UUID) antes de cálculos
        const isUuid = (v?: string) => !!v && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
        let clienteIdValido: string | null = isUuid(cliente.id) ? cliente.id : null;
        if (!clienteIdValido) {
          // Tentar resolver por nome exato nas 3 colunas
          const nomesBusca: string[] = Array.from(new Set((cliente.nomes_mobilemed || []).filter(Boolean)));
          let resolved: { id: string } | null = null;
          // Buscar por nome
          if (!resolved) {
            const resp = await supabase.from('clientes').select('id').in('nome', nomesBusca).limit(1);
            if (!resp.error && resp.data && resp.data.length > 0) resolved = resp.data[0] as any;
          }
          // Buscar por nome_fantasia
          if (!resolved) {
            const resp = await supabase.from('clientes').select('id').in('nome_fantasia', nomesBusca).limit(1);
            if (!resp.error && resp.data && resp.data.length > 0) resolved = resp.data[0] as any;
          }
          // Buscar por nome_mobilemed
          if (!resolved) {
            const resp = await supabase.from('clientes').select('id').in('nome_mobilemed', nomesBusca).limit(1);
            if (!resp.error && resp.data && resp.data.length > 0) resolved = resp.data[0] as any;
          }
          clienteIdValido = resolved?.id || null;
        }
        
        if (!clienteIdValido) {
          console.warn(`⚠️ Cliente sem ID válido no cadastro: ${cliente.nome_fantasia}. Preços/Parâmetros não serão aplicados.`);
        }

    // Buscar volumetria do período DIRETAMENTE no banco - mais eficiente
    console.log(`🔍 Buscando volumetria para cliente: ${cliente.nome_fantasia} no período ${periodo}`);
    
    // Paginação para evitar limite de 1000 registros
    let volumetria: any[] = [];
    const pageSize = 1000;
    let from = 0;
    while (true) {
      const { data: page, error: volumetriaError } = await supabase
        .from('volumetria_mobilemed')
        .select(`
          "EMPRESA",
          "MODALIDADE", 
          "ESPECIALIDADE",
          "CATEGORIA",
          "PRIORIDADE", 
          "VALORES",
          "MEDICO",
          "DATA_LAUDO",
          "DATA_PRAZO",
          periodo_referencia
        `)
        .eq('periodo_referencia', periodo)
        .in('"EMPRESA"', cliente.nomes_mobilemed)
        .not('"VALORES"', 'is', null)
        .range(from, from + pageSize - 1);

      if (volumetriaError) {
        console.error(`❌ ERRO ao buscar volumetria para ${cliente.nome_fantasia}:`, volumetriaError);
        break;
      }

      if (!page || page.length === 0) break;

      volumetria.push(...page);

      if (page.length < pageSize) break; // última página
      from += pageSize;
    }
    
    console.log(`📊 Cliente ${cliente.nome_fantasia} (${cliente.nomes_mobilemed.join(', ')}): ${volumetria?.length || 0} registros encontrados na volumetria para período ${periodo}`);
    
    if (volumetria && volumetria.length > 0) {
      // Log uma amostra dos dados encontrados
      console.log(`📋 Amostra volumetria ${cliente.nome_fantasia}:`, volumetria.slice(0, 3).map(v => ({
        modalidade: v.MODALIDADE,
        especialidade: v.ESPECIALIDADE,
        categoria: v.CATEGORIA,
        prioridade: v.PRIORIDADE,
        valores: v.VALORES,
        empresa: v.EMPRESA,
        periodo: v.periodo_referencia
      })));
    } else {
      console.warn(`⚠️ PROBLEMA: Nenhum dado de volumetria encontrado para ${cliente.nome_fantasia} no período ${periodo}`);
      console.log(`🔍 Nomes MobileMed para busca:`, cliente.nomes_mobilemed);
    }

        // ✅ CORREÇÃO: Contar por VALORES (exames reais), não por registros
        const totalExames = volumetria?.reduce((sum, item) => sum + (item.VALORES || 0), 0) || 0;
        
        console.log(`📈 Cliente ${cliente.nome_fantasia}: ${volumetria?.length || 0} registros, ${totalExames} exames total`);

        // ✅ BUSCAR CONDIÇÃO DE VOLUME DO CONTRATO
        const condVolume = cliente.contratos_clientes?.[0]?.cond_volume || 'MOD/ESP/CAT';
        console.log(`📋 Condição de Volume para ${cliente.nome_fantasia}: ${condVolume}`);

        // Função para calcular volume baseado na condição
        const calcularVolumeCondicional = (modalidade: string, especialidade: string, categoria: string): number => {
          if (!volumetria || volumetria.length === 0) return 0;
          
          let volumeCalculado = 0;
          
          switch (condVolume) {
            case 'MOD/ESP':
              // Somar apenas exames da modalidade + especialidade específica
              volumeCalculado = volumetria
                .filter(v => 
                  v.MODALIDADE?.toUpperCase().trim() === modalidade.toUpperCase().trim() &&
                  v.ESPECIALIDADE?.toUpperCase().trim() === especialidade.toUpperCase().trim()
                )
                .reduce((sum, item) => sum + (item.VALORES || 0), 0);
              break;
              
            case 'MOD/ESP/CAT':
              // Somar apenas exames da modalidade + especialidade + categoria específica
              volumeCalculado = volumetria
                .filter(v => 
                  v.MODALIDADE?.toUpperCase().trim() === modalidade.toUpperCase().trim() &&
                  v.ESPECIALIDADE?.toUpperCase().trim() === especialidade.toUpperCase().trim() &&
                  (v.CATEGORIA || 'SC').toUpperCase().trim() === categoria.toUpperCase().trim()
                )
                .reduce((sum, item) => sum + (item.VALORES || 0), 0);
              break;
              
            default:
              // Fallback para volume total
              volumeCalculado = totalExames;
              break;
          }
          
          console.log(`📊 Volume calculado para ${modalidade}/${especialidade}/${categoria}: ${volumeCalculado} (condição: ${condVolume})`);
          return volumeCalculado;
        };

        // Calcular valores dos exames baseado na tabela de preços
        let valorExames = 0;
        const detalhesExames = [];

        if (volumetria && volumetria.length > 0) {
          // Agrupar exames por modalidade/especialidade/categoria/prioridade
          const grupos = new Map();
          
          for (const exame of volumetria) {
            // ✅ NORMALIZAÇÃO COMPLETA: Aplicar todas as regras antes do agrupamento
            let modalidade = (exame.MODALIDADE || '').toUpperCase().trim();
            let categoriaRaw = (exame.CATEGORIA || 'SC').toUpperCase().trim();
            let prioridade = (exame.PRIORIDADE || '').toUpperCase().trim();
            let especialidade = (exame.ESPECIALIDADE || '').toUpperCase().trim();
            
            // ✅ REGRA CRÍTICA: COLUNAS sempre MUSCULO ESQUELETICO
            if (categoriaRaw === 'COLUNAS') {
              especialidade = 'MUSCULO ESQUELETICO';
            }
            
            // ✅ NORMALIZAÇÃO PRIORIDADE COMPLETA: Múltiplas variações
            // IMPORTANTE: Manter consistência com o cadastro de preços
            let prioridadeNormalizada = prioridade;
            if (prioridade === 'URGENCIA' || prioridade === 'URGENTE') {
              prioridadeNormalizada = 'URGÊNCIA'; // ✅ MANTER COM ACENTO
            }
            if (prioridade === 'PLANTAO') {
              prioridadeNormalizada = 'PLANTÃO'; // ✅ MANTER COM ACENTO
            }
            
            // ✅ CATEGORIA FALLBACK: Se categoria vazia ou inválida, usar SC
            if (!categoriaRaw || categoriaRaw === '' || categoriaRaw === 'NULL') {
              categoriaRaw = 'SC';
            }
            
            const chave = `${modalidade}_${especialidade}_${categoriaRaw}_${prioridadeNormalizada}`;
            if (!grupos.has(chave)) {
              grupos.set(chave, {
                modalidade,
                especialidade,
                categoria: categoriaRaw,
                prioridade: prioridadeNormalizada, // ✅ USAR PRIORIDADE NORMALIZADA
                quantidade: 0,
                valor_unitario: 0
              });
            }
            grupos.get(chave).quantidade += (exame.VALORES || 1);
          }

          // Calcular preço para cada grupo
          for (const grupo of grupos.values()) {
            try {
              console.log(`🔍 Buscando preço para ${cliente.nome_fantasia}: ${grupo.modalidade}/${grupo.especialidade}/${grupo.categoria}/${grupo.prioridade} (${grupo.quantidade} exames)`);
              
              // Verificar se temos todos os dados necessários
              if (!grupo.modalidade || !grupo.especialidade) {
                console.warn(`⚠️ Dados incompletos no grupo:`, grupo);
                continue;
              }

              // ✅ CALCULAR VOLUME BASEADO NA CONDIÇÃO DO CONTRATO
              const volumeEspecifico = calcularVolumeCondicional(
                grupo.modalidade, 
                grupo.especialidade, 
                grupo.categoria || 'SC'
              );

              // Primeira tentativa: prioridade informada
              let preco: number | null = null;
              let precoError: any = null;

              // ✅ LOGS DETALHADOS PARA DEBUG
              console.log(`🔍 DEBUG: Calculando preço para ${cliente.nome_fantasia}:`, {
                modalidade: grupo.modalidade,
                especialidade: grupo.especialidade, 
                categoria: grupo.categoria || 'SC',
                prioridade: grupo.prioridade,
                quantidade: grupo.quantidade,
                volume_especifico: volumeEspecifico, // ✅ Usar volume específico da condição
                condicao_volume: condVolume,
                is_plantao: grupo.prioridade.includes('PLANTAO') || grupo.prioridade.includes('PLANTÃO')
              });

              try {
                const rpc1 = await supabase.rpc('calcular_preco_exame', {
                  p_cliente_id: clienteIdValido,
                  p_modalidade: grupo.modalidade,
                  p_especialidade: grupo.especialidade,
                  p_prioridade: grupo.prioridade,
                  p_categoria: grupo.categoria || 'SC',
                  p_volume_total: volumeEspecifico, // ✅ Usar volume específico baseado na condição
                  p_is_plantao: grupo.prioridade.includes('PLANTAO') || grupo.prioridade.includes('PLANTÃO')
                });
                preco = rpc1.data as number | null;
                precoError = rpc1.error;
              } catch (e) {
                precoError = e;
              }

              console.log(`📊 Resultado da função calcular_preco_exame:`, {
                cliente: cliente.nome_fantasia,
                modalidade: grupo.modalidade,
                especialidade: grupo.especialidade,
                prioridade: grupo.prioridade,
                categoria: grupo.categoria,
                quantidade: grupo.quantidade,
                volume_usado: volumeEspecifico,
                preco_retornado: preco,
                erro: precoError?.message || precoError || 'nenhum',
                rpc_error: precoError ? true : false
              });

              // Fallback 1: se não encontrou, tentar com prioridade ROTINA
              if ((!preco || preco <= 0) && !precoError) {
                const rpc2 = await supabase.rpc('calcular_preco_exame', {
                  p_cliente_id: clienteIdValido,
                  p_modalidade: grupo.modalidade,
                  p_especialidade: grupo.especialidade,
                  p_prioridade: 'ROTINA',
                  p_categoria: grupo.categoria || 'SC',
                  p_volume_total: volumeEspecifico,
                  p_is_plantao: false
                });
                if (!rpc2.error && rpc2.data) {
                  preco = rpc2.data as number;
                }
              }

              // Fallback 2: se ainda não encontrou e categoria != SC, tentar com SC
              if ((!preco || preco <= 0) && (grupo.categoria || 'SC') !== 'SC') {
                const rpc3 = await supabase.rpc('calcular_preco_exame', {
                  p_cliente_id: clienteIdValido,
                  p_modalidade: grupo.modalidade,
                  p_especialidade: grupo.especialidade,
                  p_prioridade: grupo.prioridade,
                  p_categoria: 'SC',
                  p_volume_total: volumeEspecifico,
                  p_is_plantao: grupo.prioridade.includes('PLANTAO') || grupo.prioridade.includes('PLANTÃO')
                });
                if (!rpc3.error && rpc3.data) {
                  preco = rpc3.data as number;
                }
              }

              if (preco && preco > 0) {
                grupo.valor_unitario = preco;
                const valorGrupo = grupo.quantidade * preco;
                valorExames += valorGrupo;
                
                detalhesExames.push({
                  ...grupo,
                  valor_total: valorGrupo,
                  status: 'preco_encontrado'
                });
                
                console.log(`💰 Preço encontrado: ${grupo.modalidade}/${grupo.especialidade}/${grupo.categoria}/${grupo.prioridade} = R$ ${preco.toFixed(2)} x ${grupo.quantidade} = R$ ${valorGrupo.toFixed(2)}`);
              } else {
                // Sem fallback: respeitar regras existentes e não aplicar valores artificiais
                detalhesExames.push({
                  ...grupo,
                  valor_total: 0,
                  valor_unitario: 0,
                  status: 'preco_nao_encontrado',
                  problema: `Preço não encontrado para ${grupo.modalidade}/${grupo.especialidade}/${grupo.categoria}/${grupo.prioridade}`
                });
                console.warn(`⚠️ Preço NÃO encontrado: ${grupo.modalidade}/${grupo.especialidade}/${grupo.categoria}/${grupo.prioridade}`);
              }
            } catch (error) {
              console.error(`❌ Erro ao calcular preço para ${cliente.nome_fantasia}:`, error);
            }
          }
        }

        // Calcular franquia, portal e integração usando lógica corrigida
        console.log(`💰 Calculando faturamento para ${cliente.nome_fantasia} - Volume: ${totalExames}`);
        
        // ✅ BUSCAR PARÂMETROS DE FATURAMENTO COMPLETOS (somente se houver clienteId válido)
        let parametros: any = undefined;
        let paramsError: any = null;
        if (clienteIdValido) {
          const { data: parametrosFaturamento, error: err } = await supabase
            .from('parametros_faturamento')
            .select(`
              aplicar_franquia,
              valor_franquia,
              volume_franquia,
              frequencia_continua,
              frequencia_por_volume,
              valor_acima_franquia,
              valor_integracao,
              portal_laudos,
              cobrar_integracao,
              simples,
              percentual_iss
            `)
            .eq('cliente_id', clienteIdValido)
            .eq('status', 'A')
            .order('updated_at', { ascending: false })
            .limit(1);
          parametros = parametrosFaturamento?.[0];
          paramsError = err;
        }
        
        if (paramsError) {
          console.error(`❌ Erro ao buscar parâmetros para ${cliente.nome_fantasia}:`, paramsError);
        }
        
        console.log(`🔧 Parâmetros ${cliente.nome_fantasia}:`, {
          tem_parametros: !!parametros,
          aplicar_franquia: parametros?.aplicar_franquia,
          valor_franquia: parametros?.valor_franquia,
          portal_laudos: parametros?.portal_laudos,
          cobrar_integracao: parametros?.cobrar_integracao,
          simples: parametros?.simples,
          percentual_iss: parametros?.percentual_iss
        });
        let valorFranquia = 0;
        let valorPortal = 0;
        let valorIntegracao = 0;
        let detalhesFranquia = {};

        // LÓGICA CORRIGIDA DA FRANQUIA
        if (parametros?.aplicar_franquia) {
          if (parametros.frequencia_continua) {
            // Frequência contínua = SIM: sempre cobra franquia
            if (parametros.frequencia_por_volume && totalExames > (parametros.volume_franquia || 0)) {
              valorFranquia = parametros.valor_acima_franquia || parametros.valor_franquia || 0;
              detalhesFranquia = {
                tipo: 'continua_com_volume',
                volume_base: parametros.volume_franquia,
                volume_atual: totalExames,
                valor_aplicado: valorFranquia,
                motivo: 'Frequência contínua + volume acima da franquia'
              };
            } else {
              valorFranquia = parametros.valor_franquia || 0;
              detalhesFranquia = {
                tipo: 'continua_normal', 
                volume_atual: totalExames,
                valor_aplicado: valorFranquia,
                motivo: 'Frequência contínua - valor base'
              };
            }
          } else {
            // Frequência contínua = NÃO: só cobra se houver volume
            if (totalExames > 0) {
              if (parametros.frequencia_por_volume && totalExames > (parametros.volume_franquia || 0)) {
                valorFranquia = parametros.valor_acima_franquia || parametros.valor_franquia || 0;
                detalhesFranquia = {
                  tipo: 'volume_acima',
                  volume_base: parametros.volume_franquia,
                  volume_atual: totalExames,
                  valor_aplicado: valorFranquia,
                  motivo: 'Volume acima da franquia (regra por volume)'
                };
              } else if (!parametros.frequencia_por_volume && (parametros.volume_franquia || 0) > 0 && totalExames > (parametros.volume_franquia || 0)) {
                // Novo: sem regra por volume e volume acima do limite → NÃO cobra franquia
                valorFranquia = 0;
                detalhesFranquia = {
                  tipo: 'acima_volume_sem_regra',
                  volume_base: parametros.volume_franquia,
                  volume_atual: totalExames,
                  valor_aplicado: 0,
                  motivo: 'Volume acima da franquia e frequencia_por_volume = false - franquia NÃO aplicada'
                };
              } else {
                valorFranquia = parametros.valor_franquia || 0;
                detalhesFranquia = {
                  tipo: 'volume_normal',
                  volume_atual: totalExames,
                  valor_aplicado: valorFranquia,
                  motivo: 'Volume dentro da franquia'
                };
              }
            } else {
              // Volume = 0 e frequência contínua = NÃO → Não cobra franquia
              valorFranquia = 0;
              detalhesFranquia = {
                tipo: 'sem_volume',
                volume_atual: 0,
                valor_aplicado: 0,
                motivo: 'Sem volume de exames e frequência não contínua - franquia NÃO aplicada'
              };
            }
          }
        } else {
          detalhesFranquia = {
            tipo: 'nao_aplica',
            valor_aplicado: 0,
            motivo: 'Cliente não possui franquia configurada'
          };
        }

        // ✅ PORTAL DE LAUDOS: Sempre usar valor_integracao se portal_laudos = true
        if (parametros?.portal_laudos) {
          valorPortal = parametros.valor_integracao || 0;
        }

        // ✅ INTEGRAÇÃO: Valor específico para integração  
        if (parametros?.cobrar_integracao) {
          valorIntegracao = parametros.valor_integracao || 0;
        }

        // ✅ Garantir cálculo do valor total de exames baseado em preços reais
        if (valorExames === 0 && totalExames > 0) {
          console.log(`⚠️ PROBLEMA: Cliente ${cliente.nome_fantasia} tem ${totalExames} exames na volumetria mas valor calculado = R$ 0,00`);
        }

        const calculoCompleto = [{
          valor_franquia: valorFranquia,
          valor_portal_laudos: valorPortal,
          valor_integracao: valorIntegracao,
          detalhes_franquia: detalhesFranquia
        }];

        console.log(`📊 Cliente ${cliente.nome_fantasia}: Franquia R$ ${valorFranquia.toFixed(2)} | Portal R$ ${valorPortal.toFixed(2)} | Integração R$ ${valorIntegracao.toFixed(2)}`);
        
        if (valorExames === 0 && totalExames > 0) {
          console.log(`⚠️ PROBLEMA: Cliente ${cliente.nome_fantasia} tem ${totalExames} exames na volumetria mas valor calculado = R$ 0,00`);
        }

        const calculo = calculoCompleto?.[0];
        if (!calculo) {
          console.warn(`Nenhum resultado de cálculo para ${cliente.nome_fantasia}`);
          continue;
        }

        // ✅ CALCULAR TRIBUTAÇÃO: Usar os mesmos parâmetros já buscados
        const simplesNacional = parametros?.simples || false;
        const percentualISS = parametros?.percentual_iss || 0;
        
        
        const valorBruto = valorExames + (calculo.valor_franquia || 0) + (calculo.valor_portal_laudos || 0) + (calculo.valor_integracao || 0);
        console.log(`💰 Tributação ${cliente.nome_fantasia}:`, {
          simples_nacional: simplesNacional,
          percentual_iss: percentualISS,
          valor_bruto: valorBruto
        });
        let valorImpostos = 0;
        let valorISS = 0;
        
        // ✅ CORREÇÃO TRIBUTAÇÃO: Calcular ISS se percentual > 0 OU buscar do contrato
        if (percentualISS > 0) {
          valorISS = valorBruto * (percentualISS / 100);
          valorImpostos = valorISS;
        } else if (!simplesNacional) {
          // Buscar ISS do contrato se não tem nos parâmetros
          const { data: contratoISS } = await supabase
            .from('contratos_clientes')
            .select('percentual_iss')
            .eq('cliente_id', cliente.id)
            .order('created_at', { ascending: false })
            .limit(1);
          
          const issContrato = contratoISS?.[0]?.percentual_iss || 0;
          if (issContrato > 0) {
            valorISS = valorBruto * (issContrato / 100);
            valorImpostos = valorISS;
          }
        }
        
        const valorTotal = valorBruto - valorImpostos;

        // Montar demonstrativo com alertas para problemas
        const temProblemas = valorExames === 0 && totalExames > 0;
        const temFranquiaProblema = valorFranquia > 0 && totalExames === 0 && !parametros?.frequencia_continua;
        
         const demonstrativo: DemonstrativoCliente = {
          cliente_id: cliente.id,
          cliente_nome: cliente.nome_fantasia || cliente.nome,
          periodo,
          total_exames: totalExames, // ✅ Agora é a contagem real de exames (VALORES)
          valor_exames: valorExames,
          valor_franquia: valorFranquia,
          valor_portal_laudos: valorPortal,
          valor_integracao: valorIntegracao,
          valor_bruto: valorBruto,
          valor_impostos: valorImpostos,
          valor_total: valorTotal,
          detalhes_franquia: detalhesFranquia || {},
          detalhes_exames: detalhesExames,
          detalhes_tributacao: {
            simples_nacional: simplesNacional,
            percentual_iss: percentualISS,
            valor_iss: valorISS,
            base_calculo: valorBruto
          }
        };

        // ✅ ADICIONAR DETALHES DOS EXAMES PARA INTERFACE
        demonstrativo.detalhes_exames = detalhesExames;
        
        // Adicionar alertas se houver problemas
        if (temProblemas) {
          demonstrativo.alertas = [`⚠️ Cliente tem ${totalExames} exames mas valor R$ 0,00 - verificar tabela de preços`];
        }
        if (temFranquiaProblema) {
          demonstrativo.alertas = demonstrativo.alertas || [];
          demonstrativo.alertas.push(`⚠️ Franquia cobrada sem volume (freq. contínua = false)`);
        }

        demonstrativos.push(demonstrativo);
        processados++;
        
        console.log(`Cliente ${cliente.nome_fantasia} processado com sucesso - Total: R$ ${demonstrativo.valor_total.toFixed(2)} (${totalExames} exames)`);

      } catch (error) {
        console.error(`Erro ao processar cliente ${cliente.nome_fantasia}:`, error);
        continue;
      }
    }

    // Ordenar por valor total (maior primeiro)
    demonstrativos.sort((a, b) => b.valor_total - a.valor_total);

    const resumo = {
      total_clientes: clientes.length,
      clientes_processados: processados,
      total_exames_geral: demonstrativos.reduce((sum, d) => sum + d.total_exames, 0), // ✅ ADICIONAR TOTAL EXAMES
      valor_bruto_geral: demonstrativos.reduce((sum, d) => sum + d.valor_bruto, 0),
      valor_impostos_geral: demonstrativos.reduce((sum, d) => sum + d.valor_impostos, 0),
      valor_total_geral: demonstrativos.reduce((sum, d) => sum + d.valor_total, 0),
      valor_exames_geral: demonstrativos.reduce((sum, d) => sum + d.valor_exames, 0),
      valor_franquias_geral: demonstrativos.reduce((sum, d) => sum + d.valor_franquia, 0),
      valor_portal_geral: demonstrativos.reduce((sum, d) => sum + d.valor_portal_laudos, 0),
      valor_integracao_geral: demonstrativos.reduce((sum, d) => sum + d.valor_integracao, 0),
      clientes_simples_nacional: demonstrativos.filter(d => d.detalhes_tributacao.simples_nacional).length,
      clientes_regime_normal: demonstrativos.filter(d => !d.detalhes_tributacao.simples_nacional).length
    };

    console.log('Demonstrativos gerados:', resumo);

    // Salvar dados no localStorage do cliente (via resposta)
    const dadosParaSalvar = {
      demonstrativos,
      resumo,
      periodo,
      timestamp: new Date().toISOString()
    };

    return new Response(
      JSON.stringify({
        success: true,
        periodo,
        resumo,
        demonstrativos,
        alertas: alertasClientes, // ✅ INCLUIR ALERTAS de clientes inativos com volumetria
        salvar_localStorage: {
          chave: `demonstrativos_completos_${periodo}`,
          dados: dadosParaSalvar
        },
        message: `Demonstrativos gerados para ${processados} clientes`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao gerar demonstrativos:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});