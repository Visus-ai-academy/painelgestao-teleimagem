import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import * as XLSX from "https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VolumetriaRecord {
  EMPRESA: string;
  ESTUDO_DESCRICAO: string;
  MODALIDADE: string;
  ESPECIALIDADE: string;
  MEDICO: string;
  DATA_EXAME: string;
  DATA_LAUDO: string;
  PRIORIDADE: string;
  VALORES: number;
  CATEGORIA: string;
  TIPO_FATURAMENTO: string;
  PREPARO: string;
  periodo_referencia: string;
  arquivo_fonte: string;
  lote_upload?: string;
}

// 🔄 PROCESSAMENTO DE STAGING - Primeira etapa da nova arquitetura
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_path, arquivo_fonte, periodo_referencia, periodo_processamento } = await req.json();
    
    console.log('🔄 [STAGING] Iniciando processamento para staging:', {
      file_path,
      arquivo_fonte,
      periodo_referencia
    });

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Registrar início do upload
    const lote_upload = crypto.randomUUID();
    
    const { data: uploadRecord, error: uploadError } = await supabaseClient
      .from('processamento_uploads')
      .insert({
        tipo_arquivo: arquivo_fonte,
        arquivo_nome: file_path.split('/').pop(),
        status: 'processando',
        periodo_referencia: periodo_referencia,
        detalhes_erro: {
          lote_upload: lote_upload,
          etapa: 'staging',
          inicio: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (uploadError) {
      console.error('❌ [STAGING] Erro ao registrar upload:', uploadError);
      throw uploadError;
    }

    console.log('📝 [STAGING] Upload registrado:', uploadRecord.id);

    // 2. Baixar arquivo do storage
    console.log('📥 [STAGING] Baixando arquivo do storage...');
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('uploads')
      .download(file_path);

    if (downloadError || !fileData) {
      console.error('❌ [STAGING] Erro ao baixar arquivo:', downloadError);
      await supabaseClient
        .from('processamento_uploads')
        .update({
          status: 'erro',
          detalhes_erro: { etapa: 'staging', erro: 'Erro ao baixar arquivo' },
          completed_at: new Date().toISOString()
        })
        .eq('id', uploadRecord.id);
      throw downloadError;
    }

    // 3. Ler Excel com otimização de memória
    console.log('📊 [STAGING] Lendo arquivo Excel...');
    
    let workbook, worksheet, jsonData;
    
    try {
      // Ler arquivo em chunks menores para evitar excesso de memória
      const arrayBuffer = await fileData.arrayBuffer();
      console.log(`📏 [STAGING] Arquivo: ${Math.round(arrayBuffer.byteLength / 1024)} KB`);
      
      // Configurar XLSX para usar menos memória
      workbook = XLSX.read(arrayBuffer, { 
        type: 'array',
        cellNF: false,
        cellHTML: false,
        cellFormula: false,
        cellStyles: false,
        cellDates: true,
        dense: false
      });
      
      worksheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!worksheet) {
        throw new Error('Planilha não encontrada no arquivo');
      }
      
      jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        defval: null,
        blankrows: false,
        skipHidden: true 
      });
      
      console.log(`📋 [STAGING] ${jsonData.length} registros encontrados no Excel`);
      
      // Limpar objetos grandes da memória
      workbook = null;
      worksheet = null;
      
    } catch (error) {
      console.error('❌ [STAGING] Erro ao processar Excel:', error);
      await supabaseClient
        .from('processamento_uploads')
        .update({
          status: 'erro',
          detalhes_erro: { etapa: 'staging', erro: `Erro ao processar Excel: ${error.message}` },
          completed_at: new Date().toISOString()
        })
        .eq('id', uploadRecord.id);
      throw error;
    }

    // 4. Processar em lotes menores para staging
    const BATCH_SIZE = 100;
    let totalProcessados = 0;
    let totalInseridos = 0;
    let totalErros = 0;

    for (let i = 0; i < jsonData.length; i += BATCH_SIZE) {
      const batch = jsonData.slice(i, i + BATCH_SIZE);
      
      console.log(`📦 [STAGING] Processando lote ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(jsonData.length/BATCH_SIZE)} (${batch.length} registros)`);

      const stagingRecords: any[] = [];

      // Mapear dados do Excel para formato staging
      for (const row of batch) {
        try {
          const record = {
            EMPRESA: row['EMPRESA'] || '',
            NOME_PACIENTE: row['NOME_PACIENTE'] || '',
            CODIGO_PACIENTE: row['CODIGO_PACIENTE'] || '',
            ESTUDO_DESCRICAO: row['ESTUDO_DESCRICAO'] || '',
            ACCESSION_NUMBER: row['ACCESSION_NUMBER'] || '',
            MODALIDADE: row['MODALIDADE'] || '',
            PRIORIDADE: row['PRIORIDADE'] || '',
            VALORES: Number(row['VALORES']) || 0,
            ESPECIALIDADE: row['ESPECIALIDADE'] || '',
            MEDICO: row['MEDICO'] || '',
            DUPLICADO: row['DUPLICADO'] || '',
            DATA_REALIZACAO: row['DATA_REALIZACAO'] || row['DATA_EXAME'] || null,
            HORA_REALIZACAO: row['HORA_REALIZACAO'] || null,
            DATA_TRANSFERENCIA: row['DATA_TRANSFERENCIA'] || null,
            HORA_TRANSFERENCIA: row['HORA_TRANSFERENCIA'] || null,
            DATA_LAUDO: row['DATA_LAUDO'] || null,
            HORA_LAUDO: row['HORA_LAUDO'] || null,
            DATA_PRAZO: row['DATA_PRAZO'] || null,
            HORA_PRAZO: row['HORA_PRAZO'] || null,
            STATUS: row['STATUS'] || '',
            DATA_REASSINATURA: row['DATA_REASSINATURA'] || null,
            HORA_REASSINATURA: row['HORA_REASSINATURA'] || null,
            MEDICO_REASSINATURA: row['MEDICO_REASSINATURA'] || '',
            SEGUNDA_ASSINATURA: row['SEGUNDA_ASSINATURA'] || '',
            POSSUI_IMAGENS_CHAVE: row['POSSUI_IMAGENS_CHAVE'] || '',
            IMAGENS_CHAVES: row['IMAGENS_CHAVES'] || '',
            IMAGENS_CAPTURADAS: row['IMAGENS_CAPTURADAS'] || '',
            CODIGO_INTERNO: row['CODIGO_INTERNO'] || '',
            DIGITADOR: row['DIGITADOR'] || '',
            COMPLEMENTAR: row['COMPLEMENTAR'] || '',
            CATEGORIA: row['CATEGORIA'] || '',
            tipo_faturamento: row['TIPO_FATURAMENTO'] || '',
            periodo_referencia: periodo_referencia,
            arquivo_fonte: arquivo_fonte,
            lote_upload: lote_upload,
            status_processamento: 'pendente'
          };

          stagingRecords.push(record);
          totalProcessados++;
        } catch (error) {
          console.error('⚠️ [STAGING] Erro ao mapear registro:', error);
          totalErros++;
        }
      }

      // Inserir lote na tabela staging
      if (stagingRecords.length > 0) {
        const { error: insertError } = await supabaseClient
          .from('volumetria_staging')
          .insert(stagingRecords);

        if (insertError) {
          console.error('❌ [STAGING] Erro ao inserir lote:', insertError);
          totalErros += stagingRecords.length;
        } else {
          totalInseridos += stagingRecords.length;
          console.log(`✅ [STAGING] Lote inserido: ${stagingRecords.length} registros`);
        }
      }
    }

    // 5. Atualizar status do upload
    await supabaseClient
      .from('processamento_uploads')
      .update({
        status: 'processando',
        registros_processados: totalProcessados,
        registros_inseridos: totalInseridos,
        registros_erro: totalErros,
        detalhes_erro: {
          etapa: 'staging_completo',
          registros_excel: jsonData.length,
          registros_staging: totalInseridos,
          registros_erro: totalErros,
          lote_upload: lote_upload,
          concluido_em: new Date().toISOString()
        }
      })
      .eq('id', uploadRecord.id);

    const resultado = {
      success: true,
      message: 'Staging processado com sucesso',
      upload_id: uploadRecord.id,
      lote_upload: lote_upload,
      registros_excel: jsonData.length,
      registros_inseridos: totalInseridos,
      registros_erro: totalErros
    };

    console.log('✅ [STAGING] Processamento concluído:', resultado);

    return new Response(
      JSON.stringify(resultado),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 [STAGING] Erro crítico:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});