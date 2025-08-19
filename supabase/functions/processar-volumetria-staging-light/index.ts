import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import * as XLSX from "https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🚀 PROCESSAMENTO OTIMIZADO PARA MEMÓRIA - Arquivos Grandes
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // VALIDAR REQUEST BODY
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('📨 [STAGING-LIGHT] Request body recebido completo:', JSON.stringify(requestBody, null, 2));
      console.log('📨 [STAGING-LIGHT] Tipo do requestBody:', typeof requestBody);
      console.log('📨 [STAGING-LIGHT] Keys do requestBody:', Object.keys(requestBody || {}));
    } catch (jsonError) {
      console.error('❌ [STAGING-LIGHT] Erro ao fazer parse do JSON:', jsonError);
      throw new Error('Request body inválido');
    }

    const { file_path, arquivo_fonte, periodo_referencia } = requestBody;
    
    console.log('🔍 [STAGING-LIGHT] Valores extraídos do destructuring:', {
      file_path_extraido: file_path,
      file_path_tipo: typeof file_path,
      arquivo_fonte_extraido: arquivo_fonte,
      arquivo_fonte_tipo: typeof arquivo_fonte,
      periodo_referencia_extraido: periodo_referencia
    });
    
    // VALIDAÇÕES CRÍTICAS
    if (!file_path || typeof file_path !== 'string' || file_path.trim() === '') {
      console.error('❌ [STAGING-LIGHT] file_path inválido:', { file_path, type: typeof file_path });
      console.error('💥 [STAGING-LIGHT] RequestBody completo quando file_path inválido:', requestBody);
      throw new Error('ERRO CRÍTICO: file_path obrigatório, deve ser string não-vazia');
    }
    if (!arquivo_fonte || arquivo_fonte.trim() === '') {
      console.error('❌ [STAGING-LIGHT] arquivo_fonte inválido:', { arquivo_fonte });
      throw new Error('ERRO CRÍTICO: arquivo_fonte obrigatório');
    }
    
    console.log('🚀 [STAGING-LIGHT] Processamento otimizado iniciado:', {
      file_path,
      arquivo_fonte: arquivo_fonte.substring(0, 20),
      periodo: periodo_referencia || 'jun/25'
    });

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Criar upload record
    const lote_upload = crypto.randomUUID();
    const arquivoNome = file_path.includes('/') ? file_path.split('/').pop() : file_path;
    
    const { data: uploadRecord, error: uploadError } = await supabaseClient
      .from('processamento_uploads')
      .insert({
        tipo_arquivo: arquivo_fonte,
        arquivo_nome: arquivoNome || 'arquivo.xlsx',
        status: 'processando',
        periodo_referencia: periodo_referencia || 'jun/25',
        detalhes_erro: { lote_upload, etapa: 'staging_light', inicio: new Date().toISOString() }
      })
      .select()
      .single();

    if (uploadError) {
      console.error('❌ [STAGING-LIGHT] Erro ao registrar upload:', uploadError);
      throw uploadError;
    }

    console.log('✅ [STAGING-LIGHT] Upload registrado:', uploadRecord.id);

    // 2. Download do arquivo
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('uploads')
      .download(file_path);

    if (downloadError || !fileData) {
      console.error('❌ [STAGING-LIGHT] Erro no download:', downloadError);
      await supabaseClient
        .from('processamento_uploads')
        .update({
          status: 'erro',
          detalhes_erro: { etapa: 'download', erro: 'Arquivo não encontrado', file_path },
          completed_at: new Date().toISOString()
        })
        .eq('id', uploadRecord.id);
      throw new Error(`Arquivo não encontrado: ${file_path}`);
    }

    console.log('✅ [STAGING-LIGHT] Arquivo baixado');

    // 3. Processamento OTIMIZADO para memória
    const arrayBuffer = await fileData.arrayBuffer();
    const fileSizeKB = Math.round(arrayBuffer.byteLength / 1024);
    console.log(`📊 [STAGING-LIGHT] Processando ${fileSizeKB} KB de forma otimizada`);
    
    // Configurações ULTRA-LEVES para arquivos grandes
    console.log('📖 [STAGING-LIGHT] Lendo workbook com configurações otimizadas...');
    const workbook = XLSX.read(arrayBuffer, { 
      type: 'array',
      cellDates: false,
      cellNF: false,
      cellHTML: false,
      dense: true, // Formato denso para economizar memória
      sheetStubs: false, // Não processar células vazias
      bookVBA: false, // Ignorar macros VBA
      bookSheets: false, // Não carregar metadados das sheets
      bookProps: false, // Não carregar propriedades do arquivo
      raw: false // Não usar valores raw
    });
    
    if (!workbook.SheetNames.length) {
      throw new Error('Arquivo Excel sem planilhas');
    }
    
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    console.log('📋 [STAGING-LIGHT] Convertendo planilha...');
    
    // Para arquivos muito grandes, limitar o range processado
    const MAX_ROWS = fileSizeKB > 8000 ? 3000 : (fileSizeKB > 5000 ? 10000 : 50000);
    
    // Conversão ultra-otimizada para arquivos grandes
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      defval: '',
      blankrows: false,
      skipHidden: true,
      raw: false,
      dateNF: 'yyyy-mm-dd', // Formato de data simples
      header: 1, // Usar primeira linha como header
      range: MAX_ROWS < 50000 ? `A1:Z${MAX_ROWS}` : undefined // Limitar range se necessário
    });
    
    const totalLinhas = jsonData.length;
    console.log(`📊 [STAGING-LIGHT] ${totalLinhas} registros para processar`);
    
    if (totalLinhas === 0) {
      throw new Error('Planilha vazia');
    }
    
    // Verificar colunas essenciais
    const firstRow = jsonData[0] as any;
    const colunas = Object.keys(firstRow);
    const colunasEssenciais = ['EMPRESA', 'NOME_PACIENTE'];
    
    for (const col of colunasEssenciais) {
      if (!colunas.includes(col)) {
        throw new Error(`Coluna obrigatória faltando: ${col}`);
      }
    }
    
    console.log('✅ [STAGING-LIGHT] Estrutura validada');

    // Obter período de referência formatado corretamente
    const periodoRef = periodo_referencia || 'jun/25';
    console.log(`📅 [STAGING-LIGHT] Usando período de referência: ${periodoRef}`);
    
    // 4. PROCESSAMENTO ULTRA-CONSERVADOR para arquivos gigantes
    const BATCH_SIZE = fileSizeKB > 8000 ? 10 : (fileSizeKB > 5000 ? 20 : 50);
    let totalInseridos = 0;
    let totalErros = 0;
    
    console.log(`🔄 [STAGING-LIGHT] Usando lotes de ${BATCH_SIZE} registros para arquivo de ${fileSizeKB}KB`);
    
    // Processar em chunks menores para arquivos gigantes
    const CHUNK_SIZE = Math.min(500, Math.floor(jsonData.length / 5)); // Máximo 500 registros por chunk
    
    for (let chunkStart = 0; chunkStart < jsonData.length; chunkStart += CHUNK_SIZE) {
      const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, jsonData.length);
      const chunk = jsonData.slice(chunkStart, chunkEnd);
      
      console.log(`📦 [STAGING-LIGHT] Chunk ${Math.floor(chunkStart/CHUNK_SIZE)+1}/${Math.ceil(jsonData.length/CHUNK_SIZE)} (${chunk.length} registros)`);
      
      // Processar chunk em micro-lotes
      for (let i = 0; i < chunk.length; i += BATCH_SIZE) {
        const batch = chunk.slice(i, i + BATCH_SIZE);
        const stagingRecords = [];
        
        for (const row of batch) {
          try {
            const empresa = String(row['EMPRESA'] || '').trim();
            const nomePaciente = String(row['NOME_PACIENTE'] || '').trim();
            
            if (!empresa || !nomePaciente || empresa.includes('_local')) {
              totalErros++;
              continue;
            }
            
            // Registro ultra-mínimo para conservar memória
            stagingRecords.push({
              EMPRESA: empresa.substring(0, 100),
              NOME_PACIENTE: nomePaciente.substring(0, 100),
              CODIGO_PACIENTE: String(row['CODIGO_PACIENTE'] || '').substring(0, 50) || null,
              ESTUDO_DESCRICAO: String(row['ESTUDO_DESCRICAO'] || '').substring(0, 100) || null,
              MODALIDADE: String(row['MODALIDADE'] || '').substring(0, 10) || null,
              VALORES: Number(row['VALORES']) || 0,
              ESPECIALIDADE: String(row['ESPECIALIDADE'] || '').substring(0, 50) || null,
              MEDICO: String(row['MEDICO'] || '').substring(0, 100) || null,
              periodo_referencia: periodoRef,
              arquivo_fonte: arquivo_fonte,
              lote_upload: lote_upload,
              status_processamento: 'pendente'
            });
          } catch (error) {
            totalErros++;
          }
        }
        
        // Inserir micro-lote com retry
        if (stagingRecords.length > 0) {
          try {
            await supabaseClient
              .from('volumetria_staging')
              .insert(stagingRecords);
            totalInseridos += stagingRecords.length;
          } catch (insertError) {
            console.error('❌ [STAGING-LIGHT] Erro na inserção batch:', insertError);
            totalErros += stagingRecords.length;
          }
        }
        
        // Liberação de memória mais agressiva a cada 100 registros
        if ((chunkStart + i) % 100 === 0) {
          if (globalThis.gc) globalThis.gc(); // Forçar garbage collection se disponível
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      // Pausa maior entre chunks para liberar memória
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Log de progresso
      console.log(`📊 [STAGING-LIGHT] Progresso: ${Math.round(((chunkEnd / jsonData.length) * 100))}% - ${totalInseridos} inseridos`);
    }
    
    console.log(`📊 [STAGING-LIGHT] RESULTADO: ${totalInseridos} inseridos, ${totalErros} erros`);

    // 5. Finalizar
    await supabaseClient
      .from('processamento_uploads')
      .update({
        status: 'staging_concluido',
        registros_processados: totalLinhas,
        registros_inseridos: totalInseridos,
        registros_erro: totalErros,
        detalhes_erro: {
          etapa: 'staging_light_completo',
          lote_upload: lote_upload,
          memoria_otimizada: true,
          concluido_em: new Date().toISOString()
        }
      })
      .eq('id', uploadRecord.id);

    const resultado = {
      success: true,
      message: `Staging otimizado: ${totalInseridos} registros`,
      upload_id: uploadRecord.id,
      lote_upload: lote_upload,
      registros_inseridos_staging: totalInseridos,
      registros_erro_staging: totalErros,
      otimizado_memoria: true
    };

    console.log('✅ [STAGING-LIGHT] Concluído:', resultado);

    return new Response(
      JSON.stringify(resultado),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 [STAGING-LIGHT] Erro crítico:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString(),
        optimized: true
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});