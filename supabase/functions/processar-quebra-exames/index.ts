import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import * as XLSX from "https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuebraExameRow {
  EXAME?: string;
  exame?: string;
  QUEBRA?: string;
  quebra?: string;
  CATEGORIA?: string;
  categoria?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      throw new Error('Nenhum arquivo foi enviado');
    }

    console.log(`Processando arquivo de quebra: ${file.name}, tamanho: ${file.size} bytes`);

    // Ler arquivo Excel
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet) as QuebraExameRow[];

    console.log(`Total de linhas encontradas: ${jsonData.length}`);

    let processados = 0;
    let inseridos = 0;
    let atualizados = 0;
    let erros = 0;
    const detalhesErros: any[] = [];

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      processados++;

      try {
        // Mapear campos com diferentes variações de nome
        const exameOriginal = row.EXAME || row.exame;
        const exameQuebrado = row.QUEBRA || row.quebra;
        const categoriaQuebrada = row.CATEGORIA || row.categoria; // Deixar em branco se não informada
        
        if (!exameOriginal || !exameQuebrado) {
          throw new Error('Campos obrigatórios em branco: EXAME, QUEBRA');
        }

        // Preparar dados da regra de quebra
        const regraData = {
          exame_original: exameOriginal.trim(),
          exame_quebrado: exameQuebrado.trim(),
          categoria_quebrada: categoriaQuebrada?.trim() || null, // Deixar null se não informada
          ativo: true
        };

        // Verificar se já existe (por exame original e quebrado)
        let { data: existente } = await supabase
          .from('regras_quebra_exames')
          .select('id')
          .eq('exame_original', regraData.exame_original)
          .eq('exame_quebrado', regraData.exame_quebrado)
          .single();

        if (existente) {
          // Atualizar existente
          const { error: updateError } = await supabase
            .from('regras_quebra_exames')
            .update(regraData)
            .eq('id', existente.id);

          if (updateError) throw updateError;
          atualizados++;
        } else {
          // Inserir novo
          const { error: insertError } = await supabase
            .from('regras_quebra_exames')
            .insert(regraData);

          if (insertError) throw insertError;
          inseridos++;
        }

        console.log(`Linha ${i + 1}: Processada com sucesso - ${regraData.exame_original} → ${regraData.exame_quebrado}`);

      } catch (error: any) {
        erros++;
        const detalheErro = {
          linha: i + 1,
          dados: row,
          erro: error.message
        };
        detalhesErros.push(detalheErro);
        console.error(`Erro na linha ${i + 1}:`, error.message);
      }
    }

    // Registrar processamento
    const { error: logError } = await supabase
      .from('processamento_uploads')
      .insert({
        arquivo_nome: file.name,
        tipo_arquivo: 'quebra_exames',
        tipo_dados: 'incremental',
        status: erros === processados ? 'erro' : 'concluido',
        registros_processados: processados,
        registros_inseridos: inseridos,
        registros_atualizados: atualizados,
        registros_erro: erros,
        detalhes_erro: detalhesErros.length > 0 ? detalhesErros : null,
        tamanho_arquivo: file.size
      });

    if (logError) {
      console.error('Erro ao registrar log:', logError);
    }

    const resultado = {
      sucesso: true,
      arquivo: file.name,
      processados,
      inseridos,
      atualizados,
      erros,
      detalhes_erros: detalhesErros
    };

    console.log('Processamento concluído:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Erro geral:', error);
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        erro: error.message,
        detalhes: error.stack 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});