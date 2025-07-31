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
  arquivo_fonte: 'volumetria_padrao' | 'volumetria_fora_padrao' | 'volumetria_padrao_retroativo' | 'volumetria_fora_padrao_retroativo' | 'volumetria_onco_padrao';
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
  },
  volumetria_onco_padrao: {
    label: 'Arquivo 5: Volumetria Onco Padrão',
    description: 'Upload para dados oncológicos - valores obrigatórios para faturamento',
    validateValues: true,
    filterCurrentPeriod: false,
    appropriateValues: false
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

// Função para verificar se uma data está no período de faturamento especificado
export function isInBillingPeriod(dataRealizacao: Date, periodoFaturamento: { ano: number; mes: number }): boolean {
  // Período de faturamento selecionado: dia 8 do mês selecionado até dia 7 do mês seguinte
  // Exemplo: junho/2025 → período de 08/06/2025 a 07/07/2025
  const { ano, mes } = periodoFaturamento;
  
  // Calcular o mês seguinte
  const anoSeguinte = mes === 12 ? ano + 1 : ano;
  const mesSeguinte = mes === 12 ? 1 : mes + 1;
  
  // Período de exclusão: dia 8 do mês selecionado até dia 7 do mês seguinte
  const inicioPeriodo = new Date(ano, mes - 1, 8); // mes - 1 porque Date usa 0-11
  const fimPeriodo = new Date(anoSeguinte, mesSeguinte - 1, 7);
  
  return dataRealizacao >= inicioPeriodo && dataRealizacao <= fimPeriodo;
}

// Função para calcular a data limite de corte para faturamento (dia 7 do mês seguinte)
export function getDataLimiteCorte(periodoFaturamento: { ano: number; mes: number }): Date {
  const { ano, mes } = periodoFaturamento;
  
  // Calcular o mês seguinte
  const anoSeguinte = mes === 12 ? ano + 1 : ano;
  const mesSeguinte = mes === 12 ? 1 : mes + 1;
  
  // Data limite: dia 7 do mês seguinte ao período de faturamento
  // Exemplo: para faturamento de junho/2025, a data limite é 07/07/2025
  return new Date(anoSeguinte, mesSeguinte - 1, 7); // mes - 1 porque Date usa 0-11
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
  arquivoFonte: 'volumetria_padrao' | 'volumetria_fora_padrao' | 'volumetria_padrao_retroativo' | 'volumetria_fora_padrao_retroativo' | 'volumetria_onco_padrao'
): VolumetriaRecord | null {
  try {
    // Validação robusta de entrada
    if (!row || typeof row !== 'object') {
      console.warn('Linha inválida: objeto row não definido ou inválido');
      return null;
    }

    // Obter configuração do arquivo
    const config = VOLUMETRIA_UPLOAD_CONFIGS[arquivoFonte];

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
      
      // Campos numéricos - conversão null-safe com apropriação para arquivos fora padrão
      VALORES: row['VALORES'] ? (config.appropriateValues ? appropriateExamValue({
        MODALIDADE: safeString(row['MODALIDADE']),
        ESPECIALIDADE: safeString(row['ESPECIALIDADE']),
        EMPRESA: String(empresa).trim(),
        NOME_PACIENTE: String(nomePaciente).trim(),
        arquivo_fonte: arquivoFonte
      } as VolumetriaRecord) : convertValues(row['VALORES'])) : undefined,
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

// Função para processar arquivo Excel utilizando edge function existente com validação robusta
export async function processVolumetriaFile(
  file: File, 
  arquivoFonte: 'volumetria_padrao' | 'volumetria_fora_padrao' | 'volumetria_padrao_retroativo' | 'volumetria_fora_padrao_retroativo' | 'volumetria_onco_padrao',
  onProgress?: (processed: number, total: number, inserted: number) => void,
  periodoFaturamento?: { ano: number; mes: number }
): Promise<{ success: boolean; totalProcessed: number; totalInserted: number; errors: string[]; limitedProcessing?: boolean; filePath?: string }> {
  
  const { supabase } = await import('@/integrations/supabase/client');
  
  try {
    console.log('=== INICIANDO PROCESSAMENTO ROBUSTO ===');
    console.log('Arquivo:', file.name);
    console.log('Fonte:', arquivoFonte);
    console.log('Período:', periodoFaturamento);
    
    // Determinar o arquivo_fonte para a edge function - agora enviando o tipo exato
    const edgeFunctionSource = arquivoFonte; // Enviar o tipo exato sem mapeamento
    
    console.log(`📁 Tipo de arquivo enviado: ${edgeFunctionSource}`);

    // Upload do arquivo para o storage
    const timestamp = Date.now();
    const fileName = `${arquivoFonte}_${timestamp}_${file.name}`;
    const filePath = `uploads/${fileName}`;

    console.log('Uploading arquivo para storage:', filePath);
    
    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Erro ao fazer upload: ${uploadError.message}`);
    }

    console.log('Arquivo enviado com sucesso, iniciando processamento...');

    // Chamar a edge function existente de processamento
    const { data, error } = await supabase.functions.invoke('processar-volumetria-mobilemed', {
      body: { 
        file_path: filePath,
        arquivo_fonte: edgeFunctionSource
      }
    });

    if (error) {
      // Limpar arquivo temporário do storage em caso de erro
      try {
        await supabase.storage.from('uploads').remove([filePath]);
      } catch (cleanupError) {
        console.warn('Erro ao limpar arquivo temporário após erro:', cleanupError);
      }
      throw new Error(`Erro na edge function: ${error.message}`);
    }

    console.log('Edge function iniciada:', data);

    // Monitorar progresso via polling do log de upload
    const uploadLogId = data.upload_log_id;
    let finalStatus = null;
    let attempts = 0;
    const maxAttempts = 120; // 2 minutos máximo
    
    console.log('Monitorando progresso do upload log:', uploadLogId);

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Aguardar 1 segundo
      
      const { data: statusData, error: statusError } = await supabase
        .from('processamento_uploads')
        .select('*')
        .eq('id', uploadLogId)
        .single();

      if (statusError) {
        console.error('Erro ao buscar status:', statusError);
        break;
      }

      if (statusData) {
        const progress = statusData.registros_processados || 0;
        const inserted = statusData.registros_inseridos || 0;
        
        // Estimar total baseado no progresso (se disponível)
        const estimatedTotal = progress > 0 ? progress : 50000; // Fallback aumentado para grandes volumes
        
        // Atualizar progresso na UI
        onProgress?.(progress, estimatedTotal, inserted);
        
        // Verificar se terminou
        if (statusData.status === 'concluido' || statusData.status === 'erro') {
          finalStatus = statusData;
          break;
        }
      }
      
      attempts++;
    }

    // Limpar arquivo temporário do storage
    try {
      await supabase.storage.from('uploads').remove([filePath]);
    } catch (cleanupError) {
      console.warn('Erro ao limpar arquivo temporário:', cleanupError);
    }

    if (!finalStatus) {
      throw new Error('Timeout no processamento - não foi possível obter o status final');
    }

    if (finalStatus.status === 'erro') {
      const errorMessage = finalStatus.erro_detalhes || 'Erro desconhecido no processamento';
      throw new Error(errorMessage);
    }

    // Verificar se existem registros com erro
    const errors: string[] = [];
    if (finalStatus.registros_erro > 0) {
      // Buscar registros de erro específicos
      const { data: errorRecords, error: errorFetchError } = await supabase
        .from('volumetria_erros')
        .select('*')
        .eq('arquivo_fonte', edgeFunctionSource)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!errorFetchError && errorRecords) {
        for (const errorRecord of errorRecords) {
          errors.push(`${errorRecord.empresa} - ${errorRecord.nome_paciente}: ${errorRecord.erro_detalhes}`);
        }
      }
      
      errors.push(`⚠️ ATENÇÃO: ${finalStatus.registros_erro} registros com erros foram salvos na tabela de erros para correção.`);
    }

    console.log('=== PROCESSAMENTO COMPLETO FINALIZADO ===');
    console.log(`Registros processados: ${finalStatus.registros_processados}`);
    console.log(`Registros inseridos: ${finalStatus.registros_inseridos}`);
    console.log(`Registros com erro: ${finalStatus.registros_erro}`);

    return {
      success: true,
      totalProcessed: finalStatus.registros_processados || 0,
      totalInserted: finalStatus.registros_inseridos || 0,
      errors,
      limitedProcessing: finalStatus.limited_processing || false,
      filePath: filePath // Usar o filePath real do arquivo uploadado
    };

  } catch (error) {
    console.error('Erro no processamento completo:', error);
    
    return {
      success: false,
      totalProcessed: 0,
      totalInserted: 0,
      errors: [error instanceof Error ? error.message : 'Erro desconhecido'],
      limitedProcessing: false
    };
  }
}