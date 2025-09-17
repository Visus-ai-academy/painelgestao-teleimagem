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

    // Buscar demonstrativos de faturamento do período (não exigir flag relatorio_gerado)
    let query = supabase
      .from('relatorios_faturamento_status')
      .select(`
        cliente_id,
        cliente_nome,
        periodo,
        relatorio_gerado,
        detalhes_relatorio
      `)
      .eq('periodo', periodo);

    // Se clientes específicos foram informados, filtrar (usando ILIKE para case insensitive)
    if (clientes && clientes.length > 0) {
      const clientesCondition = clientes.map(nome => `cliente_nome.eq.${nome}`).join(',');
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
        let valorParaNF = usarBrutoSempre ? brutoDetalhe : (brutoDetalhe || totalDetalhe);

        // 🔄 Fallback: se não houver valor no relatório, calcular via RPC
        if (valorParaNF <= 0) {
          const volume = toNumber(detalhes?.totalRegistros) || toNumber(detalhes?.total_laudos) || 0;
          const { data: calc, error: calcError } = await supabase.rpc('calcular_faturamento_completo', {
            p_cliente_id: demo.cliente_id,
            p_periodo: periodo,
            p_volume_total: volume
          });
          if (calcError) {
            console.error('Erro RPC calcular_faturamento_completo:', calcError);
          }
          const calcRow = Array.isArray(calc) ? calc[0] : null;
          const valorCalc = toNumber(calcRow?.valor_total) || toNumber(calcRow?.valor_exames);
          if (valorCalc > 0) {
            valorParaNF = valorCalc;
            // Enriquecer detalhes com resumo mínimo (não bloqueante)
            try {
              const resumoCalc = {
                origem: 'rpc_calcular_faturamento_completo',
                valor_exames: toNumber(calcRow?.valor_exames),
                valor_franquia: toNumber(calcRow?.valor_franquia),
                valor_portal_laudos: toNumber(calcRow?.valor_portal_laudos),
                valor_integracao: toNumber(calcRow?.valor_integracao),
                valor_total: valorCalc
              };
              if (detalhes && typeof detalhes === 'object') {
                detalhes.resumo = detalhes.resumo || resumoCalc;
              }
            } catch (_) { /* noop */ }
          }
        }

        if (valorParaNF <= 0) {
          console.warn('⚠️ Dados de faturamento sem valor. Prosseguindo: Omie calculará a OS com base no contrato.');
        }

        // ✅ EXTRAIR VALORES da estrutura do relatório
        valorTotal = valorParaNF; // usar este como base para NF (pode ser 0 se contrato definir)
        totalLaudos = toNumber(detalhes?.total_laudos) || toNumber(detalhes?.resumo?.total_laudos) || 0;
        valorBruto = brutoDetalhe || valorParaNF;

        if (!clienteData || !clienteData.contratos_clientes || clienteData.contratos_clientes.length === 0) {
          throw new Error(`Cliente não possui contrato ativo: ${demo.cliente_nome}`);
        }

        // Obter contrato ativo priorizando o número dos parâmetros de faturamento
        const parametroCliente = parametrosData?.find(p => p.cliente_id === demo.cliente_id);
        const numeroContratoAlvo = (parametroCliente?.numero_contrato || '').toString().trim();
        const contratoAtivo = (numeroContratoAlvo
          ? clienteData.contratos_clientes.find((c: any) => (c.numero_contrato || '').toString().trim() === numeroContratoAlvo)
          : null) || clienteData.contratos_clientes[0];
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
                cnpj: String(clienteData.cnpj || '').replace(/\D/g, ''),
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
                console.log(`💾 Código real Omie ${codigoClienteOmie} salvo no contrato ${contratoAtivo.numero_contrato} (campo omie_codigo_cliente)`);
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

        // Garantir que temos o código do contrato do Omie; se ausente ou inválido (igual ao código do cliente), sincronizar agora
        let codContratoDigits = String(contratoAtivo.omie_codigo_contrato || '').replace(/\D/g, '');
        const codClienteDigits = String(codigoClienteOmie || '').replace(/\D/g, '');
        const contratoInvalido = !codContratoDigits || (codContratoDigits && codClienteDigits && codContratoDigits === codClienteDigits);
        if (contratoInvalido) {
          console.warn(`Contrato OMIE ausente/inválido para ${demo.cliente_nome}. Tentando ConsultarContrato com número ${numeroContratoAlvo || contratoAtivo.numero_contrato}...`);
          const numeroConsulta = (numeroContratoAlvo || contratoAtivo.numero_contrato || '').toString().trim();
          if (numeroConsulta) {
            try {
              const consultaReq: OmieApiRequest = {
                call: 'ConsultarContrato',
                app_key: omieAppKey,
                app_secret: omieAppSecret,
                param: [{ cNumCtr: numeroConsulta }]
              };
              const consultaResp = await fetch('https://app.omie.com.br/api/v1/servicos/contrato/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(consultaReq)
              });
              const consultaJson = await consultaResp.json();
              const findNCodCtr = (o: any): any => {
                if (!o || typeof o !== 'object') return null;
                if (Object.prototype.hasOwnProperty.call(o, 'nCodCtr')) return o.nCodCtr;
                if (Object.prototype.hasOwnProperty.call(o, 'nCodContrato')) return o.nCodContrato;
                for (const v of Object.values(o)) {
                  const r = findNCodCtr(v);
                  if (r != null) return r;
                }
                return null;
              };
              const codDireto = findNCodCtr(consultaJson);
              const codDiretoDigits = String(codDireto || '').replace(/\D/g, '');
              if (codDiretoDigits && codDiretoDigits !== codClienteDigits) {
                const agoraISO = new Date().toISOString();
                let updateQuery = supabase
                  .from('contratos_clientes')
                  .update({ omie_codigo_contrato: String(codDiretoDigits), omie_data_sincronizacao: agoraISO })
                  .eq('cliente_id', demo.cliente_id)
                  .eq('status', 'ativo');
                updateQuery = updateQuery.eq('numero_contrato', numeroConsulta);
                const { error: updErr } = await updateQuery;
                if (updErr) {
                  await supabase
                    .from('contratos_clientes')
                    .update({ omie_codigo_contrato: String(codDiretoDigits), omie_data_sincronizacao: agoraISO })
                    .eq('id', contratoAtivo.id);
                }
                contratoAtivo.omie_codigo_contrato = String(codDiretoDigits);
              } else {
                console.warn('ConsultarContrato não retornou nCodCtr válido (ou igual ao código do cliente). Tentando função auxiliar...');
                const sync = await supabase.functions.invoke('buscar-contrato-omie', {
                  body: {
                    cliente_id: demo.cliente_id,
                    cliente_nome: demo.cliente_nome,
                    numero_contrato: numeroConsulta
                  }
                });
                if (sync.data?.sucesso && sync.data?.codigo_contrato) {
                  const novoCod = String(sync.data.codigo_contrato);
                  const novoCodDigits = novoCod.replace(/\D/g, '');
                  if (novoCodDigits && novoCodDigits !== codClienteDigits) {
                    const agoraISO = new Date().toISOString();
                    let updateQuery2 = supabase
                      .from('contratos_clientes')
                      .update({ omie_codigo_contrato: novoCod, omie_data_sincronizacao: agoraISO })
                      .eq('cliente_id', demo.cliente_id)
                      .eq('status', 'ativo')
                      .eq('numero_contrato', numeroConsulta);
                    const { error: updErr2 } = await updateQuery2;
                    if (updErr2) {
                      await supabase
                        .from('contratos_clientes')
                        .update({ omie_codigo_contrato: novoCod, omie_data_sincronizacao: agoraISO })
                        .eq('id', contratoAtivo.id);
                    }
                    contratoAtivo.omie_codigo_contrato = novoCod;
                  } else {
                    console.warn('Código de contrato retornado é igual ao código do cliente ou inválido. Ignorando atualização.');
                  }
                } else {
                  console.warn(`Sincronização de contrato Omie não retornou código para ${demo.cliente_nome}. Detalhes: ${JSON.stringify(sync.error || sync.data)}`);
                }
              }
            } catch (e) {
              console.warn('Falha ao consultar contrato diretamente no Omie:', e);
            }
          } else {
            console.warn('Não há número de contrato disponível para consulta.');
          }
        }
        // Revalidar após tentativa de sincronização
        codContratoDigits = String(contratoAtivo.omie_codigo_contrato || '').replace(/\D/g, '');

        // Validação estrita: exigir código de contrato OMIE válido
        if (!codContratoDigits || (codContratoDigits && codClienteDigits && codContratoDigits === codClienteDigits)) {
          throw new Error(`Contrato OMIE ausente ou inválido para ${demo.cliente_nome}. Sincronize o contrato no Omie (numero_contrato=${numeroContratoAlvo || contratoAtivo.numero_contrato}) e tente novamente.`);
        }

        const codigoContratoOmie = Number(codContratoDigits);
        console.log(`Cliente ${demo.cliente_nome} - Código OMIE Cliente: ${codigoClienteNumerico} | Código Contrato: ${codigoContratoOmie} | Valor: ${valorParaNF}`);

        // ETAPA 1: Verificação e Busca Mais Robusta do Código do Contrato
        // Para resolver o problema do COT (Contrato não encontrado)
        let codigoContratoValidado = codigoContratoOmie;
        const numeroConsultaCompleta = (numeroContratoAlvo || contratoAtivo.numero_contrato || '').toString().trim();
        
        try {
          console.log(`🔍 Verificando código do contrato para ${demo.cliente_nome} - Número: ${numeroConsultaCompleta}`);
          
          // Fazer uma busca mais ampla por contratos do cliente no OMIE
          const listarContratosReq = {
            call: 'ListarContratos',
            app_key: omieAppKey,
            app_secret: omieAppSecret,
            param: [{
              pagina: 1,
              registros_por_pagina: 50,
              filtrar_cliente: codigoClienteNumerico
            }]
          };
          
          const respListar = await fetch("https://app.omie.com.br/api/v1/servicos/contrato/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(listarContratosReq)
          });
          
          const resultListar = await respListar.json();
          console.log(`📋 Contratos encontrados para ${demo.cliente_nome}:`, JSON.stringify(resultListar));
          
          if (resultListar?.contratos_cadastro && Array.isArray(resultListar.contratos_cadastro)) {
            // Procurar contrato por número exato primeiro
            let contratoEncontrado = resultListar.contratos_cadastro.find((c: any) => 
              c.cabecalho?.cNumCtr === numeroConsultaCompleta
            );
            
            // Se não encontrar por número exato, pegar o primeiro ativo
            if (!contratoEncontrado) {
              contratoEncontrado = resultListar.contratos_cadastro.find((c: any) => 
                c.cabecalho?.cSituacao === 'ATIVO' || c.cabecalho?.cSituacao === 'A'
              );
            }
            
            // Se ainda não encontrar, pegar o primeiro da lista
            if (!contratoEncontrado && resultListar.contratos_cadastro.length > 0) {
              contratoEncontrado = resultListar.contratos_cadastro[0];
            }
            
            if (contratoEncontrado?.cabecalho?.nCodCtr) {
              codigoContratoValidado = Number(contratoEncontrado.cabecalho.nCodCtr);
              console.log(`✅ Código do contrato validado para ${demo.cliente_nome}: ${codigoContratoValidado} (Número: ${contratoEncontrado.cabecalho.cNumCtr})`);
              
              // Salvar o código correto no banco
              await supabase
                .from('contratos_clientes')
                .update({ 
                  omie_codigo_contrato: String(codigoContratoValidado),
                  omie_data_sincronizacao: new Date().toISOString()
                })
                .eq('id', contratoAtivo.id);
            }
          }
        } catch (listarError) {
          console.warn(`⚠️ Erro ao listar contratos para ${demo.cliente_nome}:`, listarError);
        }

        // ETAPA 2: Atualizar valor do contrato no OMIE com valor apurado do demonstrativo
        // OBRIGATÓRIO: O valor da NF deve ser o valor apurado no demonstrativo
        console.log(`💰 Atualizando contrato ${codigoContratoValidado} com valor do demonstrativo: R$ ${valorParaNF} (${demo.cliente_nome})`);
        
        try {
          const atualizarContratoReq = {
            call: 'AlterarContrato',
            app_key: omieAppKey,
            app_secret: omieAppSecret,
            param: [{
              contratoCadastro: {
                cabecalho: {
                  cNumCtr: numeroConsultaCompleta,
                  nCodCli: codigoClienteNumerico,
                  nValTotMes: Math.round(Number(valorParaNF || 0) * 100) / 100 // Valor OBRIGATÓRIO do demonstrativo
                }
              }
            }]
          };

          const respAtualizacao = await fetch("https://app.omie.com.br/api/v1/servicos/contrato/", {
            method: "POST", 
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(atualizarContratoReq)
          });
          
          const resultAtualizacao = await respAtualizacao.json();
          
          if (resultAtualizacao?.cCodStatus || resultAtualizacao?.cDescStatus || resultAtualizacao?.nCodCtr) {
            console.log(`✅ Contrato atualizado com valor do demonstrativo: R$ ${valorParaNF} | Status: ${resultAtualizacao?.cDescStatus || 'OK'}`);
          } else if (resultAtualizacao?.faultstring) {
            console.warn(`⚠️ Erro do Omie ao atualizar contrato: ${resultAtualizacao.faultstring} (${resultAtualizacao.faultcode})`);
            // Não interromper - tentar faturar mesmo assim
          } else {
            console.warn(`⚠️ Resultado inesperado na atualização do contrato: ${JSON.stringify(resultAtualizacao)}`);
          }
        } catch (atualizacaoError: any) {
          console.warn(`⚠️ Erro ao atualizar valor do contrato: ${atualizacaoError?.message}`);
          // Não interromper - tentar faturar mesmo assim
        }

        // ETAPA 3: Faturar Contrato (ÚNICO MÉTODO - obrigatoriamente com valor do demonstrativo)
        try {
          console.log(`📋 Faturando contrato ${codigoContratoValidado} para ${demo.cliente_nome} - Valor obrigatório: R$ ${valorParaNF}`);
          
          const reqBody = {
            call: 'FaturarContrato',
            app_key: omieAppKey,
            app_secret: omieAppSecret,
            param: [{ nCodCtr: Number(codigoContratoValidado) }]
          };
          
          console.log(
            `Executando FaturarContrato para ${demo.cliente_nome}:`,
            JSON.stringify({ call: reqBody.call, param: reqBody.param }, null, 2)
          );
          
          const resp = await fetch("https://app.omie.com.br/api/v1/servicos/contratofat/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(reqBody)
          });
          
          const nfResult = await resp.json();

          if (nfResult?.nCodOS) {
            console.log(`✅ NF gerada com sucesso via contrato: OS ${nfResult.nCodOS} | Status: ${nfResult.cDescStatus}`);
            console.log(`💰 IMPORTANTE: Valor da NF deve ser R$ ${valorParaNF} (valor do demonstrativo)`);
            
            // Salvar referência da NF no banco
            await supabase
              .from('relatorios_faturamento_status')
              .update({
                omie_nf_gerada: true,
                omie_codigo_pedido: nfResult.nCodOS,
                omie_numero_pedido: nfResult.nCodCtr || null,
                data_geracao_nf_omie: new Date().toISOString(),
                omie_detalhes: {
                  ...nfResult,
                  valor_demonstrativo: valorParaNF,
                  metodo_geracao: "FaturarContrato_com_valor_demonstrativo"
                }
              })
              .eq('cliente_id', demo.cliente_id)
              .eq('periodo', periodo);

            resultados.push({
              cliente: demo.cliente_nome,
              sucesso: true,
              codigo_ordem_servico: nfResult.nCodOS,
              codigo_contrato: nfResult.nCodCtr,
              status: nfResult.cDescStatus,
              valor_demonstrativo: valorParaNF,
              valor_total: valorTotal,
              metodo: "FaturarContrato"
            });
            sucessos++;
          } else {
            throw new Error(`FaturarContrato retornou erro: ${JSON.stringify(nfResult)}`);
          }
        } catch (contratoError) {
          throw new Error(`Erro no FaturarContrato para ${demo.cliente_nome}: ${contratoError.message}`);
        }

      } catch (error) {
        console.error(`Erro ao processar NF para ${demo.cliente_nome}:`, error);
        erros++;
        const erroMsg = (error as any)?.message || String(error);
        // Persistir erro no registro do relatório para facilitar diagnóstico
        await supabase
          .from('relatorios_faturamento_status')
          .update({ erro: erroMsg, omie_nf_gerada: false, updated_at: new Date().toISOString() })
          .eq('cliente_id', demo.cliente_id)
          .eq('periodo', periodo);
        resultados.push({
          cliente: demo.cliente_nome,
          sucesso: false,
          erro: erroMsg,
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