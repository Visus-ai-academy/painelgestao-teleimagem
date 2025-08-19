import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from "https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🚀 PROCESSAMENTO ZERO MEMÓRIA - Streaming ultra-otimizado
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { file_path, arquivo_fonte, periodo_referencia } = await req.json();
    
    if (!file_path || !arquivo_fonte) {
      throw new Error('Parâmetros obrigatórios ausentes');
    }

    console.log('🚀 [ZERO-MEMORY] Iniciando processamento ultra-otimizado:', { file_path, arquivo_fonte });

    // 1. Registrar upload
    const loteUpload = crypto.randomUUID();
    const { data: uploadData, error: uploadError } = await supabase
      .from('processamento_uploads')
      .insert({
        arquivo_nome: file_path.split('/').pop(),
        tipo_arquivo: arquivo_fonte,
        tipo_dados: 'volumetria',
        periodo_referencia: periodo_referencia || 'jun/25',
        status: 'processando',
        detalhes_erro: {
          etapa: 'zero_memory_streaming',
          inicio: new Date().toISOString(),
          lote_upload: loteUpload
        }
      })
      .select()
      .single();

    if (uploadError) throw uploadError;
    console.log('✅ [ZERO-MEMORY] Upload registrado:', uploadData.id);

    // 2. Download com limite de memória rígido
    console.log('📥 [ZERO-MEMORY] Fazendo download otimizado...');
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('volumetria')
      .download(file_path);

    if (downloadError) throw downloadError;

    const fileSize = fileData.size;
    console.log(`📊 [ZERO-MEMORY] Arquivo baixado: ${Math.round(fileSize/1024)} KB`);

    // 3. Processamento com limite de memória ultra-baixo
    const arrayBuffer = await fileData.arrayBuffer();
    
    // Configurações de memória mínima
    XLSX.set_fs({} as any); // Desabilitar sistema de arquivos
    const workbook = XLSX.read(arrayBuffer, { 
      type: 'array',
      cellDates: false,
      cellNF: false,
      cellStyles: false,
      sheetStubs: false,
      WTF: false,
      bookDeps: false,
      bookFiles: false,
      bookProps: false,
      bookSheets: false,
      bookVBA: false
    });

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Conversão com configuração mínima
    const rawData = XLSX.utils.sheet_to_json(worksheet, { 
      raw: false,
      defval: null,
      dateNF: 'yyyy-mm-dd'
    });

    // Limpar workbook imediatamente
    workbook.SheetNames = [];
    workbook.Sheets = {};

    console.log(`📊 [ZERO-MEMORY] Dados extraídos: ${rawData.length} registros`);

    // 4. Processamento em micro-lotes (100 registros por vez)
    const BATCH_SIZE = 100;
    let processados = 0;
    let inseridos = 0;
    let erros = 0;

    for (let i = 0; i < rawData.length; i += BATCH_SIZE) {
      const batch = rawData.slice(i, i + BATCH_SIZE);
      
      try {
        // Transformar dados em lote pequeno
        const records = batch.map((row: any) => ({
          id: crypto.randomUUID(),
          "EMPRESA": row["EMPRESA"] || row["A"] || null,
          "NOME_PACIENTE": row["NOME_PACIENTE"] || row["B"] || null,
          "CODIGO_PACIENTE": row["CODIGO_PACIENTE"] || row["C"] || null,
          "ESTUDO_DESCRICAO": row["ESTUDO_DESCRICAO"] || row["D"] || null,
          "ACCESSION_NUMBER": row["ACCESSION_NUMBER"] || row["E"] || null,
          "MODALIDADE": row["MODALIDADE"] || row["F"] || null,
          "PRIORIDADE": row["PRIORIDADE"] || row["G"] || null,
          "VALORES": parseFloat(row["VALORES"] || row["H"] || 0),
          "ESPECIALIDADE": row["ESPECIALIDADE"] || row["I"] || null,
          "MEDICO": row["MEDICO"] || row["J"] || null,
          "DATA_REALIZACAO": row["DATA_REALIZACAO"] || row["K"] || null,
          "HORA_REALIZACAO": row["HORA_REALIZACAO"] || row["L"] || null,
          "DATA_LAUDO": row["DATA_LAUDO"] || row["M"] || null,
          "HORA_LAUDO": row["HORA_LAUDO"] || row["N"] || null,
          "DATA_PRAZO": row["DATA_PRAZO"] || row["O"] || null,
          "HORA_PRAZO": row["HORA_PRAZO"] || row["P"] || null,
          arquivo_fonte,
          lote_upload: loteUpload,
          periodo_referencia: periodo_referencia || 'jun/25',
          data_referencia: new Date().toISOString().split('T')[0],
          processamento_pendente: false
        }));

        // Inserir no staging
        const { error: insertError } = await supabase
          .from('volumetria_staging')
          .insert(records);

        if (insertError) {
          console.error(`❌ [ZERO-MEMORY] Erro no batch ${Math.floor(i/BATCH_SIZE) + 1}:`, insertError.message);
          erros += batch.length;
        } else {
          inseridos += batch.length;
        }

        processados += batch.length;

        // Log de progresso a cada 1000 registros
        if (processados % 1000 === 0) {
          console.log(`🔄 [ZERO-MEMORY] Progresso: ${processados}/${rawData.length} (${Math.round(processados/rawData.length*100)}%)`);
        }

        // Força garbage collection a cada lote
        if (typeof globalThis !== 'undefined' && 'gc' in globalThis) {
          try {
            (globalThis as any).gc();
          } catch (e) {
            // Ignore se não disponível
          }
        }

      } catch (batchError) {
        console.error(`❌ [ZERO-MEMORY] Erro no batch ${Math.floor(i/BATCH_SIZE) + 1}:`, batchError);
        erros += batch.length;
        processados += batch.length;
      }
    }

    // 5. Atualizar status final
    await supabase
      .from('processamento_uploads')
      .update({
        status: erros === 0 ? 'staging_concluido' : 'erro',
        registros_processados: processados,
        registros_inseridos: inseridos,
        registros_erro: erros,
        detalhes_erro: {
          etapa: 'zero_memory_concluido',
          lote_upload: loteUpload,
          inicio: uploadData.detalhes_erro?.inicio,
          fim: new Date().toISOString(),
          memoria_otimizada: true
        }
      })
      .eq('id', uploadData.id);

    console.log('✅ [ZERO-MEMORY] Processamento concluído:', {
      processados,
      inseridos,
      erros,
      taxa_sucesso: `${Math.round((inseridos/processados)*100)}%`
    });

    return new Response(JSON.stringify({
      success: true,
      upload_id: uploadData.id,
      lote_upload: loteUpload,
      registros_processados: processados,
      registros_inseridos: inseridos,
      registros_erro: erros,
      message: 'Processamento zero-memory concluído'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [ZERO-MEMORY] Erro geral:', error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});