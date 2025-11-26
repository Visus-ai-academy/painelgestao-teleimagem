import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  clientes?: string[];      // nomes (case-insensitive)
  cliente_ids?: string[];   // UUIDs
  cnpjs?: string[];         // CNPJs
  apenas_sem_codigo?: boolean; // se true, busca apenas clientes com omie_codigo_cliente NULL
  limite?: number;          // limite de clientes no modo sem filtro
}

interface OmieApiRequest {
  call: string;
  app_key: string;
  app_secret: string;
  param: any[];
}

interface OmieContrato {
  nCodCtr: number;
  cNumCtr: string;
  dVigInicial: string;
  dVigFinal: string;
  [key: string]: any;
}

// Função para converter data do formato DD/MM/YYYY para YYYY-MM-DD
function converterDataOmie(dataOmie: string): string | null {
  if (!dataOmie) return null;
  const partes = dataOmie.split('/');
  if (partes.length !== 3) return null;
  return `${partes[2]}-${partes[1]}-${partes[0]}`;
}

// Função para adicionar delay entre requisições
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Função para fazer requisição com retry exponencial
async function fetchWithRetry(url: string, options: any, maxRetries = 5): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Se receber 425 (Too Early), 429 (Too Many Requests) ou 500 (Internal Server Error), esperar e tentar novamente
      if (response.status === 425 || response.status === 429 || response.status === 500) {
        const waitTime = Math.pow(2, attempt) * 3000; // 3s, 6s, 12s, 24s, 48s
        console.log(`Erro ${response.status} detectado. Aguardando ${waitTime}ms antes de tentar novamente (tentativa ${attempt + 1}/${maxRetries})...`);
        await delay(waitTime);
        continue;
      }
      
      return response;
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      const waitTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, 8s, 16s
      console.log(`Erro na requisição. Aguardando ${waitTime}ms antes de tentar novamente (tentativa ${attempt + 1}/${maxRetries})...`);
      await delay(waitTime);
    }
  }
  
  throw new Error('Máximo de tentativas excedido');
}

// Função para buscar cliente no OMIE diretamente
async function buscarClienteOmie(cnpj: string, nomeCliente: string) {
  const omieAppKey = Deno.env.get('OMIE_APP_KEY');
  const omieAppSecret = Deno.env.get('OMIE_APP_SECRET');

  if (!omieAppKey || !omieAppSecret) {
    throw new Error('Credenciais do OMIE não configuradas');
  }

  console.log(`Buscando cliente no OMIE - CNPJ: ${cnpj}, Nome: ${nomeCliente}`);

  // Paginar resultados e tentar casar por CNPJ (normalizado) e, se necessário, por nome
  const digits = (cnpj || '').replace(/\D/g, '');
  const norm = (s: string) => (s || '').toLowerCase().trim();
  const alvoNome = norm(nomeCliente);

  for (let pagina = 1; pagina <= 50; pagina++) {
    const buscarClienteReq: OmieApiRequest = {
      call: "ListarClientes",
      app_key: omieAppKey,
      app_secret: omieAppSecret,
      param: [{
        pagina,
        registros_por_pagina: 100,
      }],
    };

    console.log(`Consultando API OMIE - ListarClientes (página ${pagina})...`);

    const response = await fetchWithRetry('https://app.omie.com.br/api/v1/geral/clientes/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buscarClienteReq),
    });

    if (!response.ok) {
      throw new Error(`Erro na API do OMIE: ${response.status} - ${response.statusText}`);
    }

    // Aguardar 2 segundos entre requisições para evitar rate limiting
    await delay(2000);

    const dados = await response.json();
    const lista = dados.clientes_cadastro || [];
    console.log(`API OMIE retornou ${lista.length} clientes na página ${pagina}`);

    if (lista.length === 0) break; // fim da paginação

    // 1) Tentar por CNPJ (somente dígitos)
    let clienteEncontrado = lista.find((cliente: any) => {
      const cnpjResp = String(cliente.cnpj_cpf || '').replace(/\D/g, '');
      return cnpjResp && digits && cnpjResp === digits;
    });

    // 2) Se não encontrou por CNPJ, tentar por nome (razao_social ou nome_fantasia)
    if (!clienteEncontrado && alvoNome) {
      clienteEncontrado = lista.find((cliente: any) =>
        norm(cliente.razao_social).includes(alvoNome) ||
        norm(cliente.nome_fantasia).includes(alvoNome)
      );
    }

    if (clienteEncontrado) {
      console.log(`Cliente encontrado no OMIE: ${clienteEncontrado.razao_social} - Código: ${clienteEncontrado.codigo_cliente_omie}`);
      return {
        codigo_omie: clienteEncontrado.codigo_cliente_omie,
        razao_social: clienteEncontrado.razao_social,
        nome_fantasia: clienteEncontrado.nome_fantasia,
        cnpj: clienteEncontrado.cnpj_cpf,
      };
    }

    // Se retornou menos que a página cheia, não há próximas páginas
    if (lista.length < 100) break;
  }

  return null;
}

// Função para buscar contratos no OMIE por código de cliente
async function buscarContratosOmie(codigoClienteOmie: string) {
  const omieAppKey = Deno.env.get('OMIE_APP_KEY');
  const omieAppSecret = Deno.env.get('OMIE_APP_SECRET');

  if (!omieAppKey || !omieAppSecret) {
    throw new Error('Credenciais do OMIE não configuradas');
  }

  console.log(`Buscando contratos no OMIE para cliente código: ${codigoClienteOmie}`);

  const contratos: OmieContrato[] = [];

  for (let pagina = 1; pagina <= 20; pagina++) {
    const buscarContratosReq: OmieApiRequest = {
      call: "ListarContratos",
      app_key: omieAppKey,
      app_secret: omieAppSecret,
      param: [{
        pagina,
        registros_por_pagina: 100,
        apenas_importado_api: 'N',
        filtrar_por_cliente: codigoClienteOmie
      }],
    };

    console.log(`Consultando API OMIE - ListarContratos (página ${pagina})...`);

    const response = await fetchWithRetry('https://app.omie.com.br/api/v1/servicos/contrato/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buscarContratosReq),
    });

    if (!response.ok) {
      throw new Error(`Erro na API do OMIE: ${response.status} - ${response.statusText}`);
    }

    // Aguardar 2 segundos entre requisições para evitar rate limiting
    await delay(2000);

    const dados = await response.json();
    const lista = dados.contratoCadastro || [];
    console.log(`API OMIE retornou ${lista.length} contratos na página ${pagina}`);

    if (lista.length === 0) break;

    contratos.push(...lista);

    if (lista.length < 100) break;
  }

  return contratos;
}

// Função para processar clientes em background
async function processarClientesBackground(
  clientesData: any[],
  supabase: any
) {
  console.log(`[Background] Iniciando processamento de ${clientesData.length} clientes em background`);
  
  const CHUNK_SIZE = 5; // Processar 5 clientes por chunk
  const DELAY_ENTRE_CLIENTES = 3000; // 3 segundos entre clientes
  const DELAY_ENTRE_CHUNKS = 5000; // 5 segundos entre chunks
  
  let atualizados = 0;
  let naoEncontrados = 0;
  let erros = 0;

  // Dividir clientes em chunks
  for (let i = 0; i < clientesData.length; i += CHUNK_SIZE) {
    const chunk = clientesData.slice(i, i + CHUNK_SIZE);
    console.log(`[Background] Processando chunk ${Math.floor(i / CHUNK_SIZE) + 1} de ${Math.ceil(clientesData.length / CHUNK_SIZE)}`);
    
    for (const c of chunk) {
      try {
        console.log(`[Background] Processando cliente: ${c.nome}`);
        await delay(DELAY_ENTRE_CLIENTES);
        
        let codigoOmie = c.omie_codigo_cliente;
        const agora = new Date().toISOString();

        // Se não tem código OMIE, buscar no OMIE
        if (!codigoOmie) {
          if (!c.cnpj) {
            console.log(`[Background] Cliente ${c.nome} sem CNPJ - pulando`);
            naoEncontrados++;
            continue;
          }

          const encontrado = await buscarClienteOmie(c.cnpj, c.nome);
          
          if (!encontrado?.codigo_omie) {
            console.log(`[Background] Cliente ${c.nome} não encontrado no Omie`);
            naoEncontrados++;
            continue;
          }

          codigoOmie = String(encontrado.codigo_omie);

          const { error: updClienteError } = await supabase
            .from('clientes')
            .update({ omie_codigo_cliente: codigoOmie, omie_data_sincronizacao: agora })
            .eq('id', c.id);

          if (updClienteError) throw updClienteError;
          console.log(`[Background] Cliente ${c.nome} - código OMIE atualizado: ${codigoOmie}`);
        }

        // Buscar contratos do sistema para este cliente
        const { data: contratosCliente, error: contratosError } = await supabase
          .from('contratos_clientes')
          .select('id, numero_contrato, data_inicio, data_fim')
          .eq('cliente_id', c.id)
          .in('status', ['ativo', 'vencido']);

        if (contratosError) throw contratosError;

        // Buscar contratos no OMIE
        const contratosOmie = await buscarContratosOmie(codigoOmie);
        console.log(`[Background] Cliente ${c.nome} - encontrados ${contratosOmie.length} contratos no OMIE`);
        
        let contratosAtualizados = 0;

        // Para cada contrato do sistema, tentar casar com OMIE pelo numero_contrato
        for (const contrato of contratosCliente || []) {
          if (!contrato.numero_contrato) continue;

          const contratoOmie = contratosOmie.find((co: OmieContrato) => 
            co.cabecalho?.cNumCtr && String(co.cabecalho.cNumCtr).trim() === String(contrato.numero_contrato).trim()
          );

          if (contratoOmie && contratoOmie.cabecalho) {
            const updateData: any = {
              omie_codigo_cliente: codigoOmie,
              omie_codigo_contrato: String(contratoOmie.cabecalho.nCodCtr),
              omie_data_sincronizacao: agora
            };

            if (contratoOmie.cabecalho.dVigInicial) {
              const dataInicio = converterDataOmie(contratoOmie.cabecalho.dVigInicial);
              if (dataInicio) updateData.data_inicio = dataInicio;
            }
            if (contratoOmie.cabecalho.dVigFinal) {
              const dataFim = converterDataOmie(contratoOmie.cabecalho.dVigFinal);
              if (dataFim) updateData.data_fim = dataFim;
            }

            const { error: updContratoError } = await supabase
              .from('contratos_clientes')
              .update(updateData)
              .eq('id', contrato.id);

            if (!updContratoError) {
              // Atualizar também parametros_faturamento com as mesmas datas
              const updateParamsData: any = {};
              if (contratoOmie.cabecalho.dVigInicial) {
                const dataInicio = converterDataOmie(contratoOmie.cabecalho.dVigInicial);
                if (dataInicio) updateParamsData.data_inicio_contrato = dataInicio;
              }
              if (contratoOmie.cabecalho.dVigFinal) {
                const dataFim = converterDataOmie(contratoOmie.cabecalho.dVigFinal);
                if (dataFim) updateParamsData.data_termino_contrato = dataFim;
              }

              if (Object.keys(updateParamsData).length > 0) {
                await supabase
                  .from('parametros_faturamento')
                  .update(updateParamsData)
                  .eq('numero_contrato', contrato.numero_contrato);
              }

              contratosAtualizados++;
              console.log(`[Background] Contrato ${contrato.numero_contrato} sincronizado com sucesso`);
            }
          } else {
            // Apenas atualizar código do cliente no contrato
            await supabase
              .from('contratos_clientes')
              .update({ omie_codigo_cliente: codigoOmie, omie_data_sincronizacao: agora })
              .eq('id', contrato.id);
          }
        }

        console.log(`[Background] Cliente ${c.nome} - ${contratosAtualizados} contratos atualizados`);
        atualizados++;
      } catch (e) {
        console.error(`[Background] Erro ao sincronizar cliente ${c.nome}:`, e);
        erros++;
      }
    }
    
    // Delay entre chunks (exceto no último chunk)
    if (i + CHUNK_SIZE < clientesData.length) {
      console.log(`[Background] Aguardando ${DELAY_ENTRE_CHUNKS}ms antes do próximo chunk...`);
      await delay(DELAY_ENTRE_CHUNKS);
    }
  }

  console.log(`[Background] Processamento concluído - Atualizados: ${atualizados}, Não encontrados: ${naoEncontrados}, Erros: ${erros}`);
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

    const body: SyncRequest = await req.json().catch(() => ({}));
    const { clientes, cliente_ids, cnpjs, apenas_sem_codigo = false } = body || {};

    console.log('Iniciando sincronização de códigos Omie (cliente) com parâmetros:', body);

    // Montar query base - buscar TODOS os clientes que precisam sincronizar
    let query = supabase
      .from('clientes')
      .select('id, nome, cnpj, omie_codigo_cliente');

    if (cliente_ids && cliente_ids.length > 0) {
      query = query.in('id', cliente_ids);
    } else if (cnpjs && cnpjs.length > 0) {
      query = query.in('cnpj', cnpjs);
    } else if (clientes && clientes.length > 0) {
      const orCond = clientes.map((n) => `nome.ilike.%${n}%`).join(',');
      query = query.or(orCond);
    } else if (apenas_sem_codigo) {
      query = query.is('omie_codigo_cliente', null).not('cnpj', 'is', null);
    }
    // Se nenhum filtro foi fornecido, buscar todos os clientes ativos

    const { data: clientesData, error: listError } = await query;
    if (listError) throw listError;

    if (!clientesData || clientesData.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Nenhum cliente encontrado para sincronizar',
        total_clientes: 0
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Total de ${clientesData.length} clientes para sincronizar`);

    // Iniciar processamento em background
    EdgeRuntime.waitUntil(
      processarClientesBackground(clientesData, supabase)
    );

    // Retornar imediatamente
    return new Response(JSON.stringify({
      success: true,
      message: `Sincronização iniciada em background para ${clientesData.length} clientes`,
      total_clientes: clientesData.length,
      status: 'processando'
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Erro na função sincronizar-codigo-cliente-omie:', error);
    return new Response(JSON.stringify({ success: false, error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
