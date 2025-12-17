import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import * as XLSX from "https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParametroRow {
  [key: string]: any; // Permite qualquer nome de coluna
}

// Mapeamento flexível de colunas baseado no template atual
const COLUMN_MAPPING = {
  // Nomes da empresa (separados corretamente)
  nomeEmpresa: [
    'NOME_MOBILEMED', 'Nome Empresa', 'NOME EMPRESA', 'nome empresa', 'Nome_Empresa', 'NOME_EMPRESA', 
    'Cliente', 'CLIENTE', 'cliente', 'Empresa', 'EMPRESA'
  ],
  nomeFantasia: [
    'Nome_Fantasia', 'Nome Fantasia', 'NOME_FANTASIA', 'nome_fantasia', 'nome fantasia'
  ],
  // Identificação
  cnpj: ['CNPJ', 'cnpj'],
  razaoSocial: ['Razão Social', 'RAZÃO SOCIAL', 'razao social'],
  numeroContrato: ['Numero Contrato', 'Contrato', 'CONTRATO'],
  
  // Classificação
  tipoCliente: ['TIPO_CLIENTE ("CO" OU "NC"', 'TIPO_CLIENTE'],
  tipoFaturamento: ['TIPO FATURAMENTO', 'TIPO FATURAMENTO ("CO-FT", "NC-FT", "NC-NF")'],
  status: ['Status', 'STATUS', 'STATUS (INATIVO OU ATIVO)'],
  
  // Impostos e tributação
  impostosAbMin: ['Impostos abMin', 'IMPOSTOS ABMIN'],
  simples: ['Simples', 'SIMPLES'],
  percentualISS: ['% ISS', '%ISS', 'ISS'],
  
  // Métricas de convênio/urgência
  tipoMetricaConvenio: ['Tipo métrica convênio', 'Tipo Métrica Convênio'],
  valorConvenio: ['Valor convênio', 'Valor Convênio'],
  tipoMetricaUrgencia: ['Tipo métrica URGÊNCIA', 'Tipo Métrica URGÊNCIA'],
  valorUrgencia: ['Valor URGÊNCIA', 'VALOR URGÊNCIA', 'Valor Urgência'],
  
  // Desconto/Acréscimo
  tipoDesconto: ['Tipo Desconto / Acréscimo', 'TIPO DESCONTO / ACRÉSCIMO'],
  descontoAcrescimo: ['Desconto / Acréscimo', 'DESCONTO / ACRÉSCIMO'],
  
  // Integração - apenas valor
  valorIntegracao: ['Integração', 'INTEGRAÇÃO', 'Valor Integração', 'VALOR INTEGRAÇÃO', 'valor_integracao'],
  dataInicioIntegracao: ['Data Início Integração', 'DATA INÍCIO INTEGRAÇÃO'],
  
  // Portal - apenas valor
  valorPortalLaudos: ['Portal de Laudos', 'PORTAL DE LAUDOS', 'Valor Portal Laudos', 'VALOR PORTAL LAUDOS', 'valor_portal_laudos'],
  
  // Franquia
  possuiFranquia: ['Possui Franquia', 'POSSUI FRANQUIA'],
  valorFranquia: ['Valor Franquia', 'VALOR FRANQUIA'],
  volumeFranquia: ['Volume Franquia', 'VOLUME FRANQUIA', 'Volume'],
  frequenciaContinua: ['Frequencia Contínua', 'Frequência Contínua'],
  frequenciaPorVolume: ['Frequência por volume', 'FREQUÊNCIA POR VOLUME'],
  valorFranquiaAcimaVolume: ['R$ Valor Franquia Acima Volume', 'VALOR FRANQUIA ACIMA VOLUME'],
  dataInicioFranquia: ['Data Início Franquia', 'DATA INÍCIO FRANQUIA'],
  
  // Configurações de cobrança
  cobrarUrgenciaRotina: ['Cobrar URGÊNCIA como ROTINA', 'COBRAR URGÊNCIA COMO ROTINA'],
  incluirEmpresaOrigem: ['Incluir Empresa Origem', 'INCLUIR EMPRESA ORIGEM'],
  incluirAccessNumber: ['Incluir Acces Number', 'INCLUIR ACCES NUMBER'],
  incluirMedicoSolicitante: ['INCLUIR MÉDICO SOLICITANTE', 'Incluir Médico Solicitante'],
  
  // Fechamento
  diaFechamento: ['Dia Fechamento', 'DIA FECHAMENTO'],
  formaCobranca: ['Forma Cobrança', 'FORMA COBRANÇA']
};

// Função para formatar CNPJ
function formatarCNPJ(cnpj: string | number): string | null {
  if (!cnpj && cnpj !== 0) return null;
  
  // Converte para string e remove todos os caracteres não numéricos
  let cnpjStr = cnpj.toString().replace(/\D/g, '');
  
  // Se está vazio após limpeza, retorna null
  if (!cnpjStr) return null;
  
  // Preenche com zeros à esquerda para garantir 14 dígitos
  cnpjStr = cnpjStr.padStart(14, '0');
  
  // Se tem mais de 14 dígitos, algo está errado, retorna como veio
  if (cnpjStr.length > 14) {
    console.log(`CNPJ com mais de 14 dígitos: ${cnpj} -> ${cnpjStr}`);
    return cnpj.toString();
  }
  
  // Se tem menos de 11 dígitos mesmo após padding, provavelmente é inválido
  if (cnpjStr.length < 11) {
    console.log(`CNPJ muito curto: ${cnpj} -> ${cnpjStr}`);
    return cnpj.toString();
  }
  
  // Aplica formatação padrão do CNPJ
  const formatted = cnpjStr.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  console.log(`CNPJ formatado: ${cnpj} -> ${formatted}`);
  return formatted;
}

// Função para formatar CPF
function formatarCPF(cpf: string | number): string | null {
  if (!cpf && cpf !== 0) return null;
  
  // Converte para string e remove todos os caracteres não numéricos
  let cpfStr = cpf.toString().replace(/\D/g, '');
  
  // Se está vazio após limpeza, retorna null
  if (!cpfStr) return null;
  
  // Preenche com zeros à esquerda para garantir 11 dígitos
  cpfStr = cpfStr.padStart(11, '0');
  
  // Se tem mais de 11 dígitos, algo está errado, retorna como veio
  if (cpfStr.length > 11) {
    console.log(`CPF com mais de 11 dígitos: ${cpf} -> ${cpfStr}`);
    return cpf.toString();
  }
  
  // Se tem menos de 10 dígitos mesmo após padding, provavelmente é inválido
  if (cpfStr.length < 10) {
    console.log(`CPF muito curto: ${cpf} -> ${cpfStr}`);
    return cpf.toString();
  }
  
  // Aplica formatação padrão do CPF
  const formatted = cpfStr.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  console.log(`CPF formatado: ${cpf} -> ${formatted}`);
  return formatted;
}

// Função para normalizar nome para busca (remove acentos, espaços extras, etc)
function normalizarNome(nome: string): string {
  if (!nome) return '';
  return nome
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/\s+/g, ' '); // Remove espaços extras
}

function findColumnValue(row: ParametroRow, possibleNames: string[] | string): any {
  // Se for string única, converte para array
  const nameArray = Array.isArray(possibleNames) ? possibleNames : [possibleNames];
  
  for (const name of nameArray) {
    if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
      return row[name];
    }
  }
  return null;
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

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      throw new Error('Nenhum arquivo foi enviado');
    }

    console.log(`Processando arquivo: ${file.name}, tamanho: ${file.size} bytes`);

    // Ler arquivo Excel
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet) as ParametroRow[];

    console.log(`Total de linhas encontradas: ${jsonData.length}`);

    let processados = 0;
    let inseridos = 0;
    let atualizados = 0;
    let erros = 0;
    const detalhesErros: any[] = [];

    // Buscar clientes e criar mapa normalizado
    const { data: clientes } = await supabase.from('clientes').select('id, nome, nome_mobilemed, nome_fantasia');
    const clienteMap = new Map();
    
    // Criar múltiplos mapeamentos para aumentar as chances de match
    if (clientes) {
      clientes.forEach(cliente => {
        const nomes = [
          cliente.nome,
          cliente.nome_mobilemed,
          cliente.nome_fantasia
        ].filter(Boolean);
        
        nomes.forEach(nome => {
          if (nome) {
            // Mapeamento exato
            clienteMap.set(nome.toLowerCase().trim(), cliente.id);
            // Mapeamento normalizado
            clienteMap.set(normalizarNome(nome), cliente.id);
          }
        });
      });
    }

    // Imprimir colunas disponíveis para debug
    if (jsonData.length > 0) {
      console.log('Colunas disponíveis no arquivo:', Object.keys(jsonData[0]));
    }

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      processados++;

      try {
        // Usar mapeamento flexível para encontrar o nome da empresa
        const nomeEmpresa = findColumnValue(row, COLUMN_MAPPING.nomeEmpresa);
        
        if (!nomeEmpresa) {
          console.log(`Linha ${i + 1} - Colunas disponíveis:`, Object.keys(row));
          throw new Error('Campo "Nome Empresa" não encontrado. Verifique se a coluna existe no arquivo.');
        }

        // Debug: mostrar dados do cliente sendo processado
        console.log(`Processando linha ${i + 1}: Cliente "${nomeEmpresa}"`);

        // Buscar cliente_id com múltiplas tentativas
        let cliente_id = null;
        const nomeEmpresaNormalizado = normalizarNome(nomeEmpresa.toString());
        
        // Tentar várias formas de buscar o cliente pelo NOME_MOBILEMED
        cliente_id = clienteMap.get(nomeEmpresa.toString().toLowerCase().trim()) ||
                     clienteMap.get(nomeEmpresaNormalizado) ||
                     clienteMap.get(nomeEmpresa.toString()) ||
                     null;

        // Se não encontrou pelo nome mobilemed, tentar pelo nome fantasia
        if (!cliente_id) {
          const nomeFantasiaArquivo = findColumnValue(row, COLUMN_MAPPING.nomeFantasia);
          if (nomeFantasiaArquivo) {
            const nomeFantasiaNormalizado = normalizarNome(nomeFantasiaArquivo.toString());
            cliente_id = clienteMap.get(nomeFantasiaArquivo.toString().toLowerCase().trim()) ||
                        clienteMap.get(nomeFantasiaNormalizado) ||
                        clienteMap.get(nomeFantasiaArquivo.toString()) ||
                        null;
            if (cliente_id) {
              console.log(`Cliente encontrado pelo Nome Fantasia: ${nomeFantasiaArquivo} -> ID: ${cliente_id}`);
            }
          }
        }

        if (cliente_id) {
          console.log(`Cliente encontrado: ${nomeEmpresa} -> ID: ${cliente_id}`);
        } else {
          // CRIAR CLIENTE AUTOMATICAMENTE quando não existe
          console.log(`🆕 Cliente NÃO encontrado: ${nomeEmpresa} - Criando automaticamente...`);
          
          const nomeFantasiaArquivo = findColumnValue(row, COLUMN_MAPPING.nomeFantasia);
          const cnpjArquivo = findColumnValue(row, COLUMN_MAPPING.cnpj);
          const razaoSocialArquivo = findColumnValue(row, COLUMN_MAPPING.razaoSocial);
          
          // Criar novo cliente na tabela clientes
          const novoClienteData = {
            nome: nomeEmpresa.toString().trim(),
            nome_mobilemed: nomeEmpresa.toString().trim(),
            nome_fantasia: nomeFantasiaArquivo?.toString().trim() || nomeEmpresa.toString().trim(),
            cnpj: formatarCNPJ(cnpjArquivo),
            razao_social: razaoSocialArquivo?.toString().trim() || null,
            ativo: true,
            status: 'Ativo'
          };
          
          const { data: novoCliente, error: erroCliente } = await supabase
            .from('clientes')
            .insert(novoClienteData)
            .select('id')
            .single();
          
          if (erroCliente) {
            console.error(`❌ Erro ao criar cliente ${nomeEmpresa}:`, erroCliente);
            throw new Error(`Erro ao criar cliente ${nomeEmpresa}: ${erroCliente.message}`);
          }
          
          cliente_id = novoCliente.id;
          console.log(`✅ Cliente criado com sucesso: ${nomeEmpresa} -> ID: ${cliente_id}`);
          
          // Adicionar ao mapa para futuras referências no mesmo arquivo
          clienteMap.set(nomeEmpresa.toString().toLowerCase().trim(), cliente_id);
          clienteMap.set(nomeEmpresaNormalizado, cliente_id);
          if (nomeFantasiaArquivo) {
            clienteMap.set(nomeFantasiaArquivo.toString().toLowerCase().trim(), cliente_id);
            clienteMap.set(normalizarNome(nomeFantasiaArquivo.toString()), cliente_id);
          }
        }

        // Debug: mostrar dados sendo extraídos do arquivo
        const nomeFantasiaArquivo = findColumnValue(row, COLUMN_MAPPING.nomeFantasia);
        const cnpjArquivo = findColumnValue(row, COLUMN_MAPPING.cnpj);
        const razaoSocialArquivo = findColumnValue(row, COLUMN_MAPPING.razaoSocial);
        
        console.log(`Dados extraídos do arquivo:`, {
          nome_mobilemed: nomeEmpresa,
          nome_fantasia: nomeFantasiaArquivo,
          cnpj: cnpjArquivo,
          razao_social: razaoSocialArquivo
        });

        // Preparar dados do parâmetro com tipos corretos
        const parametroData = {
          cliente_id: cliente_id,
          
          // Campos identificação - TODOS do arquivo de upload
          nome_mobilemed: nomeEmpresa,
          nome_fantasia: nomeFantasiaArquivo,
          numero_contrato: findColumnValue(row, COLUMN_MAPPING.numeroContrato),
          cnpj: formatarCNPJ(cnpjArquivo),
          razao_social: razaoSocialArquivo,
          
          // Datas de contrato
          data_inicio_contrato: (() => {
            const valor = findColumnValue(row, ['DATA_INICIO', 'Data Início']);
            if (!valor) return null;
            if (typeof valor === 'number') {
              const data = new Date((valor - 25569) * 86400 * 1000);
              return data.toISOString().split('T')[0];
            }
            const data = new Date(valor);
            return isNaN(data.getTime()) ? null : data.toISOString().split('T')[0];
          })(),
          data_termino_contrato: (() => {
            const valor = findColumnValue(row, ['DATA_TERMINO', 'Data Término']);
            if (!valor) return null;
            if (typeof valor === 'number') {
              const data = new Date((valor - 25569) * 86400 * 1000);
              return data.toISOString().split('T')[0];
            }
            const data = new Date(valor);
            return isNaN(data.getTime()) ? null : data.toISOString().split('T')[0];
          })(),
          
          // Classificação básica
          tipo_cliente: findColumnValue(row, COLUMN_MAPPING.tipoCliente)?.toString().trim() || 'CO',
          tipo_faturamento: findColumnValue(row, COLUMN_MAPPING.tipoFaturamento)?.toString().trim(),
          cliente_consolidado: findColumnValue(row, ['Cliente Consolidado']),
          
          // Status conforme arquivo - "I", "A" ou "C"
          status: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.status);
            if (!valor) return 'A'; // Padrão ativo se não informado
            const valorStr = valor.toString().trim().toUpperCase();
            // Aceita os valores do arquivo: I (Inativo), A (Ativo), C (Cancelado)
            if (['I', 'A', 'C'].includes(valorStr)) {
              console.log(`Status encontrado: ${valorStr}`);
              return valorStr;
            }
            // Se vier como texto, converte para código
            if (valorStr === 'ATIVO') return 'A';
            if (valorStr === 'INATIVO') return 'I';
            if (valorStr === 'CANCELADO') return 'C';
            console.log(`Status não reconhecido: ${valorStr}, assumindo Ativo`);
            return 'A';
          })(),
          
          // Critérios de processamento
          criterio_emissao_nf: findColumnValue(row, ['Criterio de Emissao de NF']),
          criterios_geracao_relatorio: findColumnValue(row, ['Criterios de geração do relatório']),
          criterios_aplicacao_parametros: findColumnValue(row, ['Criterios de aplicação dos parâmetros']),
          criterios_aplicacao_franquias: findColumnValue(row, ['Criterios de aplicação das franquias']),
          
          // Faturamento e fechamento
          dia_faturamento: (() => {
            const valor = findColumnValue(row, ['DIA_FATURAMENTO', 'Dia Faturamento']);
            return valor ? Number(valor) : null;
          })(),
          dia_fechamento: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.diaFechamento);
            return valor ? Number(valor) : 7;
          })(),
          forma_cobranca: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.formaCobranca);
            return valor ? valor.toString().trim().toLowerCase() : 'mensal';
          })(),
          
          // Impostos - NUMERIC, não boolean
          impostos_ab_min: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.impostosAbMin);
            if (!valor) return 0;
            const valorStr = valor.toString().trim().toLowerCase();
            return (valorStr === 's' || valorStr === 'sim') ? 1 : 0;
          })(),
          simples: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.simples);
            if (!valor) return false;
            const valorStr = valor.toString().trim().toLowerCase();
            return valorStr === 's' || valorStr === 'sim';
          })(),
          percentual_iss: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.percentualISS);
            return valor ? Number(valor) : 0;
          })(),
          
          // Métricas de urgência - campos que faltavam
          tipo_metrica_urgencia: findColumnValue(row, COLUMN_MAPPING.tipoMetricaUrgencia)?.toString().trim(),
          percentual_urgencia: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.valorUrgencia);
            return valor ? Number(valor) : 0;
          })(),
          aplicar_adicional_urgencia: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.tipoMetricaUrgencia);
            if (!valor) return false;
            const valorStr = valor.toString().trim().toLowerCase();
            return valorStr === 'percentual' || valorStr === 'sim' || valorStr === 's';
          })(),
          cobrar_urgencia_como_rotina: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.cobrarUrgenciaRotina);
            if (!valor) return false;
            const valorStr = valor.toString().trim().toLowerCase();
            return valorStr === 'sim' || valorStr === 's';
          })(),
          
          // Desconto/Acréscimo
          tipo_desconto_acrescimo: findColumnValue(row, COLUMN_MAPPING.tipoDesconto)?.toString().trim(),
          desconto_acrescimo: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.descontoAcrescimo);
            return valor ? Number(valor) : 0;
          })(),
          
          // Integração - apenas valor monetário (se vazio = 0)
          valor_integracao: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.valorIntegracao);
            if (!valor) return 0;
            const valorNum = Number(valor);
            return isNaN(valorNum) ? 0 : valorNum;
          })(),
          
          // Portal de Laudos - apenas valor monetário (se vazio = 0)
          valor_portal_laudos: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.valorPortalLaudos);
            if (!valor) return 0;
            const valorNum = Number(valor);
            return isNaN(valorNum) ? 0 : valorNum;
          })(),
          
          // Franquia - todos os campos necessários
          aplicar_franquia: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.possuiFranquia);
            if (!valor) return false;
            const valorStr = valor.toString().trim().toLowerCase();
            return valorStr === 'sim' || valorStr === 's';
          })(),
          valor_franquia: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.valorFranquia);
            return valor ? Number(valor) : 0;
          })(),
          volume_franquia: (() => {
            const valor = findColumnValue(row, ['Volume Franquia', 'Volume']);
            return valor ? Number(valor) : 0;
          })(),
          frequencia_continua: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.frequenciaContinua);
            if (!valor) return false;
            const valorStr = valor.toString().trim().toLowerCase();
            return valorStr === 'sim' || valorStr === 's';
          })(),
          frequencia_por_volume: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.frequenciaPorVolume);
            if (!valor) return false;
            const valorStr = valor.toString().trim().toLowerCase();
            return valorStr === 'sim' || valorStr === 's';
          })(),
          valor_acima_franquia: (() => {
            const valor = findColumnValue(row, ['R$ Valor Franquia Acima Volume']);
            return valor ? Number(valor) : 0;
          })(),
          data_aniversario_contrato: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.dataInicioFranquia);
            if (!valor) return null;
            if (typeof valor === 'number') {
              const data = new Date((valor - 25569) * 86400 * 1000);
              return data.toISOString().split('T')[0];
            }
            const data = new Date(valor);
            return isNaN(data.getTime()) ? null : data.toISOString().split('T')[0];
          })(),
          
          // Configurações de inclusão no relatório
          incluir_empresa_origem: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.incluirEmpresaOrigem);
            if (!valor) return false;
            const valorStr = valor.toString().trim().toLowerCase();
            return valorStr === 'sim' || valorStr === 's';
          })(),
          incluir_access_number: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.incluirAccessNumber);
            if (!valor) return false;
            const valorStr = valor.toString().trim().toLowerCase();
            return valorStr === 'sim' || valorStr === 's';
          })(),
          incluir_medico_solicitante: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.incluirMedicoSolicitante);
            if (!valor) return false;
            const valorStr = valor.toString().trim().toLowerCase();
            return valorStr === 'sim' || valorStr === 's';
          })(),
          
          // Campos de controle com valores padrão corretos
          periodicidade_reajuste: 'anual',
          indice_reajuste: 'IPCA',
          percentual_reajuste_fixo: 0
        };

        // Cada linha do Excel é um parâmetro único - inserir direto sem verificação de duplicação
        // Múltiplos parâmetros podem ter o mesmo nome_fantasia (ex: RMPADUA com 3 parâmetros)
        const { error: insertError } = await supabase
          .from('parametros_faturamento')
          .insert(parametroData);

        if (insertError) {
          console.error('Erro ao inserir parâmetro:', insertError);
          throw insertError;
        }
        inseridos++;

        console.log(`Linha ${i + 1}: Processada com sucesso - ${nomeEmpresa}`);

      } catch (error: any) {
        erros++;
        const detalheErro = {
          linha: i + 1,
          dados: row,
          erro: error.message
        };
        detalhesErros.push(detalheErro);
        console.error(`Erro na linha ${i + 1}:`, error.message);
      }
    }

    // Registrar processamento
    const { error: logError } = await supabase
      .from('processamento_uploads')
      .insert({
        arquivo_nome: file.name,
        tipo_arquivo: 'parametros_faturamento',
        tipo_dados: 'incremental',
        status: erros === processados ? 'erro' : 'concluido',
        registros_processados: processados,
        registros_inseridos: inseridos,
        registros_atualizados: atualizados,
        registros_erro: erros,
        detalhes_erro: detalhesErros.length > 0 ? detalhesErros : null,
        tamanho_arquivo: file.size
      });

    if (logError) {
      console.error('Erro ao registrar log:', logError);
    }

    const resultado = {
      sucesso: true,
      arquivo: file.name,
      processados,
      inseridos,
      atualizados,
      erros,
      detalhes_erros: detalhesErros
    };

    console.log('Processamento concluído:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Erro no processamento:', error);
    return new Response(JSON.stringify({
      sucesso: false,
      erro: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});