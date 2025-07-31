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

// Função para processar arquivo Excel utilizando nova arquitetura de streaming
export async function processVolumetriaFile(
  file: File, 
  arquivoFonte: 'volumetria_padrao' | 'volumetria_fora_padrao' | 'volumetria_padrao_retroativo' | 'volumetria_fora_padrao_retroativo' | 'volumetria_onco_padrao',
  onProgress?: (data: { progress: number; processed: number; total: number; status: string }) => void,
  periodoFaturamento?: { ano: number; mes: number }
): Promise<{ success: boolean; totalProcessed: number; totalInserted: number; message: string; uploadLogId?: string }> {
  
  const { supabase } = await import('@/integrations/supabase/client');
  
  try {
    console.log('=== INICIANDO PROCESSAMENTO STREAMING ===');
    console.log('Arquivo:', file.name);
    console.log('Fonte:', arquivoFonte);
    console.log('Período:', periodoFaturamento);

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

    // Chamar a nova edge function de processamento streaming
    const { data, error } = await supabase.functions.invoke('processar-volumetria-streaming', {
      body: { 
        file_path: filePath,
        arquivo_fonte: arquivoFonte,
        periodo: periodoFaturamento
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

    console.log('Edge function streaming iniciada:', data);

    // Se não está completo, continuar processamento
    if (data && !data.completed && data.continue_processing) {
      console.log('🔄 Continuando processamento em batches...');
      
      let currentState = data.state;
      let attempts = 0;
      const maxAttempts = 200; // Máximo de batches para evitar loop infinito
      
      while (!currentState.isComplete && attempts < maxAttempts) {
        attempts++;
        console.log(`📦 Processando batch ${attempts}...`);
        
        // Aguardar um pouco entre batches para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
          const { data: continueData, error: continueError } = await supabase.functions.invoke('processar-volumetria-streaming', {
            body: {
              continue_processing: true,
              state: currentState
            }
          });

          if (continueError) {
            console.error('Erro ao continuar processamento:', continueError);
            break;
          }

          if (continueData.completed) {
            console.log('✅ Processamento completo!', continueData.stats);
            return {
              success: true,
              uploadLogId: currentState.upload_log_id,
              totalProcessed: continueData.stats.processed_rows,
              totalInserted: continueData.stats.inserted_count,
              message: 'Arquivo processado completamente via streaming'
            };
          }

          currentState = continueData.state;
          console.log(`📊 Progresso: ${continueData.stats.progress}`);
          
          // Callback de progresso se fornecido
          if (onProgress) {
            onProgress({
              progress: parseInt(continueData.stats.progress.replace('%', '')),
              processed: continueData.stats.processed_rows,
              total: continueData.stats.total_rows,
              status: 'Processando via streaming...'
            });
          }
          
        } catch (err) {
          console.error('Erro no batch:', err);
          break;
        }
      }
      
      if (attempts >= maxAttempts) {
        throw new Error('Processamento interrompido: muitos batches');
      }
    }

    return {
      success: true,
      uploadLogId: data.upload_log_id || data.state?.upload_log_id,
      totalProcessed: data.stats?.processed_rows || 0,
      totalInserted: data.stats?.inserted_count || 0,
      message: data.message || 'Processamento iniciado'
    };

  } catch (error) {
    console.error('Erro no processamento completo:', error);
    
    return {
      success: false,
      totalProcessed: 0,
      totalInserted: 0,
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}