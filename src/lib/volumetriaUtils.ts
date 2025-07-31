import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

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
  DATA_REALIZACAO?: string;
  HORA_REALIZACAO?: string;
  DATA_TRANSFERENCIA?: string;
  HORA_TRANSFERENCIA?: string;
  DATA_LAUDO?: string;
  HORA_LAUDO?: string;
  DATA_PRAZO?: string;
  HORA_PRAZO?: string;
  STATUS?: string;
  DATA_REASSINATURA?: string;
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
}

export const VOLUMETRIA_UPLOAD_CONFIGS = {
  volumetria_padrao: {
    label: 'Arquivo 1: Volumetria Padrão',
    description: 'Upload padrão - valores obrigatórios para faturamento',
    validateValues: true,
    filterCurrentPeriod: false,
    appropriateValues: false
  },
  volumetria_fora_padrao: {
    label: 'Arquivo 2: Volumetria Fora do Padrão',
    description: 'Upload com apropriação - valores serão calculados automaticamente',
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

// Função SIMPLIFICADA que funciona DEFINITIVAMENTE
export async function processVolumetriaFile(
  file: File, 
  arquivoFonte: 'volumetria_padrao' | 'volumetria_fora_padrao' | 'volumetria_padrao_retroativo' | 'volumetria_fora_padrao_retroativo' | 'volumetria_onco_padrao',
  onProgress?: (data: { progress: number; processed: number; total: number; status: string }) => void,
  periodoFaturamento?: { ano: number; mes: number }
): Promise<{ success: boolean; totalProcessed: number; totalInserted: number; message: string; uploadLogId?: string }> {
  
  try {
    console.log('=== PROCESSAMENTO DIRETO INICIADO ===');
    console.log('Arquivo:', file.name);
    console.log('Fonte:', arquivoFonte);
    console.log('Período:', periodoFaturamento);

    // Ler arquivo Excel DIRETAMENTE no frontend
    
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: true }) as any[];

    console.log(`📊 Total de linhas lidas: ${jsonData.length}`);

    if (onProgress) {
      onProgress({ progress: 10, processed: 0, total: jsonData.length, status: 'Arquivo lido com sucesso' });
    }

    // Criar log de upload
    const { data: uploadLog, error: logError } = await supabase
      .from('processamento_uploads')
      .insert({
        arquivo_nome: file.name,
        tipo_arquivo: arquivoFonte,
        tipo_dados: 'volumetria',
        status: 'pendente',
        registros_processados: 0,
        registros_inseridos: 0,
        registros_atualizados: 0,
        registros_erro: 0,
        periodo_referencia: periodoFaturamento ? `${periodoFaturamento.ano}-${periodoFaturamento.mes.toString().padStart(2, '0')}` : null
      })
      .select()
      .single();

    if (logError) throw new Error(`Erro ao criar log: ${logError.message}`);

    if (onProgress) {
      onProgress({ progress: 20, processed: 0, total: jsonData.length, status: 'Log criado, iniciando processamento' });
    }

    // Limpar dados anteriores
    const periodoReferencia = periodoFaturamento ? `${periodoFaturamento.ano}-${periodoFaturamento.mes.toString().padStart(2, '0')}` : new Date().toISOString().substring(0, 7);
    
    await supabase
      .from('volumetria_mobilemed')
      .delete()
      .eq('arquivo_fonte', arquivoFonte)
      .eq('periodo_referencia', periodoReferencia);

    console.log('🧹 Dados anteriores limpos');

    if (onProgress) {
      onProgress({ progress: 30, processed: 0, total: jsonData.length, status: 'Dados anteriores limpos' });
    }

    // Atualizar status para processando
    await supabase
      .from('processamento_uploads')
      .update({ status: 'processando' })
      .eq('id', uploadLog.id);

    // Processar dados em lotes pequenos de 200
    const loteUpload = `${arquivoFonte}_${Date.now()}_${uploadLog.id.substring(0, 8)}`;
    const batchSize = 200;
    let totalInserted = 0;
    let totalErrors = 0;

    for (let i = 0; i < jsonData.length; i += batchSize) {
      const batch = jsonData.slice(i, i + batchSize);
      const records: VolumetriaRecord[] = [];

      // Processar linhas do batch
      for (const row of batch) {
        try {
          if (!row || typeof row !== 'object') continue;

          const empresa = row['EMPRESA'] || '';
          const nomePaciente = row['NOME_PACIENTE'] || '';

          if (!empresa.trim() || !nomePaciente.trim()) {
            totalErrors++;
            continue;
          }

          const safeString = (value: any): string | undefined => {
            if (value === null || value === undefined || value === '') return undefined;
            return String(value).trim() || undefined;
          };

          const convertValues = (valueStr: string | number): number | undefined => {
            if (valueStr === null || valueStr === undefined || valueStr === '') return undefined;
            try {
              const numValue = typeof valueStr === 'string' ? parseFloat(valueStr) : valueStr;
              return isNaN(numValue) ? undefined : Math.floor(numValue);
            } catch {
              return undefined;
            }
          };

          const convertBrazilianDate = (dateStr: string): string | undefined => {
            if (!dateStr || dateStr.trim() === '') return undefined;
            try {
              const cleanDate = dateStr.trim();
              const dateRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/;
              const match = cleanDate.match(dateRegex);
              if (!match) return undefined;
              
              let [, day, month, year] = match;
              if (year.length === 2) {
                const currentYear = new Date().getFullYear();
                const currentCentury = Math.floor(currentYear / 100) * 100;
                year = String(currentCentury + parseInt(year));
              }
              
              const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
              if (isNaN(date.getTime())) return undefined;
              
              return date.toISOString().split('T')[0]; // Formato YYYY-MM-DD
            } catch {
              return undefined;
            }
          };

          const convertTime = (timeStr: string): string | undefined => {
            if (!timeStr || timeStr.trim() === '') return undefined;
            try {
              const cleanTime = timeStr.trim();
              const timeRegex = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/;
              const match = cleanTime.match(timeRegex);
              if (!match) return undefined;
              
              const [, hours, minutes, seconds = '00'] = match;
              const h = parseInt(hours);
              const m = parseInt(minutes);
              const s = parseInt(seconds);
              
              if (h > 23 || m > 59 || s > 59) return undefined;
              
              return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
            } catch {
              return undefined;
            }
          };

          const record: VolumetriaRecord = {
            EMPRESA: String(empresa).trim(),
            NOME_PACIENTE: String(nomePaciente).trim(),
            arquivo_fonte: arquivoFonte,
            lote_upload: loteUpload,
            periodo_referencia: periodoReferencia,
            
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
            
            VALORES: convertValues(row['VALORES']),
            IMAGENS_CHAVES: convertValues(row['IMAGENS_CHAVES']),
            IMAGENS_CAPTURADAS: convertValues(row['IMAGENS_CAPTURADAS']),
            CODIGO_INTERNO: convertValues(row['CODIGO_INTERNO']),
            
            DATA_REALIZACAO: convertBrazilianDate(String(row['DATA_REALIZACAO'] || '')),
            DATA_TRANSFERENCIA: convertBrazilianDate(String(row['DATA_TRANSFERENCIA'] || '')),
            DATA_LAUDO: convertBrazilianDate(String(row['DATA_LAUDO'] || '')),
            DATA_PRAZO: convertBrazilianDate(String(row['DATA_PRAZO'] || '')),
            DATA_REASSINATURA: convertBrazilianDate(String(row['DATA_REASSINATURA'] || '')),
            
            HORA_REALIZACAO: convertTime(String(row['HORA_REALIZACAO'] || '')),
            HORA_TRANSFERENCIA: convertTime(String(row['HORA_TRANSFERENCIA'] || '')),
            HORA_LAUDO: convertTime(String(row['HORA_LAUDO'] || '')),
            HORA_PRAZO: convertTime(String(row['HORA_PRAZO'] || '')),
            HORA_REASSINATURA: convertTime(String(row['HORA_REASSINATURA'] || '')),
          };

          records.push(record);
        } catch (error) {
          console.error('Erro ao processar linha:', error);
          totalErrors++;
        }
      }

      // Inserir records em sub-lotes de 50
      for (let j = 0; j < records.length; j += 50) {
        const subBatch = records.slice(j, j + 50);
        try {
          const { error: insertError } = await supabase
            .from('volumetria_mobilemed')
            .insert(subBatch);

          if (insertError) {
            console.error(`❌ Erro inserção lote ${i}-${j}:`, insertError.message);
            totalErrors += subBatch.length;
          } else {
            totalInserted += subBatch.length;
            console.log(`✅ Lote ${i}-${j}: ${subBatch.length} registros inseridos`);
          }
        } catch (batchErr) {
          console.error(`❌ Erro crítico no lote ${i}-${j}:`, batchErr);
          totalErrors += subBatch.length;
        }
      }

      // Atualizar progresso
      const progress = Math.round(30 + ((i + batchSize) / jsonData.length) * 60);
      const processed = Math.min(i + batchSize, jsonData.length);
      
      if (onProgress) {
        onProgress({ 
          progress, 
          processed, 
          total: jsonData.length, 
          status: `Processando lote ${Math.floor(i / batchSize) + 1} de ${Math.ceil(jsonData.length / batchSize)}` 
        });
      }

      // Atualizar log de progresso
      await supabase
        .from('processamento_uploads')
        .update({
          registros_processados: processed,
          registros_inseridos: totalInserted,
          registros_erro: totalErrors,
          detalhes_erro: JSON.stringify({
            progresso: `${progress}%`,
            lote_atual: Math.floor(i / batchSize) + 1,
            total_lotes: Math.ceil(jsonData.length / batchSize),
            inseridos: totalInserted,
            erros: totalErrors
          })
        })
        .eq('id', uploadLog.id);
    }

    console.log('🔧 Aplicando regras de negócio...');
    
    if (onProgress) {
      onProgress({ progress: 90, processed: jsonData.length, total: jsonData.length, status: 'Aplicando regras de negócio...' });
    }

    // Aplicar regras de negócio
    let registrosAtualizados = 0;
    try {
      if (arquivoFonte.includes('volumetria')) {
        const { data: deParaResult } = await supabase.rpc('aplicar_de_para_automatico', { 
          arquivo_fonte_param: arquivoFonte 
        });
        registrosAtualizados += (deParaResult as any)?.registros_atualizados || 0;
      }

      const { data: prioridadeResult } = await supabase.rpc('aplicar_de_para_prioridade');
      registrosAtualizados += (prioridadeResult as any)?.registros_atualizados || 0;
    } catch (rulesError) {
      console.log('⚠️ Erro nas regras (ignorado):', rulesError);
    }

    // Finalizar
    await supabase
      .from('processamento_uploads')
      .update({
        status: 'concluido',
        registros_atualizados: registrosAtualizados,
        completed_at: new Date().toISOString(),
        detalhes_erro: JSON.stringify({
          status: 'Processamento Concluído',
          total_processado: jsonData.length,
          total_inserido: totalInserted,
          total_erros: totalErrors,
          regras_aplicadas: registrosAtualizados
        })
      })
      .eq('id', uploadLog.id);

    if (onProgress) {
      onProgress({ progress: 100, processed: jsonData.length, total: jsonData.length, status: 'Processamento concluído!' });
    }

    console.log('✅ PROCESSAMENTO CONCLUÍDO COM SUCESSO!');
    console.log(`📊 Estatísticas: ${totalInserted} inseridos, ${totalErrors} erros, ${registrosAtualizados} atualizados`);

    // Aplicar regras específicas para arquivos retroativos
    if (arquivoFonte.includes('retroativo')) {
      console.log('🔧 Aplicando regras específicas para arquivo retroativo...');
      try {
        const { data: regrasResult, error: regrasError } = await supabase.functions.invoke('aplicar-regras-tratamento', {
          body: {
            arquivo_fonte: arquivoFonte
          }
        });
        
        if (regrasError) {
          console.warn('⚠️ Erro ao aplicar regras específicas:', regrasError);
        } else {
          console.log('✅ Regras específicas aplicadas:', regrasResult);
          registrosAtualizados += regrasResult?.registros_atualizados || 0;
        }
      } catch (regrasError) {
        console.warn('⚠️ Erro ao aplicar regras específicas:', regrasError);
      }
    }

    // Forçar atualização das estatísticas após processamento
    console.log('🔄 Atualizando estatísticas...');
    try {
      if ((window as any).volumetriaContext?.refreshData) {
        await (window as any).volumetriaContext.refreshData();
        console.log('✅ Estatísticas atualizadas');
      }
    } catch (refreshError) {
      console.warn('⚠️ Erro ao atualizar estatísticas:', refreshError);
    }

    return {
      success: true,
      totalProcessed: jsonData.length,
      totalInserted: totalInserted,
      message: `Processamento concluído! ${totalInserted} registros inseridos de ${jsonData.length} processados.`,
      uploadLogId: uploadLog.id
    };

  } catch (error) {
    console.error('💥 ERRO no processamento:', error);
    
    throw new Error(`Erro no processamento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

// Função otimizada para processamento completo de arquivos de volumetria (sem limitação de registros)
export async function processVolumetriaOtimizado(
  file: File,
  arquivoFonte: string,
  periodo?: { ano: number; mes: number },
  onProgress?: (progress: { progress: number; processed: number; total: number; status: string }) => void
): Promise<{ success: boolean; message: string; stats: any }> {
  console.log('🚀 Iniciando processamento otimizado de volumetria:', arquivoFonte);
  
  try {
    // Upload do arquivo
    if (onProgress) {
      onProgress({ progress: 10, processed: 0, total: 100, status: 'Fazendo upload do arquivo...' });
    }
    
    const fileName = `volumetria_${Date.now()}_${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(fileName, file);

    if (uploadError) {
      throw new Error(`Erro no upload: ${uploadError.message}`);
    }

    console.log('✅ Arquivo enviado:', fileName);
    
    if (onProgress) {
      onProgress({ progress: 30, processed: 0, total: 100, status: 'Processando arquivo...' });
    }

    // Chamar edge function otimizada
    const { data: processData, error: processError } = await supabase.functions.invoke('processar-volumetria-otimizado', {
      body: { 
        file_path: fileName,
        arquivo_fonte: arquivoFonte,
        periodo: periodo
      }
    });

    if (processError) {
      console.error('❌ Erro no processamento:', processError);
      throw new Error(`Erro no processamento: ${processError.message}`);
    }

    if (!processData.success) {
      throw new Error(processData.error || 'Erro no processamento');
    }

    console.log('✅ Processamento otimizado concluído:', processData);

    if (onProgress) {
      onProgress({ 
        progress: 100, 
        processed: processData.stats.inserted_count, 
        total: processData.stats.total_rows, 
        status: `Concluído! ${processData.stats.inserted_count} registros processados` 
      });
    }

    // Forçar atualização das estatísticas
    if ((window as any).volumetriaContext) {
      setTimeout(() => {
        (window as any).volumetriaContext.refreshData();
      }, 2000);
    }

    return {
      success: true,
      message: processData.message,
      stats: processData.stats
    };

  } catch (error) {
    console.error('❌ Erro no processamento otimizado:', error);
    
    if (onProgress) {
      onProgress({ 
        progress: 0, 
        processed: 0, 
        total: 100, 
        status: `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}` 
      });
    }

    throw error;
  }
}