import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🚀 Iniciando correção de dados existentes...');

    const resultados: any[] = [];

    // Listar arquivos existentes
    const { data: arquivos, error: arquivosError } = await supabase
      .from('volumetria_mobilemed')
      .select('arquivo_fonte')
      .not('arquivo_fonte', 'is', null);

    if (arquivosError) {
      throw new Error(`Erro ao buscar arquivos: ${arquivosError.message}`);
    }

    const arquivosUnicos = [...new Set(arquivos?.map(a => a.arquivo_fonte) || [])];
    console.log(`📁 Encontrados ${arquivosUnicos.length} arquivos para processar: ${arquivosUnicos.join(', ')}`);

    // Para cada arquivo, aplicar todas as correções
    for (const arquivo of arquivosUnicos) {
      console.log(`\n📂 Processando arquivo: ${arquivo}`);
      const resultadoArquivo = {
        arquivo_fonte: arquivo,
        correcoes: {} as any
      };

      // 1. Correção de modalidades CR/DX -> RX
      console.log(`  🔧 Corrigindo modalidades CR/DX...`);
      const { data: modalidadesCorrigidas, error: modalidadeError } = await supabase
        .from('volumetria_mobilemed')
        .update({ "MODALIDADE": 'RX', updated_at: new Date().toISOString() })
        .eq('arquivo_fonte', arquivo)
        .in('MODALIDADE', ['CR', 'DX'])
        .not('ESTUDO_DESCRICAO', 'ilike', '%mamografia%')
        .select('id');

      resultadoArquivo.correcoes.modalidades_rx = modalidadesCorrigidas?.length || 0;

      // 2. Correção de modalidade OT -> DO  
      console.log(`  🔧 Corrigindo modalidades OT...`);
      const { data: otCorrigidas, error: otError } = await supabase
        .from('volumetria_mobilemed')
        .update({ "MODALIDADE": 'DO', updated_at: new Date().toISOString() })
        .eq('arquivo_fonte', arquivo)
        .eq('MODALIDADE', 'OT')
        .select('id');

      resultadoArquivo.correcoes.modalidades_ot = otCorrigidas?.length || 0;

      // 3. Correção de modalidade BMD -> DO
      console.log(`  🔧 Corrigindo modalidades BMD...`);
      const { data: bmdCorrigidas, error: bmdError } = await supabase
        .from('volumetria_mobilemed')
        .update({ "MODALIDADE": 'DO', updated_at: new Date().toISOString() })
        .eq('arquivo_fonte', arquivo)
        .eq('MODALIDADE', 'BMD')
        .select('id');

      resultadoArquivo.correcoes.modalidades_bmd = bmdCorrigidas?.length || 0;

      // 4. Aplicar especialidades baseadas na modalidade para registros vazios
      console.log(`  🔧 Aplicando especialidades automáticas...`);
      
      // RX
      await supabase
        .from('volumetria_mobilemed')
        .update({ "ESPECIALIDADE": 'RX', updated_at: new Date().toISOString() })
        .eq('arquivo_fonte', arquivo)
        .eq('MODALIDADE', 'RX')
        .or('ESPECIALIDADE.is.null,ESPECIALIDADE.eq.');

      // CT  
      await supabase
        .from('volumetria_mobilemed')
        .update({ "ESPECIALIDADE": 'CT', updated_at: new Date().toISOString() })
        .eq('arquivo_fonte', arquivo)
        .eq('MODALIDADE', 'CT')
        .or('ESPECIALIDADE.is.null,ESPECIALIDADE.eq.');

      // RM
      await supabase
        .from('volumetria_mobilemed')
        .update({ "ESPECIALIDADE": 'RM', updated_at: new Date().toISOString() })
        .eq('arquivo_fonte', arquivo)
        .eq('MODALIDADE', 'MR')
        .or('ESPECIALIDADE.is.null,ESPECIALIDADE.eq.');

      // DO
      await supabase
        .from('volumetria_mobilemed')
        .update({ "ESPECIALIDADE": 'DO', updated_at: new Date().toISOString() })
        .eq('arquivo_fonte', arquivo)
        .eq('MODALIDADE', 'DO')
        .or('ESPECIALIDADE.is.null,ESPECIALIDADE.eq.');

      // 5. Aplicar categorias do cadastro de exames
      console.log(`  🔧 Aplicando categorias do cadastro...`);
      const { data: registrosSemCategoria } = await supabase
        .from('volumetria_mobilemed')
        .select('id, "ESTUDO_DESCRICAO"')
        .eq('arquivo_fonte', arquivo)
        .or('"CATEGORIA".is.null,"CATEGORIA".eq.—,"CATEGORIA".eq.');

      let categoriasAplicadas = 0;
      if (registrosSemCategoria) {
        for (const registro of registrosSemCategoria) {
          const { data: categoriaEncontrada } = await supabase
            .from('cadastro_exames')
            .select('categoria')
            .eq('nome', registro.ESTUDO_DESCRICAO)
            .eq('ativo', true)
            .not('categoria', 'is', null)
            .not('categoria', 'eq', '')
            .limit(1)
            .maybeSingle();

          if (categoriaEncontrada?.categoria) {
            await supabase
              .from('volumetria_mobilemed')
              .update({ "CATEGORIA": categoriaEncontrada.categoria, updated_at: new Date().toISOString() })
              .eq('id', registro.id);
            categoriasAplicadas++;
          } else {
            // Categoria padrão baseada na modalidade
            const { data: modalidadeInfo } = await supabase
              .from('volumetria_mobilemed')
              .select('"MODALIDADE"')
              .eq('id', registro.id)
              .single();

            let categoriaDefault = 'SC';
            if (modalidadeInfo?.MODALIDADE === 'DO') categoriaDefault = 'DO';
            else if (modalidadeInfo?.MODALIDADE === 'MG') categoriaDefault = 'MG';

            await supabase
              .from('volumetria_mobilemed')
              .update({ "CATEGORIA": categoriaDefault, updated_at: new Date().toISOString() })
              .eq('id', registro.id);
            categoriasAplicadas++;
          }
        }
      }
      resultadoArquivo.correcoes.categorias = categoriasAplicadas;

      // 6. Aplicar de-para de prioridades
      console.log(`  🔧 Aplicando de-para de prioridades...`);
      const { data: mapeamentos } = await supabase
        .from('valores_prioridade_de_para')
        .select('prioridade_original, nome_final')
        .eq('ativo', true);

      let prioridadesCorrigidas = 0;
      if (mapeamentos) {
        for (const mapeamento of mapeamentos) {
          const { data: registrosAtualizados } = await supabase
            .from('volumetria_mobilemed')
            .update({ "PRIORIDADE": mapeamento.nome_final, updated_at: new Date().toISOString() })
            .eq('arquivo_fonte', arquivo)
            .eq('PRIORIDADE', mapeamento.prioridade_original)
            .select('id');
          
          prioridadesCorrigidas += registrosAtualizados?.length || 0;
        }
      }
      resultadoArquivo.correcoes.prioridades = prioridadesCorrigidas;

      resultados.push(resultadoArquivo);
      console.log(`✅ Arquivo ${arquivo} processado com sucesso`);
    }

    // Log da operação
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'CORRECAO_LOTE',
        record_id: 'bulk_correction',
        new_data: {
          arquivos_processados: arquivosUnicos.length,
          resultados: resultados,
          regras_aplicadas: ['modalidade_cr_dx_rx', 'modalidade_ot_do', 'modalidade_bmd_do', 'especialidades_automaticas', 'categorias_cadastro', 'de_para_prioridades']
        },
        user_email: 'system',
        severity: 'info'
      });

    const response = {
      sucesso: true,
      arquivos_processados: arquivosUnicos.length,
      total_correcoes: resultados.reduce((acc, r) => 
        acc + Object.values(r.correcoes).reduce((sum, val) => sum + (val as number), 0), 0
      ),
      detalhes_por_arquivo: resultados,
      timestamp: new Date().toISOString(),
      observacao: 'Correções aplicadas em dados existentes - regras agora funcionarão automaticamente para novos uploads'
    };

    console.log('🎉 Correção concluída:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('💥 Erro na correção de dados existentes:', error);
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        erro: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});