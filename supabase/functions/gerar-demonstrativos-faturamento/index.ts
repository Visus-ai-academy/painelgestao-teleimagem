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

    const { periodo, clientesPermitidos } = await req.json();
    
    if (!periodo) {
      throw new Error('Período é obrigatório');
    }

    console.log(`Gerando demonstrativos para o período: ${periodo}`);
    
    // ✅ LIMITAÇÃO DE TESTE: Se clientesPermitidos fornecido, aplicar filtro
    if (clientesPermitidos && Array.isArray(clientesPermitidos)) {
      console.log(`🧪 [TESTE] Limitação ativa para clientes: ${clientesPermitidos.join(', ')}`);
    }

    // ✅ MUDANÇA FUNDAMENTAL: Buscar APENAS clientes com volumetria no período
    console.log(`🔍 Buscando clientes que TÊM volumetria no período: ${periodo}`);
    
    const { data: clientesComVolumetria, error: volError } = await supabase
      .from('volumetria_mobilemed')
      .select('"EMPRESA"')
      .eq('periodo_referencia', periodo)
      .not('"EMPRESA"', 'is', null)
      .not('"EMPRESA"', 'eq', '')
      .not('"VALORES"', 'is', null)
      .gt('"VALORES"', 0)
      .limit(50000);

    if (volError) {
      throw new Error(`Erro ao buscar volumetria: ${volError.message}`);
    }

    if (!clientesComVolumetria || clientesComVolumetria.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Nenhum cliente com volumetria encontrado para o período ${periodo}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ Obter lista única de clientes que realmente têm volumetria
    const nomesComVolumetria = [...new Set(clientesComVolumetria.map(c => c.EMPRESA).filter(Boolean))];
    console.log(`📊 Clientes únicos com volumetria: ${nomesComVolumetria.length}`, nomesComVolumetria);
    
    // ✅ APLICAR LIMITAÇÃO DE TESTE se fornecida
    let clientesFiltrados = nomesComVolumetria;
    if (clientesPermitidos && Array.isArray(clientesPermitidos)) {
      clientesFiltrados = nomesComVolumetria.filter(nome => 
        clientesPermitidos.some(permitido => nome.toUpperCase().includes(permitido.toUpperCase()))
      );
      console.log(`🧪 [TESTE] Filtro aplicado: ${clientesFiltrados.length}/${nomesComVolumetria.length} clientes mantidos`);
      console.log(`🧪 [TESTE] Clientes filtrados:`, clientesFiltrados);
    }

    if (clientesFiltrados.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: clientesPermitidos 
            ? `Nenhum dos clientes de teste (${clientesPermitidos.join(', ')}) possui volumetria no período ${periodo}`
            : `Nenhum cliente elegível após filtros para o período ${periodo}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ Buscar dados completos APENAS dos clientes que têm volumetria
    // OTIMIZAÇÃO: Fazer consultas separadas para evitar queries muito complexas
    console.log(`🔍 Buscando dados completos para ${clientesFiltrados.length} clientes...`);
    
    // Fazer 3 consultas separadas para cada tipo de nome
    const consultasPromises = [
      supabase.from('clientes').select(`
        id, nome, nome_fantasia, nome_mobilemed, ativo, status,
        contratos_clientes(tipo_faturamento, cond_volume, status),
        parametros_faturamento(status, tipo_faturamento, updated_at)
      `).in('nome', clientesFiltrados),
      
      supabase.from('clientes').select(`
        id, nome, nome_fantasia, nome_mobilemed, ativo, status,
        contratos_clientes(tipo_faturamento, cond_volume, status),
        parametros_faturamento(status, tipo_faturamento, updated_at)
      `).in('nome_fantasia', clientesFiltrados),
      
      supabase.from('clientes').select(`
        id, nome, nome_fantasia, nome_mobilemed, ativo, status,
        contratos_clientes(tipo_faturamento, cond_volume, status),
        parametros_faturamento(status, tipo_faturamento, updated_at)
      `).in('nome_mobilemed', clientesFiltrados)
    ];
    
    const resultadosConsultas = await Promise.all(consultasPromises);
    
    // Combinar resultados e remover duplicatas por ID
    const clientesCompletos = [];
    const idsVistos = new Set();
    
    resultadosConsultas.forEach(({ data }) => {
      if (data) {
        data.forEach(cliente => {
          if (!idsVistos.has(cliente.id)) {
            idsVistos.add(cliente.id);
            clientesCompletos.push(cliente);
          }
        });
      }
    });
    
    console.log(`📋 Clientes encontrados no cadastro: ${clientesCompletos.length}`);
    
    const clientesError = resultadosConsultas.some(r => r.error) ? 
      resultadosConsultas.find(r => r.error)?.error : null;

    // ✅ Complementar com clientes não encontrados no cadastro (fallback)
    let todosClientesFinal = [...(clientesCompletos || [])];
    const clientesEncontrados = new Set();
    
    // Mapear nomes encontrados no cadastro
    (clientesCompletos || []).forEach(c => {
      [c.nome, c.nome_fantasia, c.nome_mobilemed].filter(Boolean).forEach(nome => {
        if (clientesFiltrados.includes(nome)) {
          clientesEncontrados.add(nome);
        }
      });
    });
    
    // Adicionar clientes que têm volumetria mas não estão no cadastro
    const clientesNaoEncontrados = clientesFiltrados.filter(nome => !clientesEncontrados.has(nome));
    
    if (clientesNaoEncontrados.length > 0) {
      console.log(`⚠️ ${clientesNaoEncontrados.length} clientes com volumetria não encontrados no cadastro:`, clientesNaoEncontrados);
      
      // Criar registros temporários para clientes não cadastrados
      clientesNaoEncontrados.forEach((nome, index) => {
        todosClientesFinal.push({
          id: `temp-volumetria-${index + 1}`,
          nome,
          nome_fantasia: nome,
          nome_mobilemed: nome,
          ativo: true,
          status: 'Ativo',
          parametros_faturamento: [{ status: 'A', tipo_faturamento: 'CO-FT' }]
        });
      });
    }
    
    console.log(`📋 Total final de clientes para processamento: ${todosClientesFinal.length}`);

    // ✅ SEPARAR clientes ativos dos inativos/cancelados (robusto para variações)
    const isStatusInativoOuCancelado = (status?: string) => {
      if (!status) return false;
      const s = status.toString().trim().toUpperCase();
      // Códigos e descrições comuns
      if (s === 'I' || s.startsWith('INAT')) return true; // INATIVO, INATIVADO, I
      if (s === 'C' || s.startsWith('CANCEL')) return true; // CANCELADO, CANCELADA, C
      return false;
    };
    // Helpers de parâmetros/contratos
    const getParametroAtivo = (pfList?: any) => {
      const list: any[] = Array.isArray(pfList) ? pfList : (pfList ? [pfList] : []);
      if (!list || list.length === 0) return null;
      const ativos = list.filter((pf) => {
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
      return (pfAtivo?.tipo_faturamento || 'CO-FT').toUpperCase();
    };

    // Helper: identificar clientes NC-NF exclusivamente pelos Parâmetros
    const isNCNF = (c: any) => {
      const pfAtivo = getParametroAtivo(c.parametros_faturamento);
      const tipoParam = pfAtivo?.tipo_faturamento?.toUpperCase?.();
      return tipoParam === 'NC-NF';
    };

    // ✅ MUDANÇA: Processar TODOS os clientes da volumetria, criando parâmetros padrão quando necessário
    const clientesAtivos = todosClientesFinal.map(c => {
      const pfAtivo = getParametroAtivo(c.parametros_faturamento);
      
      // Se não tem parâmetros ativos, criar temporário padrão
      if (!pfAtivo || isStatusInativoOuCancelado(pfAtivo.status)) {
        c.parametros_faturamento = [{ 
          status: 'A', 
          tipo_faturamento: 'CO-FT',
          created_temp: true // Flag para identificar temporários
        }];
      }
      
      return c;
    }).filter(c => !isNCNF(c)); // Apenas excluir NC-NF
    // ✅ SIMPLIFICADO: Não precisamos mais da lógica complexa de clientes inativos
    // Todos os clientes da volumetria já estão incluídos na lista clientesAtivos
    const clientesInativosComVolumetria = []; // Lista vazia - não precisamos mais desta lógica
    const alertasClientes: string[] = [];
    
    console.log(`📊 Clientes para processamento: ${clientesAtivos.length} (todos os clientes da volumetria)`);

    // ✅ LISTA FINAL: apenas clientes ativos (já inclui todos da volumetria)
    let clientes = [...clientesAtivos];
    
    // ✅ APLICAR LIMITAÇÃO DE TESTE se fornecida
    if (clientesPermitidos && Array.isArray(clientesPermitidos)) {
      const clientesAntesFiltro = clientes.length;
      clientes = clientes.filter(cliente => {
        const nomes = [
          cliente.nome,
          cliente.nome_fantasia,
          cliente.nome_mobilemed
        ].filter(Boolean).map(n => n.toUpperCase());
        
        return clientesPermitidos.some(permitido => 
          nomes.some(nome => nome.includes(permitido.toUpperCase()))
        );
      });
      
      console.log(`🧪 [TESTE] Filtro aplicado: ${clientes.length}/${clientesAntesFiltro} clientes mantidos`);
      console.log(`🧪 [TESTE] Clientes mantidos:`, clientes.map(c => c.nome_fantasia || c.nome));
    }
    
    if (clientes.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: clientesPermitidos 
            ? `Nenhum dos clientes de teste (${clientesPermitidos.join(', ')}) possui volumetria no período ${periodo}`
            : `Nenhum cliente com volumetria encontrado para o período ${periodo}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
          cond_volume: cliente.cond_volume || cliente.contratos_clientes?.[0]?.cond_volume || 'MOD/ESP/CAT',
          parametros_faturamento: cliente.parametros_faturamento,
          tipo_faturamento: (getParametroAtivo(cliente.parametros_faturamento)?.tipo_faturamento)
            || cliente.contratos_clientes?.[0]?.tipo_faturamento
            || 'CO-FT'
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
        
        // ✅ Resolver cliente_id válido (UUID) prioritizando o que tem preços ativos
        const isUuid = (v?: string) => !!v && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
        let clienteIdValido: string | null = isUuid(cliente.id) ? cliente.id : null;
        
        // NOVO: Sempre buscar o cliente com preços ativos para evitar duplicatas
        const nomesBusca: string[] = Array.from(new Set((cliente.nomes_mobilemed || []).filter(Boolean)));
        let resolved: { id: string } | null = null;
        
        // Buscar cliente que TEM preços ativos (prioridade máxima)
        const { data: clientesComPrecos } = await supabase
          .from('clientes')
          .select('id')
          .in('nome', nomesBusca)
          .filter('id', 'in', '(SELECT DISTINCT cliente_id FROM precos_servicos WHERE ativo = true)')
          .limit(1);
        
        if (clientesComPrecos && clientesComPrecos.length > 0) {
          resolved = clientesComPrecos[0] as any;
        } else {
          // Fallback: buscar por nome_fantasia com preços
          const { data: clientesFantasiaComPrecos } = await supabase
            .from('clientes')
            .select('id')
            .in('nome_fantasia', nomesBusca)
            .filter('id', 'in', '(SELECT DISTINCT cliente_id FROM precos_servicos WHERE ativo = true)')
            .limit(1);
          
          if (clientesFantasiaComPrecos && clientesFantasiaComPrecos.length > 0) {
            resolved = clientesFantasiaComPrecos[0] as any;
          } else {
            // Fallback: buscar por nome_mobilemed com preços
            const { data: clientesMobilemedComPrecos } = await supabase
              .from('clientes')
              .select('id')
              .in('nome_mobilemed', nomesBusca)
              .filter('id', 'in', '(SELECT DISTINCT cliente_id FROM precos_servicos WHERE ativo = true)')
              .limit(1);
            
            if (clientesMobilemedComPrecos && clientesMobilemedComPrecos.length > 0) {
              resolved = clientesMobilemedComPrecos[0] as any;
            } else {
              // Último fallback: qualquer cliente com esse nome (sem preços)
              if (!resolved && clienteIdValido) {
                resolved = { id: clienteIdValido };
              } else {
                const resp = await supabase.from('clientes').select('id').in('nome', nomesBusca).limit(1);
                if (!resp.error && resp.data && resp.data.length > 0) resolved = resp.data[0] as any;
              }
            }
          }
        }
        
        clienteIdValido = resolved?.id || null;
        
        if (!clienteIdValido) {
          console.warn(`⚠️ Cliente sem ID válido no cadastro: ${cliente.nome_fantasia}. Preços/Parâmetros não serão aplicados.`);
        }
        // Regras de exclusão: NC-NF não gera demonstrativo nem relatório
        if ((cliente.tipo_faturamento || '').toUpperCase() === 'NC-NF') {
          console.log(`⏭️ Ignorando cliente NC-NF: ${cliente.nome_fantasia}`);
          continue;
        }

    // Buscar volumetria do período DIRETAMENTE no banco - mais eficiente
    console.log(`🔍 Buscando volumetria para cliente: ${cliente.nome_fantasia} no período ${periodo}`);
    
    // Buscar contrato ativo para aplicar filtros de faturamento (especialidades/modalidades) e condição de volume
    let contratoAtivo: any = null;
    if (clienteIdValido) {
      const { data: contratosCli, error: contratoErr } = await supabase
        .from('contratos_clientes')
        .select('especialidades, modalidades, status, cond_volume')
        .eq('cliente_id', clienteIdValido)
        .eq('status', 'ativo')
        .order('updated_at', { ascending: false })
        .limit(1);
      if (!contratoErr && contratosCli && contratosCli.length > 0) {
        contratoAtivo = contratosCli[0];
      }
    }

    // Determinar filtros permitidos
    let allowedEspecialidades: string[] | null = Array.isArray(contratoAtivo?.especialidades) && contratoAtivo.especialidades.length > 0
      ? contratoAtivo.especialidades.map((e: string) => (e || '').toUpperCase().trim())
      : null;
    let allowedModalidades: string[] | null = Array.isArray(contratoAtivo?.modalidades) && contratoAtivo.modalidades.length > 0
      ? contratoAtivo.modalidades.map((m: string) => (m || '').toUpperCase().trim())
      : null;

    // Regra específica conhecida: CBU só fatura Medicina Interna
    const nomeFantasiaUpper = (cliente.nome_fantasia || cliente.nome || '').toUpperCase();
    if (nomeFantasiaUpper.includes('CBU')) {
      allowedEspecialidades = ['MEDICINA INTERNA'];
    }

    // Paginação para evitar limite de 1000 registros
    let volumetria: any[] = [];
    const pageSize = 1000;
    let from = 0;
    while (true) {
      // Montar query base com filtros principais
      let query = supabase
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
          periodo_referencia,
          tipo_faturamento
        `)
        .eq('periodo_referencia', periodo)
        .in('"EMPRESA"', cliente.nomes_mobilemed)
        .not('"VALORES"', 'is', null)
        .neq('tipo_faturamento', 'NC-NF'); // Excluir exames não faturáveis

      // Aplicar filtros contratuais quando existirem
      if (allowedEspecialidades && allowedEspecialidades.length > 0) {
        query = query.in('"ESPECIALIDADE"', allowedEspecialidades);
      }
      if (allowedModalidades && allowedModalidades.length > 0) {
        query = query.in('"MODALIDADE"', allowedModalidades);
      }

      const { data: page, error: volumetriaError } = await query
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

        // ✅ USAR CONDIÇÃO DE VOLUME CORRIGIDA DO CLIENTE
        const condVolume = cliente.cond_volume || 'MOD/ESP/CAT';
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
                  p_volume_total: volumeEspecifico, // ✅ Usar quantidade do grupo para faixa (ex.: 113 -> 101-250)
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
                   p_volume_total: volumeEspecifico, // ✅ Usar volume condicional para faixa
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
            .eq('cliente_id', clienteIdValido)
            .order('created_at', { ascending: false })
            .limit(1);
          
          const issContrato = contratoISS?.[0]?.percentual_iss || 0;
          if (issContrato > 0) {
            valorISS = valorBruto * (issContrato / 100);
            valorImpostos = valorISS;
          }
        }
        
        const valorTotal = valorBruto - valorImpostos;

        // Calcular total de exames efetivamente faturados (com preço)
        const totalExamesComPreco = detalhesExames
          .filter((d: any) => d.status === 'preco_encontrado' && (d.valor_unitario || 0) > 0)
          .reduce((sum: number, d: any) => sum + (d.quantidade || 0), 0);

        // Montar demonstrativo com alertas para problemas
        const temProblemas = valorExames === 0 && totalExames > 0;
        const temFranquiaProblema = valorFranquia > 0 && totalExames === 0 && !parametros?.frequencia_continua;
        
         const demonstrativo: DemonstrativoCliente = {
          cliente_id: cliente.id,
          cliente_nome: cliente.nome_fantasia || cliente.nome,
          periodo,
          total_exames: totalExamesComPreco, // Somente exames com preço aplicado
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
        error: (error as any)?.message || 'Erro inesperado ao gerar demonstrativos',
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});