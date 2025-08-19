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
    } catch (jsonError) {
      console.error('❌ [STAGING-LIGHT] Erro ao fazer parse do JSON:', jsonError);
      throw new Error('Request body inválido');
    }

    const { file_path, arquivo_fonte, periodo_referencia } = requestBody;
    
    // VALIDAÇÕES CRÍTICAS
    if (!file_path || typeof file_path !== 'string') {
      throw new Error('file_path obrigatório e deve ser string');
    }
    if (!arquivo_fonte) {
      throw new Error('arquivo_fonte obrigatório');
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
    
    // Configurações ultra-leves para Excel
    const workbook = XLSX.read(arrayBuffer, { 
      type: 'array',
      cellDates: false,
      cellNF: false,
      cellHTML: false,
      dense: true, // Usar modo denso para economizar memória
      sheetStubs: false // Não processar células vazias
    });
    
    if (!workbook.SheetNames.length) {
      throw new Error('Arquivo Excel sem planilhas');
    }
    
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    console.log('📋 [STAGING-LIGHT] Convertendo planilha...');
    
    // Conversão otimizada com limite de memória
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      defval: '',
      blankrows: false,
      skipHidden: true,
      raw: false,
      range: 0 // Processar apenas o necessário
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

    // 4. Inserção em MICRO-LOTES para economizar memória
    const MICRO_BATCH = 10; // Lotes ultra pequenos
    let totalInseridos = 0;
    let totalErros = 0;
    
    for (let i = 0; i < jsonData.length; i += MICRO_BATCH) {
      const microBatch = jsonData.slice(i, i + MICRO_BATCH);
      console.log(`🔄 [STAGING-LIGHT] Processando micro-lote ${Math.floor(i/MICRO_BATCH)+1}`);
      
      const stagingRecords = [];
      
      for (const row of microBatch) {
        try {
          const empresa = String(row['EMPRESA'] || '').trim();
          const nomePaciente = String(row['NOME_PACIENTE'] || '').trim();
          
          if (!empresa || !nomePaciente || empresa.includes('_local')) {
            totalErros++;
            continue;
          }
          
          // Registro mínimo para economizar memória
          stagingRecords.push({
            EMPRESA: empresa,
            NOME_PACIENTE: nomePaciente,
            CODIGO_PACIENTE: String(row['CODIGO_PACIENTE'] || '').trim() || null,
            ESTUDO_DESCRICAO: String(row['ESTUDO_DESCRICAO'] || '').trim() || null,
            MODALIDADE: String(row['MODALIDADE'] || '').trim() || null,
            VALORES: Number(row['VALORES']) || 0,
            ESPECIALIDADE: String(row['ESPECIALIDADE'] || '').trim() || null,
            MEDICO: String(row['MEDICO'] || '').trim() || null,
            periodo_referencia: periodo_referencia || 'jun/25',
            arquivo_fonte: arquivo_fonte,
            lote_upload: lote_upload,
            status_processamento: 'pendente'
          });
        } catch (error) {
          console.error('⚠️ [STAGING-LIGHT] Erro no registro:', error);
          totalErros++;
        }
      }
      
      // Inserir micro-lote
      if (stagingRecords.length > 0) {
        try {
          await supabaseClient
            .from('volumetria_staging')
            .insert(stagingRecords);
          totalInseridos += stagingRecords.length;
        } catch (insertError) {
          console.error('❌ [STAGING-LIGHT] Erro na inserção:', insertError);
          totalErros += stagingRecords.length;
        }
      }
      
      // Pausa entre micro-lotes para liberar memória
      if (i % 50 === 0) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
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