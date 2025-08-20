import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ⚡ UPLOAD DIRETO - BYPASS COMPLETO DE TODOS OS PROBLEMAS
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_path, arquivo_fonte } = await req.json();
    
    console.log('📊 [DIRETO] Processando arquivo real:', file_path);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const lote_upload = crypto.randomUUID();

    // 1. BAIXAR ARQUIVO EXCEL DO STORAGE
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('uploads')
      .download(file_path);

    if (downloadError) throw downloadError;
    
    // 2. LER DADOS DO EXCEL
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    console.log(`📊 [DIRETO] Arquivo lido: ${jsonData.length} registros encontrados`);

    // 3. BUSCAR REGRAS DE DE-PARA PARA VALORES ZERADOS
    const { data: deParaRules } = await supabaseClient
      .from('valores_referencia_de_para')
      .select('*')
      .eq('ativo', true);

    const deParaMap = new Map();
    deParaRules?.forEach(rule => {
      deParaMap.set(rule.estudo_descricao, rule.valores);
    });

    // 4. PROCESSAR REGISTROS EM LOTES MENORES (OTIMIZADO)
    const BATCH_SIZE = 50; // Reduzido para evitar timeout
    let totalInseridos = 0;
    let totalZeradosCorrigidos = 0;

    console.log(`📊 [DIRETO] Iniciando processamento de ${jsonData.length} registros em lotes de ${BATCH_SIZE}`);

    for (let i = 0; i < jsonData.length; i += BATCH_SIZE) {
      const batch = jsonData.slice(i, i + BATCH_SIZE);
      console.log(`🔄 [DIRETO] Processando lote ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(jsonData.length/BATCH_SIZE)} (registros ${i + 1}-${Math.min(i + BATCH_SIZE, jsonData.length)})`);
      
      // Processar batch de forma mais eficiente
      const registrosProcessados = [];
      
      for (const row of batch) {
        // Aplicar de-para se valor for zero
        let valorFinal = parseFloat(row.VALORES) || 0;
        if (valorFinal === 0 && deParaMap.has(row.ESTUDO_DESCRICAO)) {
          valorFinal = deParaMap.get(row.ESTUDO_DESCRICAO);
          totalZeradosCorrigidos++;
        }

        registrosProcessados.push({
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
        });
      }

      // Inserir lote com timeout reduzido
      try {
        const { error: insertError } = await supabaseClient
          .from('volumetria_mobilemed')
          .insert(registrosProcessados);

        if (insertError) {
          console.error(`❌ [DIRETO] Erro no lote ${i}:`, insertError);
          throw insertError;
        } else {
          totalInseridos += registrosProcessados.length;
          console.log(`✅ [DIRETO] Lote ${Math.floor(i/BATCH_SIZE) + 1} inserido: ${registrosProcessados.length} registros (Total: ${totalInseridos})`);
        }
      } catch (batchError) {
        console.error(`❌ [DIRETO] Erro crítico no lote ${i}:`, batchError);
        throw batchError;
      }

      // Pequena pausa para evitar sobrecarga
      if (i + BATCH_SIZE < jsonData.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    // 5. REGISTRAR UPLOAD COMPLETO
    const { data: uploadRecord } = await supabaseClient
      .from('processamento_uploads')
      .insert({
        tipo_arquivo: arquivo_fonte,
        arquivo_nome: `${arquivo_fonte}_${Date.now()}.xlsx`,
        status: 'concluido',
        periodo_referencia: 'jun/25',
        registros_processados: totalInseridos,
        registros_inseridos: totalInseridos,
        registros_atualizados: 0,
        registros_erro: jsonData.length - totalInseridos,
        completed_at: new Date().toISOString(),
        detalhes_erro: { 
          lote_upload,
          metodo: 'upload_direto_completo',
          motivo: 'processamento_arquivo_real',
          zerados_corrigidos: totalZeradosCorrigidos
        }
      })
      .select()
      .single();

    console.log(`✅ [DIRETO] ${totalInseridos} registros inseridos, ${totalZeradosCorrigidos} zerados corrigidos`);

    // 6. RESPOSTA DE SUCESSO
    return new Response(
      JSON.stringify({
        success: true,
        message: `Upload concluído: ${totalInseridos} registros processados`,
        upload_id: uploadRecord?.id || 'direto',
        stats: {
          inserted_count: totalInseridos,
          total_rows: jsonData.length,
          error_count: jsonData.length - totalInseridos,
          regras_aplicadas: totalZeradosCorrigidos
        },
        processamento_direto: true
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ [DIRETO] Erro crítico:', error.message);
    console.error('❌ [DIRETO] Stack trace:', error.stack);
    console.error('❌ [DIRETO] Tipo do erro:', error.constructor.name);
    
    // FALHAR COMPLETAMENTE - NÃO GERAR DADOS FICTÍCIOS
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: `Erro no processamento do arquivo: ${error.message}`,
        upload_id: null,
        stats: {
          inserted_count: 0,
          total_rows: 0,
          error_count: 1
        },
        erro_detalhado: {
          message: error.message,
          type: error.constructor.name,
          stack: error.stack?.substring(0, 500)
        }
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});