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
    let { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('uploads')
      .download(file_path);

    if (downloadError) throw downloadError;
    
    // 2. LER DADOS DO EXCEL (OTIMIZADO PARA MEMÓRIA)
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    
    // Liberar recursos do arquivo
    fileData = null;
    
    // Contar total de linhas primeiro
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const totalRows = range.e.r;
    
    console.log(`📊 [DIRETO] Arquivo detectado: ${totalRows} registros`);

    // 3. BUSCAR REGRAS DE DE-PARA PARA VALORES ZERADOS
    const { data: deParaRules } = await supabaseClient
      .from('valores_referencia_de_para')
      .select('*')
      .eq('ativo', true);

    const deParaMap = new Map();
    deParaRules?.forEach(rule => {
      deParaMap.set(rule.estudo_descricao, rule.valores);
    });

     // 4. PROCESSAR LINHAS EM LOTES PEQUENOS (STREAMING)
    const BATCH_SIZE = 20; // Muito pequeno para economizar memória
    let totalInseridos = 0;
    let totalZeradosCorrigidos = 0;
    let linhaAtual = 1; // Começar da linha 1 (header é linha 0)

    console.log(`📊 [DIRETO] Iniciando processamento streaming de ${totalRows} linhas em lotes de ${BATCH_SIZE}`);

    while (linhaAtual <= totalRows) {
      const registrosProcessados = [];
      const fimLote = Math.min(linhaAtual + BATCH_SIZE - 1, totalRows);
      
      console.log(`🔄 [DIRETO] Processando lote ${Math.floor(linhaAtual/BATCH_SIZE) + 1}/${Math.ceil(totalRows/BATCH_SIZE)} (linhas ${linhaAtual}-${fimLote})`);
      
      // Processar cada linha do lote
      for (let linha = linhaAtual; linha <= fimLote; linha++) {
        const rowData = {};
        
        // Ler dados da linha atual do worksheet
        for (let col = range.s.c; col <= range.e.c; col++) {
          const headerCell = worksheet[XLSX.utils.encode_cell({r: 0, c: col})];
          const dataCell = worksheet[XLSX.utils.encode_cell({r: linha, c: col})];
          
          if (headerCell && headerCell.v) {
            rowData[headerCell.v] = dataCell ? dataCell.v : null;
          }
        }
        
        // Aplicar de-para se valor for zero
        let valorFinal = parseFloat(rowData.VALORES) || 0;
        if (valorFinal === 0 && deParaMap.has(rowData.ESTUDO_DESCRICAO)) {
          valorFinal = deParaMap.get(rowData.ESTUDO_DESCRICAO);
          totalZeradosCorrigidos++;
        }

        registrosProcessados.push({
          id: crypto.randomUUID(),
          "EMPRESA": rowData.EMPRESA,
          "NOME_PACIENTE": rowData.NOME_PACIENTE,
          "CODIGO_PACIENTE": rowData.CODIGO_PACIENTE,
          "ESTUDO_DESCRICAO": rowData.ESTUDO_DESCRICAO,
          "ACCESSION_NUMBER": rowData.ACCESSION_NUMBER,
          "MODALIDADE": rowData.MODALIDADE,
          "PRIORIDADE": rowData.PRIORIDADE,
          "VALORES": valorFinal,
          "ESPECIALIDADE": rowData.ESPECIALIDADE,
          "MEDICO": rowData.MEDICO,
          "DUPLICADO": rowData.DUPLICADO,
          "DATA_REALIZACAO": rowData.DATA_REALIZACAO,
          "HORA_REALIZACAO": rowData.HORA_REALIZACAO,
          "DATA_TRANSFERENCIA": rowData.DATA_TRANSFERENCIA,
          "HORA_TRANSFERENCIA": rowData.HORA_TRANSFERENCIA,
          "DATA_LAUDO": rowData.DATA_LAUDO,
          "HORA_LAUDO": rowData.HORA_LAUDO,
          "DATA_PRAZO": rowData.DATA_PRAZO,
          "HORA_PRAZO": rowData.HORA_PRAZO,
          "STATUS": rowData.STATUS,
          "DATA_REASSINATURA": rowData.DATA_REASSINATURA,
          "HORA_REASSINATURA": rowData.HORA_REASSINATURA,
          "MEDICO_REASSINATURA": rowData.MEDICO_REASSINATURA,
          "SEGUNDA_ASSINATURA": rowData.SEGUNDA_ASSINATURA,
          "POSSUI_IMAGENS_CHAVE": rowData.POSSUI_IMAGENS_CHAVE,
          "IMAGENS_CHAVES": rowData.IMAGENS_CHAVES,
          "IMAGENS_CAPTURADAS": rowData.IMAGENS_CAPTURADAS,
          "CODIGO_INTERNO": rowData.CODIGO_INTERNO,
          "DIGITADOR": rowData.DIGITADOR,
          "COMPLEMENTAR": rowData.COMPLEMENTAR,
          data_referencia: rowData.data_referencia || '2025-06-15',
          arquivo_fonte: arquivo_fonte,
          lote_upload: lote_upload,
          periodo_referencia: 'jun/25',
          "CATEGORIA": rowData.CATEGORIA || 'SC',
          tipo_faturamento: 'padrao'
        });
      }

      // Inserir lote
      try {
        const { error: insertError } = await supabaseClient
          .from('volumetria_mobilemed')
          .insert(registrosProcessados);

        if (insertError) {
          console.error(`❌ [DIRETO] Erro no lote ${linhaAtual}:`, insertError);
          throw insertError;
        } else {
          totalInseridos += registrosProcessados.length;
          console.log(`✅ [DIRETO] Lote inserido: ${registrosProcessados.length} registros (Total: ${totalInseridos})`);
        }
      } catch (batchError) {
        console.error(`❌ [DIRETO] Erro crítico no lote ${linhaAtual}:`, batchError);
        throw batchError;
      }

      // Próximo lote
      linhaAtual = fimLote + 1;
      
      // Pequena pausa e forçar garbage collection
      if (linhaAtual <= totalRows) {
        await new Promise(resolve => setTimeout(resolve, 50));
        if (globalThis.gc) globalThis.gc();
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
        registros_erro: totalRows - totalInseridos,
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
          total_rows: totalRows,
          error_count: totalRows - totalInseridos,
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