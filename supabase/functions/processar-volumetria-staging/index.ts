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

// 🔄 PROCESSAMENTO DE STAGING OTIMIZADO - Primeira etapa da nova arquitetura
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_path, arquivo_fonte, periodo_referencia, periodo_processamento } = await req.json();
    
    console.log('🔄 [STAGING] Iniciando processamento otimizado:', {
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

    // 3. Processamento otimizado por tamanho de arquivo
    console.log('📊 [STAGING] Processando arquivo Excel otimizado...');
    
    let totalLinhas = 0;
    let totalInseridos = 0;
    
    try {
      const arrayBuffer = await fileData.arrayBuffer();
      const fileSizeKB = Math.round(arrayBuffer.byteLength / 1024);
      console.log(`📏 [STAGING] Arquivo: ${fileSizeKB} KB`);
      
      // Para arquivos grandes (>4MB), usar processamento streaming
      if (fileSizeKB > 4096) {
        console.log('🚀 [STAGING] Arquivo grande detectado - usando processamento streaming');
        
        const workbook = XLSX.read(arrayBuffer, { 
          type: 'array',
          cellNF: false,
          cellHTML: false,
          cellFormula: false,
          cellStyles: false,
          cellDates: false,
          dense: true,
          sheetRows: 0 // Ler apenas metadados primeiro
        });
        
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!worksheet) {
          throw new Error('Planilha não encontrada no arquivo');
        }
        
        // Obter total de linhas
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
        totalLinhas = Math.max(1, range.e.r);
        
        console.log(`📋 [STAGING] ${totalLinhas} linhas detectadas - processamento por chunks`);
        
        // Processar em chunks de 300 linhas para arquivos grandes
        const CHUNK_SIZE = 300;
        let processedRows = 0;
        
        for (let startRow = 1; startRow < totalLinhas; startRow += CHUNK_SIZE) {
          const endRow = Math.min(startRow + CHUNK_SIZE - 1, totalLinhas - 1);
          
          console.log(`📦 [STAGING] Chunk ${Math.floor(startRow/CHUNK_SIZE) + 1} (linhas ${startRow}-${endRow})`);
          
          // Recriar workbook apenas com o range necessário
          const rangeString = `A1:Z${endRow + 1}`;
          const chunkWorkbook = XLSX.read(arrayBuffer, {
            type: 'array',
            cellNF: false,
            cellHTML: false,
            cellFormula: false,
            cellStyles: false,
            cellDates: false,
            dense: true,
            sheetRows: endRow + 1
          });
          
          const chunkWorksheet = chunkWorkbook.Sheets[chunkWorkbook.SheetNames[0]];
          
          // Extrair apenas as linhas do chunk atual
          const chunkData = XLSX.utils.sheet_to_json(chunkWorksheet, {
            defval: null,
            blankrows: false,
            skipHidden: true,
            range: { s: { r: startRow, c: 0 }, e: { r: endRow, c: 100 } }
          });
          
          const chunkInserted = await processarChunk(
            chunkData, 
            supabaseClient, 
            lote_upload, 
            arquivo_fonte, 
            periodo_referencia
          );
          
          totalInseridos += chunkInserted;
          processedRows += chunkData.length;
          
          // Limpar objetos do chunk para liberar memória
          delete chunkWorkbook.Sheets;
          
          // Pausa para evitar sobrecarga de memória
          if (startRow % (CHUNK_SIZE * 3) === 0) {
            console.log(`⏸️ [STAGING] Pausa para limpeza de memória (processadas ${processedRows} linhas)`);
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
        
      } else {
        // Arquivos pequenos - processamento normal otimizado
        console.log('📊 [STAGING] Processamento otimizado para arquivo pequeno');
        
        const workbook = XLSX.read(arrayBuffer, { 
          type: 'array',
          cellNF: false,
          cellHTML: false,
          cellFormula: false,
          cellStyles: false,
          cellDates: false,
          dense: false
        });
        
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!worksheet) {
          throw new Error('Planilha não encontrada no arquivo');
        }
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          defval: null,
          blankrows: false,
          skipHidden: true 
        });
        
        totalLinhas = jsonData.length;
        console.log(`📋 [STAGING] ${totalLinhas} registros encontrados - processamento único`);
        
        totalInseridos = await processarChunk(
          jsonData, 
          supabaseClient, 
          lote_upload, 
          arquivo_fonte, 
          periodo_referencia
        );
        
        // Limpar workbook da memória
        delete workbook.Sheets;
      }
      
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

    // 4. Atualizar status final do upload
    await supabaseClient
      .from('processamento_uploads')
      .update({
        status: 'staging_concluido',
        registros_processados: totalLinhas,
        registros_inseridos: totalInseridos,
        registros_erro: Math.max(0, totalLinhas - totalInseridos),
        detalhes_erro: {
          etapa: 'staging_completo',
          registros_excel: totalLinhas,
          registros_staging: totalInseridos,
          registros_erro: Math.max(0, totalLinhas - totalInseridos),
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
      registros_excel: totalLinhas,
      registros_inseridos: totalInseridos,
      registros_erro: Math.max(0, totalLinhas - totalInseridos)
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
})

// Função auxiliar otimizada para processar chunks de dados
async function processarChunk(
  jsonData: any[],
  supabaseClient: any,
  lote_upload: string,
  arquivo_fonte: string,
  periodo_referencia: string
): Promise<number> {
  const BATCH_SIZE = 25; // Lotes muito pequenos para evitar timeout
  let totalInseridos = 0;

  console.log(`📦 [CHUNK] Processando ${jsonData.length} registros em lotes de ${BATCH_SIZE}...`);

  for (let i = 0; i < jsonData.length; i += BATCH_SIZE) {
    const batch = jsonData.slice(i, i + BATCH_SIZE);
    const stagingRecords: any[] = [];

    // Mapear dados do Excel para formato staging
    for (const row of batch) {
      try {
        if (!row || typeof row !== 'object') continue;

        const empresa = String(row['EMPRESA'] || '').trim();
        const nomePaciente = String(row['NOME_PACIENTE'] || '').trim();

        // Validações básicas
        if (!empresa || !nomePaciente) continue;

        // Excluir clientes com "_local"
        if (empresa.toLowerCase().includes('_local')) continue;

        const record = {
          EMPRESA: empresa,
          NOME_PACIENTE: nomePaciente,
          CODIGO_PACIENTE: String(row['CODIGO_PACIENTE'] || '').trim() || null,
          ESTUDO_DESCRICAO: String(row['ESTUDO_DESCRICAO'] || '').trim() || null,
          ACCESSION_NUMBER: String(row['ACCESSION_NUMBER'] || '').trim() || null,
          MODALIDADE: String(row['MODALIDADE'] || '').trim() || null,
          PRIORIDADE: String(row['PRIORIDADE'] || '').trim() || null,
          VALORES: Number(row['VALORES']) || 0,
          ESPECIALIDADE: String(row['ESPECIALIDADE'] || '').trim() || null,
          MEDICO: String(row['MEDICO'] || '').trim() || null,
          DUPLICADO: String(row['DUPLICADO'] || '').trim() || null,
          DATA_REALIZACAO: row['DATA_REALIZACAO'] || row['DATA_EXAME'] || null,
          HORA_REALIZACAO: row['HORA_REALIZACAO'] || null,
          DATA_TRANSFERENCIA: row['DATA_TRANSFERENCIA'] || null,
          HORA_TRANSFERENCIA: row['HORA_TRANSFERENCIA'] || null,
          DATA_LAUDO: row['DATA_LAUDO'] || null,
          HORA_LAUDO: row['HORA_LAUDO'] || null,
          DATA_PRAZO: row['DATA_PRAZO'] || null,
          HORA_PRAZO: row['HORA_PRAZO'] || null,
          STATUS: String(row['STATUS'] || '').trim() || null,
          DATA_REASSINATURA: row['DATA_REASSINATURA'] || null,
          HORA_REASSINATURA: row['HORA_REASSINATURA'] || null,
          MEDICO_REASSINATURA: String(row['MEDICO_REASSINATURA'] || '').trim() || null,
          SEGUNDA_ASSINATURA: String(row['SEGUNDA_ASSINATURA'] || '').trim() || null,
          POSSUI_IMAGENS_CHAVE: String(row['POSSUI_IMAGENS_CHAVE'] || '').trim() || null,
          IMAGENS_CHAVES: row['IMAGENS_CHAVES'] || null,
          IMAGENS_CAPTURADAS: row['IMAGENS_CAPTURADAS'] || null,
          CODIGO_INTERNO: row['CODIGO_INTERNO'] || null,
          DIGITADOR: String(row['DIGITADOR'] || '').trim() || null,
          COMPLEMENTAR: String(row['COMPLEMENTAR'] || '').trim() || null,
          CATEGORIA: String(row['CATEGORIA'] || '').trim() || null,
          tipo_faturamento: String(row['TIPO_FATURAMENTO'] || '').trim() || null,
          periodo_referencia: periodo_referencia,
          arquivo_fonte: arquivo_fonte,
          lote_upload: lote_upload,
          status_processamento: 'pendente'
        };

        stagingRecords.push(record);
      } catch (error) {
        console.error('⚠️ [CHUNK] Erro ao mapear registro:', error);
        // Continuar processamento mesmo com erro em registro individual
      }
    }

    // Inserir lote na tabela staging
    if (stagingRecords.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('volumetria_staging')
        .insert(stagingRecords);

      if (insertError) {
        console.error('❌ [CHUNK] Erro ao inserir lote:', insertError);
        // Tentar inserir registros individualmente se falhar em lote
        for (const record of stagingRecords) {
          try {
            await supabaseClient
              .from('volumetria_staging')
              .insert([record]);
            totalInseridos++;
          } catch (individualError) {
            console.error('⚠️ [CHUNK] Erro em registro individual:', individualError);
          }
        }
      } else {
        totalInseridos += stagingRecords.length;
        console.log(`✅ [CHUNK] Lote inserido: ${stagingRecords.length} registros`);
      }
    }

    // Pausa micro para não sobrecarregar o sistema
    if (i % (BATCH_SIZE * 4) === 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  console.log(`✅ [CHUNK] Processamento concluído: ${totalInseridos} registros inseridos`);
  return totalInseridos;
}