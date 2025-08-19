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

    // 3. Ler Excel com STREAMING para arquivos grandes
    console.log('📊 [STAGING] Processando arquivo Excel em streaming...');
    
    let totalLinhas = 0;
    let processedBatches = 0;
    
    try {
      const arrayBuffer = await fileData.arrayBuffer();
      const fileSizeKB = Math.round(arrayBuffer.byteLength / 1024);
      console.log(`📏 [STAGING] Arquivo: ${fileSizeKB} KB`);
      
      // Para arquivos grandes (>3MB), processar em chunks
      if (fileSizeKB > 3072) { // 3MB
        console.log('🔄 [STAGING] Arquivo grande detectado - usando processamento streaming');
        
        // Ler Excel otimizado para arquivos grandes
        const workbook = XLSX.read(arrayBuffer, { 
          type: 'array',
          cellNF: false,
          cellHTML: false,
          cellFormula: false,
          cellStyles: false,
          cellDates: false, // Desabilitar parsing de datas para economizar memória
          dense: true, // Usar formato denso
          sheetRows: 1000 // Limitar linhas por vez
        });
        
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!worksheet) {
          throw new Error('Planilha não encontrada no arquivo');
        }
        
        // Obter range da planilha
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
        totalLinhas = range.e.r + 1;
        console.log(`📋 [STAGING] ${totalLinhas} linhas detectadas no Excel`);
        
        // Processar em chunks de 500 linhas
        const CHUNK_SIZE = 500;
        for (let startRow = 1; startRow < totalLinhas; startRow += CHUNK_SIZE) {
          const endRow = Math.min(startRow + CHUNK_SIZE - 1, totalLinhas - 1);
          
          console.log(`📦 [STAGING] Processando chunk ${Math.floor(startRow/CHUNK_SIZE) + 1} (linhas ${startRow}-${endRow})`);
          
          // Criar nova planilha apenas com o chunk atual
          const chunkWorksheet = {};
          const chunkRange = `A1:Z${endRow - startRow + 2}`; // +2 para incluir cabeçalho
          
          // Copiar cabeçalho
          for (let col = range.s.c; col <= range.e.c; col++) {
            const headerAddr = XLSX.utils.encode_cell({ r: 0, c: col });
            const headerCell = worksheet[headerAddr];
            if (headerCell) {
              const newHeaderAddr = XLSX.utils.encode_cell({ r: 0, c: col });
              chunkWorksheet[newHeaderAddr] = headerCell;
            }
          }
          
          // Copiar dados do chunk
          for (let row = startRow; row <= endRow; row++) {
            for (let col = range.s.c; col <= range.e.c; col++) {
              const cellAddr = XLSX.utils.encode_cell({ r: row, c: col });
              const cell = worksheet[cellAddr];
              if (cell) {
                const newRowIndex = row - startRow + 1; // +1 para pular cabeçalho
                const newCellAddr = XLSX.utils.encode_cell({ r: newRowIndex, c: col });
                chunkWorksheet[newCellAddr] = cell;
              }
            }
          }
          
          chunkWorksheet['!ref'] = chunkRange;
          
          // Converter chunk para JSON
          const chunkData = XLSX.utils.sheet_to_json(chunkWorksheet, { 
            defval: null,
            blankrows: false,
            skipHidden: true 
          });
          
          // Processar chunk
          await processarChunk(chunkData, supabaseClient, lote_upload, arquivo_fonte, periodo_referencia);
          processedBatches++;
          
          // Limpar chunk da memória
          Object.keys(chunkWorksheet).forEach(key => delete chunkWorksheet[key]);
          
          // Pausa para evitar sobrecarga
          if (processedBatches % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        console.log(`✅ [STAGING] ${processedBatches} chunks processados`);
        
      } else {
        // Arquivos pequenos - processamento normal
        console.log('📊 [STAGING] Processamento normal para arquivo pequeno');
        const workbook = XLSX.read(arrayBuffer, { 
          type: 'array',
          cellNF: false,
          cellHTML: false,
          cellFormula: false,
          cellStyles: false,
          cellDates: true,
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
        console.log(`📋 [STAGING] ${totalLinhas} registros encontrados no Excel`);
        
        await processarChunk(jsonData, supabaseClient, lote_upload, arquivo_fonte, periodo_referencia);
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

    // 5. Atualizar estatísticas finais
    const { data: stagingStats } = await supabaseClient
      .from('volumetria_staging')
      .select('id', { count: 'exact' })
      .eq('lote_upload', lote_upload);

    const totalInseridos = stagingStats?.length || 0;

    // 6. Atualizar status do upload
    await supabaseClient
      .from('processamento_uploads')
      .update({
        status: 'processando',
        registros_processados: totalLinhas,
        registros_inseridos: totalInseridos,
        registros_erro: totalLinhas - totalInseridos,
        detalhes_erro: {
          etapa: 'staging_completo',
          registros_excel: totalLinhas,
          registros_staging: totalInseridos,
          registros_erro: totalLinhas - totalInseridos,
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
      registros_erro: totalLinhas - totalInseridos
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