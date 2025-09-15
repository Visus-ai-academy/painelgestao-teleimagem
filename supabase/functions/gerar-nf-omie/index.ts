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

    // Se clientes específicos foram informados, filtrar
    if (clientes && clientes.length > 0) {
      query = query.in('cliente_nome', clientes);
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
        id, nome, cnpj, email, endereco, cidade, estado, cep, telefone, email_envio_nf,
        contratos_clientes!inner(
          id,
          numero_contrato,
          tipo_faturamento,
          status,
          ativo,
          codigo_omie
        )
      `)
      .in('id', clienteIds)
      .eq('contratos_clientes.ativo', true);

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

        if (!detalhes || (!detalhes.valor_total && !detalhes.resumo?.valor_a_pagar)) {
          throw new Error('Dados de faturamento incompletos');
        }

        // ✅ EXTRAIR VALORES da estrutura do relatório
        valorTotal = detalhes.valor_total || detalhes.resumo?.valor_a_pagar || 0;
        totalLaudos = detalhes.total_laudos || detalhes.resumo?.total_laudos || 0;
        valorBruto = detalhes.valor_bruto || detalhes.resumo?.valor_bruto_total || valorTotal;

        if (valorTotal <= 0) {
          throw new Error(`Valor total inválido: R$ ${valorTotal}`);
        }

        if (!clienteData || !clienteData.contratos_clientes || clienteData.contratos_clientes.length === 0) {
          throw new Error(`Cliente não possui contrato ativo: ${demo.cliente_nome}`);
        }

        // Obter contrato ativo (cliente já cadastrado no OMIE)
        const contratoAtivo = clienteData.contratos_clientes[0];
        const codigoClienteOmie = contratoAtivo.codigo_omie;

        if (!codigoClienteOmie) {
          throw new Error(`Cliente ${demo.cliente_nome} não possui código OMIE configurado no contrato`);
        }

        console.log(`Cliente ${demo.cliente_nome} - Código OMIE: ${codigoClienteOmie} | Contrato: ${contratoAtivo.numero_contrato}`);

        // Preparar dados para criação da NF no Omie baseado no contrato ativo
        const nfData = {
          // Cabeçalho da NF
          cabecalho: {
            codigo_cliente_omie: codigoClienteOmie,
            codigo_pedido: `FAT-${periodo}-${demo.cliente_nome.replace(/[^A-Z0-9]/g, '')}`,
            data_emissao: new Date().toISOString().split('T')[0],
            data_vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 dias
            numero_pedido: `${periodo}-${contratoAtivo.numero_contrato}`,
            quantidade_itens: 1,
            codigo_parcela: "000",
            qtde_parcelas: 1
          },
          // Informações do cliente
          informacoes_adicionais: {
            categoria: "Faturamento Teleimagem",
            obs_internas: `Período ${periodo} - ${totalLaudos} laudos | Contrato: ${contratoAtivo.numero_contrato}`,
            obs_venda: `Serviços de telemedicina - período ${periodo} | ${contratoAtivo.tipo_faturamento}`
          },
          // Itens da NF baseados no contrato
          det: [
            {
              ide: {
                codigo_item_omie: "", // Código do serviço de telemedicina no Omie
                simples_nacional: contratoAtivo.simples ? "S" : "N",
                codigo_produto: "TELEIMAGEM-SERVICOS"
              },
              produto: {
                codigo: "TELEIMAGEM",
                descricao: `Serviços de Telemedicina - ${periodo} (${contratoAtivo.tipo_faturamento})`,
                unidade: "SV",
                quantidade: 1,
                valor_unitario: valorTotal,
                valor_total: valorTotal
              },
              imposto: {
                cofins_aliquota: 3.00,
                pis_aliquota: 0.65,
                iss_aliquota: contratoAtivo.percentual_iss || 5.00,
                codigo_beneficio_fiscal: ""
              }
            }
          ]
        };

        // Criar NF no Omie
        const criarNFReq: OmieApiRequest = {
          call: "IncluirPedido",
          app_key: omieAppKey,
          app_secret: omieAppSecret,
          param: [nfData]
        };

        console.log(`Criando NF no Omie:`, JSON.stringify(criarNFReq, null, 2));

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