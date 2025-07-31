import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VolumetriaRecord {
  EMPRESA: string;
  NOME_PACIENTE: string;
  CODIGO_PACIENTE?: string;
  ESTUDO_DESCRICAO?: string;
  ACCESSION_NUMBER?: string;
  MODALIDADE?: string;
  PRIORIDADE?: string;
  VALORES?: number;
  ESPECIALIDADE?: string;
  MEDICO?: string;
  DUPLICADO?: string;
  DATA_REALIZACAO?: Date;
  HORA_REALIZACAO?: string;
  DATA_TRANSFERENCIA?: Date;
  HORA_TRANSFERENCIA?: string;
  DATA_LAUDO?: Date;
  HORA_LAUDO?: string;
  DATA_PRAZO?: Date;
  HORA_PRAZO?: string;
  STATUS?: string;
  DATA_REASSINATURA?: Date;
  HORA_REASSINATURA?: string;
  MEDICO_REASSINATURA?: string;
  SEGUNDA_ASSINATURA?: string;
  POSSUI_IMAGENS_CHAVE?: string;
  IMAGENS_CHAVES?: number;
  IMAGENS_CAPTURADAS?: number;
  CODIGO_INTERNO?: number;
  DIGITADOR?: string;
  COMPLEMENTAR?: string;
  arquivo_fonte: 'data_laudo' | 'data_exame';
  status_validacao: 'valido' | 'erro';
  erro_detalhes?: string;
}

interface ValidationResult {
  validRecords: VolumetriaRecord[];
  invalidRecords: VolumetriaRecord[];
  errors: string[];
  totalProcessed: number;
}

// FASE 1: Tratamento das colunas dos dados de upload
function convertBrazilianDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  try {
    const cleanDate = dateStr.trim();
    const dateRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/;
    const match = cleanDate.match(dateRegex);
    
    if (!match) return null;
    
    let [, day, month, year] = match;
    
    if (year.length === 2) {
      const currentYear = new Date().getFullYear();
      const currentCentury = Math.floor(currentYear / 100) * 100;
      year = String(currentCentury + parseInt(year));
    }
    
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    return null;
  }
}

function convertTime(timeStr: string): string | null {
  if (!timeStr || timeStr.trim() === '') return null;
  
  try {
    const cleanTime = timeStr.trim();
    const timeRegex = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/;
    const match = cleanTime.match(timeRegex);
    
    if (!match) return null;
    
    const [, hours, minutes, seconds = '00'] = match;
    const h = parseInt(hours);
    const m = parseInt(minutes);
    const s = parseInt(seconds);
    
    if (h > 23 || m > 59 || s > 59) return null;
    
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
  } catch (error) {
    return null;
  }
}

function convertValues(valueStr: string | number): number | null {
  if (valueStr === null || valueStr === undefined || valueStr === '') return null;
  
  try {
    const numValue = typeof valueStr === 'string' ? parseFloat(valueStr) : valueStr;
    return isNaN(numValue) ? null : Math.floor(numValue);
  } catch (error) {
    return null;
  }
}

function processRow(row: any, arquivoFonte: 'data_laudo' | 'data_exame'): VolumetriaRecord {
  const safeString = (value: any): string | undefined => {
    if (value === null || value === undefined || value === '') return undefined;
    return String(value).trim() || undefined;
  };

  const record: VolumetriaRecord = {
    EMPRESA: String(row['EMPRESA'] || '').trim(),
    NOME_PACIENTE: String(row['NOME_PACIENTE'] || '').trim(),
    arquivo_fonte: arquivoFonte,
    status_validacao: 'valido',
    
    CODIGO_PACIENTE: safeString(row['CODIGO_PACIENTE']),
    ESTUDO_DESCRICAO: safeString(row['ESTUDO_DESCRICAO']),
    ACCESSION_NUMBER: safeString(row['ACCESSION_NUMBER']),
    MODALIDADE: safeString(row['MODALIDADE']),
    PRIORIDADE: safeString(row['PRIORIDADE']),
    ESPECIALIDADE: safeString(row['ESPECIALIDADE']),
    MEDICO: safeString(row['MEDICO']),
    DUPLICADO: safeString(row['DUPLICADO']),
    STATUS: safeString(row['STATUS']),
    MEDICO_REASSINATURA: safeString(row['MEDICO_REASSINATURA']),
    SEGUNDA_ASSINATURA: safeString(row['SEGUNDA_ASSINATURA']),
    POSSUI_IMAGENS_CHAVE: safeString(row['POSSUI_IMAGENS_CHAVE']),
    DIGITADOR: safeString(row['DIGITADOR']),
    COMPLEMENTAR: safeString(row['COMPLEMENTAR']),
    
    VALORES: row['VALORES'] ? convertValues(row['VALORES']) : undefined,
    IMAGENS_CHAVES: row['IMAGENS_CHAVES'] ? convertValues(row['IMAGENS_CHAVES']) : undefined,
    IMAGENS_CAPTURADAS: row['IMAGENS_CAPTURADAS'] ? convertValues(row['IMAGENS_CAPTURADAS']) : undefined,
    CODIGO_INTERNO: row['CODIGO_INTERNO'] ? convertValues(row['CODIGO_INTERNO']) : undefined,
    
    DATA_REALIZACAO: row['DATA_REALIZACAO'] ? convertBrazilianDate(String(row['DATA_REALIZACAO'])) : undefined,
    DATA_TRANSFERENCIA: row['DATA_TRANSFERENCIA'] ? convertBrazilianDate(String(row['DATA_TRANSFERENCIA'])) : undefined,
    DATA_LAUDO: row['DATA_LAUDO'] ? convertBrazilianDate(String(row['DATA_LAUDO'])) : undefined,
    DATA_PRAZO: row['DATA_PRAZO'] ? convertBrazilianDate(String(row['DATA_PRAZO'])) : undefined,
    DATA_REASSINATURA: row['DATA_REASSINATURA'] ? convertBrazilianDate(String(row['DATA_REASSINATURA'])) : undefined,
    
    HORA_REALIZACAO: row['HORA_REALIZACAO'] ? convertTime(String(row['HORA_REALIZACAO'])) : undefined,
    HORA_TRANSFERENCIA: row['HORA_TRANSFERENCIA'] ? convertTime(String(row['HORA_TRANSFERENCIA'])) : undefined,
    HORA_LAUDO: row['HORA_LAUDO'] ? convertTime(String(row['HORA_LAUDO'])) : undefined,
    HORA_PRAZO: row['HORA_PRAZO'] ? convertTime(String(row['HORA_PRAZO'])) : undefined,
    HORA_REASSINATURA: row['HORA_REASSINATURA'] ? convertTime(String(row['HORA_REASSINATURA'])) : undefined,
  };

  return record;
}

// FASE 2: De-para de quebra de exames (aplicar regras existentes)
async function aplicarDeParaQuebraExames(supabaseClient: any, records: VolumetriaRecord[], config: any): Promise<VolumetriaRecord[]> {
  console.log('FASE 2: Aplicando de-para de quebra de exames...');
  
  // Buscar regras de quebra ativas
  const { data: regrasQuebra, error } = await supabaseClient
    .from('quebra_exames')
    .select('*')
    .eq('ativo', true);

  if (error) {
    console.error('Erro ao buscar regras de quebra:', error);
    return records;
  }

  let recordsProcessados = [...records];
  let novosRecords: VolumetriaRecord[] = [];

  for (const regra of regrasQuebra || []) {
    const recordsParaQuebrar = recordsProcessados.filter(record => 
      record.ESTUDO_DESCRICAO === regra.exame_original
    );

    for (const record of recordsParaQuebrar) {
      // Remover o registro original
      recordsProcessados = recordsProcessados.filter(r => r !== record);
      
      // Criar novos registros baseados na quebra
      for (const novoExame of regra.exames_resultantes) {
        const novoRecord: VolumetriaRecord = {
          ...record,
          ESTUDO_DESCRICAO: novoExame.nome,
          VALORES: novoExame.valor || record.VALORES
        };
        novosRecords.push(novoRecord);
      }
    }
  }

  const resultadoFinal = [...recordsProcessados, ...novosRecords];
  console.log(`Quebra de exames aplicada: ${records.length} → ${resultadoFinal.length} registros`);
  
  return resultadoFinal;
}

// FASE 3: Filtro de datas (aplicar regras de negócio existentes)
function aplicarFiltroDatas(records: VolumetriaRecord[], config: any): VolumetriaRecord[] {
  console.log('FASE 3: Aplicando filtro de datas...');
  
  const hoje = new Date();
  const dataLimiteMinima = new Date('2020-01-01');

  const recordsFiltrados = records.filter(record => {
    // Determinar data de referência baseada no tipo de arquivo
    let dataReferencia = null;
    
    if (record.arquivo_fonte === 'data_laudo') {
      dataReferencia = record.DATA_LAUDO;
    } else {
      dataReferencia = record.DATA_REALIZACAO;
    }
    
    // Filtros básicos
    if (!dataReferencia) return false;
    if (dataReferencia > hoje) return false;
    if (dataReferencia < dataLimiteMinima) return false;
    
    // Aplicar regras específicas de período de faturamento
    if (config.periodoFaturamento) {
      // Para arquivos retroativos: excluir período atual
      if (config.filterCurrentPeriod && record.DATA_REALIZACAO) {
        if (isInBillingPeriod(record.DATA_REALIZACAO, config.periodoFaturamento)) {
          console.log(`Excluído por estar no período de faturamento ${config.periodoFaturamento.mes}/${config.periodoFaturamento.ano}`);
          return false;
        }
      }
      
      // Para arquivos padrão: filtrar DATA_LAUDO
      if ((config.arquivoFonte === 'volumetria_padrao' || config.arquivoFonte === 'volumetria_fora_padrao') && 
          record.DATA_LAUDO) {
        const dataLimiteCorte = getDataLimiteCorte(config.periodoFaturamento);
        if (record.DATA_LAUDO > dataLimiteCorte) {
          console.log(`Excluído - DATA_LAUDO superior à data limite de corte`);
          return false;
        }
      }
    }
    
    return true;
  });

  console.log(`Filtro de datas aplicado: ${records.length} → ${recordsFiltrados.length} registros`);
  return recordsFiltrados;
}

// Funções auxiliares das regras de negócio existentes
function isInBillingPeriod(dataRealizacao: Date, periodoFaturamento: { ano: number; mes: number }): boolean {
  const { ano, mes } = periodoFaturamento;
  const anoSeguinte = mes === 12 ? ano + 1 : ano;
  const mesSeguinte = mes === 12 ? 1 : mes + 1;
  const inicioPeriodo = new Date(ano, mes - 1, 8);
  const fimPeriodo = new Date(anoSeguinte, mesSeguinte - 1, 7);
  return dataRealizacao >= inicioPeriodo && dataRealizacao <= fimPeriodo;
}

function getDataLimiteCorte(periodoFaturamento: { ano: number; mes: number }): Date {
  const { ano, mes } = periodoFaturamento;
  const anoSeguinte = mes === 12 ? ano + 1 : ano;
  const mesSeguinte = mes === 12 ? 1 : mes + 1;
  return new Date(anoSeguinte, mesSeguinte - 1, 7);
}

// FASE 4: De-para de prioridade
async function aplicarDeParaPrioridade(supabaseClient: any, records: VolumetriaRecord[]): Promise<VolumetriaRecord[]> {
  console.log('FASE 4: Aplicando de-para de prioridade...');
  
  // Buscar mapeamentos de prioridade
  const { data: mapeamentos, error } = await supabaseClient
    .from('valores_prioridade_de_para')
    .select('*')
    .eq('ativo', true);

  if (error) {
    console.error('Erro ao buscar mapeamentos de prioridade:', error);
    return records;
  }

  const mapeamentosMap = new Map();
  for (const map of mapeamentos || []) {
    mapeamentosMap.set(map.prioridade_original, map.nome_final);
  }

  let atualizados = 0;
  const recordsAtualizados = records.map(record => {
    if (record.PRIORIDADE && mapeamentosMap.has(record.PRIORIDADE)) {
      const novoRecord = { ...record };
      novoRecord.PRIORIDADE = mapeamentosMap.get(record.PRIORIDADE);
      atualizados++;
      return novoRecord;
    }
    return record;
  });

  console.log(`De-para de prioridade aplicado: ${atualizados} registros atualizados`);
  return recordsAtualizados;
}

// FASE 5: Validação final obrigatória
function validacaoFinal(records: VolumetriaRecord[]): ValidationResult {
  console.log('FASE 5: Executando validação final obrigatória...');
  
  const validRecords: VolumetriaRecord[] = [];
  const invalidRecords: VolumetriaRecord[] = [];
  const errors: string[] = [];

  for (const record of records) {
    const camposObrigatorios = ['DATA_LAUDO', 'HORA_LAUDO', 'DATA_PRAZO', 'HORA_PRAZO'];
    const camposFaltando = [];

    for (const campo of camposObrigatorios) {
      if (!record[campo as keyof VolumetriaRecord]) {
        camposFaltando.push(campo);
      }
    }

    if (camposFaltando.length > 0) {
      const recordInvalido = {
        ...record,
        status_validacao: 'erro' as const,
        erro_detalhes: `Campos obrigatórios ausentes: ${camposFaltando.join(', ')}`
      };
      invalidRecords.push(recordInvalido);
      errors.push(`Registro inválido - EMPRESA: ${record.EMPRESA}, PACIENTE: ${record.NOME_PACIENTE} - Campos faltando: ${camposFaltando.join(', ')}`);
    } else {
      validRecords.push(record);
    }
  }

  console.log(`Validação final: ${validRecords.length} válidos, ${invalidRecords.length} inválidos`);
  
  return {
    validRecords,
    invalidRecords,
    errors,
    totalProcessed: records.length
  };
}

// Função principal de processamento
async function processarVolumetriaCompleto(
  supabaseClient: any,
  file_path: string,
  arquivo_fonte: 'data_laudo' | 'data_exame',
  uploadLogId: string,
  config?: any
) {
  try {
    console.log('=== INICIANDO PROCESSAMENTO COMPLETO ===');
    console.log('Config recebido:', JSON.stringify(config));
    
    // Baixar arquivo do storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('uploads')
      .download(file_path);

    if (downloadError) {
      throw new Error(`Erro ao baixar arquivo: ${downloadError.message}`);
    }

    // Ler arquivo Excel
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    
    if (!workbook.SheetNames.length) {
      throw new Error('Arquivo Excel não possui planilhas');
    }

    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    if (jsonData.length === 0) {
      throw new Error('Arquivo Excel está vazio');
    }

    console.log(`Dados extraídos: ${jsonData.length} linhas`);

    // FASE 1: Tratamento das colunas dos dados de upload
    console.log('FASE 1: Tratamento das colunas dos dados de upload...');
    let recordsProcessados: VolumetriaRecord[] = [];
    
    for (const row of jsonData) {
      const record = processRow(row, arquivo_fonte);
      recordsProcessados.push(record);
    }

    console.log(`FASE 1 concluída: ${recordsProcessados.length} registros processados`);

    // FASE 2: De-para de quebra de exames
    recordsProcessados = await aplicarDeParaQuebraExames(supabaseClient, recordsProcessados, config);

    // FASE 3: Filtro de datas
    recordsProcessados = aplicarFiltroDatas(recordsProcessados, config);

    // FASE 4: De-para de prioridade
    recordsProcessados = await aplicarDeParaPrioridade(supabaseClient, recordsProcessados);

    // FASE 5: Validação final obrigatória
    const validationResult = validacaoFinal(recordsProcessados);

    // Inserir registros válidos
    let totalInserido = 0;
    if (validationResult.validRecords.length > 0) {
      console.log(`Inserindo ${validationResult.validRecords.length} registros válidos...`);
      
      const batchSize = 500;
      for (let i = 0; i < validationResult.validRecords.length; i += batchSize) {
        const batch = validationResult.validRecords.slice(i, i + batchSize);
        
        const { data: insertedData, error: insertError } = await supabaseClient
          .from('volumetria_mobilemed')
          .insert(batch.map(record => {
            // Remove campos de validação antes da inserção
            const { status_validacao, erro_detalhes, ...recordParaInserir } = record;
            return recordParaInserir;
          }))
          .select('id');

        if (insertError) {
          console.error(`Erro no lote ${Math.floor(i / batchSize) + 1}:`, insertError);
        } else {
          totalInserido += insertedData?.length || batch.length;
        }
      }
    }

    // Salvar registros inválidos em tabela de erros
    if (validationResult.invalidRecords.length > 0) {
      console.log(`Salvando ${validationResult.invalidRecords.length} registros inválidos na tabela de erros...`);
      
      const { error: errorLogError } = await supabaseClient
        .from('volumetria_erros')
        .insert(validationResult.invalidRecords.map(record => ({
          empresa: record.EMPRESA,
          nome_paciente: record.NOME_PACIENTE,
          arquivo_fonte: record.arquivo_fonte,
          erro_detalhes: record.erro_detalhes,
          dados_originais: JSON.stringify(record),
          created_at: new Date().toISOString()
        })));

      if (errorLogError) {
        console.error('Erro ao salvar registros inválidos:', errorLogError);
      }
    }

    // Atualizar log de upload
    const { error: updateError } = await supabaseClient
      .from('processamento_uploads')
      .update({
        status: totalInserido > 0 ? 'concluido' : 'erro',
        registros_processados: validationResult.totalProcessed,
        registros_inseridos: totalInserido,
        registros_erro: validationResult.invalidRecords.length
      })
      .eq('id', uploadLogId);

    if (updateError) {
      console.error('Erro ao atualizar log:', updateError);
    }

    console.log('=== PROCESSAMENTO COMPLETO FINALIZADO ===');
    console.log(`Total processado: ${validationResult.totalProcessed}`);
    console.log(`Registros válidos inseridos: ${totalInserido}`);
    console.log(`Registros inválidos: ${validationResult.invalidRecords.length}`);
    
    if (validationResult.invalidRecords.length > 0) {
      console.error('⚠️ ATENÇÃO: Existem registros com erros que precisam ser corrigidos!');
      console.error('Registros inválidos foram salvos na tabela volumetria_erros para correção.');
    }

  } catch (error) {
    console.error('Erro durante processamento completo:', error);
    
    // Atualizar log com erro
    try {
      await supabaseClient
        .from('processamento_uploads')
        .update({
          status: 'erro',
          erro_detalhes: error?.message || String(error)
        })
        .eq('id', uploadLogId);
    } catch (finalErr) {
      console.error('Erro ao atualizar status de erro:', finalErr);
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_path, arquivo_fonte, config } = await req.json();

    console.log('=== PROCESSAR VOLUMETRIA COMPLETO ===');
    console.log('Arquivo:', file_path);
    console.log('Fonte:', arquivo_fonte);
    console.log('Config:', JSON.stringify(config));

    if (!file_path || !arquivo_fonte) {
      throw new Error('file_path e arquivo_fonte são obrigatórios');
    }

    if (!['data_laudo', 'data_exame'].includes(arquivo_fonte)) {
      throw new Error('arquivo_fonte deve ser "data_laudo" ou "data_exame"');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Criar log de upload
    const { data: uploadLog, error: logError } = await supabaseClient
      .from('processamento_uploads')
      .insert({
        arquivo_nome: file_path,
        tipo_arquivo: config?.arquivoFonte || arquivo_fonte,
        status: 'processando',
        registros_processados: 0,
        registros_inseridos: 0,
        registros_atualizados: 0,
        registros_erro: 0
      })
      .select()
      .single();

    if (logError) {
      throw new Error('Erro ao criar log de upload');
    }

    // Iniciar processamento em background
    const backgroundTask = processarVolumetriaCompleto(
      supabaseClient,
      file_path,
      arquivo_fonte as 'data_laudo' | 'data_exame',
      uploadLog.id,
      config
    );

    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(backgroundTask);
    } else {
      backgroundTask.catch(console.error);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Processamento completo iniciado em background',
        upload_log_id: uploadLog.id,
        arquivo_fonte: arquivo_fonte,
        status: 'processing',
        fases: [
          '1. Tratamento das colunas',
          '2. De-para de quebra de exames', 
          '3. Filtro de datas',
          '4. De-para de prioridade',
          '5. Validação final obrigatória'
        ]
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Erro na função processar-volumetria-completo:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: 'Erro no processamento completo'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});