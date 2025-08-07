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

    const empresaOriginal = row['EMPRESA'] || '';
    const nomePaciente = row['NOME_PACIENTE'] || '';

    if (!empresaOriginal.trim() || !nomePaciente.trim()) return null;

    // REGRA: Excluir clientes com "_local" no nome (maiúscula ou minúscula)
    if (empresaOriginal.toLowerCase().includes('_local')) {
      return null;
    }

    // Não aplicar limpeza aqui pois processRow é síncrono - será aplicado via trigger SQL
    const empresa = empresaOriginal.trim();

    const safeString = (value: any): string | undefined => {
      if (value === null || value === undefined || value === '') return undefined;
      return String(value).trim() || undefined;
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
      record.data_referencia = record.DATA_LAUDO || record.DATA_REALIZACAO;
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
    console.log('🚀 PROCESSAMENTO OTIMIZADO INICIADO');
    
    const requestData = await req.json();
    console.log('📦 Dados recebidos:', JSON.stringify(requestData));
    
    const { file_path, arquivo_fonte, periodo } = requestData;
    
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

    // Processar registros
    const loteUpload = `${arquivo_fonte}_${Date.now()}_${uploadLog.id.substring(0, 8)}`;
    const batchSize = 500; // Lote menor para teste
    let totalInserted = 0;
    let totalErrors = 0;

    console.log(`📦 Processando ${jsonData.length} registros em lotes de ${batchSize}`);

    // Processar em chunks
    for (let i = 0; i < jsonData.length; i += batchSize) {
      const batch = jsonData.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(jsonData.length / batchSize);
      
      console.log(`📋 Processando lote ${batchNumber}/${totalBatches} (${i + 1}-${Math.min(i + batchSize, jsonData.length)})`);

      const records: VolumetriaRecord[] = [];

      // Processar registros
      for (const row of batch) {
        try {
          const record = processRow(row, arquivo_fonte, loteUpload, periodoReferencia);
          if (record && record.EMPRESA && record.NOME_PACIENTE) {
            records.push(record);
          } else {
            totalErrors++;
          }
        } catch (rowError) {
          console.error('❌ Erro ao processar linha:', rowError);
          totalErrors++;
        }
      }

      if (records.length === 0) {
        console.log(`⚠️ Lote ${batchNumber}: Sem registros válidos`);
        continue;
      }

      console.log(`✅ Lote ${batchNumber}: ${records.length} registros preparados para inserção`);

      // Inserir registros
      try {
        const { error: insertError } = await supabaseClient
          .from('volumetria_mobilemed')
          .insert(records);

        if (insertError) {
          console.error(`❌ Erro ao inserir lote ${batchNumber}:`, insertError);
          totalErrors += records.length;
        } else {
          totalInserted += records.length;
          console.log(`✅ Lote ${batchNumber}: ${records.length} registros inseridos`);
        }
      } catch (insertException) {
        console.error(`❌ Exceção ao inserir lote ${batchNumber}:`, insertException);
        totalErrors += records.length;
      }

      // Atualizar progresso
      const processedCount = Math.min(i + batchSize, jsonData.length);
      const progress = Math.min(Math.round((processedCount / jsonData.length) * 100), 100);
      
      console.log(`📈 Progresso: ${progress}% (${processedCount}/${jsonData.length}) - ${totalInserted} inseridos, ${totalErrors} erros`);
    }

    console.log('✅ PROCESSAMENTO BÁSICO CONCLUÍDO!');
    console.log(`📊 Resultado: ${totalInserted} inseridos, ${totalErrors} erros de ${jsonData.length} registros`);

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
        // Para arquivos não-retroativos: aplicar exclusões por período também
        console.log('🗑️ Aplicando exclusões por período (arquivos não-retroativos)...');
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
            
            if (registrosExcluidos > 0) {
              console.log(`🗑️ IMPORTANTE: ${registrosExcluidos} registros excluídos por regras de data`);
            }
          }
        } catch (exclusoesException) {
          console.warn('⚠️ Exceção nas exclusões:', exclusoesException);
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

    // Finalizar log
    await supabaseClient
      .from('processamento_uploads')
      .update({
        status: totalInserted > 0 ? 'concluido' : 'erro',
        registros_processados: jsonData.length,
        registros_inseridos: totalInserted,
        registros_erro: totalErrors,
        detalhes_erro: totalInserted === 0 ? JSON.stringify({ erro: 'Nenhum registro foi inserido' }) : null
      })
      .eq('id', uploadLog.id);

    console.log('🎯 PROCESSAMENTO FINALIZADO!');

    return new Response(JSON.stringify({
      success: true,
      total_registros: jsonData.length,
      registros_inseridos: totalInserted,
      registros_erro: totalErrors,
      upload_id: uploadLog.id
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