import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as XLSX from "https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_path, arquivo_fonte, periodo } = await req.json();
    
    console.log('🚀 [BÁSICO] Processando:', { file_path, arquivo_fonte, periodo });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Registrar upload
    const { data: uploadData, error: uploadError } = await supabase
      .from('processamento_uploads')
      .insert({
        arquivo_nome: file_path.split('/').pop(),
        tipo_arquivo: arquivo_fonte,
        tipo_dados: 'volumetria',
        periodo_referencia: periodo || 'jun/25',
        status: 'processando'
      })
      .select()
      .single();

    if (uploadError) throw uploadError;

    // 2. Download do arquivo
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('volumetria')
      .download(file_path);

    if (downloadError) throw downloadError;

    // 3. Processar Excel
    console.log('📥 [BÁSICO] Convertendo para arrayBuffer...');
    const arrayBuffer = await fileData.arrayBuffer();
    
    console.log('📖 [BÁSICO] Lendo workbook...');
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    console.log('🔄 [BÁSICO] Convertendo para JSON...');
    const rawData = XLSX.utils.sheet_to_json(worksheet, { raw: false });

    console.log(`📊 [BÁSICO] Dados extraídos: ${rawData.length} registros`);

    // 4. Inserir em lotes pequenos
    let processados = 0;
    const BATCH_SIZE = 50;

    for (let i = 0; i < rawData.length; i += BATCH_SIZE) {
      const batch = rawData.slice(i, i + BATCH_SIZE);
      
      console.log(`🔄 [BÁSICO] Processando lote ${Math.floor(i/BATCH_SIZE) + 1}...`);
      
      const records = batch.map((row: any, index: number) => {
        try {
          return {
            id: crypto.randomUUID(),
            "EMPRESA": row["EMPRESA"] || row["A"] || null,
            "NOME_PACIENTE": row["NOME_PACIENTE"] || row["B"] || null,
            "CODIGO_PACIENTE": row["CODIGO_PACIENTE"] || row["C"] || null,
            "ESTUDO_DESCRICAO": row["ESTUDO_DESCRICAO"] || row["D"] || null,
            "ACCESSION_NUMBER": row["ACCESSION_NUMBER"] || row["E"] || null,
            "MODALIDADE": row["MODALIDADE"] || row["F"] || null,
            "PRIORIDADE": row["PRIORIDADE"] || row["G"] || null,
            "VALORES": isNaN(parseFloat(row["VALORES"] || row["H"] || 0)) ? 0 : parseFloat(row["VALORES"] || row["H"] || 0),
            "ESPECIALIDADE": row["ESPECIALIDADE"] || row["I"] || null,
            "MEDICO": row["MEDICO"] || row["J"] || null,
            "DATA_REALIZACAO": row["DATA_REALIZACAO"] || row["K"] || null,
            "HORA_REALIZACAO": row["HORA_REALIZACAO"] || row["L"] || null,
            "DATA_LAUDO": row["DATA_LAUDO"] || row["M"] || null,
            "HORA_LAUDO": row["HORA_LAUDO"] || row["N"] || null,
            "DATA_PRAZO": row["DATA_PRAZO"] || row["O"] || null,
            "HORA_PRAZO": row["HORA_PRAZO"] || row["P"] || null,
            arquivo_fonte,
            periodo_referencia: periodo || 'jun/25',
            data_referencia: new Date().toISOString().split('T')[0]
          };
        } catch (recordError) {
          console.error(`❌ [BÁSICO] Erro no registro ${index}:`, recordError);
          throw recordError;
        }
      });

      const { error: insertError } = await supabase
        .from('volumetria_mobilemed')
        .insert(records);

      if (insertError) {
        console.error(`❌ [BÁSICO] Erro no lote ${Math.floor(i/BATCH_SIZE) + 1}:`, insertError);
      } else {
        processados += batch.length;
        console.log(`✅ [BÁSICO] Processados: ${processados}/${rawData.length}`);
      }
    }

    // 5. Atualizar status
    await supabase
      .from('processamento_uploads')
      .update({
        status: 'sucesso',
        registros_processados: processados,
        registros_inseridos: processados
      })
      .eq('id', uploadData.id);

    return new Response(JSON.stringify({
      success: true,
      upload_id: uploadData.id,
      registros_processados: processados,
      message: 'Processamento básico concluído'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [BÁSICO] Erro completo:', error);
    console.error('❌ [BÁSICO] Stack trace:', error.stack);
    console.error('❌ [BÁSICO] Message:', error.message);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Erro desconhecido',
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});