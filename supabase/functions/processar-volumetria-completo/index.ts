import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const { file_path, arquivo_fonte, start_row = 0, batch_size = 1 } = requestBody; // ULTRA minimalista: apenas 1 registro

    console.log(`=== PROCESSAMENTO ULTRA MINIMALISTA - BATCH ${Math.floor(start_row / batch_size) + 1} ===`);
    console.log(`📂 Arquivo: ${file_path}`);
    console.log(`📑 Fonte: ${arquivo_fonte}`);
    console.log(`📊 Linha inicial: ${start_row}, Batch size: ${batch_size}`);

    if (!file_path) {
      throw new Error('file_path é obrigatório');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Baixar arquivo do storage
    console.log(`📥 Tentando baixar arquivo: ${file_path}`);
    
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('uploads')
      .download(file_path);

    if (downloadError) {
      console.error('❌ Erro no download:', downloadError);
      throw new Error(`Erro ao baixar arquivo: ${JSON.stringify(downloadError)}`);
    }

    if (!fileData) {
      throw new Error('Arquivo não encontrado no storage');
    }

    console.log('✅ Arquivo baixado, tamanho:', fileData.size);

    // SIMPLIFICADO: Usar a abordagem clássica que sabemos que funciona
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    
    // Converter para JSON para analisar os dados
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log('📊 Dados brutos do Excel:');
    console.log(`📊 Total de linhas: ${jsonData.length}`);
    console.log('📊 Primeira linha (cabeçalhos):', jsonData[0]);
    console.log('📊 Segunda linha (dados):', jsonData[1]);
    console.log('📊 Terceira linha (dados):', jsonData[2]);
    
    if (jsonData.length <= 1) {
      return new Response(JSON.stringify({
        success: true,
        message: "Arquivo vazio ou apenas cabeçalhos",
        batch_info: {
          start_row: 0,
          end_row: 0,
          batch_size: 0,
          total_records: 0,
          inserted: 0,
          errors: 0,
          de_para_updated: 0,
          progress_percent: 100,
          has_more: false,
          next_start_row: null
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }
    
    // Mapear cabeçalhos
    const headers = jsonData[0] as string[];
    console.log('📋 Cabeçalhos mapeados:', headers);
    
    // Determinar quantas linhas processar neste batch
    const totalDataRows = jsonData.length - 1; // Subtrair linha de cabeçalho
    const actualStartRow = start_row;
    const endRow = Math.min(actualStartRow + batch_size, totalDataRows);
    
    console.log(`📦 Processando batch: linhas ${actualStartRow} a ${endRow - 1} de ${totalDataRows} total`);
    
    if (actualStartRow >= totalDataRows) {
      return new Response(JSON.stringify({
        success: true,
        message: "Processamento concluído - não há mais dados",
        batch_info: {
          start_row,
          end_row: actualStartRow,
          batch_size: 0,
          total_records: totalDataRows,
          inserted: 0,
          errors: 0,
          de_para_updated: 0,
          progress_percent: 100,
          has_more: false,
          next_start_row: null
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }
    
    // Processar as linhas do batch
    const loteUpload = `${arquivo_fonte}_batch_${Math.floor(start_row / batch_size)}_${Date.now()}`;
    const periodoReferencia = new Date().toISOString().substring(0, 7);
    
    let inserted = 0;
    let errors = 0;
    
    for (let i = actualStartRow; i < endRow; i++) {
      const rowIndex = i + 1; // +1 para pular cabeçalho no array JSON
      const rowData = jsonData[rowIndex] as any[];
      
      if (!rowData || rowData.length === 0) {
        console.log(`⚠️ Linha ${rowIndex} vazia, pulando`);
        continue;
      }
      
      console.log(`📝 Processando linha ${rowIndex}:`, rowData);
      
      try {
        // Mapear dados usando índices dos cabeçalhos
        const record: any = {
          arquivo_fonte: arquivo_fonte,
          lote_upload: loteUpload,
          periodo_referencia: periodoReferencia
        };
        
        // Mapear campos essenciais
        if (headers.includes('EMPRESA') && rowData[headers.indexOf('EMPRESA')]) {
          record.EMPRESA = String(rowData[headers.indexOf('EMPRESA')]).trim();
        }
        if (headers.includes('NOME_PACIENTE') && rowData[headers.indexOf('NOME_PACIENTE')]) {
          record.NOME_PACIENTE = String(rowData[headers.indexOf('NOME_PACIENTE')]).trim();
        }

        // REGRA: Excluir clientes com "_local" no nome (maiúscula ou minúscula)
        if (record.EMPRESA && record.EMPRESA.toLowerCase().includes('_local')) {
          console.log(`Linha ${rowIndex}: cliente com _local excluído: ${record.EMPRESA}`)
          continue
        }
        if (headers.includes('CODIGO_PACIENTE') && rowData[headers.indexOf('CODIGO_PACIENTE')]) {
          record.CODIGO_PACIENTE = String(rowData[headers.indexOf('CODIGO_PACIENTE')]).trim();
        }
        if (headers.includes('ESTUDO_DESCRICAO') && rowData[headers.indexOf('ESTUDO_DESCRICAO')]) {
          record.ESTUDO_DESCRICAO = String(rowData[headers.indexOf('ESTUDO_DESCRICAO')]).trim();
        }
        if (headers.includes('MODALIDADE') && rowData[headers.indexOf('MODALIDADE')]) {
          record.MODALIDADE = String(rowData[headers.indexOf('MODALIDADE')]).trim();
        }
        if (headers.includes('VALORES') && rowData[headers.indexOf('VALORES')]) {
          record.VALORES = Number(rowData[headers.indexOf('VALORES')]) || 0;
        }
        
        console.log('📄 Registro mapeado:', record);
        
        // Só inserir se tiver dados mínimos
        if (record.EMPRESA || record.NOME_PACIENTE) {
          const { error: insertError } = await supabaseClient
            .from('volumetria_mobilemed')
            .insert(record);
          
          if (insertError) {
            console.error('❌ Erro ao inserir:', insertError);
            errors++;
          } else {
            console.log('✅ Registro inserido com sucesso');
            inserted++;
          }
        } else {
          console.log('⚠️ Registro ignorado - sem dados essenciais');
        }
        
      } catch (error) {
        console.error('❌ Erro ao processar linha:', error);
        errors++;
      }
    }
    
    console.log(`✅ Batch processado: ${inserted} inseridos, ${errors} erros`);
    
    // Aplicar de-para se necessário
    let deParaUpdated = 0;
    if (arquivo_fonte.includes('volumetria') && inserted > 0) {
      try {
        const { data: deParaResult } = await supabaseClient.rpc('aplicar_de_para_automatico', { 
          arquivo_fonte_param: arquivo_fonte 
        });
        deParaUpdated = deParaResult?.registros_atualizados || 0;
        console.log(`✅ De-Para aplicado: ${deParaUpdated} registros atualizados`);
      } catch (deParaError) {
        console.log(`⚠️ Erro no de-para (ignorado): ${deParaError.message}`);
      }
    }
    
    // Normalizar nomes CEDI-* para CEDIDIAG (última etapa)
    try {
      const { error: normError } = await supabaseClient
        .from('volumetria_mobilemed')
        .update({ EMPRESA: 'CEDIDIAG', updated_at: new Date().toISOString() })
        .in('EMPRESA', ['CEDI-RJ','CEDI-RO','CEDI-UNIMED','CEDI_RJ','CEDI_RO','CEDI_UNIMED'])
        .eq('lote_upload', loteUpload);
      if (normError) {
        console.warn('⚠️ Erro na normalização CEDIDIAG (ignorado):', normError);
      } else {
        console.log('✅ Normalização CEDIDIAG aplicada (última etapa)');
      }
    } catch (normEx) {
      console.warn('⚠️ Exceção na normalização CEDIDIAG (ignorada):', normEx);
    }

    const nextStartRow = endRow;
    const hasMore = nextStartRow < totalDataRows;
    const progress = Math.round((endRow / totalDataRows) * 100);

    return new Response(JSON.stringify({
      success: true,
      message: `Batch ${Math.floor(start_row / batch_size) + 1} processado: ${inserted} inseridos, ${deParaUpdated} de-para aplicados`,
      batch_info: {
        start_row,
        end_row: endRow,
        batch_size: endRow - actualStartRow,
        total_records: totalDataRows,
        inserted,
        errors,
        de_para_updated: deParaUpdated,
        progress_percent: progress,
        has_more: hasMore,
        next_start_row: hasMore ? nextStartRow : null
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('💥 ERRO CRÍTICO:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Erro desconhecido',
      error_details: error.toString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});