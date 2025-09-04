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

// Mapeamento flexível de colunas
const COLUMN_MAPPING = {
  // Nomes possíveis para o nome da empresa
  nomeEmpresa: [
    'Nome Empresa', 'NOME EMPRESA', 'nome empresa', 'Nome_Empresa', 
    'NOME_EMPRESA', 'Cliente', 'CLIENTE', 'cliente', 'Empresa', 'EMPRESA', 'empresa',
    'NOME_MOBILEMED', 'Nome_Fantasia', 'Razão Social', 'RAZÃO SOCIAL',
    'Nome Fantasia', 'NOME FANTASIA', 'razao social', 'Nome_fantasia'
  ],
  // Campo de status/tipo cliente (não confundir com "Status" que não existe na planilha)
  tipoCliente: ['TIPO_CLIENTE ("CO" OU "NC"', 'TIPO_CLIENTE', 'STATUS (INATIVO OU ATIVO)'],
  // Campo Impostos abMin da planilha
  impostosAbMin: ['Impostos abMin', 'IMPOSTOS ABMIN', 'Impostos abMin'],
  tipoMetricaConvenio: ['Tipo métrica convênio', 'Tipo Métrica Convênio', 'TIPO MÉTRICA CONVÊNIO'],
  valorConvenio: ['Valor convênio', 'Valor Convênio', 'VALOR CONVÊNIO'],
  tipoMetricaUrgencia: ['Tipo métrica URGÊNCIA', 'Tipo Métrica URGÊNCIA', 'TIPO MÉTRICA URGÊNCIA', 'Tipo/Valor URGÊNCIA'],
  valorUrgencia: ['Valor URGÊNCIA', 'VALOR URGÊNCIA', 'Valor Urgência'],
  tipoDesconto: ['Tipo Desconto / Acréscimo', 'TIPO DESCONTO / ACRÉSCIMO', 'Desconto/Acréscimo'],
  descontoAcrescimo: ['Desconto / Acréscimo', 'DESCONTO / ACRÉSCIMO', 'Desconto/Acréscimo'],
  integracao: ['Integração', 'INTEGRAÇÃO', 'integracao'],
  dataInicioIntegracao: ['Data Início Integração', 'DATA INÍCIO INTEGRAÇÃO', 'DATA_INICIO', 'DATA INICIO'],
  portalLaudos: ['Portal de Laudos', 'PORTAL DE LAUDOS', 'Portal de Laudos'],
  percentualISS: ['% ISS', '%ISS', 'ISS'],
  possuiFranquia: ['Possui Franquia', 'POSSUI FRANQUIA', 'Franquia'],
  valorFranquia: ['Valor Franquia', 'VALOR FRANQUIA'],
  frequenciaContinua: ['Frequencia Contínua', 'FREQUENCIA CONTÍNUA', 'Frequência Contínua'],
  frequenciaPorVolume: ['Frequência por volume', 'FREQUÊNCIA POR VOLUME'],
  volume: ['Volume', 'VOLUME', 'Volume Franquia'],
  valorFranquiaAcimaVolume: ['R$ Valor Franquia Acima Volume', 'VALOR FRANQUIA ACIMA VOLUME'],
  dataInicioFranquia: ['Data Início Franquia', 'DATA INÍCIO FRANQUIA'],
  cobrarUrgenciaRotina: ['Cobrar URGÊNCIA como ROTINA', 'COBRAR URGÊNCIA COMO ROTINA'],
  incluirEmpresaOrigem: ['Incluir Empresa Origem', 'INCLUIR EMPRESA ORIGEM'],
  incluirAccessNumber: ['Incluir Acces Number', 'INCLUIR ACCES NUMBER', 'Incluir Access Number'],
  incluirMedicoSolicitante: ['Incluir Médico Solicitante', 'INCLUIR MÉDICO SOLICITANTE']
};

function findColumnValue(row: ParametroRow, possibleNames: string[]): any {
  for (const name of possibleNames) {
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

    // Buscar clientes
    const { data: clientes } = await supabase.from('clientes').select('id, nome');
    const clienteMap = new Map(clientes?.map(c => [c.nome.toLowerCase(), c.id]) || []);

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

        // Preparar dados do parâmetro usando mapeamento flexível - TODOS os campos do Excel
        const parametroData = {
          cliente_id: clienteMap.get(nomeEmpresa.toString().toLowerCase().trim()),
          
          // Campos diretamente do Excel
          nome_mobilemed: findColumnValue(row, COLUMN_MAPPING.nomeEmpresa),
          nome_fantasia: findColumnValue(row, ['Nome_Fantasia', 'NOME FANTASIA', 'Nome Fantasia']),
          numero_contrato: findColumnValue(row, ['Contrato', 'CONTRATO', 'Numero Contrato']),
          cnpj: findColumnValue(row, ['CNPJ', 'cnpj']),
          razao_social: findColumnValue(row, ['Razão Social', 'RAZÃO SOCIAL', 'razao social']),
          dia_faturamento: findColumnValue(row, ['DIA_FATURAMENTO', 'Dia Faturamento']) ? Number(findColumnValue(row, ['DIA_FATURAMENTO', 'Dia Faturamento'])) : null,
          data_inicio_contrato: (() => {
            const valor = findColumnValue(row, ['DATA_INICIO', 'Data Inicio', 'Data_Inicio']);
            if (!valor) return null;
            // Se for número (formato Excel), converter de número de série para data
            if (typeof valor === 'number') {
              const data = new Date((valor - 25569) * 86400 * 1000);
              return data.toISOString().split('T')[0];
            }
            // Se for string, tentar converter normalmente
            const data = new Date(valor);
            return isNaN(data.getTime()) ? null : data.toISOString().split('T')[0];
          })(),
          data_termino_contrato: (() => {
            const valor = findColumnValue(row, ['DATA_TERMINO', 'Data Termino', 'Data_Termino']);
            if (!valor) return null;
            // Se for número (formato Excel), converter de número de série para data
            if (typeof valor === 'number') {
              const data = new Date((valor - 25569) * 86400 * 1000);
              return data.toISOString().split('T')[0];
            }
            // Se for string, tentar converter normalmente
            const data = new Date(valor);
            return isNaN(data.getTime()) ? null : data.toISOString().split('T')[0];
          })(),
          criterio_emissao_nf: findColumnValue(row, ['Criterio de Emissao de NF', 'CRITERIO DE EMISSAO DE NF']),
          criterios_geracao_relatorio: findColumnValue(row, ['Criterios de geração do relatório', 'CRITERIOS DE GERACAO DO RELATORIO']),
          criterios_aplicacao_parametros: findColumnValue(row, ['Criterios de aplicação dos parâmetros', 'CRITERIOS DE APLICACAO DOS PARAMETROS']),
          criterios_aplicacao_franquias: findColumnValue(row, ['Criterios de aplicação das franquias', 'CRITERIOS DE APLICACAO DAS FRANQUIAS']),
          tipo_faturamento: findColumnValue(row, ['TIPO FATURAMENTO ("CO-FT", "NC-FT", "NC-NF")', 'TIPO FATURAMENTO', 'Tipo Faturamento']),
          
          // Campos básicos
          cliente_consolidado: findColumnValue(row, ['Cliente Consolidado', 'CLIENTE CONSOLIDADO']),
          tipo_cliente: findColumnValue(row, COLUMN_MAPPING.tipoCliente)?.toString().trim() || 'CO',
          
          // Impostos e Simples - usando o mapeamento correto do campo "Impostos abMin"
          impostos_ab_min: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.impostosAbMin);
            if (!valor) return null;
            // Se for 'S' ou 'N', converter para "Sim" e "Não"
            if (typeof valor === 'string') {
              if (valor.trim().toLowerCase() === 's') return 'Sim';
              if (valor.trim().toLowerCase() === 'n') return 'Não';
              if (valor.trim().toLowerCase() === 'sim') return 'Sim';
              if (valor.trim().toLowerCase() === 'não' || valor.trim().toLowerCase() === 'nao') return 'Não';
            }
            return valor?.toString() || null;
          })(),
          simples: (() => {
            const valor = findColumnValue(row, ['Simples', 'SIMPLES']);
            if (!valor) return false;
            const valorStr = valor.toString().trim().toLowerCase();
            return valorStr === 's' || valorStr === 'sim' || valorStr === 'y' || valorStr === 'yes';
          })(),
          percentual_iss: findColumnValue(row, COLUMN_MAPPING.percentualISS) ? Number(findColumnValue(row, COLUMN_MAPPING.percentualISS)) : null,
          
          // Métrica e Valor Convênio
          tipo_metrica_convenio: findColumnValue(row, COLUMN_MAPPING.tipoMetricaConvenio)?.toString().trim(),
          valor_integracao: findColumnValue(row, COLUMN_MAPPING.valorConvenio) ? Number(findColumnValue(row, COLUMN_MAPPING.valorConvenio)) : null,
          cobrar_integracao: findColumnValue(row, COLUMN_MAPPING.integracao)?.toString().trim()?.toLowerCase() === 'sim',
          data_inicio_integracao: findColumnValue(row, COLUMN_MAPPING.dataInicioIntegracao) ? new Date(findColumnValue(row, COLUMN_MAPPING.dataInicioIntegracao)).toISOString().split('T')[0] : null,
          
          // Métrica e Valor Urgência
          tipo_metrica_urgencia: findColumnValue(row, COLUMN_MAPPING.tipoMetricaUrgencia)?.toString().trim(),
          percentual_urgencia: findColumnValue(row, COLUMN_MAPPING.valorUrgencia) ? Number(findColumnValue(row, COLUMN_MAPPING.valorUrgencia)) : null,
          aplicar_adicional_urgencia: findColumnValue(row, COLUMN_MAPPING.tipoMetricaUrgencia)?.toString().trim()?.toLowerCase() === 'percentual',
          cobrar_urgencia_como_rotina: findColumnValue(row, COLUMN_MAPPING.cobrarUrgenciaRotina)?.toString().trim()?.toLowerCase() === 'sim',
          
          // Desconto/Acréscimo
          tipo_desconto_acrescimo: findColumnValue(row, COLUMN_MAPPING.tipoDesconto)?.toString().trim(),
          desconto_acrescimo: findColumnValue(row, COLUMN_MAPPING.descontoAcrescimo) ? Number(findColumnValue(row, COLUMN_MAPPING.descontoAcrescimo)) : null,
          
          // Portal de Laudos
          portal_laudos: findColumnValue(row, COLUMN_MAPPING.portalLaudos)?.toString().trim()?.toLowerCase() === 'sim',
          
          // Franquia
          aplicar_franquia: findColumnValue(row, COLUMN_MAPPING.possuiFranquia)?.toString().trim()?.toLowerCase() === 'sim',
          valor_franquia: findColumnValue(row, COLUMN_MAPPING.valorFranquia) ? Number(findColumnValue(row, COLUMN_MAPPING.valorFranquia)) : null,
          volume_franquia: findColumnValue(row, COLUMN_MAPPING.volume) ? Number(findColumnValue(row, COLUMN_MAPPING.volume)) : null,
          frequencia_continua: findColumnValue(row, COLUMN_MAPPING.frequenciaContinua)?.toString().trim()?.toLowerCase() === 'sim',
          frequencia_por_volume: findColumnValue(row, COLUMN_MAPPING.frequenciaPorVolume)?.toString().trim()?.toLowerCase() === 'sim',
          valor_acima_franquia: findColumnValue(row, COLUMN_MAPPING.valorFranquiaAcimaVolume) ? Number(findColumnValue(row, COLUMN_MAPPING.valorFranquiaAcimaVolume)) : null,
          data_aniversario_contrato: findColumnValue(row, COLUMN_MAPPING.dataInicioFranquia) ? new Date(findColumnValue(row, COLUMN_MAPPING.dataInicioFranquia)).toISOString().split('T')[0] : null,
          
          // Configurações de Faturamento
          incluir_empresa_origem: findColumnValue(row, COLUMN_MAPPING.incluirEmpresaOrigem)?.toString().trim()?.toLowerCase() === 'sim',
          incluir_access_number: findColumnValue(row, COLUMN_MAPPING.incluirAccessNumber)?.toString().trim()?.toLowerCase() === 'sim',
          incluir_medico_solicitante: findColumnValue(row, COLUMN_MAPPING.incluirMedicoSolicitante)?.toString().trim()?.toLowerCase() === 'sim',
          
  // Campos de controle (mantidos dos originais)
          periodicidade_reajuste: 'anual',
          indice_reajuste: 'IGP-M',
          percentual_reajuste_fixo: findColumnValue(row, COLUMN_MAPPING.descontoAcrescimo) ? Number(findColumnValue(row, COLUMN_MAPPING.descontoAcrescimo)) : null,
          dia_fechamento: findColumnValue(row, ['dia_fechamento', 'Dia Fechamento', 'DIA FECHAMENTO']) ? Number(findColumnValue(row, ['dia_fechamento', 'Dia Fechamento', 'DIA FECHAMENTO'])) : 7,
          forma_cobranca: findColumnValue(row, ['forma_cobranca', 'Forma Cobrança', 'FORMA COBRANÇA', 'forma_pagamento', 'Forma Pagamento'])?.toString().trim() || 'mensal',
          ativo: true
        };

        if (!parametroData.cliente_id) {
          throw new Error(`Cliente não encontrado: ${nomeEmpresa}`);
        }

        // Verificar se já existe
        const { data: existente } = await supabase
          .from('parametros_faturamento')
          .select('id')
          .eq('cliente_id', parametroData.cliente_id)
          .maybeSingle();

        if (existente) {
          // Atualizar existente
          const { error: updateError } = await supabase
            .from('parametros_faturamento')
            .update(parametroData)
            .eq('id', existente.id);

          if (updateError) throw updateError;
          atualizados++;
        } else {
          // Inserir novo
          const { error: insertError } = await supabase
            .from('parametros_faturamento')
            .insert(parametroData);

          if (insertError) throw insertError;
          inseridos++;
        }

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
    console.error('Erro geral:', error);
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        erro: error.message,
        detalhes: error.stack 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});