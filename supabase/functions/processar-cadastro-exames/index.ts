import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import * as XLSX from "https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExameRow {
  nome: string;
  descricao?: string;
  modalidade: string;
  especialidade: string;
  categoria: string;
  prioridade: string;
  codigo_exame?: string;
  permite_quebra?: boolean;
  criterio_quebra?: string;
  exames_derivados?: string;
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

    console.log(`Processando arquivo: ${file.name}, tamanho: ${file.size} bytes`);

    // Ler arquivo Excel
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet) as ExameRow[];

    console.log(`Total de linhas encontradas: ${jsonData.length}`);

    let processados = 0;
    let inseridos = 0;
    let atualizados = 0;
    let erros = 0;
    const detalhesErros: any[] = [];

    // Buscar IDs das entidades relacionadas para validação
    const { data: modalidades } = await supabase.from('modalidades').select('id, nome');
    const { data: especialidades } = await supabase.from('especialidades').select('id, nome');
    const { data: categorias } = await supabase.from('categorias_exame').select('id, nome');
    const { data: prioridades } = await supabase.from('prioridades').select('id, nome');

    const modalidadeMap = new Map(modalidades?.map(m => [m.nome.toLowerCase(), m.id]) || []);
    const especialidadeMap = new Map(especialidades?.map(e => [e.nome.toLowerCase(), e.id]) || []);
    const categoriaMap = new Map(categorias?.map(c => [c.nome.toLowerCase(), c.id]) || []);
    const prioridadeMap = new Map(prioridades?.map(p => [p.nome.toLowerCase(), p.id]) || []);

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      processados++;

      try {
        if (!row.nome || !row.modalidade || !row.especialidade || !row.categoria || !row.prioridade) {
          throw new Error('Campos obrigatórios em branco: nome, modalidade, especialidade, categoria, prioridade');
        }

        // Preparar dados do exame
        const exameData = {
          nome: row.nome.trim(),
          descricao: row.descricao?.trim() || null,
          modalidade: row.modalidade.trim(),
          especialidade: row.especialidade.trim(),
          categoria: row.categoria.trim(),
          prioridade: row.prioridade.trim(),
          modalidade_id: modalidadeMap.get(row.modalidade.toLowerCase().trim()),
          especialidade_id: especialidadeMap.get(row.especialidade.toLowerCase().trim()),
          categoria_id: categoriaMap.get(row.categoria.toLowerCase().trim()),
          prioridade_id: prioridadeMap.get(row.prioridade.toLowerCase().trim()),
          codigo_exame: row.codigo_exame?.trim() || null,
          permite_quebra: row.permite_quebra === true || row.permite_quebra === 'true' || row.permite_quebra === 'SIM',
          criterio_quebra: row.criterio_quebra ? JSON.parse(row.criterio_quebra) : null,
          exames_derivados: row.exames_derivados ? JSON.parse(row.exames_derivados) : null,
          ativo: true
        };

        // Verificar se já existe (por nome ou código)
        let { data: existente } = await supabase
          .from('cadastro_exames')
          .select('id')
          .or(`nome.eq.${exameData.nome},codigo_exame.eq.${exameData.codigo_exame}`)
          .single();

        if (existente) {
          // Atualizar existente
          const { error: updateError } = await supabase
            .from('cadastro_exames')
            .update(exameData)
            .eq('id', existente.id);

          if (updateError) throw updateError;
          atualizados++;
        } else {
          // Inserir novo
          const { error: insertError } = await supabase
            .from('cadastro_exames')
            .insert(exameData);

          if (insertError) throw insertError;
          inseridos++;
        }

        console.log(`Linha ${i + 1}: Processada com sucesso - ${exameData.nome}`);

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
        tipo_arquivo: 'cadastro_exames',
        tipo_dados: 'configuracao',
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