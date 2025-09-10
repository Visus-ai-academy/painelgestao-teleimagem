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

        // Buscar TODOS os clientes ativos com contratos
    const { data: clientes, error: clientesError } = await supabase
      .from('clientes')
      .select(`
        id, nome, nome_mobilemed, email, ativo, status,
        contratos_clientes (
          id, tem_precos_configurados, status
        )
      `)
      .eq('ativo', true)
      .eq('status', 'Ativo')
      .limit(50000); // Aumentar limite explicitamente

    if (clientesError) throw clientesError;

    const clientesAtivos = clientes || [];
    console.log(`[gerar-faturamento-periodo] Total de clientes ativos: ${clientesAtivos.length}`);

    // Buscar mapeamentos de nomes
    const { data: mapeamentos } = await supabase
      .from('mapeamento_nomes_clientes')
      .select('nome_arquivo, nome_sistema')
      .eq('ativo', true)
      .limit(50000); // Aumentar limite explicitamente

    const mapeamentosMap = new Map();
    mapeamentos?.forEach(m => {
      mapeamentosMap.set(m.nome_arquivo.toUpperCase().trim(), m.nome_sistema.toUpperCase().trim());
    });

    // Processar imediatamente (sem background task para evitar problemas com EdgeRuntime)
    console.log('[gerar-faturamento-periodo] Iniciando processamento...');
    
    // 1. LIMPAR DADOS ANTERIORES DO PERÍODO (ambos os formatos)
    console.log(`[gerar-faturamento-periodo] Limpando dados anteriores do período ${periodoFormatado} e ${periodoRefMonyy}`);
    await supabase.from('faturamento').delete().eq('periodo_referencia', periodoFormatado);
    await supabase.from('faturamento').delete().eq('periodo_referencia', periodoRefMonyy);

    let totalItens = 0;
    let clientesComDados = 0;
    let processedCount = 0;

        // Processar clientes em lotes pequenos para evitar timeout
        const loteSize = 5; // Reduzir drasticamente para evitar timeout
        console.log(`[gerar-faturamento-periodo] Processando clientes com volumetria em lotes de ${loteSize}`);
        
        // Buscar clientes que realmente têm dados de volumetria no período - USANDO CAMPO EMPRESA
        const { data: clientesComVolumetria } = await supabase
          .from('volumetria_mobilemed')
          .select('"EMPRESA"')
          .eq('periodo_referencia', periodoFormatado) // Usar período normalizado YYYY-MM
          .not('"EMPRESA"', 'is', null)
          .limit(10000); // Reduzir limite para evitar timeout
        
        // Coletar APENAS nomes de EMPRESA
        const nomesClientesSet = new Set();
        clientesComVolumetria?.forEach(v => {
          if (v.EMPRESA) nomesClientesSet.add(v.EMPRESA);
        });
        const nomesClientesComVolumetria = Array.from(nomesClientesSet);
        
        console.log(`[gerar-faturamento-periodo] Clientes com volumetria no período: ${nomesClientesComVolumetria.length}`);
        console.log(`[gerar-faturamento-periodo] Lista: ${nomesClientesComVolumetria.join(', ')}`);
        
        // Buscar dados completos dos clientes na tabela usando nome_mobilemed - SEM LIMITAÇÃO
        const { data: todosClientes } = await supabase
          .from('clientes')
          .select('id, nome, nome_fantasia, nome_mobilemed, email, ativo, status')
          .limit(50000); // Aumentar limite explicitamente para buscar TODOS os clientes
        
        // Buscar contratos separadamente para evitar filtros no JOIN
        const { data: todosContratos } = await supabase
          .from('contratos_clientes')
          .select('id, cliente_id, tem_precos_configurados, status')
          .eq('status', 'ativo')
          .limit(50000);
        
        console.log(`[gerar-faturamento-periodo] Total de clientes encontrados: ${todosClientes?.length || 0}`);
        console.log(`[gerar-faturamento-periodo] Total de contratos ativos encontrados: ${todosContratos?.length || 0}`);
        
        // Criar mapa de contratos por cliente_id
        const contratosMap = new Map();
        todosContratos?.forEach(contrato => {
          if (!contratosMap.has(contrato.cliente_id)) {
            contratosMap.set(contrato.cliente_id, []);
          }
          contratosMap.get(contrato.cliente_id).push(contrato);
        });
        
        // Criar mapa usando nome_mobilemed para identificação (campo que mapeia com EMPRESA)
        const clientesMap = new Map();
        todosClientes?.forEach(cliente => {
          // Adicionar contratos ao cliente
          cliente.contratos_clientes = contratosMap.get(cliente.id) || [];
          
          // Mapear por nome_mobilemed (que corresponde ao campo EMPRESA da volumetria)
          if (cliente.nome_mobilemed) {
            clientesMap.set(cliente.nome_mobilemed.toUpperCase().trim(), cliente);
          }
          // Fallback para nome principal se não tiver nome_mobilemed
          else if (cliente.nome) {
            clientesMap.set(cliente.nome.toUpperCase().trim(), cliente);
          }
        });
        
        // PROCESSAR TODOS OS CLIENTES DA VOLUMETRIA - separar entre COM PREÇOS e PENDENTES
        const clientesComPrecos: any[] = [];
        const clientesPendentes: any[] = [];
        
        for (const nomeEmpresa of nomesClientesComVolumetria) {
          // Buscar cliente usando qualquer um dos campos de nome ou mapeamento
          let clienteExistente = clientesMap.get(nomeEmpresa.toUpperCase().trim());
          
          // Se não encontrou, tentar com mapeamento
          if (!clienteExistente) {
            const nomeMapeado = mapeamentosMap.get(nomeEmpresa.toUpperCase().trim());
            if (nomeMapeado) {
              clienteExistente = clientesMap.get(nomeMapeado);
              console.log(`[gerar-faturamento-periodo] Mapeamento aplicado: ${nomeEmpresa} -> ${nomeMapeado}`);
            }
          }
          
          if (clienteExistente) {
            // Verificar se tem contrato ativo
            const contratoAtivo = clienteExistente.contratos_clientes?.find(c => 
              c.status === 'ativo'
            );
            
            const clienteProcessado = {
              ...clienteExistente,
              nome_mobilemed: nomeEmpresa // Preservar o nome usado na volumetria (campo EMPRESA)
            };
            
            if (contratoAtivo) {
              // Verificar diretamente se existem preços configurados na tabela precos_servicos
              const { data: precosExistem } = await supabase
                .from('precos_servicos')
                .select('id')
                .eq('cliente_id', clienteExistente.id)
                .limit(1);
              
              if (precosExistem && precosExistem.length > 0) {
                console.log(`[gerar-faturamento-periodo] Cliente COM PREÇOS: ${nomeEmpresa} -> ${clienteExistente.id} (${clienteExistente.nome})`);
                clientesComPrecos.push(clienteProcessado);
              } else {
                console.log(`[gerar-faturamento-periodo] Cliente SEM PREÇOS: ${nomeEmpresa} -> ${clienteExistente.id} (${clienteExistente.nome}) - sem registros em precos_servicos`);
                clientesPendentes.push(clienteProcessado);
              }
            } else {
              console.log(`[gerar-faturamento-periodo] Cliente SEM CONTRATO ATIVO: ${nomeEmpresa} -> ${clienteExistente.id} (${clienteExistente.nome})`);
              clientesPendentes.push(clienteProcessado);
            }
          } else {
            // Cliente não cadastrado
            console.log(`[gerar-faturamento-periodo] Cliente NÃO CADASTRADO: ${nomeEmpresa}`);
            const clienteTemp = {
              id: `temp-${nomeEmpresa.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
              nome: nomeEmpresa,
              nome_mobilemed: nomeEmpresa,
              email: `${nomeEmpresa.toLowerCase().replace(/[^a-z0-9]/g, '')}@cliente.temporario.com`,
              ativo: true,
              status: 'Ativo',
              contratos_clientes: []
            };
            clientesPendentes.push(clienteTemp);
          }
        }
        
        console.log(`[gerar-faturamento-periodo] Clientes para processar: ${clientesComPrecos.length + clientesPendentes.length}`);
        console.log(`[gerar-faturamento-periodo] Clientes COM preços configurados: ${clientesComPrecos.length}`);
        console.log(`[gerar-faturamento-periodo] Clientes PENDENTES (sem preços): ${clientesPendentes.length}`);
        console.log(`[gerar-faturamento-periodo] Lista COM preços: ${clientesComPrecos.map(c => c.nome).join(', ')}`);
        console.log(`[gerar-faturamento-periodo] Lista PENDENTES: ${clientesPendentes.map(c => c.nome).join(', ')}`);
        
        // PROCESSAR CLIENTES EM LOTES PEQUENOS PARA EVITAR TIMEOUT
        const todosClientesParaProcessar = [...clientesComPrecos, ...clientesPendentes];
        const loteClientes = Math.min(5, todosClientesParaProcessar.length); // Processar máximo 5 clientes por vez
        
        console.log(`[gerar-faturamento-periodo] Processando ${todosClientesParaProcessar.length} clientes em lotes de ${loteClientes}`);
        
        let processedCount = 0;
        for (let i = 0; i < Math.min(loteClientes, todosClientesParaProcessar.length); i++) {
            const cliente = todosClientesParaProcessar[i];
            const tem_precos = clientesComPrecos.includes(cliente);
            
            try {
              console.log(`[gerar-faturamento-periodo] [${i + 1}/${loteClientes}] Processando cliente: ${cliente.nome}`);
              
              // Buscar dados de volumetria do cliente no período usando campo EMPRESA (LIMITADO)
              const { data: vm, error: vmErr } = await supabase
                .from('volumetria_mobilemed')
                .select('"EMPRESA","MODALIDADE","ESPECIALIDADE","CATEGORIA","PRIORIDADE","ESTUDO_DESCRICAO","VALORES","NOME_PACIENTE","DATA_REALIZACAO","MEDICO","ACCESSION_NUMBER"')
                .eq('"EMPRESA"', cliente.nome_mobilemed)
                .eq('periodo_referencia', periodoFormatado)
                .limit(1000); // Limitar registros por cliente para evitar timeout

              if (vmErr) {
                console.log(`[gerar-faturamento-periodo] Erro volumetria cliente ${cliente.nome}:`, vmErr.message);
                continue;
              }

              const rows = vm || [];
              if (rows.length === 0) {
                console.log(`[gerar-faturamento-periodo] Cliente ${cliente.nome} sem dados de volumetria no período`);
                continue;
              }

              console.log(`[gerar-faturamento-periodo] Cliente ${cliente.nome} - encontrados ${rows.length} registros de volumetria`);

              // Volume total (usado na faixa de preço) - garantir valor mínimo 1 se zerado
              const volumeTotal = Math.max(1, rows.reduce((acc: number, r: any) => acc + (Number(r.VALORES) || 0), 0));

              // Agrupar por chave INCLUINDO paciente (LIMITAR GRUPOS)
              const grupos = new Map<string, { chave: GrupoChave; qtd: number; paciente: string; medico: string; dataExame: string; accession: string }>();
              let groupCount = 0;
              const maxGroups = 100; // Limitar grupos por cliente
              
              for (const r of rows) {
                if (groupCount >= maxGroups) break; // Limitar processamento
                
                const chave: GrupoChave = {
                  modalidade: r.MODALIDADE || '',
                  especialidade: r.ESPECIALIDADE || '',
                  categoria: r.CATEGORIA || 'SC',
                  prioridade: r.PRIORIDADE || '',
                  estudo: r.ESTUDO_DESCRICAO || 'Exame',
                };
                
                const key = `${chave.modalidade}|${chave.especialidade}|${chave.categoria}|${chave.prioridade}|${chave.estudo}|${r.NOME_PACIENTE}|${r.ACCESSION_NUMBER}`;
                const qtd = Math.max(1, Number(r.VALORES) || 1);
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
                  groupCount++;
                }
              }

              console.log(`[gerar-faturamento-periodo] Cliente ${cliente.nome} - processando ${grupos.size} grupos de exames`);
              
              const itensInserir: any[] = [];
              let itemCount = 0;

              for (const { chave, qtd, paciente, medico, dataExame, accession } of grupos.values()) {
                let unit = 0; // Valor padrão
                
                if (tem_precos) {
                  try {
                    // Calcular preço unitário via RPC apenas para clientes com preços configurados
                    const { data: preco, error: precoErr } = await supabase.rpc('calcular_preco_exame', {
                      p_cliente_id: cliente.id,
                      p_modalidade: chave.modalidade,
                      p_especialidade: chave.especialidade,
                      p_prioridade: chave.prioridade,
                      p_categoria: chave.categoria,
                      p_volume_total: volumeTotal,
                      p_is_plantao: (chave.prioridade || '').toUpperCase().includes('PLANT')
                    });

                    unit = preco || 0;
                    
                    if (precoErr || !unit || unit <= 0) {
                      console.log(`[gerar-faturamento-periodo] Preço não encontrado para ${cliente.nome}: ${chave.modalidade}/${chave.especialidade}/${chave.categoria}`);
                      continue;
                    }
                  } catch (rpcError: any) {
                    console.log(`[gerar-faturamento-periodo] Erro RPC para ${cliente.nome}:`, rpcError.message);
                    continue;
                  }
                } else {
                  unit = 0; // Cliente sem preços configurados
                }

                let valor = Number((unit * qtd).toFixed(2));

                if (tem_precos && valor <= 0) {
                  continue; // Pular itens com valor zero para clientes com preços
                }

                const hoje = new Date();
                const emissao = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
                const vencimento = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                itensInserir.push({
                  omie_id: `SIM_${cliente.id}_${Date.now()}_${Math.floor(Math.random()*1000)}`,
                  numero_fatura: `FAT-${periodoFormatado}-${String(cliente.nome).substring(0, 10)}-${Date.now()}`,
                  cliente_id: cliente.id,
                  cliente_nome: cliente.nome,
                  cliente_nome_original: cliente.nome_mobilemed,
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
                  periodo_referencia: periodoFormatado,
                  tipo_dados: 'incremental',
                  accession_number: accession,
                });
                
                itemCount++;
              }

              if (itensInserir.length > 0) {
                console.log(`[gerar-faturamento-periodo] Inserindo ${itensInserir.length} itens para cliente ${cliente.nome}`);
                const { error: insErr } = await supabase.from('faturamento').insert(itensInserir);
                if (insErr) {
                  console.log(`[gerar-faturamento-periodo] Erro ao inserir itens (${cliente.nome}):`, insErr.message);
                } else {
                  totalItens += itensInserir.length;
                  clientesComDados++;
                  console.log(`[gerar-faturamento-periodo] ✓ Cliente ${cliente.nome} processado: ${itensInserir.length} itens`);
                }
              }
              
              processedCount++;
              
            } catch (clienteError: any) {
              console.error(`[gerar-faturamento-periodo] ERRO processando cliente ${cliente.nome}:`, clienteError.message);
              continue;
            }
        }

    console.log('[gerar-faturamento-periodo] PROCESSAMENTO CONCLUÍDO:', {
      totalItens,
      clientesComDados,
      clientesComPrecos: clientesComPrecos.length,
      clientesPendentes: clientesPendentes.length,
      clientesProcessados: processedCount,
      clientesTotais: nomesClientesComVolumetria.length
    });

    // Criar resumo das pendências
    const resumoPendencias = clientesPendentes.map(cliente => ({
      nome: cliente.nome,
      motivo: cliente.id.startsWith('temp-') ? 'Cliente não cadastrado' : 'Cliente sem contrato ativo ou preços configurados'
    }));

    console.log('[gerar-faturamento-periodo] CLIENTES PENDENTES:', resumoPendencias);

    // Retornar resposta com resultado do processamento
    return new Response(JSON.stringify({
      success: true,
      periodo: periodoFormatado,
      periodo_referencia: periodoRefMonyy,
      total_itens: totalItens,
      clientes_com_dados: clientesComDados,
      clientes_com_precos: clientesComPrecos.length,
      clientes_pendentes: clientesPendentes.length,
      clientes_processados: processedCount || 0,
      total_clientes: nomesClientesComVolumetria.length,
      pendencias: resumoPendencias,
      message: `Processamento concluído: ${processedCount || 0} clientes processados de ${nomesClientesComVolumetria.length} disponíveis`
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[gerar-faturamento-periodo] Erro:', error);
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Erro desconhecido' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});