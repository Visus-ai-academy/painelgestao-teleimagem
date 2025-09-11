import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import * as XLSX from "https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExameRow {
  EXAME?: string;
  nome?: string;
  descricao?: string;
  modalidade: string;
  especialidade: string;
  categoria: string;
  prioridade?: string;
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
    const registrosParaInserir: any[] = [];

    // Buscar IDs das entidades relacionadas para validação
    const { data: modalidades } = await supabase.from('modalidades').select('id, nome');
    const { data: especialidades } = await supabase.from('especialidades').select('id, nome');
    const { data: categorias } = await supabase.from('categorias_exame').select('id, nome');
    const { data: prioridades } = await supabase.from('prioridades').select('id, nome');

    const modalidadeMap = new Map(modalidades?.map(m => [m.nome.toLowerCase(), m.id]) || []);
    const especialidadeMap = new Map(especialidades?.map(e => [e.nome.toLowerCase(), e.id]) || []);
    const categoriaMap = new Map(categorias?.map(c => [c.nome.toLowerCase(), c.id]) || []);
    const prioridadeMap = new Map(prioridades?.map(p => [p.nome.toLowerCase(), p.id]) || []);

    console.log(`🔄 Processando ${jsonData.length} registros em lotes para otimizar performance...`);

    // Processar todos os registros e validar antes de inserir
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      processados++;

      try {
        // Mapear campos considerando maiúsculo/minúsculo
        const nomeExame = row.EXAME || row.nome;
        const modalidade = row.MODALIDADE || row.modalidade;
        const especialidade = row.ESPECIALIDADE || row.especialidade;
        const categoria = row.CATEGORIA || row.categoria;
        const prioridade = row.PRIORIDADE || row.prioridade;
        
        if (!nomeExame || !modalidade || !especialidade) {
          throw new Error('Campos obrigatórios em branco: EXAME, modalidade, especialidade');
        }

        // Preparar dados do exame
        const exameData = {
          nome: nomeExame.trim(),
          descricao: (row.DESCRICAO || row.descricao)?.trim() || null,
          modalidade: modalidade.trim(),
          especialidade: especialidade.trim(),
          categoria: categoria?.trim() || null,
          prioridade: prioridade?.trim() || 'Rotina',
          modalidade_id: modalidadeMap.get(modalidade.toLowerCase().trim()),
          especialidade_id: especialidadeMap.get(especialidade.toLowerCase().trim()),
          categoria_id: categoria ? categoriaMap.get(categoria.toLowerCase().trim()) : null,
          prioridade_id: prioridadeMap.get((prioridade || 'Rotina').toLowerCase().trim()),
          codigo_exame: (row.CODIGO_EXAME || row.codigo_exame)?.trim() || null,
          permite_quebra: (row.PERMITE_QUEBRA || row.permite_quebra) === true || (row.PERMITE_QUEBRA || row.permite_quebra) === 'true' || (row.PERMITE_QUEBRA || row.permite_quebra) === 'SIM',
          criterio_quebra: (row.CRITERIO_QUEBRA || row.criterio_quebra) ? JSON.parse(row.CRITERIO_QUEBRA || row.criterio_quebra) : null,
          exames_derivados: (row.EXAMES_DERIVADOS || row.exames_derivados) ? JSON.parse(row.EXAMES_DERIVADOS || row.exames_derivados) : null,
          ativo: true
        };

        registrosParaInserir.push(exameData);

        // Log de progresso a cada 500 registros
        if ((i + 1) % 500 === 0) {
          console.log(`📋 Validados ${i + 1}/${jsonData.length} registros...`);
        }

      } catch (error: any) {
        erros++;
        const detalheErro = {
          linha: i + 1,
          dados: row,
          erro: error.message
        };
        detalhesErros.push(detalheErro);
        console.error(`❌ Erro na linha ${i + 1}:`, error.message);
      }
    }

    console.log(`✅ Validação concluída: ${registrosParaInserir.length} registros válidos para inserção`);

    // Inserir em lotes de 1000 registros para otimizar performance
    const batchSize = 1000;
    let totalInserido = 0;
    
    for (let i = 0; i < registrosParaInserir.length; i += batchSize) {
      const batch = registrosParaInserir.slice(i, i + batchSize);
      
      console.log(`🚀 Inserindo lote ${Math.floor(i/batchSize) + 1}: registros ${i + 1} a ${Math.min(i + batchSize, registrosParaInserir.length)}`);
      
      try {
        const { error: batchError } = await supabase
          .from('cadastro_exames')
          .insert(batch);

        if (batchError) {
          throw new Error(`Erro no lote: ${batchError.message}`);
        }

        totalInserido += batch.length;
        inseridos = totalInserido;
        console.log(`✅ Lote inserido com sucesso! Total inserido até agora: ${totalInserido}`);
        
      } catch (batchError: any) {
        console.error(`❌ Erro ao inserir lote:`, batchError);
        // Tentar inserir registros individualmente neste lote
        for (const registro of batch) {
          try {
            const { error: individualError } = await supabase
              .from('cadastro_exames')
              .insert(registro);
            
            if (!individualError) {
              totalInserido++;
              inseridos = totalInserido;
            } else {
              erros++;
              detalhesErros.push({
                linha: 'lote_individual',
                dados: registro,
                erro: individualError.message
              });
            }
          } catch (individualErr: any) {
            erros++;
            detalhesErros.push({
              linha: 'lote_individual', 
              dados: registro,
              erro: individualErr.message
            });
          }
        }
      }
    }

    // Registrar processamento
    const { error: logError } = await supabase
      .from('processamento_uploads')
      .insert({
        arquivo_nome: file.name,
        tipo_arquivo: 'cadastro_exames',
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