import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OmieApiRequest {
  call: string;
  app_key: string;
  app_secret: string;
  param: Array<any>;
}

interface GerarNFRequest {
  periodo: string;
  clientes?: string[]; // Array de nomes de clientes, se vazio processa todos
}

interface FaturamentoData {
  cliente_nome: string;
  cliente_id: string;
  periodo_referencia: string;
  valor_total: number;
  valor_bruto: number;
  total_exames: number;
  detalhes_exames: any[];
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

    const { periodo, clientes }: GerarNFRequest = await req.json();
    
    if (!periodo) {
      throw new Error('Período é obrigatório');
    }

    const omieAppKey = Deno.env.get('OMIE_APP_KEY');
    const omieAppSecret = Deno.env.get('OMIE_APP_SECRET');

    if (!omieAppKey || !omieAppSecret) {
      throw new Error('Credenciais do Omie não configuradas');
    }

    console.log(`Iniciando geração de NF no Omie para período: ${periodo}`);

    // Buscar demonstrativos de faturamento gerados
    let query = supabase
      .from('relatorios_faturamento_status')
      .select(`
        cliente_id,
        cliente_nome,
        periodo,
        relatorio_gerado,
        detalhes_relatorio
      `)
      .eq('periodo', periodo)
      .eq('relatorio_gerado', true);

    // Se clientes específicos foram informados, filtrar (usando ILIKE para case insensitive)
    if (clientes && clientes.length > 0) {
      const clientesCondition = clientes.map(nome => `cliente_nome.ilike.${nome}`).join(',');
      query = query.or(clientesCondition);
    }

    const { data: demonstrativos, error: demoError } = await query;

    if (demoError) {
      throw new Error(`Erro ao buscar demonstrativos: ${demoError.message}`);
    }

    if (!demonstrativos || demonstrativos.length === 0) {
      throw new Error('Nenhum demonstrativo de faturamento encontrado para o período');
    }

    console.log(`Encontrados ${demonstrativos.length} demonstrativos para processar`);

    // Buscar dados dos clientes e contratos ativos
    const clienteIds = demonstrativos.map(d => d.cliente_id).filter(Boolean);
    const { data: clientesData } = await supabase
      .from('clientes')
      .select(`
        id, nome, cnpj, email, endereco, cidade, estado, cep, telefone, email_envio_nf, cod_cliente, 
        omie_codigo_cliente, omie_data_sincronizacao,
        contratos_clientes!inner(
          id,
          numero_contrato,
          tipo_faturamento,
          status,
          simples,
          percentual_iss,
          configuracoes_integracao,
          omie_codigo_cliente,
          omie_codigo_contrato,
          omie_data_sincronizacao
        )
      `)
      .in('id', clienteIds)
      .eq('contratos_clientes.status', 'ativo');

    // Buscar também nos parâmetros de faturamento para códigos OMIE adicionais
    const { data: parametrosData } = await supabase
      .from('parametros_faturamento')
      .select(`
        cliente_id,
        numero_contrato,
        nome_fantasia,
        nome_mobilemed
      `)
      .in('cliente_id', clienteIds)
      .eq('status', 'A');

    const resultados = [];
    let sucessos = 0;
    let erros = 0;

    for (const demo of demonstrativos) {
      let valorTotal = 0;
      let totalLaudos = 0;
      let valorBruto = 0;
      try {
        console.log(`Processando NF para cliente: ${demo.cliente_nome}`);

        const clienteData = clientesData?.find(c => c.id === demo.cliente_id);
        const detalhes = typeof demo.detalhes_relatorio === 'string'
          ? JSON.parse(demo.detalhes_relatorio)
          : demo.detalhes_relatorio;

        // Aceitar relatórios que tenham ao menos valor_bruto OU valor_total em qualquer estrutura
        const toNumber = (v: any) => {
          const n = typeof v === 'number' ? v : Number(v);
          return Number.isFinite(n) ? n : 0;
        };

        const brutoDetalhe = toNumber(detalhes?.valor_bruto) || toNumber(detalhes?.resumo?.valor_bruto_total);
        const totalDetalhe = toNumber(detalhes?.valor_total) || toNumber(detalhes?.resumo?.valor_a_pagar) || toNumber(detalhes?.resumo?.valor_total);

        // Preferência: usar valor_bruto para emissão da NF
        const clienteNomeUpper = String(demo.cliente_nome || '').toUpperCase();
        const usarBrutoSempre = ['COT', 'CORTREL'].includes(clienteNomeUpper);
        const valorParaNF = usarBrutoSempre ? brutoDetalhe : (brutoDetalhe || totalDetalhe);

        if (!detalhes || valorParaNF <= 0) {
          throw new Error('Dados de faturamento incompletos ou sem valor válido (valor_bruto/valor_total)');
        }

        // ✅ EXTRAIR VALORES da estrutura do relatório
        valorTotal = valorParaNF; // usar este como base para NF
        totalLaudos = toNumber(detalhes?.total_laudos) || toNumber(detalhes?.resumo?.total_laudos);
        valorBruto = brutoDetalhe || valorParaNF;

        if (!clienteData || !clienteData.contratos_clientes || clienteData.contratos_clientes.length === 0) {
          throw new Error(`Cliente não possui contrato ativo: ${demo.cliente_nome}`);
        }

        // Obter contrato ativo (cliente já cadastrado no OMIE)
        const contratoAtivo = clienteData.contratos_clientes[0];
        const parametroCliente = parametrosData?.find(p => p.cliente_id === demo.cliente_id);
        
        // Buscar código OMIE real do cliente - IGNORAR códigos fictícios do Supabase
        let codigoClienteOmie = clienteData.omie_codigo_cliente || 
                               contratoAtivo.omie_codigo_cliente;
        
        // Se não tem código real do Omie OU tem código fictício, buscar no Omie via CNPJ
        const temCodigoFicticio = clienteData.cod_cliente?.startsWith('CLI');
        if ((!codigoClienteOmie || temCodigoFicticio) && clienteData.cnpj) {
          console.log(`🔍 Código real do Omie necessário para ${demo.cliente_nome}. Buscando no Omie via CNPJ: ${clienteData.cnpj}`);
          
          try {
            const buscaOmieResponse = await supabase.functions.invoke('buscar-codigo-cliente-omie', {
              body: {
                cnpj: clienteData.cnpj,
                nome_cliente: demo.cliente_nome
              }
            });

            if (buscaOmieResponse.error) {
              console.error(`Erro ao buscar cliente no Omie:`, buscaOmieResponse.error);
            } else if (buscaOmieResponse.data?.sucesso && buscaOmieResponse.data.cliente_encontrado) {
              const clienteOmie = buscaOmieResponse.data.cliente_encontrado;
              codigoClienteOmie = clienteOmie.codigo_omie;
              
              console.log(`✅ Cliente encontrado no Omie: ${clienteOmie.razao_social} - Código: ${codigoClienteOmie}`);
              
              // Salvar código real do Omie nas tabelas
              const agora = new Date().toISOString();
              
              // Atualizar cliente
              const { error: updateClienteError } = await supabase
                .from('clientes')
                .update({ 
                  omie_codigo_cliente: String(codigoClienteOmie),
                  omie_data_sincronizacao: agora
                })
                .eq('id', demo.cliente_id);

              // Atualizar contrato
              const { error: updateContratoError } = await supabase
                .from('contratos_clientes')
                .update({ 
                  omie_codigo_cliente: String(codigoClienteOmie),
                  omie_data_sincronizacao: agora
                })
                .eq('id', contratoAtivo.id);

              if (updateClienteError) {
                console.error(`Erro ao salvar código Omie no cliente:`, updateClienteError);
              } else {
                console.log(`💾 Código real Omie ${codigoClienteOmie} salvo para cliente ${demo.cliente_nome}`);
              }
              
              if (updateContratoError) {
                console.error(`Erro ao salvar código Omie no contrato:`, updateContratoError);
              } else {
                console.log(`💾 Código real Omie ${codigoClienteOmie} salvo no contrato ${contratoAtivo.numero_contrato}`);
              }
            } else {
              console.log(`❌ Cliente ${demo.cliente_nome} não encontrado no Omie via CNPJ`);
            }
          } catch (buscaError) {
            console.error(`Erro na busca automática no Omie para ${demo.cliente_nome}:`, buscaError);
          }
        }

        if (!codigoClienteOmie) {
          throw new Error(`Cliente ${demo.cliente_nome} não foi encontrado no Omie via CNPJ ${clienteData.cnpj || 'N/A'}`);
        }

        // Converter para o formato numérico exigido pela API (remove qualquer prefixo como "CLI" ou "2023/")
        const codigoClienteNumerico = Number(String(codigoClienteOmie).replace(/\D/g, ''));
        if (!codigoClienteNumerico) {
          throw new Error(`Código OMIE inválido para ${demo.cliente_nome}: ${codigoClienteOmie}`);
        }

        console.log(`Cliente ${demo.cliente_nome} - Código OMIE original: ${codigoClienteOmie} | Código numérico: ${codigoClienteNumerico} | Contrato: ${contratoAtivo.numero_contrato || parametroCliente?.numero_contrato}`);

        // Utilidades de data no formato dd/MM/yyyy exigido pelo Omie
        const formatDateBR = (d: Date) => {
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const yyyy = d.getFullYear();
          return `${dd}/${mm}/${yyyy}`;
        };

        const hoje = new Date();
        const venc = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        // Obter códigos de produto/serviço do contrato quando disponíveis
        const cfg = (contratoAtivo as any)?.configuracoes_integracao || {};
        const codigoProduto = cfg.codigo_produto || 'TELEIMAGEM';
        const codigoItemIntegracao = cfg.codigo_item_integracao || 'TELE-SERV';

        // Montar Pedido de Venda (API produtos/pedido -> IncluirPedido)
        const nfData = {
          cabecalho: {
            codigo_cliente: codigoClienteNumerico,
            codigo_pedido_integracao: `FAT-${periodo}-${demo.cliente_nome.replace(/[^A-Z0-9]/g, '')}`,
            data_previsao: formatDateBR(hoje),
            etapa: '50', // Faturar
            codigo_parcela: '999', // Parcela customizada
            qtde_parcelas: 1,
          },
          informacoes_adicionais: {
            enviar_email: 'N',
            consumidor_final: 'N',
          },
          lista_parcelas: {
            parcela: [
              {
                data_vencimento: formatDateBR(venc),
                numero_parcela: 1,
                percentual: 100,
                valor: valorTotal,
                nao_gerar_boleto: 'S',
              },
            ],
          },
          det: [
            {
              ide: {
                codigo_item_integracao: String(codigoItemIntegracao),
                simples_nacional: contratoAtivo.simples ? 'S' : 'N',
              },
              produto: {
                codigo_produto: String(codigoProduto),
                descricao: `Serviços de Telemedicina - ${periodo} (${contratoAtivo.tipo_faturamento})`,
                unidade: 'SV',
                quantidade: 1,
                valor_unitario: valorTotal,
              },
            },
          ],
        };

        // Criar NF no Omie
        const criarNFReq: OmieApiRequest = {
          call: "IncluirPedido",
          app_key: omieAppKey,
          app_secret: omieAppSecret,
          param: [nfData]
        };

        // Log seguro (sem expor credenciais)
        console.log(
          `Criando NF no Omie (IncluirPedido) para ${demo.cliente_nome}:`,
          JSON.stringify({ call: criarNFReq.call, param: criarNFReq.param }, null, 2)
        );

        const nfResponse = await fetch("https://app.omie.com.br/api/v1/produtos/pedido/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(criarNFReq)
        });

        const nfResult = await nfResponse.json();

        if (nfResult.codigo_pedido) {
          console.log(`NF criada com sucesso no Omie: ${nfResult.codigo_pedido}`);
          
          // Salvar referência da NF no banco
          await supabase
            .from('relatorios_faturamento_status')
            .update({
              omie_nf_gerada: true,
              omie_codigo_pedido: nfResult.codigo_pedido,
              omie_numero_pedido: nfResult.numero_pedido || null,
              data_geracao_nf_omie: new Date().toISOString(),
              omie_detalhes: nfResult
            })
            .eq('cliente_id', demo.cliente_id)
            .eq('periodo', periodo);

          resultados.push({
            cliente: demo.cliente_nome,
            sucesso: true,
            codigo_pedido_omie: nfResult.codigo_pedido,
            numero_pedido_omie: nfResult.numero_pedido,
            valor_total: valorTotal
          });
          sucessos++;
        } else {
          throw new Error(`Erro na resposta do Omie: ${JSON.stringify(nfResult)}`);
        }

      } catch (error) {
        console.error(`Erro ao processar NF para ${demo.cliente_nome}:`, error);
        erros++;
        
        resultados.push({
          cliente: demo.cliente_nome,
          sucesso: false,
          erro: error.message,
          valor_total: valorTotal
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        periodo,
        total_processados: demonstrativos.length,
        sucessos,
        erros,
        resultados,
        resumo: {
          message: `Processamento concluído: ${sucessos} NFs geradas com sucesso, ${erros} erros`,
          taxa_sucesso: Math.round((sucessos / demonstrativos.length) * 100)
        }
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Erro na função gerar-nf-omie:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});