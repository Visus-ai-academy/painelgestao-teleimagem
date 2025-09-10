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

// Mapeamento flexível de colunas baseado no arquivo real
const COLUMN_MAPPING = {
  // Nomes da empresa
  nomeEmpresa: [
    'NOME_MOBILEMED', 'Nome Empresa', 'Nome_Fantasia', 'NOME EMPRESA', 'nome empresa',
    'Nome_Empresa', 'NOME_EMPRESA', 'Cliente', 'CLIENTE', 'cliente', 'Empresa', 'EMPRESA'
  ],
  // Tipo de cliente
  tipoCliente: ['TIPO_CLIENTE ("CO" OU "NC"', 'TIPO_CLIENTE'],
  // Status
  status: ['STATUS (INATIVO OU ATIVO)', 'Status'],
  // CNPJ
  cnpj: ['CNPJ'],
  // Razão Social
  razaoSocial: ['Razão Social'],
  // Contrato
  numeroContrato: ['Contrato'],
  // Tipo Faturamento
  tipoFaturamento: ['TIPO FATURAMENTO ("CO-FT", "NC-FT", "NC-NF")', 'TIPO FATURAMENTO'],
  // Datas
  dataInicio: ['DATA_INICIO'],
  dataTermino: ['DATA_TERMINO'],
  // Dia faturamento
  diaFaturamento: ['DIA_FATURAMENTO'],
  // Impostos
  impostosAbMin: ['Impostos abMin'],
  simples: ['Simples'],
  // Critérios
  criterioEmissaoNF: ['Criterio de Emissao de NF'],
  criteriosRelatorio: ['Criterios de geração do relatório'],
  criteriosParametros: ['Criterios de aplicação dos parâmetros'],
  criteriosFranquias: ['Criterios de aplicação das franquias'],
  // Integração
  integracao: ['Integração'],
  // Portal
  portalLaudos: ['Portal de Laudos'],
  // ISS
  percentualISS: ['% ISS'],
  // Franquia
  possuiFranquia: ['Possui Franquia'],
  valorFranquia: ['Valor Franquia'],
  volumeFranquia: ['Volume Franquia'],
  frequenciaContinua: ['Frequencia Contínua'],
  frequenciaPorVolume: ['Frequência por volume'],
  valorFranquiaAcimaVolume: ['R$ Valor Franquia Acima Volume'],
  dataInicioFranquia: ['Data Início Franquia'],
  // Urgência
  cobrarUrgenciaRotina: ['Cobrar URGÊNCIA como ROTINA'],
  // Includes
  incluirEmpresaOrigem: ['Incluir Empresa Origem'],
  incluirAccessNumber: ['Incluir Acces Number'],
  incluirMedicoSolicitante: ['INCLUIR MÉDICO SOLICITANTE'],
  // Novos campos do template
  diaFechamento: ['Dia Fechamento'],
  formaCobranca: ['Forma Cobrança']
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
          nome_fantasia: findColumnValue(row, COLUMN_MAPPING.nomeEmpresa), // Usar o mesmo campo
          numero_contrato: findColumnValue(row, COLUMN_MAPPING.numeroContrato),
          cnpj: findColumnValue(row, COLUMN_MAPPING.cnpj),
          razao_social: findColumnValue(row, COLUMN_MAPPING.razaoSocial),
          dia_faturamento: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.diaFaturamento);
            return valor ? Number(valor) : null;
          })(),
          data_inicio_contrato: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.dataInicio);
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
            const valor = findColumnValue(row, COLUMN_MAPPING.dataTermino);
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
          criterio_emissao_nf: findColumnValue(row, COLUMN_MAPPING.criterioEmissaoNF),
          criterios_geracao_relatorio: findColumnValue(row, COLUMN_MAPPING.criteriosRelatorio),
          criterios_aplicacao_parametros: findColumnValue(row, COLUMN_MAPPING.criteriosParametros),
          criterios_aplicacao_franquias: findColumnValue(row, COLUMN_MAPPING.criteriosFranquias),
          tipo_faturamento: findColumnValue(row, COLUMN_MAPPING.tipoFaturamento),
          
          // Campos básicos
          cliente_consolidado: findColumnValue(row, ['Cliente Consolidado']),
          tipo_cliente: findColumnValue(row, COLUMN_MAPPING.tipoCliente)?.toString().trim() || 'CO',
          
          // Status
          ativo: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.status);
            if (!valor) return true;
            return valor.toString().trim().toUpperCase() === 'A' || valor.toString().trim().toLowerCase() === 'ativo';
          })(),
          
          // Impostos e Simples - usando conversão correta para booleano
          impostos_ab_min: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.impostosAbMin);
            if (!valor) return false;
            const valorStr = valor.toString().trim().toLowerCase();
            return valorStr === 's' || valorStr === 'sim';
          })(),
          simples: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.simples);
            if (!valor) return false;
            const valorStr = valor.toString().trim().toLowerCase();
            return valorStr === 's' || valorStr === 'sim';
          })(),
          percentual_iss: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.percentualISS);
            return valor ? Number(valor) : null;
          })(),
          
          // Métrica e Valor Convênio/Integração
          tipo_metrica_convenio: findColumnValue(row, COLUMN_MAPPING.tipoMetricaConvenio)?.toString().trim(),
          valor_integracao: findColumnValue(row, COLUMN_MAPPING.valorIntegracao) ? Number(findColumnValue(row, COLUMN_MAPPING.valorIntegracao)) : null,
          cobrar_integracao: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.cobrarIntegracao);
            if (!valor) return false;
            const valorStr = valor.toString().trim().toLowerCase();
            return valorStr === 's' || valorStr === 'sim' || valorStr === 'y' || valorStr === 'yes';
          })(),
          data_inicio_integracao: findColumnValue(row, COLUMN_MAPPING.dataInicioIntegracao) ? new Date(findColumnValue(row, COLUMN_MAPPING.dataInicioIntegracao)).toISOString().split('T')[0] : null,
          
          // Métrica e Valor Urgência
          tipo_metrica_urgencia: findColumnValue(row, COLUMN_MAPPING.tipoMetricaUrgencia)?.toString().trim(),
          percentual_urgencia: findColumnValue(row, COLUMN_MAPPING.valorUrgencia) ? Number(findColumnValue(row, COLUMN_MAPPING.valorUrgencia)) : null,
          aplicar_adicional_urgencia: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.tipoMetricaUrgencia);
            if (!valor) return false;
            const valorStr = valor.toString().trim().toLowerCase();
            return valorStr === 's' || valorStr === 'sim' || valorStr === 'percentual';
          })(),
          cobrar_urgencia_como_rotina: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.cobrarUrgenciaRotina);
            if (!valor) return false;
            const valorStr = valor.toString().trim().toLowerCase();
            return valorStr === 's' || valorStr === 'sim' || valorStr === 'y' || valorStr === 'yes';
          })(),
          
          // Desconto/Acréscimo
          tipo_desconto_acrescimo: findColumnValue(row, COLUMN_MAPPING.tipoDesconto)?.toString().trim(),
          desconto_acrescimo: findColumnValue(row, COLUMN_MAPPING.descontoAcrescimo) ? Number(findColumnValue(row, COLUMN_MAPPING.descontoAcrescimo)) : null,
          
          // Portal de Laudos - campo booleano existente na tabela
          portal_laudos: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.possuiPortalLaudos);
            if (!valor) return false;
            const valorStr = valor.toString().trim().toLowerCase();
            return valorStr === 's' || valorStr === 'sim' || valorStr === 'y' || valorStr === 'yes';
          })(),
          
          // Franquia
          aplicar_franquia: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.possuiFranquia);
            if (!valor) return false;
            const valorStr = valor.toString().trim().toLowerCase();
            return valorStr === 'sim' || valorStr === 's';
          })(),
          valor_franquia: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.valorFranquia);
            return valor ? Number(valor) : null;
          })(),
          volume_franquia: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.volumeFranquia);
            return valor ? Number(valor) : null;
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
            const valor = findColumnValue(row, COLUMN_MAPPING.valorFranquiaAcimaVolume);
            return valor ? Number(valor) : null;
          })(),
          data_aniversario_contrato: findColumnValue(row, COLUMN_MAPPING.dataInicioFranquia) ? new Date(findColumnValue(row, COLUMN_MAPPING.dataInicioFranquia)).toISOString().split('T')[0] : null,
          
          // Configurações de Faturamento
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
          
          // Campos de controle
          periodicidade_reajuste: 'anual',
          indice_reajuste: 'IGP-M',
          percentual_reajuste_fixo: null,
          dia_fechamento: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.diaFechamento);
            return valor ? Number(valor) : 7;
          })(),
          forma_cobranca: (() => {
            const valor = findColumnValue(row, COLUMN_MAPPING.formaCobranca);
            return valor ? valor.toString().trim().toLowerCase() : 'mensal';
          })()
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