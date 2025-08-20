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
  if (periodo.includes('-')) return periodo; // Já está no formato YYYY-MM
  
  // Converter jun/25 -> 2025-06
  const [mes, ano] = periodo.split('/');
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const mesNum = meses.indexOf(mes.toLowerCase()) + 1;
  const anoCompleto = `20${ano}`;
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
        
        // Buscar clientes que realmente têm dados de volumetria no período - USANDO NOME FANTASIA
        const { data: clientesComVolumetria } = await supabase
          .from('volumetria_mobilemed')
          .select('"Cliente_Nome_Fantasia"')
          .eq('periodo_referencia', periodoFormatado) // Usar período normalizado YYYY-MM
          .not('"Cliente_Nome_Fantasia"', 'is', null);
        
        const nomesClientesComVolumetria = [...new Set(clientesComVolumetria?.map(v => v.Cliente_Nome_Fantasia) || [])];
        console.log(`[gerar-faturamento-periodo] Clientes com volumetria no período: ${nomesClientesComVolumetria.length}`);
        console.log(`[gerar-faturamento-periodo] Lista: ${nomesClientesComVolumetria.join(', ')}`);
        
        // PROCESSAR TODOS OS CLIENTES DA VOLUMETRIA (criar registros temporários se necessário)
        // Buscar dados completos dos clientes na tabela usando MÚLTIPLOS CAMPOS para mapeamento
        const { data: todosClientes } = await supabase
          .from('clientes')
          .select('id, nome, nome_fantasia, nome_mobilemed, email, ativo, status')
          .eq('ativo', true)
          .eq('status', 'Ativo');
        
        // Criar mapa usando MÚLTIPLOS campos de identificação (nome, nome_fantasia, nome_mobilemed)
        const clientesMap = new Map();
        todosClientes?.forEach(cliente => {
          // Mapear por nome principal
          if (cliente.nome) {
            clientesMap.set(cliente.nome, cliente);
          }
          // Mapear por nome fantasia (regra v035)
          if (cliente.nome_fantasia && cliente.nome_fantasia !== cliente.nome) {
            clientesMap.set(cliente.nome_fantasia, cliente);
          }
          // Mapear por nome mobilemed
          if (cliente.nome_mobilemed && cliente.nome_mobilemed !== cliente.nome) {
            clientesMap.set(cliente.nome_mobilemed, cliente);
          }
        });
        
        // PROCESSAR TODOS OS CLIENTES DA VOLUMETRIA (cadastrados ou não)
        const clientesParaProcessar = nomesClientesComVolumetria.map(nomeEmpresa => {
          // Buscar cliente usando qualquer um dos campos de nome
          const clienteExistente = clientesMap.get(nomeEmpresa);
          
          if (clienteExistente) {
            console.log(`[gerar-faturamento-periodo] Cliente encontrado: ${nomeEmpresa} -> ${clienteExistente.id} (${clienteExistente.nome})`);
            return clienteExistente;
          } else {
            // Criar cliente temporário para processamento
            console.log(`[gerar-faturamento-periodo] Cliente não cadastrado: ${nomeEmpresa} - criando registro temporário`);
            return {
              id: `temp-${nomeEmpresa.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
              nome: nomeEmpresa,
              email: `${nomeEmpresa.toLowerCase().replace(/[^a-z0-9]/g, '')}@cliente.temporario.com`,
              ativo: true,
              status: 'Ativo'
            };
          }
        });
        
        console.log(`[gerar-faturamento-periodo] Clientes para processar: ${clientesParaProcessar.length}`);
        console.log(`[gerar-faturamento-periodo] Primeiros 10 clientes: ${clientesParaProcessar.slice(0, 10).map(c => c.nome).join(', ')}`);
        console.log(`[gerar-faturamento-periodo] Clientes da volumetria vs cadastrados vs processados: ${nomesClientesComVolumetria.length} vs ${todosClientes?.length || 0} vs ${clientesParaProcessar.length}`);
        
        for (let i = 0; i < clientesParaProcessar.length; i += loteSize) {
          const loteClientes = clientesParaProcessar.slice(i, i + loteSize);
          console.log(`[gerar-faturamento-periodo] Processando lote ${Math.floor(i/loteSize) + 1}/${Math.ceil(clientesParaProcessar.length/loteSize)}`);
          
          for (const cliente of loteClientes) {
            try {
              console.log(`[gerar-faturamento-periodo] Processando cliente: ${cliente.nome} (${i + loteClientes.indexOf(cliente) + 1}/${clientesParaProcessar.length})`);
            
              // Buscar TODOS os dados de volumetria do cliente no período usando NOME FANTASIA
              const { data: vm, error: vmErr } = await supabase
                .from('volumetria_mobilemed')
                .select('"EMPRESA","Cliente_Nome_Fantasia","MODALIDADE","ESPECIALIDADE","CATEGORIA","PRIORIDADE","ESTUDO_DESCRICAO","VALORES","NOME_PACIENTE","DATA_REALIZACAO","MEDICO","ACCESSION_NUMBER"')
                .eq('"Cliente_Nome_Fantasia"', cliente.nome) // Usar nome fantasia para busca
                .eq('periodo_referencia', periodoFormatado); // Usar período normalizado - SEM FILTRO DE VALORES

              if (vmErr) {
                console.log(`[gerar-faturamento-periodo] Erro volumetria cliente ${cliente.nome}:`, vmErr.message);
                continue;
              }

              const rows = vm || [];
              if (rows.length === 0) {
                console.log(`[gerar-faturamento-periodo] Cliente ${cliente.nome} sem dados de volumetria no período ${periodoFormatado}`);
                continue;
              }

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

              for (const { chave, qtd, paciente, medico, dataExame } of grupos.values()) {
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
                  console.log(`[gerar-faturamento-periodo] PREÇO NÃO ENCONTRADO - PULANDO ITEM:`);
                  console.log(`  Cliente: ${cliente.nome}`);
                  console.log(`  Paciente: ${paciente}`);
                  console.log(`  Exame: ${chave.estudo}`);
                  console.log(`  Modalidade: ${chave.modalidade}, Especialidade: ${chave.especialidade}`);
                  console.log(`  Categoria: ${chave.categoria}, Prioridade: ${chave.prioridade}`);
                  console.log(`  Quantidade (qtd): ${qtd}`);
                  console.log(`  Preço unitário (unit): ${unit}`);
                  console.log(`  Volume total: ${volumeTotal}`);
                  console.log(`  MOTIVO: Cliente sem tabela de preços configurada para esta combinação`);
                  continue; // Pular este item
                }

                const hoje = new Date();
                const emissao = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
                const vencimento = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                itensInserir.push({
                  omie_id: `SIM_${cliente.id}_${Date.now()}_${Math.floor(Math.random()*1000)}`,
                  numero_fatura: `FAT-${periodoFormatado}-${String(cliente.nome).substring(0, 10)}-${Date.now()}`,
                  cliente_id: cliente.id,
                  cliente_nome: cliente.nome, // Nome fantasia já está sendo usado
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
                });
              }

              if (itensInserir.length > 0) {
                const batchSize = 50; // Reduzir tamanho do lote
                for (let j = 0; j < itensInserir.length; j += batchSize) {
                  const lote = itensInserir.slice(j, j + batchSize);
                  const { error: insErr } = await supabase.from('faturamento').insert(lote);
                  if (insErr) {
                    console.log(`[gerar-faturamento-periodo] Erro ao inserir lote (${cliente.nome}):`, insErr.message);
                  }
                }
                totalItens += itensInserir.length;
                clientesComDados++;
                console.log(`[gerar-faturamento-periodo] Cliente ${cliente.nome} processado: ${itensInserir.length} itens`);
              }
            } catch (clienteError: any) {
              console.error(`[gerar-faturamento-periodo] ERRO processando cliente ${cliente.nome}:`, clienteError.message);
              // Continuar com próximo cliente mesmo em caso de erro
              continue;
            }
          }
          
          // Pausa pequena entre lotes para não sobrecarregar
          await new Promise(resolve => setTimeout(resolve, 100));
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