import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import * as XLSX from "https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PrecoRow {
  modalidade: string;
  especialidade: string;
  categoria: string;
  prioridade: string;
  codigo_servico?: string;
  valor_base: number;
  valor_urgencia?: number;
  cliente_nome?: string;
  tipo_preco?: string;
  data_inicio_vigencia?: string;
  data_fim_vigencia?: string;
  aplicar_legado?: boolean;
  aplicar_incremental?: boolean;
  observacoes?: string;
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
    const jsonData = XLSX.utils.sheet_to_json(worksheet) as PrecoRow[];

    console.log(`Total de linhas encontradas: ${jsonData.length}`);

    let processados = 0;
    let inseridos = 0;
    let atualizados = 0;
    let erros = 0;
    const detalhesErros: any[] = [];

    // Buscar entidades relacionadas
    const { data: modalidades } = await supabase.from('modalidades').select('id, nome');
    const { data: especialidades } = await supabase.from('especialidades').select('id, nome');
    const { data: categorias } = await supabase.from('categorias_exame').select('id, nome');
    const { data: prioridades } = await supabase.from('prioridades').select('id, nome');
    const { data: clientes } = await supabase.from('clientes').select('id, nome');

    const modalidadeMap = new Map(modalidades?.map(m => [m.nome.toLowerCase(), m.id]) || []);
    const especialidadeMap = new Map(especialidades?.map(e => [e.nome.toLowerCase(), e.id]) || []);
    const categoriaMap = new Map(categorias?.map(c => [c.nome.toLowerCase(), c.id]) || []);
    const prioridadeMap = new Map(prioridades?.map(p => [p.nome.toLowerCase(), p.id]) || []);
    const clienteMap = new Map(clientes?.map(c => [c.nome.toLowerCase(), c.id]) || []);

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      processados++;

      try {
        if (!row.modalidade || !row.especialidade || !row.categoria || !row.prioridade || !row.valor_base) {
          throw new Error('Campos obrigatórios em branco: modalidade, especialidade, categoria, prioridade, valor_base');
        }

        // Preparar dados do preço
        const precoData = {
          modalidade: row.modalidade.trim(),
          especialidade: row.especialidade.trim(),
          categoria: row.categoria.trim(),
          prioridade: row.prioridade.trim(),
          modalidade_id: modalidadeMap.get(row.modalidade.toLowerCase().trim()),
          especialidade_id: especialidadeMap.get(row.especialidade.toLowerCase().trim()),
          categoria_exame_id: categoriaMap.get(row.categoria.toLowerCase().trim()),
          prioridade_id: prioridadeMap.get(row.prioridade.toLowerCase().trim()),
          codigo_servico: row.codigo_servico?.trim() || null,
          valor_base: Number(row.valor_base),
          valor_urgencia: row.valor_urgencia ? Number(row.valor_urgencia) : Number(row.valor_base),
          cliente_id: row.cliente_nome ? clienteMap.get(row.cliente_nome.toLowerCase().trim()) : null,
          tipo_preco: row.tipo_preco?.toLowerCase() || 'padrao',
          data_inicio_vigencia: row.data_inicio_vigencia ? new Date(row.data_inicio_vigencia).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          data_fim_vigencia: row.data_fim_vigencia ? new Date(row.data_fim_vigencia).toISOString().split('T')[0] : null,
          aplicar_legado: row.aplicar_legado !== false,
          aplicar_incremental: row.aplicar_incremental !== false,
          observacoes: row.observacoes?.trim() || null,
          ativo: true
        };

        // Verificar se já existe
        const whereClause = row.cliente_nome
          ? `modalidade.eq.${precoData.modalidade},especialidade.eq.${precoData.especialidade},categoria.eq.${precoData.categoria},prioridade.eq.${precoData.prioridade},cliente_id.eq.${precoData.cliente_id}`
          : `modalidade.eq.${precoData.modalidade},especialidade.eq.${precoData.especialidade},categoria.eq.${precoData.categoria},prioridade.eq.${precoData.prioridade},cliente_id.is.null`;

        let { data: existente } = await supabase
          .from('precos_servicos')
          .select('id')
          .or(whereClause)
          .single();

        if (existente) {
          // Atualizar existente
          const { error: updateError } = await supabase
            .from('precos_servicos')
            .update(precoData)
            .eq('id', existente.id);

          if (updateError) throw updateError;
          atualizados++;
        } else {
          // Inserir novo
          const { error: insertError } = await supabase
            .from('precos_servicos')
            .insert(precoData);

          if (insertError) throw insertError;
          inseridos++;
        }

        console.log(`Linha ${i + 1}: Processada com sucesso - ${precoData.modalidade}/${precoData.especialidade}`);

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
        tipo_arquivo: 'precos_servicos',
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