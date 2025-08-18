import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import * as XLSX from 'https://deno.land/x/xlsx@0.18.5/mod.ts'

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VolumetriaRecord {
  id?: string;
  EMPRESA?: string;
  NOME_PACIENTE?: string;
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
  IMAGENS_CHAVES?: string;
  IMAGENS_CAPTURADAS?: string;
  CODIGO_INTERNO?: string;
  DIGITADOR?: string;
  COMPLEMENTAR?: string;
  data_referencia?: Date;
  arquivo_fonte?: string;
  lote_upload?: string;
  periodo_referencia?: string;
  CATEGORIA?: string;
  tipo_faturamento?: string;
  processamento_pendente?: boolean;
}

// Upload rápido para staging - SEM REGRAS
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_path, arquivo_fonte, periodo_referencia, periodo_processamento } = await req.json();
    
    console.log('🚀 UPLOAD STAGING - Iniciando processamento rápido', {
      file_path,
      arquivo_fonte,
      periodo_referencia
    });

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const loteUpload = `${arquivo_fonte}_${new Date().getTime()}`;

    // 1. REGISTRAR INÍCIO DO UPLOAD
    const { data: uploadRecord, error: uploadError } = await supabaseClient
      .from('processamento_uploads')
      .insert({
        arquivo_nome: file_path.split('/').pop(),
        tipo_arquivo: arquivo_fonte,
        tipo_dados: 'volumetria',
        periodo_referencia: periodo_referencia,
        status: 'processando',
        registros_processados: 0,
        registros_inseridos: 0,
        detalhes_erro: JSON.stringify({ fase: 'iniciando_staging' })
      })
      .select()
      .single();

    if (uploadError) {
      console.error('❌ Erro ao registrar upload:', uploadError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao registrar upload' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. BAIXAR E PROCESSAR ARQUIVO
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('uploads')
      .download(file_path);

    if (downloadError) {
      console.error('❌ Erro no download:', downloadError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro no download do arquivo' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. LER EXCEL
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    console.log(`📄 Arquivo lido: ${jsonData.length} registros para staging`);

    // 4. INSERÇÃO RÁPIDA NO STAGING - SEM REGRAS!
    let totalInserted = 0;
    let totalErrors = 0;
    const batchSize = 1000;

    for (let i = 0; i < jsonData.length; i += batchSize) {
      const batch = jsonData.slice(i, i + batchSize);
      const processedBatch = batch.map(row => {
        const record: VolumetriaRecord = {
          EMPRESA: row['EMPRESA']?.toString() || null,
          NOME_PACIENTE: row['NOME_PACIENTE']?.toString() || null,
          CODIGO_PACIENTE: row['CODIGO_PACIENTE']?.toString() || null,
          ESTUDO_DESCRICAO: row['ESTUDO_DESCRICAO']?.toString() || null,
          ACCESSION_NUMBER: row['ACCESSION_NUMBER']?.toString() || null,
          MODALIDADE: row['MODALIDADE']?.toString() || null,
          PRIORIDADE: row['PRIORIDADE']?.toString() || null,
          VALORES: parseFloat(row['VALORES']) || 0,
          ESPECIALIDADE: row['ESPECIALIDADE']?.toString() || null,
          MEDICO: row['MEDICO']?.toString() || null,
          DUPLICADO: row['DUPLICADO']?.toString() || null,
          DATA_REALIZACAO: row['DATA_REALIZACAO'] ? new Date(row['DATA_REALIZACAO']) : null,
          HORA_REALIZACAO: row['HORA_REALIZACAO']?.toString() || null,
          DATA_TRANSFERENCIA: row['DATA_TRANSFERENCIA'] ? new Date(row['DATA_TRANSFERENCIA']) : null,
          HORA_TRANSFERENCIA: row['HORA_TRANSFERENCIA']?.toString() || null,
          DATA_LAUDO: row['DATA_LAUDO'] ? new Date(row['DATA_LAUDO']) : null,
          HORA_LAUDO: row['HORA_LAUDO']?.toString() || null,
          DATA_PRAZO: row['DATA_PRAZO'] ? new Date(row['DATA_PRAZO']) : null,
          HORA_PRAZO: row['HORA_PRAZO']?.toString() || null,
          STATUS: row['STATUS']?.toString() || null,
          DATA_REASSINATURA: row['DATA_REASSINATURA'] ? new Date(row['DATA_REASSINATURA']) : null,
          HORA_REASSINATURA: row['HORA_REASSINATURA']?.toString() || null,
          MEDICO_REASSINATURA: row['MEDICO_REASSINATURA']?.toString() || null,
          SEGUNDA_ASSINATURA: row['SEGUNDA_ASSINATURA']?.toString() || null,
          POSSUI_IMAGENS_CHAVE: row['POSSUI_IMAGENS_CHAVE']?.toString() || null,
          IMAGENS_CHAVES: row['IMAGENS_CHAVES']?.toString() || null,
          IMAGENS_CAPTURADAS: row['IMAGENS_CAPTURADAS']?.toString() || null,
          CODIGO_INTERNO: row['CODIGO_INTERNO']?.toString() || null,
          DIGITADOR: row['DIGITADOR']?.toString() || null,
          COMPLEMENTAR: row['COMPLEMENTAR']?.toString() || null,
          data_referencia: periodo_processamento ? 
            new Date(periodo_processamento.ano, periodo_processamento.mes - 1, 1) : 
            new Date(),
          arquivo_fonte: arquivo_fonte,
          lote_upload: loteUpload,
          periodo_referencia: periodo_referencia,
          CATEGORIA: row['CATEGORIA']?.toString() || null,
          tipo_faturamento: null,
          processamento_pendente: true
        };

        return record;
      });

      // Inserir no STAGING sem validações
      const { data: insertData, error: insertError } = await supabaseClient
        .from('volumetria_staging')
        .insert(processedBatch);

      if (insertError) {
        console.error(`❌ Erro no batch ${i}-${i + batchSize}:`, insertError);
        totalErrors += batch.length;
      } else {
        totalInserted += batch.length;
        console.log(`✅ Batch ${i}-${i + batchSize} inserido no staging`);
      }
    }

    // 5. ATUALIZAR STATUS DO UPLOAD
    await supabaseClient
      .from('processamento_uploads')
      .update({
        status: 'staging_concluido',
        registros_processados: jsonData.length,
        registros_inseridos: totalInserted,
        registros_erro: totalErrors,
        detalhes_erro: JSON.stringify({
          fase: 'staging_concluido',
          total_staging: totalInserted,
          aguardando_processamento: true
        }),
        completed_at: new Date().toISOString()
      })
      .eq('id', uploadRecord.id);

    // 6. INICIAR PROCESSAMENTO EM BACKGROUND
    console.log('🔄 Iniciando processamento em background...');
    
    supabaseClient.functions.invoke('processar-staging-background', {
      body: { 
        lote_upload: loteUpload,
        arquivo_fonte: arquivo_fonte,
        upload_record_id: uploadRecord.id 
      }
    }).then(() => {
      console.log('🚀 Background processing iniciado');
    }).catch(err => {
      console.error('⚠️ Erro ao iniciar background:', err);
    });

    console.log('✅ UPLOAD STAGING CONCLUÍDO!', {
      total_inserido: totalInserted,
      total_erros: totalErrors,
      background_iniciado: true
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Upload para staging concluído, processamento em background iniciado',
        stats: {
          total_processado: jsonData.length,
          total_inserido: totalInserted,
          total_erros: totalErrors,
          aguardando_processamento: true
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro fatal:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});