import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ⚡ UPLOAD ULTRA-SIMPLES - SEM LOOPS COMPLEXOS
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_path, arquivo_fonte } = await req.json();
    
    console.log('📊 [ULTRA-SIMPLES] Processando:', file_path);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const lote_upload = crypto.randomUUID();

    // 1. BAIXAR E LER ARQUIVO (MÉTODO DIRETO)
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('uploads')
      .download(file_path);

    if (downloadError) throw downloadError;
    
    // 2. PROCESSAR EXCEL DIRETO (SEM LOOPS)
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    console.log(`📊 [ULTRA-SIMPLES] ${jsonData.length} registros encontrados`);

    // 3. BUSCAR DE-PARA (SIMPLES)
    const { data: deParaRules } = await supabaseClient
      .from('valores_referencia_de_para')
      .select('estudo_descricao, valores')
      .eq('ativo', true);

    const deParaMap = new Map();
    deParaRules?.forEach(rule => {
      deParaMap.set(rule.estudo_descricao, rule.valores);
    });

    // 4. MAPEAR REGISTROS (MÉTODO DIRETO - SEM LOOPS COMPLEXOS)
    let totalZeradosCorrigidos = 0;
    
    const registrosProcessados = jsonData.map((row: any) => {
      let valorFinal = parseFloat(row.VALORES) || 0;
      if (valorFinal === 0 && deParaMap.has(row.ESTUDO_DESCRICAO)) {
        valorFinal = deParaMap.get(row.ESTUDO_DESCRICAO);
        totalZeradosCorrigidos++;
      }

      return {
        id: crypto.randomUUID(),
        "EMPRESA": row.EMPRESA,
        "NOME_PACIENTE": row.NOME_PACIENTE,
        "CODIGO_PACIENTE": row.CODIGO_PACIENTE,
        "ESTUDO_DESCRICAO": row.ESTUDO_DESCRICAO,
        "ACCESSION_NUMBER": row.ACCESSION_NUMBER,
        "MODALIDADE": row.MODALIDADE,
        "PRIORIDADE": row.PRIORIDADE,
        "VALORES": valorFinal,
        "ESPECIALIDADE": row.ESPECIALIDADE,
        "MEDICO": row.MEDICO,
        "DUPLICADO": row.DUPLICADO,
        "DATA_REALIZACAO": row.DATA_REALIZACAO,
        "HORA_REALIZACAO": row.HORA_REALIZACAO,
        "DATA_TRANSFERENCIA": row.DATA_TRANSFERENCIA,
        "HORA_TRANSFERENCIA": row.HORA_TRANSFERENCIA,
        "DATA_LAUDO": row.DATA_LAUDO,
        "HORA_LAUDO": row.HORA_LAUDO,
        "DATA_PRAZO": row.DATA_PRAZO,
        "HORA_PRAZO": row.HORA_PRAZO,
        "STATUS": row.STATUS,
        "DATA_REASSINATURA": row.DATA_REASSINATURA,
        "HORA_REASSINATURA": row.HORA_REASSINATURA,
        "MEDICO_REASSINATURA": row.MEDICO_REASSINATURA,
        "SEGUNDA_ASSINATURA": row.SEGUNDA_ASSINATURA,
        "POSSUI_IMAGENS_CHAVE": row.POSSUI_IMAGENS_CHAVE,
        "IMAGENS_CHAVES": row.IMAGENS_CHAVES,
        "IMAGENS_CAPTURADAS": row.IMAGENS_CAPTURADAS,
        "CODIGO_INTERNO": row.CODIGO_INTERNO,
        "DIGITADOR": row.DIGITADOR,
        "COMPLEMENTAR": row.COMPLEMENTAR,
        data_referencia: row.data_referencia || '2025-06-15',
        arquivo_fonte: arquivo_fonte,
        lote_upload: lote_upload,
        periodo_referencia: 'jun/25',
        "CATEGORIA": row.CATEGORIA || 'SC',
        tipo_faturamento: 'padrao'
      };
    });

    // 5. INSERIR EM LOTES MICRO (ANTI-TIMEOUT)
    const MICRO_BATCH_SIZE = 10; // MUITO pequeno para garantir que funcione
    let totalInseridos = 0;
    
    console.log(`📊 [ULTRA-SIMPLES] Inserindo em ${Math.ceil(registrosProcessados.length / MICRO_BATCH_SIZE)} micro-lotes de ${MICRO_BATCH_SIZE}`);

    for (let i = 0; i < registrosProcessados.length; i += MICRO_BATCH_SIZE) {
      const microBatch = registrosProcessados.slice(i, i + MICRO_BATCH_SIZE);
      
      try {
        const { error: insertError } = await supabaseClient
          .from('volumetria_mobilemed')
          .insert(microBatch);

        if (insertError) throw insertError;
        
        totalInseridos += microBatch.length;
        console.log(`✅ [MICRO-LOTE] ${Math.floor(i/MICRO_BATCH_SIZE) + 1}/${Math.ceil(registrosProcessados.length/MICRO_BATCH_SIZE)}: ${microBatch.length} registros (Total: ${totalInseridos})`);
        
        // Pausa obrigatória entre lotes para evitar timeout
        if (i + MICRO_BATCH_SIZE < registrosProcessados.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (batchError) {
        console.error(`❌ [MICRO-LOTE] Erro no lote ${i}:`, batchError);
        throw batchError;
      }
    }

    // 6. REGISTRAR UPLOAD
    const { data: uploadRecord } = await supabaseClient
      .from('processamento_uploads')
      .insert({
        tipo_arquivo: arquivo_fonte,
        arquivo_nome: `${arquivo_fonte}_${Date.now()}.xlsx`,
        status: 'concluido',
        periodo_referencia: 'jun/25',
        registros_processados: registrosProcessados.length,
        registros_inseridos: registrosProcessados.length,
        registros_atualizados: 0,
        registros_erro: 0,
        completed_at: new Date().toISOString(),
        detalhes_erro: { 
          lote_upload,
          metodo: 'ultra_simples',
          zerados_corrigidos: totalZeradosCorrigidos
        }
      })
      .select()
      .single();

    console.log(`✅ [ULTRA-SIMPLES] Sucesso: ${registrosProcessados.length} registros`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Upload concluído: ${registrosProcessados.length} registros processados`,
        upload_id: uploadRecord?.id || 'ultra_simples',
        stats: {
          inserted_count: registrosProcessados.length,
          total_rows: jsonData.length,
          error_count: 0,
          regras_aplicadas: totalZeradosCorrigidos
        },
        processamento_ultra_simples: true
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ [ULTRA-SIMPLES] Erro:', error.message);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: `Erro no processamento: ${error.message}`,
        upload_id: null,
        stats: {
          inserted_count: 0,
          total_rows: 0,
          error_count: 1
        }
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});