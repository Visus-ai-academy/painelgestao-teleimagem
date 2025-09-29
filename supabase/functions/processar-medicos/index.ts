import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import * as XLSX from "https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MedicoRow {
  nome: string;
  crm: string;
  especialidades?: string;
  modalidades?: string;
  categoria?: string;
  telefone?: string;
  email?: string;
  ativo?: boolean | string;
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
    const jsonData = XLSX.utils.sheet_to_json(worksheet) as MedicoRow[];

    console.log(`Total de linhas encontradas: ${jsonData.length}`);

    let processados = 0;
    let inseridos = 0;
    let atualizados = 0;
    let erros = 0;
    const detalhesErros: any[] = [];

    // Buscar especialidades, modalidades e categorias do sistema
    const [especialidadesRes, modalidadesRes, categoriasRes] = await Promise.all([
      supabase.from('especialidades').select('nome').eq('ativo', true),
      supabase.from('modalidades').select('nome').eq('ativo', true),
      supabase.from('categorias_medico').select('nome').eq('ativo', true)
    ]);

    const especialidadesValidas = new Set(
      especialidadesRes.data?.map(e => e.nome.toLowerCase()) || []
    );
    const modalidadesValidas = new Set(
      modalidadesRes.data?.map(m => m.nome.toLowerCase()) || []
    );
    const categoriasValidas = new Set(
      categoriasRes.data?.map(c => c.nome.toLowerCase()) || []
    );

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      processados++;

      try {
        if (!row.nome || !row.crm) {
          throw new Error('Campos obrigatórios em branco: nome e crm');
        }

        // Processar especialidades (pode ser separado por vírgula/ponto-e-vírgula)
        const especialidades = row.especialidades
          ? row.especialidades
              .split(/[,;]/)
              .map(e => e.trim())
              .filter(e => especialidadesValidas.has(e.toLowerCase()))
          : [];

        // Processar modalidades
        const modalidades = row.modalidades
          ? row.modalidades
              .split(/[,;]/)
              .map(m => m.trim())
              .filter(m => modalidadesValidas.has(m.toLowerCase()))
          : [];

        // Validar categoria
        let categoria = row.categoria?.trim();
        if (categoria && !categoriasValidas.has(categoria.toLowerCase())) {
          console.warn(`Categoria inválida na linha ${i + 1}: ${categoria}`);
          categoria = undefined;
        }

        // Processar campo ativo
        let ativo = true;
        if (typeof row.ativo === 'string') {
          ativo = row.ativo.toLowerCase() === 'sim' || 
                  row.ativo.toLowerCase() === 'true' || 
                  row.ativo === '1';
        } else if (typeof row.ativo === 'boolean') {
          ativo = row.ativo;
        }

        // Preparar dados do médico
        const medicoData = {
          nome: row.nome.trim(),
          crm: row.crm.trim(),
          especialidades,
          modalidades,
          categoria,
          telefone: row.telefone?.trim() || null,
          email: row.email?.trim() || null,
          ativo
        };

        // Verificar se já existe pelo CRM
        const { data: existente } = await supabase
          .from('medicos')
          .select('id')
          .eq('crm', medicoData.crm)
          .single();

        if (existente) {
          // Atualizar existente
          const { error: updateError } = await supabase
            .from('medicos')
            .update(medicoData)
            .eq('id', existente.id);

          if (updateError) throw updateError;
          atualizados++;
          console.log(`Linha ${i + 1}: Médico atualizado - ${medicoData.nome}`);
        } else {
          // Inserir novo
          const { error: insertError } = await supabase
            .from('medicos')
            .insert(medicoData);

          if (insertError) throw insertError;
          inseridos++;
          console.log(`Linha ${i + 1}: Médico inserido - ${medicoData.nome}`);
        }

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
        tipo_arquivo: 'medicos',
        tipo_dados: 'cadastro',
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
