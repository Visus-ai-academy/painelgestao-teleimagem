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
  arquivo_fonte: string;
  lote_upload?: string;
  periodo_referencia?: string;
  data_referencia?: Date;
}

function convertBrazilianDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  try {
    const cleanDate = dateStr.trim();
    const dateRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/;
    const match = cleanDate.match(dateRegex);
    
    if (!match) {
      // CORREÇÃO: Em vez de retornar null, tentar outros formatos ou retornar uma data padrão
      console.warn(`Data em formato não reconhecido: ${dateStr}, mantendo registro`);
      return null; // Mantém null mas não exclui o registro
    }
    
    let [, day, month, year] = match;
    
    if (year.length === 2) {
      const currentYear = new Date().getFullYear();
      const currentCentury = Math.floor(currentYear / 100) * 100;
      year = String(currentCentury + parseInt(year));
    }
    
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (isNaN(date.getTime())) {
      // CORREÇÃO: Não excluir registro por data inválida
      console.warn(`Data inválida: ${dateStr}, mantendo registro com data null`);
      return null;
    }
    return date;
  } catch (error) {
    // CORREÇÃO: Não excluir registro por erro de conversão
    console.warn(`Erro ao converter data: ${dateStr}, mantendo registro com data null`);
    return null;
  }
}

function convertTime(timeStr: string): string | null {
  if (!timeStr || timeStr.trim() === '') return null;
  
  try {
    const cleanTime = timeStr.trim();
    const timeRegex = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/;
    const match = cleanTime.match(timeRegex);
    
    if (!match) {
      // CORREÇÃO: Não excluir registro por formato de hora inválido
      console.warn(`Hora em formato não reconhecido: ${timeStr}, mantendo registro`);
      return null;
    }
    
    const [, hours, minutes, seconds = '00'] = match;
    const h = parseInt(hours);
    const m = parseInt(minutes);
    const s = parseInt(seconds);
    
    if (h > 23 || m > 59 || s > 59) {
      // CORREÇÃO: Não excluir registro por hora inválida
      console.warn(`Hora inválida: ${timeStr}, mantendo registro com hora null`);
      return null;
    }
    
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
  } catch (error) {
    // CORREÇÃO: Não excluir registro por erro de conversão
    console.warn(`Erro ao converter hora: ${timeStr}, mantendo registro com hora null`);
    return null;
  }
}

function convertValues(valueStr: string | number): number | null {
  if (valueStr === null || valueStr === undefined || valueStr === '') return null;
  
  try {
    const numValue = typeof valueStr === 'string' ? parseFloat(valueStr) : valueStr;
    if (isNaN(numValue)) {
      // CORREÇÃO: Não excluir registro por valor inválido
      console.warn(`Valor numérico inválido: ${valueStr}, mantendo registro com valor null`);
      return null;
    }
    return Math.floor(numValue);
  } catch (error) {
    // CORREÇÃO: Não excluir registro por erro de conversão
    console.warn(`Erro ao converter valor: ${valueStr}, mantendo registro com valor null`);
    return null;
  }
}

// Interface para registros rejeitados
interface RejectedRecord {
  arquivo_fonte: string;
  lote_upload: string;
  linha_original: number;
  dados_originais: any;
  motivo_rejeicao: string;
  detalhes_erro: string;
}

function processRow(row: any, arquivoFonte: string, loteUpload: string, periodoReferencia: string, periodProcessamento?: { ano: number; mes: number } | null, lineNumber?: number): { record: VolumetriaRecord | null, rejection: RejectedRecord | null } {
  try {
    if (!row || typeof row !== 'object') {
      return {
        record: null,
        rejection: {
          arquivo_fonte: arquivoFonte,
          lote_upload: loteUpload,
          linha_original: lineNumber || 0,
          dados_originais: row,
          motivo_rejeicao: 'ESTRUTURA_INVALIDA',
          detalhes_erro: 'Linha não contém um objeto válido ou está vazia'
        }
      };
    }

    const empresaOriginal = row['EMPRESA'] || '';
    const nomePaciente = row['NOME_PACIENTE'] || '';
    const estudoDescricao = row['ESTUDO_DESCRICAO'] || '';

    // VALIDAÇÕES COM CAPTURA DE EXCLUSÕES
    
    // 1. Campos obrigatórios
    if (!empresaOriginal || empresaOriginal.toString().trim() === '') {
      return {
        record: null,
        rejection: {
          arquivo_fonte: arquivoFonte,
          lote_upload: loteUpload,
          linha_original: lineNumber || 0,
          dados_originais: row,
          motivo_rejeicao: 'CAMPO_OBRIGATORIO_AUSENTE',
          detalhes_erro: 'Campo EMPRESA está vazio ou nulo'
        }
      };
    }

    if (!nomePaciente || nomePaciente.toString().trim() === '') {
      return {
        record: null,
        rejection: {
          arquivo_fonte: arquivoFonte,
          lote_upload: loteUpload,
          linha_original: lineNumber || 0,
          dados_originais: row,
          motivo_rejeicao: 'CAMPO_OBRIGATORIO_AUSENTE',
          detalhes_erro: 'Campo NOME_PACIENTE está vazio ou nulo'
        }
      };
    }

    if (!estudoDescricao || estudoDescricao.toString().trim() === '') {
      return {
        record: null,
        rejection: {
          arquivo_fonte: arquivoFonte,
          lote_upload: loteUpload,
          linha_original: lineNumber || 0,
          dados_originais: row,
          motivo_rejeicao: 'CAMPO_OBRIGATORIO_AUSENTE',
          detalhes_erro: 'Campo ESTUDO_DESCRICAO está vazio ou nulo'
        }
      };
    }

    // 2. Validação de datas obrigatórias
    const dataLaudoStr = row['DATA_LAUDO'];
    const dataRealizacaoStr = row['DATA_REALIZACAO'];
    
    if (!dataLaudoStr || dataLaudoStr.toString().trim() === '') {
      return {
        record: null,
        rejection: {
          arquivo_fonte: arquivoFonte,
          lote_upload: loteUpload,
          linha_original: lineNumber || 0,
          dados_originais: row,
          motivo_rejeicao: 'DATA_OBRIGATORIA_AUSENTE',
          detalhes_erro: 'Campo DATA_LAUDO está vazio ou nulo'
        }
      };
    }

    if (!dataRealizacaoStr || dataRealizacaoStr.toString().trim() === '') {
      return {
        record: null,
        rejection: {
          arquivo_fonte: arquivoFonte,
          lote_upload: loteUpload,
          linha_original: lineNumber || 0,
          dados_originais: row,
          motivo_rejeicao: 'DATA_OBRIGATORIA_AUSENTE',
          detalhes_erro: 'Campo DATA_REALIZACAO está vazio ou nulo'
        }
      };
    }

    // 3. Validação de formatos de data
    const dataLaudo = convertBrazilianDate(dataLaudoStr.toString());
    const dataRealizacao = convertBrazilianDate(dataRealizacaoStr.toString());

    if (!dataLaudo) {
      return {
        record: null,
        rejection: {
          arquivo_fonte: arquivoFonte,
          lote_upload: loteUpload,
          linha_original: lineNumber || 0,
          dados_originais: row,
          motivo_rejeicao: 'FORMATO_DATA_INVALIDO',
          detalhes_erro: `DATA_LAUDO em formato inválido: "${dataLaudoStr}". Formato esperado: DD/MM/YYYY`
        }
      };
    }

    if (!dataRealizacao) {
      return {
        record: null,
        rejection: {
          arquivo_fonte: arquivoFonte,
          lote_upload: loteUpload,
          linha_original: lineNumber || 0,
          dados_originais: row,
          motivo_rejeicao: 'FORMATO_DATA_INVALIDO',
          detalhes_erro: `DATA_REALIZACAO em formato inválido: "${dataRealizacaoStr}". Formato esperado: DD/MM/YYYY`
        }
      };
    }

    // 4. Aplicar regras de período (v031) apenas para arquivos não-retroativos
    if (!arquivoFonte.includes('retroativo') && periodProcessamento) {
      const periodoAno = periodProcessamento.ano;
      const periodoMes = periodProcessamento.mes;
      
      // Calcular datas do período
      const inicioMes = new Date(periodoAno, periodoMes - 1, 1);
      const fimMes = new Date(periodoAno, periodoMes, 0);
      const fimJanelaLaudo = new Date(periodoAno, periodoMes, 7);
      
      // REGRA v031: DATA_REALIZACAO deve estar no mês do período
      if (dataRealizacao < inicioMes || dataRealizacao > fimMes) {
        return {
          record: null,
          rejection: {
            arquivo_fonte: arquivoFonte,
            lote_upload: loteUpload,
            linha_original: lineNumber || 0,
            dados_originais: row,
            motivo_rejeicao: 'REGRA_V031_DATA_REALIZACAO',
            detalhes_erro: `DATA_REALIZACAO (${dataRealizacaoStr}) fora do período permitido: ${inicioMes.toLocaleDateString('pt-BR')} a ${fimMes.toLocaleDateString('pt-BR')}`
          }
        };
      }
      
      // REGRA v031: DATA_LAUDO deve estar na janela permitida
      if (dataLaudo < inicioMes || dataLaudo > fimJanelaLaudo) {
        return {
          record: null,
          rejection: {
            arquivo_fonte: arquivoFonte,
            lote_upload: loteUpload,
            linha_original: lineNumber || 0,
            dados_originais: row,
            motivo_rejeicao: 'REGRA_V031_DATA_LAUDO',
            detalhes_erro: `DATA_LAUDO (${dataLaudoStr}) fora da janela permitida: ${inicioMes.toLocaleDateString('pt-BR')} a ${fimJanelaLaudo.toLocaleDateString('pt-BR')}`
          }
        };
      }
    }

    // 5. Aplicar regras retroativas (v002 e v003) para arquivos retroativos
    if (arquivoFonte.includes('retroativo') && periodProcessamento) {
      const periodoAno = periodProcessamento.ano;
      const periodoMes = periodProcessamento.mes;
      
      const dataLimiteRealizacao = new Date(periodoAno, periodoMes - 1, 1);
      const inicioFaturamento = new Date(periodoAno, periodoMes - 1, 8);
      const fimFaturamento = new Date(periodoAno, periodoMes, 7);
      
      // REGRA v003: DATA_REALIZACAO >= 01 do mês especificado
      if (dataRealizacao >= dataLimiteRealizacao) {
        return {
          record: null,
          rejection: {
            arquivo_fonte: arquivoFonte,
            lote_upload: loteUpload,
            linha_original: lineNumber || 0,
            dados_originais: row,
            motivo_rejeicao: 'REGRA_V003_RETROATIVO',
            detalhes_erro: `DATA_REALIZACAO (${dataRealizacaoStr}) deve ser anterior a ${dataLimiteRealizacao.toLocaleDateString('pt-BR')} para arquivos retroativos`
          }
        };
      }
      
      // REGRA v002: DATA_LAUDO fora do período de faturamento
      if (dataLaudo < inicioFaturamento || dataLaudo > fimFaturamento) {
        return {
          record: null,
          rejection: {
            arquivo_fonte: arquivoFonte,
            lote_upload: loteUpload,
            linha_original: lineNumber || 0,
            dados_originais: row,
            motivo_rejeicao: 'REGRA_V002_RETROATIVO',
            detalhes_erro: `DATA_LAUDO (${dataLaudoStr}) fora do período de faturamento: ${inicioFaturamento.toLocaleDateString('pt-BR')} a ${fimFaturamento.toLocaleDateString('pt-BR')}`
          }
        };
      }
    }

    // Se chegou até aqui, o registro é válido - processar normalmente
    const empresa = empresaOriginal.trim();

    const safeString = (value: any): string | undefined => {
      if (value === null || value === undefined || value === '') return undefined;
      return String(value).trim() || undefined;
    };

    const normalizeMedico = (value: any): string | undefined => {
      if (value === null || value === undefined || value === '') return undefined;
      
      let medico = String(value).trim();
      // Remover códigos entre parênteses como (E1), (E2), (E3), etc
      medico = medico.replace(/\s*\([^)]*\)\s*/g, '');
      // Remover DR/DRA no início se presente
      medico = medico.replace(/^DR[A]?\s+/i, '');
      // Remover pontos finais
      medico = medico.replace(/\.$/, '');
      
      return medico.trim() || undefined;
    };

    const cleanExameName = (value: any): string | undefined => {
      if (value === null || value === undefined || value === '') return undefined;
      
      let cleanName = String(value).trim();
      cleanName = cleanName.replace(/\s+X[1-9]\b/gi, '');
      cleanName = cleanName.replace(/\s+XE\b/gi, '');
      cleanName = cleanName.replace(/\s+/g, ' ').trim();
      
      return cleanName || undefined;
    };

    const record: VolumetriaRecord = {
      EMPRESA: empresa,
      NOME_PACIENTE: nomePaciente.toString().trim(),
      arquivo_fonte: arquivoFonte,
      lote_upload: loteUpload,
      periodo_referencia: periodoReferencia,
      
      CODIGO_PACIENTE: safeString(row['CODIGO_PACIENTE']),
      ESTUDO_DESCRICAO: cleanExameName(row['ESTUDO_DESCRICAO']),
      ACCESSION_NUMBER: safeString(row['ACCESSION_NUMBER']),
      MODALIDADE: safeString(row['MODALIDADE']),
      PRIORIDADE: safeString(row['PRIORIDADE']),
      ESPECIALIDADE: safeString(row['ESPECIALIDADE']),
      MEDICO: normalizeMedico(row['MEDICO']),
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
      
      DATA_REALIZACAO: dataRealizacao,
      DATA_TRANSFERENCIA: row['DATA_TRANSFERENCIA'] ? convertBrazilianDate(String(row['DATA_TRANSFERENCIA'])) : undefined,
      DATA_LAUDO: dataLaudo,
      DATA_PRAZO: row['DATA_PRAZO'] ? convertBrazilianDate(String(row['DATA_PRAZO'])) : undefined,
      DATA_REASSINATURA: row['DATA_REASSINATURA'] ? convertBrazilianDate(String(row['DATA_REASSINATURA'])) : undefined,
      
      HORA_REALIZACAO: row['HORA_REALIZACAO'] ? convertTime(String(row['HORA_REALIZACAO'])) : undefined,
      HORA_TRANSFERENCIA: row['HORA_TRANSFERENCIA'] ? convertTime(String(row['HORA_TRANSFERENCIA'])) : undefined,
      HORA_LAUDO: row['HORA_LAUDO'] ? convertTime(String(row['HORA_LAUDO'])) : undefined,
      HORA_PRAZO: row['HORA_PRAZO'] ? convertTime(String(row['HORA_PRAZO'])) : undefined,
      HORA_REASSINATURA: row['HORA_REASSINATURA'] ? convertTime(String(row['HORA_REASSINATURA'])) : undefined,
    };

    // REGRA v024: Definir data_referencia baseado no período de processamento escolhido
    if (periodProcessamento && periodProcessamento.ano && periodProcessamento.mes) {
      const mesFormatado = String(periodProcessamento.mes).padStart(2, '0');
      record.data_referencia = new Date(`${periodProcessamento.ano}-${mesFormatado}-01`);
      
      // Definir periodo_referencia também
      const mesNomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      record.periodo_referencia = `${mesNomes[periodProcessamento.mes - 1]}/${String(periodProcessamento.ano).slice(-2)}`;
    } else {
      // Fallback: usar data do arquivo se período não especificado
      if (arquivoFonte === 'data_laudo') {
        record.data_referencia = record.DATA_LAUDO;
      } else if (arquivoFonte === 'data_exame') {
        record.data_referencia = record.DATA_REALIZACAO;
      } else {
        record.data_referencia = record.DATA_LAUDO || record.DATA_REALIZACAO;
      }
    }

    return { record, rejection: null };
  } catch (error) {
    console.error('Erro ao processar linha:', error);
    return {
      record: null,
      rejection: {
        arquivo_fonte: arquivoFonte,
        lote_upload: loteUpload,
        linha_original: lineNumber || 0,
        dados_originais: row,
        motivo_rejeicao: 'ERRO_PROCESSAMENTO',
        detalhes_erro: `Erro interno no processamento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      }
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 PROCESSAMENTO OTIMIZADO INICIADO');
    
    const requestData = await req.json();
    console.log('📦 Dados recebidos:', JSON.stringify(requestData));
    
    const { file_path, arquivo_fonte, periodo, periodo_processamento } = requestData;
    
    // Usar periodo_processamento se fornecido, senão fallback para periodo
    const periodProcessamento = periodo_processamento || (periodo ? {
      ano: new Date().getFullYear(),
      mes: parseInt(periodo.split('-')[1]) || new Date().getMonth() + 1
    } : null);
    
    if (!file_path || !arquivo_fonte) {
      throw new Error('Parâmetros obrigatórios: file_path, arquivo_fonte');
    }
    
    console.log('📁 Arquivo:', file_path);
    console.log('🏷️ Fonte:', arquivo_fonte);
    console.log('🗓️ Período:', periodo);
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('✅ Cliente Supabase criado');

    // Criar log de upload
    const { data: uploadLog, error: logError } = await supabaseClient
      .from('processamento_uploads')
      .insert({
        arquivo_nome: file_path,
        tipo_arquivo: arquivo_fonte,
        tipo_dados: 'volumetria',
        status: 'processando',
        registros_processados: 0,
        registros_inseridos: 0,
        registros_atualizados: 0,
        registros_erro: 0,
        periodo_referencia: periodo ? `${periodo.ano}-${periodo.mes.toString().padStart(2, '0')}` : null
      })
      .select()
      .single();

    if (logError) {
      console.error('❌ Erro ao criar log:', logError);
      throw new Error(`Erro ao criar log: ${logError.message}`);
    }

    console.log('✅ Log de upload criado:', uploadLog.id);

    // Baixar arquivo
    const cleanFilePath = file_path.replace(/^uploads\//, '');
    console.log('📥 Baixando arquivo:', cleanFilePath);
    
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('uploads')
      .download(cleanFilePath);

    if (downloadError) {
      console.error('❌ Erro download:', downloadError);
      throw new Error(`Arquivo não encontrado: ${cleanFilePath}`);
    }

    console.log('✅ Arquivo baixado com sucesso');

    // Processar Excel
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: true });

    console.log(`📊 Total de linhas no arquivo: ${jsonData.length}`);

    if (jsonData.length === 0) {
      throw new Error('Arquivo Excel vazio ou sem dados válidos');
    }

    // Limpar dados anteriores do mesmo tipo de arquivo
    const periodoReferencia = periodo ? `${periodo.ano}-${periodo.mes.toString().padStart(2, '0')}` : new Date().toISOString().substring(0, 7);
    
    console.log('🧹 Limpando dados anteriores...');
    const { error: deleteError } = await supabaseClient
      .from('volumetria_mobilemed')
      .delete()
      .eq('arquivo_fonte', arquivo_fonte)
      .eq('periodo_referencia', periodoReferencia);

    if (deleteError) {
      console.warn('⚠️ Erro ao limpar dados anteriores:', deleteError);
    } else {
      console.log('✅ Dados anteriores limpos');
    }

    // Processar registros (otimizado)
    const loteUpload = `${arquivo_fonte}_${Date.now()}_${uploadLog.id.substring(0, 8)}`;
    const batchSize = 1000;
    let totalInserted = 0;
    let totalErrors = 0;
    
    // Arrays para capturar exclusões
    const rejectedRecords: RejectedRecord[] = [];

    console.log(`📦 Processando ${jsonData.length} registros em lotes de ${batchSize}`);

    // Debug específico para paciente reportado
    const DEBUG_PACIENTE = 'NATALIA NUNES DA SILVA MENEZES';
    let dbgFoundInFile = 0;
    let dbgPrepared = 0;
    let dbgInserted = 0;
    let dbgSkippedSemEmpresaOuNome = 0;

    // Processar em chunks
    for (let i = 0; i < jsonData.length; i += batchSize) {
      const batch = jsonData.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(jsonData.length / batchSize);
      
      console.log(`📋 Processando lote ${batchNumber}/${totalBatches} (${i + 1}-${Math.min(i + batchSize, jsonData.length)})`);

      const records: VolumetriaRecord[] = [];
      const batchRejections: RejectedRecord[] = [];
      
      // Processar registros
      for (let rowIndex = 0; rowIndex < batch.length; rowIndex++) {
        const row = batch[rowIndex];
        const lineNumber = i + rowIndex + 2; // +2 porque Excel começa em 1 e tem header
        
        try {
          const nomeRaw = String(row['NOME_PACIENTE'] ?? '').toUpperCase().trim();
          if (nomeRaw === DEBUG_PACIENTE) {
            dbgFoundInFile++;
          }

          const result = processRow(row, arquivo_fonte, loteUpload, periodoReferencia, periodProcessamento, lineNumber);
          
          if (result.record) {
            // Registro válido - adicionar para inserção
            records.push(result.record);
            if ((result.record.NOME_PACIENTE || '').toUpperCase().trim() === DEBUG_PACIENTE) {
              dbgPrepared++;
              console.log('🔎 DEBUG PACIENTE - preparado', {
                EMPRESA: result.record.EMPRESA,
                ESTUDO_DESCRICAO: result.record.ESTUDO_DESCRICAO,
                DATA_LAUDO: result.record.DATA_LAUDO,
                MODALIDADE: result.record.MODALIDADE,
                PRIORIDADE: result.record.PRIORIDADE
              });
            }
          } else if (result.rejection) {
            // Registro rejeitado - capturar exclusão
            batchRejections.push(result.rejection);
            totalErrors++;
            
            if (nomeRaw === DEBUG_PACIENTE) {
              dbgSkippedSemEmpresaOuNome++;
              console.log(`⚠️ DEBUG PACIENTE - rejeitado: ${result.rejection.motivo_rejeicao} - ${result.rejection.detalhes_erro}`);
            }
            
            console.log(`🚫 Linha ${lineNumber} rejeitada: ${result.rejection.motivo_rejeicao}`);
          }
        } catch (rowError) {
          // Erro não capturado - criar registro de rejeição de emergência
          const emergencyRejection: RejectedRecord = {
            arquivo_fonte: arquivoFonte,
            lote_upload: loteUpload,
            linha_original: lineNumber,
            dados_originais: row,
            motivo_rejeicao: 'ERRO_NAO_CAPTURADO',
            detalhes_erro: `Erro não tratado: ${rowError instanceof Error ? rowError.message : 'Erro desconhecido'}`
          };
          
          batchRejections.push(emergencyRejection);
          totalErrors++;
          console.error(`❌ Erro não capturado na linha ${lineNumber}:`, rowError);
        }
      }

      // Adicionar rejeições do lote ao array principal
      rejectedRecords.push(...batchRejections);

      if (records.length === 0 && batchRejections.length === 0) {
        console.log(`⚠️ Lote ${batchNumber}: Sem registros para processar`);
        continue;
      }

      console.log(`✅ Lote ${batchNumber}: ${records.length} registros válidos, ${batchRejections.length} rejeitados`);

      // Inserir registros válidos (com background task para não bloquear)
      if (records.length > 0) {
        try {
          EdgeRuntime.waitUntil(
            supabaseClient
              .from('volumetria_mobilemed')
              .insert(records)
              .then(({ error }) => {
                if (error) {
                  console.error(`❌ Background insert error lote ${batchNumber}:`, error);
                } else {
                  console.log(`🚀 Background insert lote ${batchNumber}: ${records.length} registros`);
                }
              })
          );
          
          totalInserted += records.length;
          const insertedThisBatch = records.filter(r => (r.NOME_PACIENTE || '').toUpperCase().trim() === DEBUG_PACIENTE).length;
          if (insertedThisBatch > 0) {
            dbgInserted += insertedThisBatch;
            console.log(`🟢 DEBUG PACIENTE - preparado para inserção: ${insertedThisBatch}`);
          }
          console.log(`⚡ Lote ${batchNumber}: ${records.length} registros agendados para inserção`);
        } catch (insertException) {
          console.error(`❌ Exceção ao agendar lote ${batchNumber}:`, insertException);
          totalErrors += records.length;
        }
      }
      
      // Inserir registros rejeitados (AUDITORIA DE EXCLUSÕES)
      if (batchRejections.length > 0) {
        try {
          EdgeRuntime.waitUntil(
            supabaseClient
              .from('registros_rejeitados_processamento')
              .insert(batchRejections)
              .then(({ error }) => {
                if (error) {
                  console.error(`❌ Erro ao salvar rejeições lote ${batchNumber}:`, error);
                } else {
                  console.log(`📝 Lote ${batchNumber}: ${batchRejections.length} rejeições salvas para auditoria`);
                }
              })
          );
        } catch (rejectedException) {
          console.error(`❌ Exceção ao salvar rejeições lote ${batchNumber}:`, rejectedException);
        }
      }

      // Atualizar progresso
      const processedCount = Math.min(i + batchSize, jsonData.length);
      const progress = Math.min(Math.round((processedCount / jsonData.length) * 100), 100);
      
      console.log(`📈 Progresso: ${progress}% (${processedCount}/${jsonData.length}) - ${totalInserted} inseridos, ${totalErrors} rejeitados`);
    }

    console.log('✅ PROCESSAMENTO BÁSICO CONCLUÍDO!');
    console.log(`📊 Resultado: ${totalInserted} inseridos, ${totalErrors} rejeitados de ${jsonData.length} registros`);
    console.log(`📝 Total de exclusões capturadas para auditoria: ${rejectedRecords.length}`);

    // Salvar resumo das exclusões no log de upload
    const exclusoesResumo = rejectedRecords.reduce((acc, rejection) => {
      acc[rejection.motivo_rejeicao] = (acc[rejection.motivo_rejeicao] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('📋 Resumo das exclusões por motivo:', exclusoesResumo);

    // 🔧 APLICAR EXCLUSÕES POR PERÍODO
    if (periodo) {
      const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
                    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
      const nomesMes = meses[periodo.mes - 1] || 'janeiro';
      const periodoReferenciaExclusao = `${nomesMes}/${periodo.ano.toString().slice(-2)}`;
      
      console.log(`📅 Período para validação: ${periodoReferenciaExclusao}`);
      
      if (arquivo_fonte.includes('retroativo')) {
        // Para arquivos retroativos: aplicar exclusões completas por período
        console.log('🗑️ Aplicando exclusões por período (arquivos retroativos)...');
        try {
          const { data: exclusoesResult, error: exclusoesError } = await supabaseClient.functions.invoke('aplicar-exclusoes-periodo', {
            body: { periodo_referencia: periodoReferenciaExclusao }
          });
          
          if (exclusoesError) {
            console.warn('⚠️ Erro nas exclusões por período:', exclusoesError);
          } else if (exclusoesResult) {
            console.log('✅ Exclusões aplicadas:', exclusoesResult);
            const registrosExcluidos = exclusoesResult.total_deletados || exclusoesResult.total_excluidos || 0;
            totalInserted = Math.max(0, totalInserted - registrosExcluidos);
          }
        } catch (exclusoesException) {
          console.warn('⚠️ Exceção nas exclusões:', exclusoesException);
        }
      } else {
        // Para arquivos não-retroativos: aplicar apenas filtro de DATA_LAUDO
        console.log('🗑️ Aplicando filtro de DATA_LAUDO (arquivos não-retroativos)...');
        try {
          const { data: filtroResult, error: filtroError } = await supabaseClient.functions.invoke('aplicar-filtro-data-laudo', {
            body: { periodo_referencia: periodoReferenciaExclusao }
          });
          
          if (filtroError) {
            console.warn('⚠️ Erro no filtro de DATA_LAUDO:', filtroError);
          } else if (filtroResult) {
            console.log('✅ Filtro de DATA_LAUDO aplicado:', filtroResult);
            const registrosExcluidos = filtroResult.total_excluidos || 0;
            totalInserted = Math.max(0, totalInserted - registrosExcluidos);
          }
        } catch (filtroException) {
          console.warn('⚠️ Exceção no filtro de DATA_LAUDO:', filtroException);
        }
      }
    }

    // 🔧 APLICAR REGRAS DE TRATAMENTO (para todos os arquivos)
    if (totalInserted > 0) {
      console.log('⚙️ Aplicando regras de tratamento...');
      try {
        const { data: regrasResult, error: regrasError } = await supabaseClient.functions.invoke('aplicar-regras-tratamento', {
          body: { lote_upload: loteUpload }
        });
        
        if (regrasError) {
          console.warn('⚠️ Erro ao aplicar regras:', regrasError);
        } else if (regrasResult) {
          console.log('✅ Regras aplicadas:', regrasResult);
        }
      } catch (regrasException) {
        console.warn('⚠️ Exceção ao aplicar regras:', regrasException);
      }
    }

    // 🔧 APLICAR CORREÇÃO DE MODALIDADE (Regra v030: DX→RX, CR→RX, mamografia→MG)
    if (totalInserted > 0) {
      console.log('🔧 Aplicando correção de modalidade DX/CR → RX...');
      try {
        const { data: correcaoResult, error: correcaoError } = await supabaseClient.functions.invoke('aplicar-correcao-modalidade-rx', {
          body: { arquivo_fonte: arquivo_fonte }
        });
        
        if (correcaoError) {
          console.warn('⚠️ Erro na correção de modalidade:', correcaoError);
        } else if (correcaoResult) {
          console.log('✅ Correção de modalidade aplicada:', correcaoResult);
          // resultado.alertas.push(`Correção modalidade: ${correcaoResult.registros_corrigidos_rx} → RX, ${correcaoResult.registros_corrigidos_mg} → MG`);
        }
      } catch (correcaoException) {
        console.warn('⚠️ Exceção na correção de modalidade:', correcaoException);
      }
    }

    // 🏷️ APLICAR TIPIFICAÇÃO DE FATURAMENTO (Regras F005/F006)
    if (totalInserted > 0) {
      console.log('🏷️ Aplicando tipificação de faturamento...');
      try {
        const { data: tipificacaoResult, error: tipificacaoError } = await supabaseClient.functions.invoke('aplicar-tipificacao-faturamento', {
          body: { 
            arquivo_fonte: arquivo_fonte,
            lote_upload: loteUpload 
          }
        });
        
        if (tipificacaoError) {
          console.warn('⚠️ Erro ao aplicar tipificação:', tipificacaoError);
        } else if (tipificacaoResult) {
          console.log('✅ Tipificação aplicada:', tipificacaoResult);
        }
      } catch (tipificacaoException) {
        console.warn('⚠️ Exceção ao aplicar tipificação:', tipificacaoException);
      }
    }

    // 🔍 APLICAR VALIDAÇÃO DE CLIENTE (Nova etapa obrigatória)
    if (totalInserted > 0) {
      console.log('🔍 Aplicando validação de cliente e definindo tipo de faturamento...');
      try {
        const { data: validacaoResult, error: validacaoError } = await supabaseClient.functions.invoke('aplicar-validacao-cliente', {
          body: { lote_upload: loteUpload }
        });
        
        if (validacaoError) {
          console.warn('⚠️ Erro na validação de cliente:', validacaoError);
          console.warn('⚠️ Erro na validação de cliente:', validacaoError);
        } else if (validacaoResult) {
          console.log('✅ Validação de cliente aplicada:', validacaoResult);
          // resultado.alertas.push(`Validação: ${validacaoResult.registros_atualizados} clientes validados, ${validacaoResult.registros_sem_cliente} sem cadastro`);
          if (validacaoResult.clientes_nao_encontrados && validacaoResult.clientes_nao_encontrados.length > 0) {
            // resultado.alertas.push(`Clientes não encontrados: ${validacaoResult.clientes_nao_encontrados.slice(0, 5).join(', ')}${validacaoResult.clientes_nao_encontrados.length > 5 ? '...' : ''}`);
            console.log(`🔍 Clientes não encontrados: ${validacaoResult.clientes_nao_encontrados.slice(0, 5).join(', ')}${validacaoResult.clientes_nao_encontrados.length > 5 ? '...' : ''}`);
          }
        }
      } catch (validacaoException) {
        console.warn('⚠️ Exceção na validação de cliente:', validacaoException);
        console.warn('⚠️ Exceção na validação de cliente:', validacaoException);
      }
    }

    // Finalizar log
    await supabaseClient
      .from('processamento_uploads')
      .update({
        status: totalInserted > 0 ? 'concluido' : 'erro',
        registros_processados: jsonData.length,
        registros_inseridos: totalInserted,
        registros_erro: totalErrors,
        detalhes_erro: JSON.stringify({
          status: totalInserted > 0 ? 'Processamento Concluído' : 'Erro no Processamento',
          total_processado: jsonData.length,
          total_inserido: totalInserted,
          total_erros: totalErrors,
          regras_aplicadas: 0,
          lote_upload: loteUpload,
          exclusoes_capturadas: rejectedRecords.length,
          exclusoes_por_motivo: exclusoesResumo,
          debug_paciente: {
            nome: DEBUG_PACIENTE,
            encontrados_no_arquivo: dbgFoundInFile,
            preparados_para_insercao: dbgPrepared,
            inseridos: dbgInserted,
            descartados_por_campos_obrigatorios: dbgSkippedSemEmpresaOuNome,
            descartados_por_corte_data_laudo: 0
          }
        })
      })
      .eq('id', uploadLog.id);

    console.log('🎯 PROCESSAMENTO FINALIZADO!');

    // PROCESSAMENTO EM BACKGROUND: Aplicar regras após upload sem travar
    const backgroundProcessing = async () => {
      try {
        console.log('🔄 INICIANDO PROCESSAMENTO EM BACKGROUND...');
        
        // Aguardar um pouco para garantir que dados foram inseridos
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Aplicar apenas regras seguras que não excluem registros
        const regras = [
          // 'aplicar-exclusao-clientes-especificos', // DESABILITADO: Pode excluir registros válidos
          // 'aplicar-exclusoes-periodo', // DESABILITADO: Exclusões por período muito restritivas
          // 'aplicar-filtro-data-laudo', // DESABILITADO: Duplica exclusões por data
          // 'aplicar-regras-tratamento', // DESABILITADO: Pode excluir registros
          'aplicar-correcao-modalidade-rx', // MANTER: Apenas corrige modalidades
          'aplicar-tipificacao-faturamento', // MANTER: Apenas classifica tipo faturamento
          // 'aplicar-validacao-cliente', // DESABILITADO: Pode excluir registros
          'aplicar-regras-quebra-exames' // MANTER: Apenas quebra exames em múltiplos
        ];
        
        for (const regra of regras) {
          try {
            console.log(`🔧 Aplicando regra: ${regra}`);
            
            // Converter período se necessário para regras que precisam
            let body = { arquivo_fonte };
            if ((regra === 'aplicar-exclusoes-periodo' || regra === 'aplicar-filtro-data-laudo') && periodo) {
              const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
              const periodoReferencia = `${meses[periodo.mes - 1]}/${periodo.ano.toString().slice(-2)}`;
              body = { arquivo_fonte, periodo_referencia: periodoReferencia };
              console.log(`📅 Período convertido: ${periodoReferencia}`);
            }
            
            const { data, error } = await supabaseClient.functions.invoke(regra, { body });
            
            if (error) {
              console.error(`❌ Erro na regra ${regra}:`, error);
            } else {
              console.log(`✅ Regra ${regra} aplicada com sucesso`);
            }
          } catch (err) {
            console.error(`💥 Falha crítica na regra ${regra}:`, err);
          }
        }
        
        // Atualizar log com processamento concluído
        await supabaseClient
          .from('processamento_uploads')
          .update({
            detalhes_erro: JSON.stringify({
              status: 'Concluído com regras aplicadas',
              regras_aplicadas: regras,
              processamento_background: true
            })
          })
          .eq('id', uploadLog.id);
          
        console.log('🎉 PROCESSAMENTO EM BACKGROUND CONCLUÍDO!');
        
      } catch (backgroundError) {
        console.error('💥 ERRO NO PROCESSAMENTO EM BACKGROUND:', backgroundError);
      }
    };
    
    // Iniciar processamento em background SEM aguardar
    EdgeRuntime.waitUntil(backgroundProcessing());

    return new Response(JSON.stringify({
      success: true,
      total_registros: jsonData.length,
      registros_inseridos: totalInserted,
      registros_erro: totalErrors,
      upload_id: uploadLog.id,
      background_processing: true,
      message: 'Upload concluído! Regras sendo aplicadas em background...'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 ERRO CRÍTICO:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Erro interno do servidor',
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});