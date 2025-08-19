import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import * as XLSX from "https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🚀 PROCESSAMENTO STREAMING ULTRA-LEVE - ZERO MEMÓRIA
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_path, arquivo_fonte, periodo_referencia } = await req.json();
    
    if (!file_path || !arquivo_fonte) {
      throw new Error('file_path e arquivo_fonte obrigatórios');
    }
    
    console.log('🎯 [STREAMING] Processamento streaming iniciado:', { file_path, arquivo_fonte });

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Registrar upload
    const lote_upload = crypto.randomUUID();
    const arquivoNome = file_path.includes('/') ? file_path.split('/').pop() : file_path;
    
    const { data: uploadRecord, error: uploadError } = await supabaseClient
      .from('processamento_uploads')
      .insert({
        tipo_arquivo: arquivo_fonte,
        arquivo_nome: arquivoNome || 'arquivo.xlsx',
        status: 'processando',
        periodo_referencia: periodo_referencia || 'jun/25',
        detalhes_erro: { lote_upload, etapa: 'streaming', inicio: new Date().toISOString() }
      })
      .select()
      .single();

    if (uploadError) throw uploadError;
    console.log('✅ [STREAMING] Upload registrado:', uploadRecord.id);

    // 2. Download arquivo
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('uploads')
      .download(file_path);

    if (downloadError || !fileData) {
      await supabaseClient
        .from('processamento_uploads')
        .update({
          status: 'erro',
          detalhes_erro: { etapa: 'download', erro: 'Arquivo não encontrado' },
          completed_at: new Date().toISOString()
        })
        .eq('id', uploadRecord.id);
      throw new Error(`Arquivo não encontrado: ${file_path}`);
    }

    console.log('✅ [STREAMING] Arquivo baixado');

    // 3. PROCESSAMENTO STREAMING EXTREMAMENTE LEVE
    const arrayBuffer = await fileData.arrayBuffer();
    const fileSizeKB = Math.round(arrayBuffer.byteLength / 1024);
    console.log(`📊 [STREAMING] Arquivo ${fileSizeKB}KB - processando streaming`);
    
    // Configurações ULTRA-MÍNIMAS para evitar memory limit
    const workbook = XLSX.read(arrayBuffer, { 
      type: 'array',
      cellDates: false,
      cellNF: false,
      cellHTML: false,
      dense: true,
      sheetStubs: false,
      bookVBA: false,
      bookSheets: false,
      bookProps: false,
      raw: false
    });
    
    if (!workbook.SheetNames.length) {
      throw new Error('Excel sem planilhas');
    }
    
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    
    // STREAMING: processar apenas 50 linhas por vez
    const MICRO_CHUNK = 50;
    let totalInseridos = 0;
    let totalErros = 0;
    let currentRow = 1; // Começar da linha 2 (pular header)
    
    console.log('🔄 [STREAMING] Iniciando processamento em micro-chunks de 50 linhas');
    
    while (true) {
      // Liberar memória agressivamente
      if (globalThis.gc) globalThis.gc();
      
      // Ler apenas um micro-chunk por vez
      const range = `A${currentRow + 1}:Z${currentRow + MICRO_CHUNK}`;
      
      let chunkData;
      try {
        chunkData = XLSX.utils.sheet_to_json(worksheet, { 
          defval: '',
          blankrows: false,
          raw: false,
          range: range
        });
      } catch (err) {
        console.log('📋 [STREAMING] Fim dos dados ou erro na leitura');
        break;
      }
      
      if (!chunkData || chunkData.length === 0) {
        console.log('📋 [STREAMING] Fim dos dados');
        break;
      }
      
      console.log(`📦 [STREAMING] Chunk ${Math.floor(currentRow/MICRO_CHUNK)+1}: ${chunkData.length} linhas`);
      
      // Processar micro-chunk em lotes de 5 para evitar memory limit
      const MINI_BATCH = 5;
      for (let i = 0; i < chunkData.length; i += MINI_BATCH) {
        const miniBatch = chunkData.slice(i, i + MINI_BATCH);
        const stagingRecords = [];
        
        for (const row of miniBatch) {
          try {
            const empresa = String(row['EMPRESA'] || '').trim();
            const nomePaciente = String(row['NOME_PACIENTE'] || '').trim();
            
            if (!empresa || !nomePaciente || empresa.includes('_local')) {
              totalErros++;
              continue;
            }
            
            // Record mínimo para conservar memória
            stagingRecords.push({
              EMPRESA: empresa.substring(0, 100),
              NOME_PACIENTE: nomePaciente.substring(0, 100),
              CODIGO_PACIENTE: String(row['CODIGO_PACIENTE'] || '').substring(0, 50) || null,
              ESTUDO_DESCRICAO: String(row['ESTUDO_DESCRICAO'] || '').substring(0, 100) || null,
              MODALIDADE: String(row['MODALIDADE'] || '').substring(0, 10) || null,
              VALORES: Number(row['VALORES']) || 0,
              ESPECIALIDADE: String(row['ESPECIALIDADE'] || '').substring(0, 50) || null,
              MEDICO: String(row['MEDICO'] || '').substring(0, 100) || null,
              periodo_referencia: periodo_referencia || 'jun/25',
              arquivo_fonte: arquivo_fonte,
              lote_upload: lote_upload,
              status_processamento: 'pendente'
            });
          } catch (error) {
            totalErros++;
          }
        }
        
        // Inserir mini-lote
        if (stagingRecords.length > 0) {
          try {
            await supabaseClient
              .from('volumetria_staging')
              .insert(stagingRecords);
            totalInseridos += stagingRecords.length;
          } catch (insertError) {
            console.error('❌ [STREAMING] Erro inserção:', insertError);
            totalErros += stagingRecords.length;
          }
        }
        
        // Pausa para liberar memória
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      currentRow += MICRO_CHUNK;
      
      // Pausa maior entre chunks
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Progress log
      if (currentRow % 500 === 0) {
        console.log(`📊 [STREAMING] Progresso: ${totalInseridos} inseridos até agora`);
      }
    }
    
    console.log(`📊 [STREAMING] FINAL: ${totalInseridos} inseridos, ${totalErros} erros`);

    // 4. Finalizar upload
    await supabaseClient
      .from('processamento_uploads')
      .update({
        status: 'staging_concluido',
        registros_processados: totalInseridos + totalErros,
        registros_inseridos: totalInseridos,
        registros_erro: totalErros,
        detalhes_erro: {
          etapa: 'streaming_completo',
          lote_upload: lote_upload,
          streaming_otimizado: true,
          concluido_em: new Date().toISOString()
        }
      })
      .eq('id', uploadRecord.id);

    const resultado = {
      success: true,
      message: `Streaming: ${totalInseridos} registros`,
      upload_id: uploadRecord.id,
      lote_upload: lote_upload,
      registros_inseridos_staging: totalInseridos,
      registros_erro_staging: totalErros,
      streaming_otimizado: true
    };

    console.log('✅ [STREAMING] Concluído:', resultado);

    return new Response(
      JSON.stringify(resultado),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 [STREAMING] Erro:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString(),
        streaming: true
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});