// Utilitários para processamento de volumetria MobileMed

export interface VolumetriaRecord {
  // Campos exatos do arquivo - sem mapeamento necessário
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
  arquivo_fonte: 'volumetria_padrao' | 'volumetria_fora_padrao' | 'volumetria_padrao_retroativo' | 'volumetria_fora_padrao_retroativo';
}

// Configuração dos tipos de upload
export const VOLUMETRIA_UPLOAD_CONFIGS = {
  volumetria_padrao: {
    label: 'Arquivo 1: Volumetria Padrão',
    description: 'Upload para dados do período atual - valores obrigatórios',
    validateValues: true,
    filterCurrentPeriod: false,
    appropriateValues: false
  },
  volumetria_fora_padrao: {
    label: 'Arquivo 2: Volumetria Fora do Padrão',
    description: 'Upload com apropriação de valores - valores serão calculados',
    validateValues: true,
    filterCurrentPeriod: false,
    appropriateValues: true
  },
  volumetria_padrao_retroativo: {
    label: 'Arquivo 3: Volumetria Padrão Retroativo',
    description: 'Upload retroativo excluindo período atual - valores obrigatórios',
    validateValues: true,
    filterCurrentPeriod: true,
    appropriateValues: false
  },
  volumetria_fora_padrao_retroativo: {
    label: 'Arquivo 4: Volumetria Fora do Padrão Retroativo',
    description: 'Upload retroativo com apropriação - valores serão calculados',
    validateValues: true,
    filterCurrentPeriod: true,
    appropriateValues: true
  }
} as const;

// Função para converter data do formato brasileiro (dd/mm/aa ou dd/mm/aaaa)
export function convertBrazilianDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  try {
    // Remove espaços e caracteres especiais
    const cleanDate = dateStr.trim();
    
    // Formatos aceitos: dd/mm/aa, dd/mm/aaaa, dd-mm-aa, dd-mm-aaaa
    const dateRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/;
    const match = cleanDate.match(dateRegex);
    
    if (!match) {
      console.warn(`Formato de data inválido: ${dateStr}`);
      return null;
    }
    
    let [, day, month, year] = match;
    
    // Converte ano de 2 dígitos para 4 dígitos
    if (year.length === 2) {
      const currentYear = new Date().getFullYear();
      const currentCentury = Math.floor(currentYear / 100) * 100;
      year = String(currentCentury + parseInt(year));
    }
    
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    // Valida se a data é válida
    if (isNaN(date.getTime())) {
      console.warn(`Data inválida: ${dateStr}`);
      return null;
    }
    
    return date;
  } catch (error) {
    console.warn(`Erro ao converter data: ${dateStr}`, error);
    return null;
  }
}

// Função para converter hora (hh:mm:ss ou hh:mm)
export function convertTime(timeStr: string): string | null {
  if (!timeStr || timeStr.trim() === '') return null;
  
  try {
    const cleanTime = timeStr.trim();
    
    // Formatos aceitos: hh:mm:ss, hh:mm
    const timeRegex = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/;
    const match = cleanTime.match(timeRegex);
    
    if (!match) {
      console.warn(`Formato de hora inválido: ${timeStr}`);
      return null;
    }
    
    const [, hours, minutes, seconds = '00'] = match;
    
    // Valida se os valores são válidos
    const h = parseInt(hours);
    const m = parseInt(minutes);
    const s = parseInt(seconds);
    
    if (h > 23 || m > 59 || s > 59) {
      console.warn(`Hora inválida: ${timeStr}`);
      return null;
    }
    
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
  } catch (error) {
    console.warn(`Erro ao converter hora: ${timeStr}`, error);
    return null;
  }
}

// Função para converter valores (parte inteira apenas)
export function convertValues(valueStr: string | number): number | null {
  if (valueStr === null || valueStr === undefined || valueStr === '') return null;
  
  try {
    const numValue = typeof valueStr === 'string' ? parseFloat(valueStr) : valueStr;
    
    if (isNaN(numValue)) {
      console.warn(`Valor numérico inválido: ${valueStr}`);
      return null;
    }
    
    // Retorna apenas a parte inteira
    return Math.floor(numValue);
  } catch (error) {
    console.warn(`Erro ao converter valor: ${valueStr}`, error);
    return null;
  }
}

// Função para verificar se uma data está no período atual de faturamento
export function isInCurrentBillingPeriod(dataRealizacao: Date): boolean {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth(); // 0-11
  
  // Período atual: dia 8 do mês anterior até dia 7 do mês atual
  const inicioPeriodo = new Date(ano, mes - 1, 8);
  const fimPeriodo = new Date(ano, mes, 7);
  
  return dataRealizacao >= inicioPeriodo && dataRealizacao <= fimPeriodo;
}

// Função para apropriar valores baseado no tipo de exame
export function appropriateExamValue(record: VolumetriaRecord): number {
  // Lógica de apropriação de valores - será expandida conforme necessário
  const modalidade = record.MODALIDADE?.toLowerCase() || '';
  const especialidade = record.ESPECIALIDADE?.toLowerCase() || '';
  
  // Valores padrão por tipo (será configurável no futuro)
  if (modalidade.includes('raio')) return 1;
  if (modalidade.includes('tomografia')) return 2;
  if (modalidade.includes('ressonancia')) return 3;
  if (modalidade.includes('ultrassom')) return 1;
  if (modalidade.includes('mamografia')) return 1;
  
  // Valor padrão
  return 1;
}

// Função para processar uma linha do Excel
export function processRow(
  row: any, 
  arquivoFonte: 'volumetria_padrao' | 'volumetria_fora_padrao' | 'volumetria_padrao_retroativo' | 'volumetria_fora_padrao_retroativo'
): VolumetriaRecord | null {
  try {
    // Validação robusta de entrada
    if (!row || typeof row !== 'object') {
      console.warn('Linha inválida: objeto row não definido ou inválido');
      return null;
    }

    // Campos obrigatórios com validação null-safe
    const empresa = row['EMPRESA'];
    const nomePaciente = row['NOME_PACIENTE'];
    
    if (!empresa || !nomePaciente || 
        typeof empresa !== 'string' && typeof empresa !== 'number' ||
        typeof nomePaciente !== 'string' && typeof nomePaciente !== 'number') {
      console.warn('Linha ignorada: EMPRESA e NOME_PACIENTE são obrigatórios e devem ser válidos');
      return null;
    }

    // Função helper para conversão segura de string
    const safeString = (value: any): string | undefined => {
      if (value === null || value === undefined || value === '') return undefined;
      return String(value).trim() || undefined;
    };

    const record: VolumetriaRecord = {
      // Campos obrigatórios - conversão segura
      EMPRESA: String(empresa).trim(),
      NOME_PACIENTE: String(nomePaciente).trim(),
      arquivo_fonte: arquivoFonte,
      
      // Campos opcionais de texto - conversão null-safe
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
      
      // Campos numéricos - conversão null-safe
      VALORES: row['VALORES'] ? convertValues(row['VALORES']) : undefined,
      IMAGENS_CHAVES: row['IMAGENS_CHAVES'] ? convertValues(row['IMAGENS_CHAVES']) : undefined,
      IMAGENS_CAPTURADAS: row['IMAGENS_CAPTURADAS'] ? convertValues(row['IMAGENS_CAPTURADAS']) : undefined,
      CODIGO_INTERNO: row['CODIGO_INTERNO'] ? convertValues(row['CODIGO_INTERNO']) : undefined,
      
      // Campos de data - conversão null-safe
      DATA_REALIZACAO: row['DATA_REALIZACAO'] ? convertBrazilianDate(String(row['DATA_REALIZACAO'])) : undefined,
      DATA_TRANSFERENCIA: row['DATA_TRANSFERENCIA'] ? convertBrazilianDate(String(row['DATA_TRANSFERENCIA'])) : undefined,
      DATA_LAUDO: row['DATA_LAUDO'] ? convertBrazilianDate(String(row['DATA_LAUDO'])) : undefined,
      DATA_PRAZO: row['DATA_PRAZO'] ? convertBrazilianDate(String(row['DATA_PRAZO'])) : undefined,
      DATA_REASSINATURA: row['DATA_REASSINATURA'] ? convertBrazilianDate(String(row['DATA_REASSINATURA'])) : undefined,
      
      // Campos de hora - conversão null-safe
      HORA_REALIZACAO: row['HORA_REALIZACAO'] ? convertTime(String(row['HORA_REALIZACAO'])) : undefined,
      HORA_TRANSFERENCIA: row['HORA_TRANSFERENCIA'] ? convertTime(String(row['HORA_TRANSFERENCIA'])) : undefined,
      HORA_LAUDO: row['HORA_LAUDO'] ? convertTime(String(row['HORA_LAUDO'])) : undefined,
      HORA_PRAZO: row['HORA_PRAZO'] ? convertTime(String(row['HORA_PRAZO'])) : undefined,
      HORA_REASSINATURA: row['HORA_REASSINATURA'] ? convertTime(String(row['HORA_REASSINATURA'])) : undefined,
    };

    return record;
  } catch (error) {
    console.error('Erro ao processar linha:', error);
    return null;
  }
}

// Função para processar arquivo Excel no frontend
export async function processVolumetriaFile(
  file: File, 
  arquivoFonte: 'volumetria_padrao' | 'volumetria_fora_padrao' | 'volumetria_padrao_retroativo' | 'volumetria_fora_padrao_retroativo',
  onProgress?: (processed: number, total: number, inserted: number) => void
): Promise<{ success: boolean; totalProcessed: number; totalInserted: number; errors: string[] }> {
  
  // Importação dinâmica do XLSX
  const XLSX = await import('xlsx');
  const { supabase } = await import('@/integrations/supabase/client');
  
  try {
    // Ler arquivo
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    
    if (!workbook.SheetNames.length) {
      throw new Error('Arquivo Excel não possui planilhas');
    }

    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    if (jsonData.length === 0) {
      throw new Error('Arquivo Excel está vazio');
    }

    console.log(`Iniciando processamento de ${jsonData.length} linhas`);

    const errors: string[] = [];
    let totalInserted = 0;
    const batchSize = 100;
    const config = VOLUMETRIA_UPLOAD_CONFIGS[arquivoFonte];

    // Processar em lotes
    for (let i = 0; i < jsonData.length; i += batchSize) {
      const batch = jsonData.slice(i, i + batchSize);
      const processedRecords: any[] = [];

      // Processar lote
      for (let j = 0; j < batch.length; j++) {
        const row = batch[j];
        const record = processRow(row, arquivoFonte);
        
        if (!record) {
          errors.push(`Linha ${i + j + 2}: Dados inválidos ou incompletos`);
          continue;
        }

        // Filtrar período atual para arquivos retroativos
        if (config.filterCurrentPeriod && record.DATA_REALIZACAO) {
          if (isInCurrentBillingPeriod(record.DATA_REALIZACAO)) {
            console.log(`Linha ${i + j + 2}: Excluída por estar no período atual`);
            continue;
          }
        }

        // Validar valores obrigatórios
        if (config.validateValues) {
          let valorFinal = record.VALORES || 0;
          
          // Apropriar valores se necessário
          if (config.appropriateValues && (!record.VALORES || record.VALORES === 0)) {
            valorFinal = appropriateExamValue(record);
            record.VALORES = valorFinal;
          }
          
          // Validar se valor não é zero
          if (valorFinal === 0) {
            errors.push(`Linha ${i + j + 2}: Campo "VALORES" não pode ser zero`);
            continue;
          }
        }

        processedRecords.push(record);
      }

      // Inserir lote no banco
      if (processedRecords.length > 0) {
        const { error: insertError } = await supabase
          .from('volumetria_mobilemed')
          .insert(processedRecords);

        if (insertError) {
          console.error('Erro ao inserir lote:', insertError);
          errors.push(`Erro ao inserir lote ${Math.floor(i / batchSize) + 1}: ${insertError.message}`);
        } else {
          totalInserted += processedRecords.length;
        }
      }

      // Atualizar progresso
      const processed = Math.min(i + batchSize, jsonData.length);
      onProgress?.(processed, jsonData.length, totalInserted);

      // Pequena pausa para não bloquear a UI
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    return {
      success: true,
      totalProcessed: jsonData.length,
      totalInserted,
      errors
    };

  } catch (error) {
    console.error('Erro no processamento:', error);
    return {
      success: false,
      totalProcessed: 0,
      totalInserted: 0,
      errors: [error instanceof Error ? error.message : 'Erro desconhecido']
    };
  }
}