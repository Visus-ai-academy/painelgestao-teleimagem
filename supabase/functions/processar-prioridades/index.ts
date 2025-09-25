import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PrioridadeDeParaRecord {
  prioridade_original: string;
  nome_final: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response(
        JSON.stringify({ error: 'Nenhum arquivo foi enviado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processando arquivo Excel:', file.name);

    // Registrar início do upload na tabela de logs
    const { data: uploadLog, error: logError } = await supabaseClient
      .from('processamento_uploads')
      .insert({
        tipo_arquivo: 'de_para_prioridade',
        arquivo_nome: file.name,
        tipo_dados: 'incremental',
        status: 'processando',
        registros_processados: 0,
        registros_inseridos: 0,
        registros_atualizados: 0,
        registros_erro: 0
      })
      .select()
      .single();

    if (logError) {
      console.error('Erro ao criar log de upload:', logError);
      throw logError;
    }

    // Ler o arquivo Excel
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    console.log('Total de linhas no arquivo:', jsonData.length);

    let processedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Primeiro, limpar registros existentes
    const { error: deleteError } = await supabaseClient
      .from('valores_prioridade_de_para')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) {
      console.error('Erro ao limpar dados existentes:', deleteError);
    } else {
      console.log('Dados existentes removidos com sucesso');
    }

    // Processar cada linha
    for (const [index, row] of jsonData.entries()) {
      try {
        const record = processRow(row as any);
        
        if (record) {
          const { error: insertError } = await supabaseClient
            .from('valores_prioridade_de_para')
            .insert([record]);

          if (insertError) {
            console.error(`Erro na linha ${index + 2}:`, insertError);
            errors.push(`Linha ${index + 2}: ${insertError.message}`);
            errorCount++;
          } else {
            processedCount++;
          }
        } else {
          errors.push(`Linha ${index + 2}: Dados inválidos ou incompletos`);
          errorCount++;
        }
      } catch (error) {
        console.error(`Erro ao processar linha ${index + 2}:`, error);
        errors.push(`Linha ${index + 2}: ${error.message}`);
        errorCount++;
      }
    }

    // Aplicar o De-Para aos dados existentes de volumetria
    try {
      const { data: applyResult, error: applyError } = await supabaseClient
        .rpc('aplicar_de_para_prioridade');

      if (applyError) {
        console.error('Erro ao aplicar De-Para:', applyError);
        errors.push(`Erro ao aplicar De-Para: ${applyError.message}`);
      } else {
        console.log('De-Para aplicado com sucesso:', applyResult);
      }
    } catch (error) {
      console.error('Erro ao aplicar De-Para:', error);
      errors.push(`Erro ao aplicar De-Para: ${error.message}`);
    }

    // Atualizar log com resultado final
    await supabaseClient
      .from('processamento_uploads')
      .update({
        status: errorCount === processedCount + errorCount ? 'erro' : 'concluido',
        registros_processados: processedCount + errorCount,
        registros_inseridos: processedCount,
        registros_atualizados: 0,
        registros_erro: errorCount,
        completed_at: new Date().toISOString()
      })
      .eq('id', uploadLog.id);

    console.log(`Processamento concluído: ${processedCount} sucessos, ${errorCount} erros`);

    return new Response(
      JSON.stringify({
        registros_processados: processedCount,
        total_registros: jsonData.length,
        erros: errors,
        sucesso: processedCount > 0
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Erro geral:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function processRow(row: any): PrioridadeDeParaRecord | null {
  try {
    // Mapear colunas do Excel
    const prioridadeOriginal = row['PRIORIDADE_ORIGINAL'] || row['prioridade_original'] || '';
    const nomeFinal = row['NOME_FINAL'] || row['nome_final'] || '';

    if (!prioridadeOriginal || !nomeFinal) {
      console.warn('Linha inválida: campos obrigatórios não encontrados', row);
      return null;
    }

    return {
      prioridade_original: String(prioridadeOriginal).trim(),
      nome_final: String(nomeFinal).trim()
    };
  } catch (error) {
    console.error('Erro ao processar linha:', error);
    return null;
  }
}