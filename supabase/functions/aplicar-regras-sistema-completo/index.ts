import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "supabase";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StatusRegra {
  regra: string;
  aplicada: boolean;
  erro?: string;
  detalhes?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validar autenticação - requer header Authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('❌ Requisição sem token de autenticação');
      return new Response(
        JSON.stringify({ 
          success: false, 
          erro: 'Autenticação obrigatória. Faça login novamente.' 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Criar cliente com service role para operações administrativas
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Validar que o token é válido
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await anonClient.auth.getUser(token);
    
    if (claimsError || !claimsData?.user) {
      console.error('❌ Token inválido ou expirado:', claimsError?.message);
      return new Response(
        JSON.stringify({ 
          success: false, 
          erro: 'Sessão expirada. Faça login novamente para aplicar as regras.' 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`✅ Usuário autenticado: ${claimsData.user.email}`);

    let body: any = {};
    try {
      body = await req.json();
    } catch (jsonError) {
      console.log('Corpo da requisição vazio ou inválido:', jsonError);
    }

    const { arquivo_fonte, periodo_referencia, aplicar_todos_arquivos = false } = body;
    
    // Validar período obrigatório
    if (!periodo_referencia) {
      console.error('❌ Período de referência não informado');
      return new Response(
        JSON.stringify({ 
          success: false,
          erro: 'Período de referência é obrigatório. Selecione o período antes de processar.'
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const arquivosParaProcessar = aplicar_todos_arquivos 
      ? ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo']
      : [arquivo_fonte];
    
    if (!aplicar_todos_arquivos && !arquivo_fonte) {
      return new Response(
        JSON.stringify({ 
          success: false,
          erro: 'Parâmetro arquivo_fonte é obrigatório quando aplicar_todos_arquivos for false'
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`🎯 Aplicação de regras sistema completo`);
    console.log(`📁 Arquivos: ${arquivosParaProcessar.join(', ')}`);
    
    const statusRegras: StatusRegra[] = [];
    let totalProcessados = 0;
    let totalCorrigidos = 0;

    // Carregar tabelas de referência
    const [cadastroRes, prioridadeRes, valoresRes] = await Promise.all([
      supabase.from('cadastro_exames').select('nome, categoria, especialidade').eq('ativo', true),
      supabase.from('valores_prioridade_de_para').select('prioridade_original, nome_final').eq('ativo', true),
      supabase.from('valores_referencia_de_para').select('estudo_descricao, valores').eq('ativo', true)
    ]);

    const cadastroExames = cadastroRes.data || [];
    const deParaPrioridades = prioridadeRes.data || [];
    const deParaValores = valoresRes.data || [];

    console.log(`📋 Referências: ${cadastroExames.length} exames, ${deParaPrioridades.length} prioridades, ${deParaValores.length} valores`);

    // Criar mapas
    const mapaCadastro = new Map(
      cadastroExames.map(e => [e.nome?.toUpperCase().trim(), { categoria: e.categoria, especialidade: e.especialidade }])
    );
    const mapaPrioridades = new Map(
      deParaPrioridades.map(p => [p.prioridade_original?.toUpperCase().trim(), p.nome_final])
    );
    const mapaValores = new Map(
      deParaValores.map(v => [v.estudo_descricao?.toUpperCase().trim(), v.valores])
    );

    // Processar arquivos
    for (const arquivo of arquivosParaProcessar) {
      console.log(`\n🔄 ${arquivo}`);
      
      // === LIMPEZA DE NOMES DE CLIENTES (antes do processamento) ===
      console.log('  ⚡ Limpeza de nomes de clientes...');
      
      // Normalizar sufixo _TELE (ex: CLINICA_CRL_TELE -> CLINICA_CRL)
      let teleQuery = supabase
        .from('volumetria_mobilemed')
        .select('"EMPRESA"')
        .eq('arquivo_fonte', arquivo)
        .like('EMPRESA', '%_TELE');
      
      if (periodo_referencia) {
        teleQuery = teleQuery.eq('periodo_referencia', periodo_referencia);
      }
      
      const { data: clientesTele } = await teleQuery;
      
      if (clientesTele && clientesTele.length > 0) {
        const empresasUnicas = [...new Set(clientesTele.map((c: any) => c.EMPRESA).filter(Boolean))];
        for (const empresaTele of empresasUnicas) {
          if (empresaTele && empresaTele.endsWith('_TELE')) {
            const empresaNormalizada = empresaTele.replace(/_TELE$/, '');
            let updateQuery = supabase.from('volumetria_mobilemed')
              .update({ EMPRESA: empresaNormalizada })
              .eq('arquivo_fonte', arquivo)
              .eq('EMPRESA', empresaTele);
            
            if (periodo_referencia) {
              updateQuery = updateQuery.eq('periodo_referencia', periodo_referencia);
            }
            
            await updateQuery;
            console.log(`    📝 ${empresaTele} → ${empresaNormalizada}`);
          }
        }
      }
      
      // === BUSCAR REGISTROS PARA PROCESSAMENTO (com paginação para evitar limite de 1000) ===
      let allRegistros: any[] = [];
      let offset = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        let query = supabase
          .from('volumetria_mobilemed')
          .select('id, "ESTUDO_DESCRICAO", "CATEGORIA", "ESPECIALIDADE", "PRIORIDADE", "VALORES", "MODALIDADE"')
          .eq('arquivo_fonte', arquivo)
          .range(offset, offset + pageSize - 1);
        
        // Filtrar por período se informado
        if (periodo_referencia) {
          query = query.eq('periodo_referencia', periodo_referencia);
        }
        
        const { data: pageData, error: pageError } = await query;
        
        if (pageError) {
          console.error(`❌ Erro na página ${offset}: ${pageError.message}`);
          break;
        }
        
        if (pageData && pageData.length > 0) {
          allRegistros = allRegistros.concat(pageData);
          offset += pageSize;
          hasMore = pageData.length === pageSize;
        } else {
          hasMore = false;
        }
      }
      
      const registros = allRegistros;
      
      if (registros.length === 0) {
        console.log(`⚠️ Nenhum registro encontrado para ${arquivo} no período ${periodo_referencia}`);
        continue;
      }

      console.log(`📊 ${registros.length} registros totais (buscados em ${Math.ceil(offset / pageSize) || 1} páginas)`);

      let stats = { modalidades: 0, especialidades: 0, categorias: 0, prioridades: 0, valores: 0, mamaMamo: 0, neuroCorrecao: 0 };

      const loteSize = 50;
      for (let i = 0; i < (registros?.length || 0); i += loteSize) {
        const lote = registros!.slice(i, i + loteSize);
        
        for (const reg of lote) {
          const upd: any = {};
          let changed = false;

          // Modalidades
          if (reg.MODALIDADE === 'BMD') {
            upd.MODALIDADE = 'DO';
            changed = true;
            stats.modalidades++;
          } else if (reg.MODALIDADE === 'CR' || reg.MODALIDADE === 'DX') {
            const desc = reg.ESTUDO_DESCRICAO?.toLowerCase() || '';
            upd.MODALIDADE = (desc.includes('mamografia') || desc.includes('mamogra') || desc.includes('tomo')) ? 'MG' : 'RX';
            changed = true;
            stats.modalidades++;
          }

          // REGRA CRÍTICA: MAMA → MAMO para modalidade MG (mamografia/tomossíntese)
          // MG (mamografia) SEMPRE deve ter especialidade MAMO, não MAMA
          // MAMA é reservado para modalidade MR (RM MAMAS)
          const modalidadeAtual = upd.MODALIDADE || reg.MODALIDADE;
          if (modalidadeAtual === 'MG' && reg.ESPECIALIDADE === 'MAMA') {
            upd.ESPECIALIDADE = 'MAMO';
            changed = true;
            stats.mamaMamo++;
            console.log(`🔄 MAMA → MAMO: ${reg.ESTUDO_DESCRICAO} (MG)`);
          }

          // Especialidades diretas (case-insensitive)
          const espMapNormalized: Record<string, string> = {
            'ONCO MEDICINA INTERNA': 'MEDICINA INTERNA',
            'CT': 'MEDICINA INTERNA',
            'COLUNAS': 'MUSCULO ESQUELETICO',
            'RX': 'MEDICINA INTERNA',  // Especialidade RX não existe, converter para MEDICINA INTERNA
            'TORAX': 'MEDICINA INTERNA'  // Especialidade TORAX não existe, converter para MEDICINA INTERNA
          };
          const especialidadeUpper = reg.ESPECIALIDADE?.toUpperCase().trim();
          if (especialidadeUpper && espMapNormalized[especialidadeUpper] && !upd.ESPECIALIDADE) {
            upd.ESPECIALIDADE = espMapNormalized[especialidadeUpper];
            changed = true;
            stats.especialidades++;
            console.log(`🔄 ESP: ${reg.ESPECIALIDADE} → ${espMapNormalized[especialidadeUpper]}`);
          }

          // Cadastro exames (SEMPRE sobrescreve - usa valor final considerando alterações anteriores)
          if (reg.ESTUDO_DESCRICAO) {
            const dados = mapaCadastro.get(reg.ESTUDO_DESCRICAO.toUpperCase().trim());
            if (dados) {
              const categoriaAtual = upd.CATEGORIA || reg.CATEGORIA;
              const especialidadeAtual = upd.ESPECIALIDADE || reg.ESPECIALIDADE;
              
              if (dados.categoria && dados.categoria !== categoriaAtual) {
                upd.CATEGORIA = dados.categoria;
                changed = true;
                stats.categorias++;
              }
              if (dados.especialidade && dados.especialidade !== especialidadeAtual) {
                upd.ESPECIALIDADE = dados.especialidade;
                changed = true;
                stats.especialidades++;
                console.log(`📋 Cadastro: ${reg.ESTUDO_DESCRICAO} → ESP: ${dados.especialidade}`);
              }
            } else {
              // Fallback categoria por modalidade
              const mod = upd.MODALIDADE || reg.MODALIDADE;
              if (!reg.CATEGORIA || reg.CATEGORIA === 'SC' || reg.CATEGORIA === '') {
                const catMap: Record<string, string> = { 'MR': 'RM', 'CT': 'TC', 'RX': 'RX', 'MG': 'MG', 'DO': 'DO' };
                if (catMap[mod]) {
                  upd.CATEGORIA = catMap[mod];
                  changed = true;
                  stats.categorias++;
                }
              }
            }
          }

          // v007b: CT/MR + MEDICINA INTERNA + CATEGORIA PESCOÇO/CABEÇA → NEURO
          // Exames CT ou MR com categoria PESCOÇO ou CABEÇA devem ter especialidade NEURO, não MEDICINA INTERNA
          const modalidadeFinal = upd.MODALIDADE || reg.MODALIDADE;
          const especialidadeFinal = upd.ESPECIALIDADE || reg.ESPECIALIDADE;
          const categoriaFinal = upd.CATEGORIA || reg.CATEGORIA;
          
          if ((modalidadeFinal === 'CT' || modalidadeFinal === 'MR') && 
              especialidadeFinal === 'MEDICINA INTERNA' &&
              categoriaFinal) {
            const catNorm = categoriaFinal.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (catNorm.includes('CABEC') || catNorm.includes('PESCO') || catNorm === 'CABECA' || catNorm === 'PESCOCO') {
              upd.ESPECIALIDADE = 'NEURO';
              changed = true;
              stats.neuroCorrecao++;
              console.log(`🧠 v007b: MEDICINA INTERNA → NEURO: ${reg.ESTUDO_DESCRICAO} (${modalidadeFinal}, ${categoriaFinal})`);
            }
          }

          // Prioridades
          if (reg.PRIORIDADE) {
            const novaPrio = mapaPrioridades.get(reg.PRIORIDADE.toUpperCase().trim());
            if (novaPrio && novaPrio !== reg.PRIORIDADE) {
              upd.PRIORIDADE = novaPrio;
              changed = true;
              stats.prioridades++;
            }
            if (reg.PRIORIDADE === 'AMBULATORIO') {
              upd.PRIORIDADE = 'ROTINA';
              changed = true;
              stats.prioridades++;
            }
          }

          // Valores
          if ((!reg.VALORES || reg.VALORES === 0) && reg.ESTUDO_DESCRICAO) {
            const novoVal = mapaValores.get(reg.ESTUDO_DESCRICAO.toUpperCase().trim());
            if (novoVal && novoVal > 0) {
              upd.VALORES = novoVal;
              changed = true;
              stats.valores++;
            }
          }

          if (changed) {
            upd.updated_at = new Date().toISOString();
            const { error } = await supabase.from('volumetria_mobilemed').update(upd).eq('id', reg.id);
            if (error) console.error(`❌ Erro ID ${reg.id}: ${error.message}`);
          }
        }
      }

      const totalCorrecoes = Object.values(stats).reduce((a, b) => a + b, 0);
      totalCorrigidos += totalCorrecoes;

      statusRegras.push({
        regra: `Regras - ${arquivo}`,
        aplicada: true,
        detalhes: { registros_processados: registros?.length || 0, ...stats, total_correções: totalCorrecoes }
      });

      console.log(`✅ ${totalCorrecoes} correções: M:${stats.modalidades} E:${stats.especialidades} C:${stats.categorias} P:${stats.prioridades} V:${stats.valores} MAMA→MAMO:${stats.mamaMamo} NEURO:${stats.neuroCorrecao}`);
      totalProcessados += registros?.length || 0;
    }

    const resultado = {
      success: true,
      total_processados: totalProcessados,
      total_corrigidos: totalCorrigidos,
      status_regras: statusRegras,
      arquivo_fonte: aplicar_todos_arquivos ? 'TODOS_OS_ARQUIVOS' : arquivo_fonte,
      periodo_referencia,
      timestamp: new Date().toISOString(),
      observacao: 'Nova abordagem: aplicação direta registro por registro'
    };

    console.log('🏆 Processamento sistema completo concluído:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('❌ Erro na aplicação de regras sistema completo:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        erro: error.message,
        detalhes: error.stack,
        observacoes: 'Erro interno no processamento das regras'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});