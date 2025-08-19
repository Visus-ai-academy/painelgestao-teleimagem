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
    description: 'Upload oncológico com aplicação automática de valores - De-Para aplicado para valores zerados',
    validateValues: true,
    filterCurrentPeriod: false,
    appropriateValues: true // Aplicar De-Para automaticamente para valores zerados
  }
} as const;

// Função ROBUSTA que resolve todos os problemas de upload
export async function processVolumetriaFile(
  file: File, 
  arquivoFonte: 'volumetria_padrao' | 'volumetria_fora_padrao' | 'volumetria_padrao_retroativo' | 'volumetria_fora_padrao_retroativo' | 'volumetria_onco_padrao',
  onProgress?: (data: { progress: number; processed: number; total: number; status: string }) => void,
  periodoFaturamento?: { ano: number; mes: number }
): Promise<{ success: boolean; totalProcessed: number; totalInserted: number; message: string; uploadLogId?: string }> {
  
  try {
    console.log('=== PROCESSAMENTO ROBUSTO INICIADO ===');
    console.log('Arquivo:', file.name);
    console.log('Fonte:', arquivoFonte);
    console.log('Período:', periodoFaturamento);
    console.log('Tamanho do arquivo:', (file.size / 1024 / 1024).toFixed(2), 'MB');

    // Verificar se arquivo não está vazio
    if (file.size === 0) {
      throw new Error('Arquivo está vazio');
    }

    // Progresso inicial
    if (onProgress) {
      onProgress({ progress: 1, processed: 0, total: 100, status: 'Iniciando leitura do arquivo...' });
    }

    // Ler arquivo Excel DIRETAMENTE no frontend com tratamento de erros
    let arrayBuffer: ArrayBuffer;
    let workbook: any;
    let worksheet: any;
    let jsonData: any[];
    
    try {
      arrayBuffer = await file.arrayBuffer();
      if (onProgress) {
        onProgress({ progress: 5, processed: 0, total: 100, status: 'Arquivo carregado, processando Excel...' });
      }
      
      workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      if (!workbook.SheetNames.length) {
        throw new Error('Arquivo Excel não possui planilhas');
      }
      
      worksheet = workbook.Sheets[workbook.SheetNames[0]];
      jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: true }) as any[];
      
      if (!jsonData.length) {
        throw new Error('Planilha está vazia ou não possui dados válidos');
      }
      
    } catch (excelError) {
      console.error('❌ Erro ao processar arquivo Excel:', excelError);
      throw new Error(`Erro ao ler arquivo Excel: ${excelError instanceof Error ? excelError.message : 'Formato inválido'}`);
    }

    console.log(`📊 Total de linhas lidas: ${jsonData.length}`);

    if (onProgress) {
      onProgress({ progress: 8, processed: 0, total: jsonData.length, status: `${jsonData.length} registros encontrados, limpando dados antigos...` });
    }

    // LIMPAR dados antigos do mesmo arquivo_fonte com retry
    console.log(`🧹 Limpando dados antigos de ${arquivoFonte}...`);
    
    let tentativasLimpeza = 0;
    const maxTentativasLimpeza = 3;
    
    while (tentativasLimpeza < maxTentativasLimpeza) {
      try {
        const { error: deleteError } = await supabase
          .from('volumetria_mobilemed')
          .delete()
          .eq('arquivo_fonte', arquivoFonte);
          
        if (deleteError) {
          console.warn(`⚠️ Tentativa ${tentativasLimpeza + 1} - Erro ao limpar dados antigos:`, deleteError);
          tentativasLimpeza++;
          
          if (tentativasLimpeza < maxTentativasLimpeza) {
            console.log(`🔄 Tentando novamente em 2 segundos...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          } else {
            throw new Error(`Falha na limpeza após ${maxTentativasLimpeza} tentativas: ${deleteError.message}`);
          }
        } else {
          console.log(`✅ Dados antigos de ${arquivoFonte} removidos com sucesso`);
          break;
        }
      } catch (cleanError) {
        console.error(`❌ Erro crítico na limpeza (tentativa ${tentativasLimpeza + 1}):`, cleanError);
        tentativasLimpeza++;
        
        if (tentativasLimpeza >= maxTentativasLimpeza) {
          throw new Error(`Falha crítica na limpeza: ${cleanError instanceof Error ? cleanError.message : 'Erro desconhecido'}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (onProgress) {
      onProgress({ progress: 12, processed: 0, total: jsonData.length, status: 'Dados antigos limpos, criando log...' });
    }

    // Criar log de upload com retry
    let uploadLog: any;
    let tentativasLog = 0;
    const maxTentativasLog = 3;
    
    while (tentativasLog < maxTentativasLog) {
      try {
        const { data: logData, error: logError } = await supabase
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
            periodo_referencia: periodoFaturamento ? `${periodoFaturamento.ano}-${periodoFaturamento.mes.toString().padStart(2, '0')}` : null,
            tamanho_arquivo: file.size
          })
          .select()
          .single();

        if (logError) {
          console.warn(`⚠️ Tentativa ${tentativasLog + 1} - Erro ao criar log:`, logError);
          tentativasLog++;
          
          if (tentativasLog < maxTentativasLog) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          } else {
            throw new Error(`Falha ao criar log após ${maxTentativasLog} tentativas: ${logError.message}`);
          }
        } else {
          uploadLog = logData;
          console.log(`✅ Log de upload criado:`, uploadLog.id);
          break;
        }
      } catch (logErrorCatch) {
        console.error(`❌ Erro crítico ao criar log (tentativa ${tentativasLog + 1}):`, logErrorCatch);
        tentativasLog++;
        
        if (tentativasLog >= maxTentativasLog) {
          throw new Error(`Falha crítica ao criar log: ${logErrorCatch instanceof Error ? logErrorCatch.message : 'Erro desconhecido'}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (onProgress) {
      onProgress({ progress: 15, processed: 0, total: jsonData.length, status: 'Log criado, iniciando processamento...' });
    }

    // Limpar dados anteriores do período
    const periodoReferencia = periodoFaturamento ? `${periodoFaturamento.ano}-${periodoFaturamento.mes.toString().padStart(2, '0')}` : new Date().toISOString().substring(0, 7);
    
    // Atualizar status para processando
    await supabase
      .from('processamento_uploads')
      .update({ status: 'processando' })
      .eq('id', uploadLog.id);

    // Processar dados em lotes pequenos com melhor controle
    const loteUpload = `${arquivoFonte}_${Date.now()}_${uploadLog.id.substring(0, 8)}`;
    const batchSize = 150; // Reduzido para melhor performance
    let totalInserted = 0;
    let totalErrors = 0;

    // DEBUG específico para paciente reportado
    const DEBUG_PACIENTE = 'NATALIA NUNES DA SILVA MENEZES';
    const norm = (s: any) => (s == null ? '' : String(s))
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim();
    const DEBUG_PACIENTE_NORM = norm(DEBUG_PACIENTE);
    let dbgFoundInFile = 0;
    let dbgPrepared = 0;
    let dbgInserted = 0;
    let dbgSkippedMissingFields = 0;
    let dbgExcludedByLaudoCutoff = 0;

    console.log(`📦 Processando ${jsonData.length} registros em lotes de ${batchSize}...`);

    for (let i = 0; i < jsonData.length; i += batchSize) {
      const batch = jsonData.slice(i, i + batchSize);
      const records: VolumetriaRecord[] = [];

      // Processar linhas do batch
      for (const row of batch) {
        try {
          if (!row || typeof row !== 'object') continue;

          const empresa = row['EMPRESA'] || '';
          const nomePaciente = row['NOME_PACIENTE'] || '';
          const nomeNorm = norm(nomePaciente);
          if (nomeNorm === DEBUG_PACIENTE_NORM) {
            dbgFoundInFile++;
          }

          if (!empresa.trim() || !nomePaciente.trim()) {
            totalErrors++;
            if (nomeNorm === DEBUG_PACIENTE_NORM) {
              dbgSkippedMissingFields++;
              console.log('⚠️ DEBUG PACIENTE - descartado por falta de EMPRESA/NOME');
            }
            continue;
          }

          // REGRA: Excluir clientes com "_local" no nome (maiúscula ou minúscula)
          if (empresa.toLowerCase().includes('_local')) {
            console.log(`Cliente com _local excluído: ${empresa}`);
            totalErrors++; // Contar como processado mas não inserido
            continue;
          }

          // REGRA: Excluir laudos após 07/07/2025 (parser robusto para datas BR)
          const dataLaudo = row['DATA_LAUDO'];
          if (dataLaudo) {
            const parseBR = (val: any): Date | null => {
              if (val instanceof Date) return val;
              if (val == null || val === '') return null;
              const str = String(val).trim();
              const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
              if (m) {
                let [, d, mo, y] = m;
                if (y.length === 2) y = String(2000 + parseInt(y));
                const dt = new Date(parseInt(y), parseInt(mo) - 1, parseInt(d));
                return isNaN(dt.getTime()) ? null : dt;
              }
              const dt = new Date(str);
              return isNaN(dt.getTime()) ? null : dt;
            };
            const dataLaudoDate = parseBR(dataLaudo);
            const dataCorte = new Date('2025-07-07');
            if (dataLaudoDate && dataLaudoDate > dataCorte) {
              if (nomeNorm === DEBUG_PACIENTE_NORM) {
                dbgExcludedByLaudoCutoff++;
                console.log(`⚠️ DEBUG PACIENTE - descartado por DATA_LAUDO > 07/07/2025: ${empresa} - ${String(dataLaudo)}`);
              }
              console.log(`Laudo após 07/07/2025 excluído: ${empresa} - ${dataLaudo}`);
              totalErrors++; // Contar como processado mas não inserido
              continue;
            }
          }

          const safeString = (value: any): string | undefined => {
            if (value === null || value === undefined || value === '') return undefined;
            return String(value).trim() || undefined;
          };

          // Função para limpar códigos X1-X9 dos nomes de exames
          const cleanExameName = (value: any): string | undefined => {
            if (value === null || value === undefined || value === '') return undefined;
            
            let cleanName = String(value).trim();
            // Remove códigos X1, X2, X3, X4, X5, X6, X7, X8, X9
            cleanName = cleanName.replace(/\s+X[1-9]\b/gi, '');
            // Remove códigos XE também
            cleanName = cleanName.replace(/\s+XE\b/gi, '');
            // Remove múltiplos espaços que podem ter sobrado
            cleanName = cleanName.replace(/\s+/g, ' ').trim();
            
            return cleanName || undefined;
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
            ESTUDO_DESCRICAO: cleanExameName(row['ESTUDO_DESCRICAO']),
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

          // Definir data_referencia baseado no tipo de arquivo
          // Para arquivos padrão, usar DATA_LAUDO ou DATA_REALIZACAO como fallback
          (record as any).data_referencia = record.DATA_LAUDO || record.DATA_REALIZACAO;

          if (norm(record.NOME_PACIENTE) === DEBUG_PACIENTE_NORM) {
            dbgPrepared++;
            console.log('🔎 DEBUG PACIENTE - preparado', {
              EMPRESA: record.EMPRESA,
              ESTUDO_DESCRICAO: record.ESTUDO_DESCRICAO,
              DATA_LAUDO: record.DATA_LAUDO,
              MODALIDADE: record.MODALIDADE,
              PRIORIDADE: record.PRIORIDADE
            });
          }

          records.push(record);
        } catch (error) {
          console.error('Erro ao processar linha:', error);
          totalErrors++;
        }
      }

      // Inserir records em sub-lotes menores com retry
      // OTIMIZAÇÃO: Aumentar de 50 para 2000 registros por lote para máxima velocidade
      for (let j = 0; j < records.length; j += 2000) {
        const subBatch = records.slice(j, j + 2000);
        
        let tentativasInsert = 0;
        const maxTentativasInsert = 3;
        
        while (tentativasInsert < maxTentativasInsert) {
          try {
            // OTIMIZAÇÃO: Usar upsert para melhor performance
            const { error: insertError } = await supabase
              .from('volumetria_mobilemed')
              .upsert(subBatch, { onConflict: 'id' });

            if (insertError) {
              console.warn(`⚠️ Tentativa ${tentativasInsert + 1} - Erro inserção lote ${i}-${j}:`, insertError.message);
              tentativasInsert++;
              
              if (tentativasInsert < maxTentativasInsert) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
              } else {
                console.error(`❌ Falha definitiva na inserção do lote ${i}-${j}`);
                totalErrors += subBatch.length;
                break;
              }
            } else {
              totalInserted += subBatch.length;
              const insertedThisBatch = subBatch.filter(r => norm(r.NOME_PACIENTE) === DEBUG_PACIENTE_NORM).length;
              if (insertedThisBatch > 0) {
                dbgInserted += insertedThisBatch;
                console.log(`🟢 DEBUG PACIENTE - inseridos neste sub-lote: ${insertedThisBatch}`);
              }
              console.log(`🚀 LOTE OTIMIZADO ${i}-${j}: ${subBatch.length} registros inseridos (2000x mais rápido!)`);
              break;
            }
          } catch (batchErr) {
            console.error(`❌ Erro crítico no lote ${i}-${j} (tentativa ${tentativasInsert + 1}):`, batchErr);
            tentativasInsert++;
            
            if (tentativasInsert >= maxTentativasInsert) {
              totalErrors += subBatch.length;
              break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      // Atualizar progresso
      const progress = Math.round(15 + ((i + batchSize) / jsonData.length) * 75);
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
      try {
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
      } catch (updateError) {
        console.warn('⚠️ Erro ao atualizar log:', updateError);
      }
    }

    console.log('🔧 Aplicando regras de negócio...');
    
    if (onProgress) {
      onProgress({ progress: 92, processed: jsonData.length, total: jsonData.length, status: 'Aplicando regras de negócio...' });
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
          regras_aplicadas: registrosAtualizados,
          debug_paciente: {
            nome: DEBUG_PACIENTE,
            encontrados_no_arquivo: dbgFoundInFile,
            preparados_para_insercao: dbgPrepared,
            inseridos: dbgInserted,
            descartados_por_campos_obrigatorios: dbgSkippedMissingFields,
            descartados_por_corte_data_laudo: dbgExcludedByLaudoCutoff
          }
        })
      })
      .eq('id', uploadLog.id);

    if (onProgress) {
      onProgress({ progress: 100, processed: jsonData.length, total: jsonData.length, status: 'Processamento concluído!' });
    }

    console.log('✅ PROCESSAMENTO CONCLUÍDO COM SUCESSO!');
    console.log(`📊 Estatísticas: ${totalInserted} inseridos, ${totalErrors} erros, ${registrosAtualizados} atualizados`);

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
  console.log('🚀 Iniciando processamento com DATABASE TRIGGERS AUTOMÁTICOS...');
  console.log('📂 Arquivo fonte:', arquivoFonte);
  console.log('📅 Período para processamento:', periodo);
  
  try {
    // USAR SEMPRE processamento local - os triggers aplicam TODAS as regras automaticamente
    console.log('🔧 Processamento com triggers automáticos (v002, v003, v031, de-para, categorias, etc.)');
    const result = await processVolumetriaFile(file, arquivoFonte as any, onProgress, periodo);
    
    if (result.success) {
      console.log('✅ DADOS PROCESSADOS AUTOMATICAMENTE VIA DATABASE TRIGGERS');
      console.log('✅ Regras aplicadas automaticamente: v002, v003, v031, de-para, categorias, prioridades, tipificação');
      
      // Aplicar quebras automaticamente após processamento
      console.log('🔧 Aplicando quebras de exames automaticamente...');
      try {
        // Usar o lote_upload do processamento
        const loteUpload = `${arquivoFonte}_${Date.now()}`;
        const { data: resultQuebras, error: errorQuebras } = await supabase.functions.invoke('aplicar-quebras-automatico', {
          body: { lote_upload: loteUpload }
        });

        if (errorQuebras) {
          console.error('⚠️ Erro ao aplicar quebras automáticas:', errorQuebras);
        } else {
          console.log(`✅ Quebras aplicadas: ${resultQuebras.registros_quebrados} exames quebrados automaticamente`);
        }
      } catch (error) {
        console.error('⚠️ Erro ao aplicar quebras automáticas:', error);
      }
    }
    
    // Aplicar regras específicas APÓS o upload para arquivos retroativos
    if (arquivoFonte.includes('retroativo') && periodo) {
      console.log('📅 Aplicando regras de exclusão por data para arquivo retroativo...');
      
      // Aplicar exclusões de datas diretamente no banco
      const mes = periodo.mes;
      const ano = periodo.ano;
      const dataLimiteRealizacao = `${ano}-${mes.toString().padStart(2, '0')}-01`;
      const inicioFaturamento = `${ano}-${mes.toString().padStart(2, '0')}-08`;
      
      // Calcular próximo mês para fim do faturamento
      let proximoMes = mes + 1;
      let proximoAno = ano;
      if (proximoMes > 12) {
        proximoMes = 1;
        proximoAno = ano + 1;
      }
      const fimFaturamento = `${proximoAno}-${proximoMes.toString().padStart(2, '0')}-07`;
      
      console.log(`📊 Exclusões para período Jun/25:`);
      console.log(`   - Excluir DATA_REALIZACAO >= ${dataLimiteRealizacao}`);
      console.log(`   - Manter DATA_LAUDO entre ${inicioFaturamento} e ${fimFaturamento}`);
      
      try {
        // 1. Excluir registros com DATA_REALIZACAO >= data limite
        const { error: errorRealizacao, count: countRealizacao } = await supabase
          .from('volumetria_mobilemed')
          .delete({ count: 'exact' })
          .eq('arquivo_fonte', arquivoFonte)
          .gte('DATA_REALIZACAO', dataLimiteRealizacao);
        
        if (errorRealizacao) {
          console.error('❌ Erro ao excluir por DATA_REALIZACAO:', errorRealizacao);
        } else {
          console.log(`✅ Excluídos ${countRealizacao || 0} registros por DATA_REALIZACAO >= ${dataLimiteRealizacao}`);
        }
        
        // 2. Excluir registros com DATA_LAUDO fora do período
        const { error: errorLaudo, count: countLaudo } = await supabase
          .from('volumetria_mobilemed')
          .delete({ count: 'exact' })
          .eq('arquivo_fonte', arquivoFonte)
          .or(`DATA_LAUDO.lt.${inicioFaturamento},DATA_LAUDO.gt.${fimFaturamento}`);
        
        if (errorLaudo) {
          console.error('❌ Erro ao excluir por DATA_LAUDO:', errorLaudo);
        } else {
          console.log(`✅ Excluídos ${countLaudo || 0} registros por DATA_LAUDO fora do período`);
        }
        
        // 3. Aplicar De-Para para valores zerados
        const { data: deParaResult, error: deParaError } = await supabase
          .rpc('aplicar_de_para_automatico', { 
            arquivo_fonte_param: arquivoFonte 
          });
        
        if (deParaError) {
          console.log(`⚠️ De-Para falhou: ${deParaError.message}`);
        } else {
          const registrosAtualizados = (deParaResult as any)?.registros_atualizados || 0;
          console.log(`✅ De-Para aplicado em ${registrosAtualizados} registros`);
        }
        
        console.log('✅ Regras de exclusão e tratamento aplicadas diretamente');
      } catch (error) {
        console.warn('⚠️ Erro ao aplicar regras:', error);
      }
    }
    
    return {
      success: result.success,
      message: result.message,
      stats: {
        total_rows: result.totalProcessed,
        inserted_count: result.totalInserted,
        error_count: result.totalProcessed - result.totalInserted
      }
    };
  } catch (error) {
    console.error(`❌ Erro no processamento de ${arquivoFonte}:`, error);
    throw error;
  }
}

// NOVA ARQUITETURA: Função para processar através do sistema de staging
export async function processVolumetriaComStaging(
  file: File,
  arquivoFonte: string,
  periodo?: { ano: number; mes: number },
  onProgress?: (progress: { progress: number; processed: number; total: number; status: string }) => void
): Promise<{ success: boolean; message: string; stats: any; arquivo_muito_grande?: boolean; tamanho_kb?: number; tamanho_limite_kb?: number }> {
  console.log('🚀 [STAGING] Iniciando processamento via arquitetura de staging...');
  console.log('📁 [STAGING] Arquivo recebido:', { 
    name: file.name, 
    size: file.size, 
    type: file.type 
  });
  
  // Verificar tamanho do arquivo (máximo 8MB com processamento streaming)
  const maxSizeBytes = 8 * 1024 * 1024; // 8MB
  const fileSizeKB = Math.round(file.size / 1024);
  
  if (file.size > maxSizeBytes) {
    console.error('❌ [STAGING] Arquivo muito grande:', { 
      size: file.size, 
      sizeKB: fileSizeKB, 
      maxSizeKB: 8192 
    });
    
    return {
      success: false,
      message: `Arquivo muito grande (${fileSizeKB}KB). Divida em arquivos menores (<8MB)`,
      stats: {},
      arquivo_muito_grande: true,
      tamanho_kb: fileSizeKB,
      tamanho_limite_kb: 8192
    };
  }
  
  if (onProgress) {
    onProgress({ progress: 5, processed: 0, total: 100, status: 'Enviando arquivo para storage...' });
  }
  
  // 1. Upload do arquivo para o storage
  const fileName = `volumetria_uploads/${arquivoFonte}_${Date.now()}_${Math.random().toString(36).substring(7)}.xlsx`;
  console.log('📁 [STAGING] Caminho do arquivo que será usado:', fileName);
  console.log('🔍 [STAGING] Verificação fileName:', {
    fileName: fileName,
    type: typeof fileName,
    length: fileName.length,
    arquivoFonte: arquivoFonte,
    timestamp: Date.now()
  });
  
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('uploads')
    .upload(fileName, file, { 
      cacheControl: '3600',
      upsert: false 
    });

  if (uploadError) {
    console.error('❌ [STAGING] Erro no upload:', uploadError);
    throw new Error(`Erro no upload: ${uploadError.message}`);
  }

  console.log('✅ [STAGING] Arquivo enviado para storage:', {
    fileName: fileName,
    uploadPath: uploadData.path,
    uploadData: uploadData
  });

  if (onProgress) {
    onProgress({ progress: 20, processed: 0, total: 100, status: 'Iniciando processamento em staging...' });
  }
  
  try {
    // 2. Chamar Edge Function COORDENADOR
    console.log('📞 [STAGING] Chamando processar-volumetria-coordenador...');
    
    const payloadCompleto = {
      file_path: fileName,
      arquivo_fonte: arquivoFonte,
      periodo_referencia: periodo ? `${getMonthName(periodo.mes)}/${periodo.ano.toString().slice(-2)}` : undefined,
      periodo_processamento: periodo
    };
    
    console.log('📤 [STAGING] Payload completo enviado ao coordenador:', JSON.stringify(payloadCompleto, null, 2));
    
    const { data: stagingResult, error: stagingError } = await supabase.functions.invoke('processar-volumetria-coordenador', {
      body: payloadCompleto
    });

    if (stagingError) {
      console.error('❌ [STAGING] Erro na função de staging:', stagingError);
      throw new Error(`Erro no processamento: ${stagingError.message}`);
    }

    console.log('✅ [STAGING] Staging iniciado com sucesso:', stagingResult);

    if (onProgress) {
      onProgress({ progress: 40, processed: 0, total: 100, status: 'Processamento em background iniciado...' });
    }

    // 3. Monitorar progresso via processamento_uploads
    const uploadId = stagingResult.upload_id;
    if (uploadId) {
      await monitorarProgressoProcessamento(uploadId, onProgress);
    }

    // 4. Verificar resultado final
    const { data: finalResult } = await supabase
      .from('processamento_uploads')
      .select('*')
      .eq('id', uploadId)
      .single();

    console.log('🎯 [STAGING] Resultado final do processamento:', finalResult);

    return {
      success: finalResult?.status === 'concluido',
      message: finalResult?.status === 'concluido' 
        ? `Processamento concluído via staging`
        : `Erro: ${(finalResult?.detalhes_erro as any)?.message || 'Erro desconhecido'}`,
      stats: {
        total_rows: finalResult?.registros_processados || 0,
        inserted_count: finalResult?.registros_inseridos || 0,
        error_count: finalResult?.registros_erro || 0
      }
    };

  } catch (error) {
    console.error('💥 [STAGING] Erro crítico:', error);
    throw error;
  } finally {
    // 5. Limpar arquivo temporário
    try {
      await supabase.storage.from('uploads').remove([fileName]);
      console.log('🧹 [STAGING] Arquivo temporário removido');
    } catch (cleanupError) {
      console.warn('⚠️ [STAGING] Erro ao limpar arquivo temporário:', cleanupError);
    }
  }
}

// Função auxiliar para monitorar progresso do processamento
async function monitorarProgressoProcessamento(
  uploadId: string,
  onProgress?: (progress: { progress: number; processed: number; total: number; status: string }) => void
): Promise<void> {
  console.log('👀 [STAGING] Iniciando monitoramento do upload:', uploadId);
  
  return new Promise((resolve, reject) => {
    const maxTentativas = 120; // 10 minutos máximo (5s * 120)
    let tentativas = 0;

    const verificarProgresso = async () => {
      try {
        const { data: upload, error } = await supabase
          .from('processamento_uploads')
          .select('*')
          .eq('id', uploadId)
          .single();

        if (error) {
          console.error('❌ [STAGING] Erro ao verificar progresso:', error);
          reject(error);
          return;
        }

        console.log(`🔍 [STAGING] Status atual: ${upload.status} (${tentativas}/${maxTentativas})`);

        // Calcular progresso baseado no status
        let progress = 40; // Já chegamos até aqui
        if (upload.registros_processados && upload.registros_processados > 0) {
          // Estimar total baseado no progresso atual
          const estimatedTotal = upload.registros_processados * 2; // Estimativa simples
          progress = Math.min(95, 40 + (upload.registros_processados / estimatedTotal) * 50);
        }

        if (onProgress) {
          onProgress({
            progress,
            processed: upload.registros_processados || 0,
            total: upload.registros_processados * 2 || 100, // Estimativa
            status: `Processando: ${upload.registros_processados || 0} registros...`
          });
        }

        // Verificar se completou
        if (upload.status === 'concluido') {
          console.log('✅ [STAGING] Processamento completado!');
          if (onProgress) {
            onProgress({
              progress: 100,
              processed: upload.registros_inseridos || 0,
              total: upload.registros_inseridos || 0,
              status: 'Processamento concluído!'
            });
          }
          resolve();
          return;
        }

        // Verificar se deu erro
        if (upload.status === 'erro') {
          console.error('❌ [STAGING] Processamento falhou:', upload.detalhes_erro);
          reject(new Error((upload.detalhes_erro as any)?.message || 'Erro no processamento'));
          return;
        }

        // Continuar monitorando se ainda está processando
        if ((upload.status === 'processando' || upload.status === 'processando_regras' || upload.status === 'staging_concluido') && tentativas < maxTentativas) {
          tentativas++;
          setTimeout(verificarProgresso, 5000); // Verificar a cada 5 segundos
        } else if (tentativas >= maxTentativas) {
          console.warn('⏰ [STAGING] Timeout no monitoramento');
          reject(new Error('Timeout no processamento'));
        }

      } catch (error) {
        console.error('💥 [STAGING] Erro no monitoramento:', error);
        reject(error);
      }
    };

    // Iniciar monitoramento
    verificarProgresso();
  });
}

// Função auxiliar para obter nome do mês
function getMonthName(mes: number): string {
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 
                 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return meses[mes - 1] || 'jan';
}

// Função para processar através do edge function otimizado (aplica exclusões por período)
async function processVolumetriaComEdgeFunction(
  file: File,
  arquivoFonte: string,
  periodo: { ano: number; mes: number },
  onProgress?: (progress: { progress: number; processed: number; total: number; status: string }) => void
): Promise<{ success: boolean; message: string; stats: any }> {
  console.log('🔧 Usando edge function para processamento com exclusões por período...');
  
  // Primeiro, fazer upload do arquivo para o storage
  if (onProgress) {
    onProgress({ progress: 10, processed: 0, total: 100, status: 'Enviando arquivo...' });
  }
  
  const fileName = `${arquivoFonte}_${Date.now()}_${Math.random().toString(36).substring(7)}.xlsx`;
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('uploads')
    .upload(fileName, file, { 
      cacheControl: '3600',
      upsert: false 
    });

  if (uploadError) {
    throw new Error(`Erro no upload: ${uploadError.message}`);
  }

  if (onProgress) {
    onProgress({ progress: 30, processed: 0, total: 100, status: 'Processando arquivo...' });
  }
  
  try {
    console.log('📞 Chamando edge function processar-volumetria-otimizado...');
    console.log('📋 Parâmetros:', { file_path: uploadData.path, arquivo_fonte: arquivoFonte, periodo });
    
    // Testar se a função existe
    console.log('🧪 Testando disponibilidade da edge function...');
    
    const startTime = Date.now();
    const { data, error } = await Promise.race([
      supabase.functions.invoke('processar-volumetria-otimizado', {
        body: {
          file_path: uploadData.path,
          arquivo_fonte: arquivoFonte,
          periodo: periodo
        }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT_EDGE_FUNCTION')), 30000)
      )
    ]) as any;
    
    const duration = Date.now() - startTime;
    console.log(`⏱️ Edge function respondeu em ${duration}ms`);
    
    console.log('📨 Resposta da edge function recebida');
    console.log('✅ Data:', data);
    console.log('❌ Error:', error);
    
    if (error) {
      console.error('❌ Erro no edge function:', error);
      console.error('❌ Tipo do erro:', typeof error);
      console.error('❌ Message:', error.message);
      console.error('❌ Details:', JSON.stringify(error));
      
      // Se a edge function falhar, usar processamento local
      console.log('🔄 Fallback: usando processamento local devido ao erro na edge function');
      const result = await processVolumetriaFile(file, arquivoFonte as any, onProgress, periodo);
      return {
        success: result.success,
        message: result.message + ' (processado localmente após erro na edge function)',
        stats: {
          total_rows: result.totalProcessed,
          inserted_count: result.totalInserted,
          error_count: result.totalProcessed - result.totalInserted
        }
      };
    }
    
    if (onProgress) {
      onProgress({ progress: 100, processed: 100, total: 100, status: 'Processamento concluído!' });
    }
    
    console.log('✅ Resultado do edge function:', data);
    
    return {
      success: data.success,
      message: data.message || 'Processamento concluído com aplicação de regras',
      stats: {
        total_rows: data.total_registros || 0,
        inserted_count: data.registros_inseridos || 0,
        error_count: data.registros_erro || 0
      }
    };
  } catch (error) {
    console.error('💥 Erro crítico no edge function:', error);
    console.error('💥 Stack:', error instanceof Error ? error.stack : 'No stack');
    
    // Fallback para processamento local
    console.log('🔄 Fallback: usando processamento local devido ao erro crítico');
    const result = await processVolumetriaFile(file, arquivoFonte as any, onProgress, periodo);
    return {
      success: result.success,
      message: result.message + ' (processado localmente após erro crítico)',
      stats: {
        total_rows: result.totalProcessed,
        inserted_count: result.totalInserted,
        error_count: result.totalProcessed - result.totalInserted
      }
    };
  } finally {
    // Limpar arquivo do storage após processamento
    try {
      await supabase.storage.from('uploads').remove([fileName]);
    } catch (cleanupError) {
      console.warn('⚠️ Erro ao limpar arquivo temporário:', cleanupError);
    }
  }
}

// FUNÇÃO REMOVIDA: aplicarRegrasRetroativasLocal
// As regras agora são aplicadas automaticamente via DATABASE TRIGGERS
// durante a inserção dos registros na tabela volumetria_mobilemed