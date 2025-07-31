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

function processRow(row: any, arquivoFonte: string, loteUpload: string, periodoReferencia: string): VolumetriaRecord | null {
  try {
    if (!row || typeof row !== 'object') return null;

    const empresa = row['EMPRESA'] || '';
    const nomePaciente = row['NOME_PACIENTE'] || '';

    if (!empresa.trim() || !nomePaciente.trim()) return null;

    const safeString = (value: any): string | undefined => {
      if (value === null || value === undefined || value === '') return undefined;
      return String(value).trim() || undefined;
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

    // Definir data_referencia baseado no tipo de arquivo
    if (arquivoFonte === 'data_laudo') {
      record.data_referencia = record.DATA_LAUDO;
    } else if (arquivoFonte === 'data_exame') {
      record.data_referencia = record.DATA_REALIZACAO;
    } else {
      // Para arquivos padrão, usar DATA_LAUDO ou DATA_REALIZACAO como fallback
      record.data_referencia = record.DATA_LAUDO || record.DATA_REALIZACAO;
    }

    // Log especial apenas para o primeiro registro de arquivos retroativos
    if (arquivoFonte.includes('retroativo') && loteUpload.endsWith('_0')) {
      console.log(`📅 Primeiro registro retroativo - Data referência: ${record.data_referencia}`);
    }

    return record;
  } catch (error) {
    console.error('Erro ao processar linha:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_path, arquivo_fonte, periodo } = await req.json();
    
    console.log('🚀 PROCESSAMENTO OTIMIZADO INICIADO');
    console.log('📁 Arquivo:', file_path);
    console.log('🏷️ Fonte:', arquivo_fonte);
    console.log('🗓️ Período:', periodo);
    
    // Log especial para arquivos retroativos
    if (arquivo_fonte.includes('retroativo')) {
      console.log('⚠️ ARQUIVO RETROATIVO DETECTADO - Processamento especial ativado');
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

    if (logError) throw new Error(`Erro ao criar log: ${logError.message}`);

    // Baixar arquivo
    const cleanFilePath = file_path.replace(/^uploads\//, '');
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('uploads')
      .download(cleanFilePath);

    if (downloadError) {
      console.error('❌ Erro download:', downloadError);
      throw new Error(`Arquivo não encontrado: ${cleanFilePath}`);
    }

    // Processar Excel
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: true });

    console.log(`📊 Total de linhas no arquivo: ${jsonData.length}`);

    // Limpar dados anteriores do mesmo tipo de arquivo
    const periodoReferencia = periodo ? `${periodo.ano}-${periodo.mes.toString().padStart(2, '0')}` : new Date().toISOString().substring(0, 7);
    
    console.log('🧹 Limpando dados anteriores...');
    await supabaseClient
      .from('volumetria_mobilemed')
      .delete()
      .eq('arquivo_fonte', arquivo_fonte)
      .eq('periodo_referencia', periodoReferencia);

    // Processar TODOS os dados em lotes otimizados
    const loteUpload = `${arquivo_fonte}_${Date.now()}_${uploadLog.id.substring(0, 8)}`;
    const batchSize = arquivo_fonte.includes('retroativo') ? 500 : 1000; // Lotes menores para retroativos
    let totalInserted = 0;
    let totalErrors = 0;

    console.log(`📦 Processando em lotes de ${batchSize} registros (otimizado para ${arquivo_fonte})...`);

    for (let i = 0; i < jsonData.length; i += batchSize) {
      const batch = jsonData.slice(i, i + batchSize);
      const records: VolumetriaRecord[] = [];

      console.log(`📋 Processando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(jsonData.length / batchSize)} - ${batch.length} registros`);

      // Processar linhas do batch com validação extra para retroativos
      for (const row of batch) {
        const record = processRow(row, arquivo_fonte, loteUpload, periodoReferencia);
        if (record) {
          // Para arquivos retroativos, validar se tem dados mínimos necessários
          if (arquivo_fonte.includes('retroativo')) {
            if (!record.EMPRESA || !record.NOME_PACIENTE) {
              totalErrors++;
              continue;
            }
          }
          records.push(record);
        } else {
          totalErrors++;
        }
      }

      console.log(`🔍 Lote processado: ${records.length} registros válidos de ${batch.length} originais`);

      if (records.length === 0) {
        console.log('⚠️ Nenhum registro válido neste lote, pulando inserção');
        continue;
      }

      // Inserir em sub-lotes de 250 para arquivos retroativos (ainda menores)
      const subBatchSize = arquivo_fonte.includes('retroativo') ? 250 : 500;
      for (let j = 0; j < records.length; j += subBatchSize) {
        const subBatch = records.slice(j, j + subBatchSize);
        console.log(`💾 Inserindo sub-lote ${j}-${j + subBatch.length}: ${subBatch.length} registros`);
        
        try {
          const { error: insertError } = await supabaseClient
            .from('volumetria_mobilemed')
            .insert(subBatch);

          if (insertError) {
            console.error(`❌ Erro inserção lote ${i}-${j}:`, insertError.message);
            console.error('❌ Primeiro registro com erro:', JSON.stringify(subBatch[0], null, 2));
            totalErrors += subBatch.length;
          } else {
            totalInserted += subBatch.length;
            console.log(`✅ Sub-lote ${i}-${j}: ${subBatch.length} registros inseridos com sucesso`);
          }
        } catch (insertException) {
          console.error(`❌ Exceção na inserção lote ${i}-${j}:`, insertException);
          totalErrors += subBatch.length;
        }

        // Para arquivos retroativos, adicionar pequenas pausas para evitar timeout
        if (arquivo_fonte.includes('retroativo') && j % 1000 === 0) {
          console.log('⏸️ Pausa técnica para evitar timeout...');
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Atualizar progresso com mais frequência
      const progress = Math.round(((i + batchSize) / jsonData.length) * 100);
      console.log(`📈 Progresso: ${progress}% - ${totalInserted} inseridos, ${totalErrors} erros`);
      
      try {
        await supabaseClient
          .from('processamento_uploads')
          .update({
            registros_processados: Math.min(i + batchSize, jsonData.length),
            registros_inseridos: totalInserted,
            registros_erro: totalErrors,
            detalhes_erro: JSON.stringify({
              progresso: `${progress}%`,
              lote_atual: Math.floor(i / batchSize) + 1,
              total_lotes: Math.ceil(jsonData.length / batchSize),
              status: 'processando',
              arquivo_fonte: arquivo_fonte,
              timestamp: new Date().toISOString()
            })
          })
          .eq('id', uploadLog.id);
      } catch (updateError) {
        console.warn('⚠️ Erro ao atualizar progresso:', updateError);
      }
    }

    console.log('✅ PROCESSAMENTO CONCLUÍDO COM SUCESSO!');
    console.log(`📊 Estatísticas: ${totalInserted} inseridos, ${totalErrors} erros`);

    // Aplicar regras específicas para arquivos retroativos
    let registrosAtualizados = 0;
    
    if (arquivo_fonte.includes('retroativo')) {
      console.log('🔧 Aplicando regras específicas para arquivo retroativo...');
      try {
        const { data: regrasResult, error: regrasError } = await supabaseClient.functions.invoke('aplicar-regras-tratamento', {
          body: {
            arquivo_fonte: arquivo_fonte
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

    // Aplicar regras gerais de De-Para
    console.log('🔧 Aplicando regras de De-Para...');
    try {
      if (arquivo_fonte.includes('volumetria')) {
        const { data: deParaResult, error: deParaError } = await supabaseClient.rpc('aplicar_de_para_automatico', { 
          arquivo_fonte_param: arquivo_fonte 
        });
        
        if (deParaError) {
          console.warn('⚠️ Erro na aplicação de De-Para automático:', deParaError);
        } else {
          const atualizados = deParaResult?.registros_atualizados || 0;
          registrosAtualizados += atualizados;
          console.log(`✅ De-Para automático: ${atualizados} registros atualizados`);
        }
      }

      const { data: prioridadeResult, error: prioridadeError } = await supabaseClient.rpc('aplicar_de_para_prioridade');
      
      if (prioridadeError) {
        console.warn('⚠️ Erro na aplicação de De-Para prioridade:', prioridadeError);
      } else {
        const atualizados = prioridadeResult?.registros_atualizados || 0;
        registrosAtualizados += atualizados;
        console.log(`✅ De-Para prioridade: ${atualizados} registros atualizados`);
      }
    } catch (rulesError) {
      console.log('⚠️ Erro nas regras de De-Para (ignorado):', rulesError.message);
    }

    // Finalizar log
    await supabaseClient
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
          arquivo_fonte: arquivo_fonte
        })
      })
      .eq('id', uploadLog.id);

    return new Response(JSON.stringify({
      success: true,
      message: 'Processamento otimizado concluído com sucesso!',
      stats: {
        total_rows: jsonData.length,
        inserted_count: totalInserted,
        error_count: totalErrors,
        rules_applied: registrosAtualizados,
        arquivo_fonte: arquivo_fonte
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 ERRO:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});