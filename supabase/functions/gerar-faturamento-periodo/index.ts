import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type GrupoChave = {
  modalidade: string;
  especialidade: string;
  categoria: string;
  prioridade: string;
  estudo: string;
};

// Função auxiliar para normalizar período
const formatPeriodoParaYYYYMM = (periodo: string): string => {
  if (periodo.includes('-') && /^\d{4}-\d{2}$/.test(periodo)) return periodo; // Já está no formato YYYY-MM
  
  // Handles multiple formats:
  // jun/25, jun/2025, junho/25, junho/2025 -> 2025-06
  let mes: string, ano: string;
  
  if (periodo.includes('/')) {
    [mes, ano] = periodo.split('/');
  } else if (periodo.includes('-') && /^[a-zA-Zç]+/.test(periodo)) {
    // jun-25 format
    [mes, ano] = periodo.split('-');
  } else {
    return periodo; // Return as-is if format not recognized
  }
  
  const mesesMap: { [key: string]: number } = {
    'jan': 1, 'janeiro': 1,
    'fev': 2, 'fevereiro': 2,
    'mar': 3, 'março': 3, 'marco': 3,
    'abr': 4, 'abril': 4,
    'mai': 5, 'maio': 5,
    'jun': 6, 'junho': 6,
    'jul': 7, 'julho': 7,
    'ago': 8, 'agosto': 8,
    'set': 9, 'setembro': 9,
    'out': 10, 'outubro': 10,
    'nov': 11, 'novembro': 11,
    'dez': 12, 'dezembro': 12
  };
  
  const mesNum = mesesMap[mes.toLowerCase()];
  if (!mesNum) return periodo; // Return as-is if month not found
  
  // Handle 2-digit and 4-digit years
  const anoCompleto = ano.length === 2 ? `20${ano}` : ano;
  
  return `${anoCompleto}-${mesNum.toString().padStart(2, '0')}`;
};

// Função para converter período YYYY-MM para jun/25
const formatPeriodoParaMonYY = (periodo: string): string => {
  const [ano, mes] = periodo.split('-');
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const mesNome = meses[parseInt(mes) - 1];
  return `${mesNome}/${ano.slice(2)}`;
};

function periodoToDatas(periodo: string) {
  // período no formato YYYY-MM (ex: 2025-06 para jun/25)
  const [y, m] = periodo.split('-').map(Number);
  
  // Para jun/25 (2025-06), buscar todo o mês de junho: 01/06 a 30/06
  const inicio = new Date(y, m - 1, 1); // Primeiro dia do mês
  const fim = new Date(y, m, 0);        // Último dia do mês (dia 0 do próximo mês)
  
  const toISO = (d: Date) => d.toISOString().split('T')[0];
  return { inicio: toISO(inicio), fim: toISO(fim) };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[gerar-faturamento-periodo] INÍCIO DA FUNÇÃO');
  
  try {
    const { periodo } = await req.json();
    console.log('[gerar-faturamento-periodo] Período recebido:', periodo);

    if (!periodo || !/^\d{4}-\d{2}$/.test(periodo)) {
      console.log('[gerar-faturamento-periodo] ERRO: Período inválido');
      return new Response(JSON.stringify({ success: false, error: 'Parâmetro periodo (YYYY-MM) é obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { inicio, fim } = periodoToDatas(periodo);
    
    // Normalizar período para formato consistente
    const periodoFormatado = formatPeriodoParaYYYYMM(periodo);
    const periodoRefMonyy = formatPeriodoParaMonYY(periodoFormatado);
    
    console.log(`[gerar-faturamento-periodo] Período normalizado: ${periodo} -> ${periodoFormatado}`);
    console.log(`[gerar-faturamento-periodo] Início=${inicio} Fim=${fim} RefMonYY=${periodoRefMonyy}`);

    // Buscar TODOS os clientes ativos
    const { data: clientes, error: clientesError } = await supabase
      .from('clientes')
      .select('id, nome, email, ativo, status')
      .eq('ativo', true)
      .eq('status', 'Ativo');

    if (clientesError) throw clientesError;

    const clientesAtivos = clientes || [];
    console.log(`[gerar-faturamento-periodo] Total de clientes ativos: ${clientesAtivos.length}`);

    // Retornar resposta imediata e processar em background
    const backgroundTask = async () => {
      try {
        console.log('[gerar-faturamento-periodo] Iniciando processamento em background...');
        
        // 1. LIMPAR DADOS ANTERIORES DO PERÍODO (ambos os formatos)
        console.log(`[gerar-faturamento-periodo] Limpando dados anteriores do período ${periodoFormatado} e ${periodoRefMonyy}`);
        await supabase.from('faturamento').delete().eq('periodo_referencia', periodoFormatado);
        await supabase.from('faturamento').delete().eq('periodo_referencia', periodoRefMonyy);

        let totalItens = 0;
        let clientesComDados = 0;

        // Processar TODOS os clientes que têm dados de volumetria
        const loteSize = 10; // Reduzir para evitar timeout
        console.log(`[gerar-faturamento-periodo] Processando clientes com volumetria`);
        
        // Buscar clientes que realmente têm dados de volumetria no período - USANDO CAMPO EMPRESA
        const { data: clientesComVolumetria } = await supabase
          .from('volumetria_mobilemed')
          .select('"EMPRESA"')
          .eq('periodo_referencia', periodoFormatado) // Usar período normalizado YYYY-MM
          .not('"EMPRESA"', 'is', null);
        
        // Coletar APENAS nomes de EMPRESA
        const nomesClientesSet = new Set();
        clientesComVolumetria?.forEach(v => {
          if (v.EMPRESA) nomesClientesSet.add(v.EMPRESA);
        });
        const nomesClientesComVolumetria = Array.from(nomesClientesSet);
        
        console.log(`[gerar-faturamento-periodo] Clientes com volumetria no período: ${nomesClientesComVolumetria.length}`);
        console.log(`[gerar-faturamento-periodo] Lista: ${nomesClientesComVolumetria.join(', ')}`);
        
        // PROCESSAR TODOS OS CLIENTES DA VOLUMETRIA (criar registros temporários se necessário)
        // Buscar dados completos dos clientes na tabela usando nome_mobilemed - SEM LIMITAÇÃO
        const { data: todosClientes } = await supabase
          .from('clientes')
          .select('id, nome, nome_fantasia, nome_mobilemed, email, ativo, status'); // REMOVER FILTROS para pegar TODOS
        
        // Criar mapa usando nome_mobilemed para identificação (campo que mapeia com EMPRESA)
        const clientesMap = new Map();
        todosClientes?.forEach(cliente => {
          // Mapear por nome_mobilemed (que corresponde ao campo EMPRESA da volumetria)
          if (cliente.nome_mobilemed) {
            clientesMap.set(cliente.nome_mobilemed, cliente);
          }
          // Fallback para nome principal se não tiver nome_mobilemed
          else if (cliente.nome) {
            clientesMap.set(cliente.nome, cliente);
          }
        });
        
        // PROCESSAR TODOS OS CLIENTES DA VOLUMETRIA (cadastrados ou não)
        const clientesParaProcessar = nomesClientesComVolumetria.map(nomeEmpresa => {
          // Buscar cliente usando qualquer um dos campos de nome
          const clienteExistente = clientesMap.get(nomeEmpresa);
          
          if (clienteExistente) {
            console.log(`[gerar-faturamento-periodo] Cliente encontrado: ${nomeEmpresa} -> ${clienteExistente.id} (${clienteExistente.nome})`);
            return {
              ...clienteExistente,
              nome_mobilemed: nomeEmpresa // Preservar o nome usado na volumetria (campo EMPRESA)
            };
          } else {
            // Criar cliente temporário para processamento
            console.log(`[gerar-faturamento-periodo] Cliente não cadastrado: ${nomeEmpresa} - criando registro temporário`);
            return {
              id: `temp-${nomeEmpresa.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
              nome: nomeEmpresa,
              nome_mobilemed: nomeEmpresa,
              email: `${nomeEmpresa.toLowerCase().replace(/[^a-z0-9]/g, '')}@cliente.temporario.com`,
              ativo: true,
              status: 'Ativo'
            };
          }
        });
        
        console.log(`[gerar-faturamento-periodo] Clientes para processar: ${clientesParaProcessar.length}`);
        console.log(`[gerar-faturamento-periodo] Primeiros 10 clientes: ${clientesParaProcessar.slice(0, 10).map(c => c.nome).join(', ')}`);
        console.log(`[gerar-faturamento-periodo] Clientes da volumetria vs cadastrados vs processados: ${nomesClientesComVolumetria.length} vs ${todosClientes?.length || 0} vs ${clientesParaProcessar.length}`);
        
        // PROCESSAR TODOS OS CLIENTES - SEM LIMITAÇÃO DE LOTES
        for (let i = 0; i < clientesParaProcessar.length; i++) {
            try {
              console.log(`[gerar-faturamento-periodo] Processando cliente: ${cliente.nome} (${i + 1}/${clientesParaProcessar.length})`);
            
              // Buscar TODOS os dados de volumetria do cliente no período usando campo EMPRESA
              const { data: vm, error: vmErr } = await supabase
                .from('volumetria_mobilemed')
                .select('"EMPRESA","MODALIDADE","ESPECIALIDADE","CATEGORIA","PRIORIDADE","ESTUDO_DESCRICAO","VALORES","NOME_PACIENTE","DATA_REALIZACAO","MEDICO","ACCESSION_NUMBER"')
                .eq('"EMPRESA"', cliente.nome_mobilemed) // CORRIGIDO: usar nome_mobilemed que mapeia com EMPRESA
                .eq('periodo_referencia', periodoFormatado); // Usar período normalizado - SEM FILTRO DE VALORES

              if (vmErr) {
                console.log(`[gerar-faturamento-periodo] Erro volumetria cliente ${cliente.nome}:`, vmErr.message);
                continue;
              }

              const rows = vm || [];
              if (rows.length === 0) {
                console.log(`[gerar-faturamento-periodo] Cliente ${cliente.nome} (${cliente.nome_fantasia_volumetria}) sem dados de volumetria no período ${periodoFormatado}`);
                continue;
              }

              console.log(`[gerar-faturamento-periodo] Cliente ${cliente.nome} - encontrados ${rows.length} registros de volumetria`);

              // Volume total (usado na faixa de preço) - garantir valor mínimo 1 se zerado
              const volumeTotal = Math.max(1, rows.reduce((acc: number, r: any) => acc + (Number(r.VALORES) || 0), 0));

              // Agrupar por chave INCLUINDO paciente
              const grupos = new Map<string, { chave: GrupoChave; qtd: number; paciente: string; medico: string; dataExame: string; accession: string }>();
              for (const r of rows) {
                const chave: GrupoChave = {
                  modalidade: r.MODALIDADE || '',
                  especialidade: r.ESPECIALIDADE || '',
                  categoria: r.CATEGORIA || 'SC',
                  prioridade: r.PRIORIDADE || '',
                  estudo: r.ESTUDO_DESCRICAO || 'Exame',
                };
                // INCLUIR PACIENTE na chave para evitar agregação incorreta
                const key = `${chave.modalidade}|${chave.especialidade}|${chave.categoria}|${chave.prioridade}|${chave.estudo}|${r.NOME_PACIENTE}|${r.ACCESSION_NUMBER}`;
                const qtd = Math.max(1, Number(r.VALORES) || 1); // Garantir quantidade mínima 1
                const atual = grupos.get(key);
                if (atual) {
                  atual.qtd += qtd;
                } else {
                  grupos.set(key, { 
                    chave, 
                    qtd, 
                    paciente: r.NOME_PACIENTE || 'N/A',
                    medico: r.MEDICO || 'N/A',
                    dataExame: r.DATA_REALIZACAO || '',
                    accession: r.ACCESSION_NUMBER || ''
                  });
                }
              }

              const itensInserir: any[] = [];

              for (const { chave, qtd, paciente, medico, dataExame, accession } of grupos.values()) {
                // Calcular preço unitário via RPC
                const { data: preco, error: precoErr } = await supabase.rpc('calcular_preco_exame', {
                  p_cliente_id: cliente.id,
                  p_modalidade: chave.modalidade,
                  p_especialidade: chave.especialidade,
                  p_prioridade: chave.prioridade,
                  p_categoria: chave.categoria,
                  p_volume_total: volumeTotal,
                  p_is_plantao: (chave.prioridade || '').toUpperCase().includes('PLANT')
                });

                if (precoErr) {
                  console.log(`[gerar-faturamento-periodo] Preço não encontrado para ${cliente.nome} ->`, chave, precoErr.message);
                }

                const unit = Number(preco) || 0;
                const valor = Number((unit * qtd).toFixed(2));

                // PULAR ITENS SEM PREÇO CONFIGURADO (não usar preço padrão)
                if (valor <= 0) {
                  console.log(`[gerar-faturamento-periodo] PREÇO NÃO ENCONTRADO - INCLUINDO COM VALOR ZERO:`);
                  console.log(`  Cliente: ${cliente.nome}`);
                  console.log(`  Paciente: ${paciente}`);
                  console.log(`  Exame: ${chave.estudo}`);
                  console.log(`  Modalidade: ${chave.modalidade}, Especialidade: ${chave.especialidade}`);
                  console.log(`  Categoria: ${chave.categoria}, Prioridade: ${chave.prioridade}`);
                  console.log(`  Quantidade (qtd): ${qtd}`);
                  console.log(`  Preço unitário (unit): ${unit}`);
                  console.log(`  Volume total: ${volumeTotal}`);
                  console.log(`  OBSERVAÇÃO: Cliente sem tabela de preços - incluindo item com valor zero para análise`);
                  // NÃO fazer continue - incluir item com valor zero
                  valor = 0; // Garantir valor zero para análise
                }

                const hoje = new Date();
                const emissao = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
                const vencimento = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                itensInserir.push({
                  omie_id: `SIM_${cliente.id}_${Date.now()}_${Math.floor(Math.random()*1000)}`,
                  numero_fatura: `FAT-${periodoFormatado}-${String(cliente.nome).substring(0, 10)}-${Date.now()}`,
                  cliente_id: cliente.id,
                  cliente_nome: cliente.nome, // Nome fantasia já está sendo usado
                  cliente_nome_original: cliente.nome_mobilemed, // Nome original da empresa (campo EMPRESA)
                  cliente_email: cliente.email || null,
                  paciente: paciente,
                  modalidade: chave.modalidade,
                  especialidade: chave.especialidade,
                  categoria: chave.categoria,
                  prioridade: chave.prioridade,
                  nome_exame: chave.estudo,
                  medico: medico,
                  data_exame: dataExame || emissao,
                  quantidade: qtd,
                  valor_bruto: valor,
                  valor: valor,
                  data_emissao: emissao,
                  data_vencimento: vencimento,
                  periodo_referencia: periodoFormatado, // Usar formato YYYY-MM
                  tipo_dados: 'incremental',
                  accession_number: accession, // Incluir ACCESSION_NUMBER
                });
              }

              if (itensInserir.length > 0) {
                // INSERIR TODOS OS ITENS DE UMA VEZ - SEM LIMITAÇÃO DE LOTE
                const { error: insErr } = await supabase.from('faturamento').insert(itensInserir);
                if (insErr) {
                  console.log(`[gerar-faturamento-periodo] Erro ao inserir itens (${cliente.nome}):`, insErr.message);
                } else {
                  totalItens += itensInserir.length;
                  clientesComDados++;
                  console.log(`[gerar-faturamento-periodo] Cliente ${cliente.nome} processado: ${itensInserir.length} itens`);
                }
              }
            } catch (clienteError: any) {
              console.error(`[gerar-faturamento-periodo] ERRO processando cliente ${cliente.nome}:`, clienteError.message);
              // Continuar com próximo cliente mesmo em caso de erro
              continue;
            }
        }

        console.log('[gerar-faturamento-periodo] PROCESSAMENTO CONCLUÍDO:', {
          totalItens,
          clientesComDados,
          clientesProcessados: clientesParaProcessar.length
        });

      } catch (error: any) {
        console.error('[gerar-faturamento-periodo] Erro no background:', error);
      }
    };

    // Iniciar tarefa em background
    EdgeRuntime.waitUntil(backgroundTask());

    // Retornar resposta imediata
    return new Response(JSON.stringify({
      success: true,
      periodo: periodoFormatado,
      periodo_referencia: periodoRefMonyy,
      clientes_processados: clientesAtivos.length,
      message: 'Processamento iniciado em background - agora usa formato normalizado YYYY-MM',
      status: 'processing'
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[gerar-faturamento-periodo] Erro:', error);
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Erro desconhecido' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});