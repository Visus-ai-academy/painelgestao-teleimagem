import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🎯 Iniciando correção de registros com ESPECIALIDADE = "GERAL"');

    // 1. Buscar todos os registros com ESPECIALIDADE = 'GERAL'
    const { data: registrosGeral, error: selectError } = await supabaseClient
      .from('volumetria_mobilemed')
      .select('id, "ESTUDO_DESCRICAO", "ESPECIALIDADE", "MODALIDADE"')
      .eq('ESPECIALIDADE', 'GERAL');

    if (selectError) {
      console.error('❌ Erro ao buscar registros com GERAL:', selectError);
      throw selectError;
    }

    console.log(`📊 Encontrados ${registrosGeral?.length || 0} registros com ESPECIALIDADE = "GERAL"`);

    if (!registrosGeral || registrosGeral.length === 0) {
      return new Response(
        JSON.stringify({
          sucesso: true,
          mensagem: 'Nenhum registro com ESPECIALIDADE = "GERAL" encontrado',
          total_corrigidos: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Buscar mapeamento do cadastro_exames
    const { data: cadastroExames, error: cadastroError } = await supabaseClient
      .from('cadastro_exames')
      .select('nome, especialidade, categoria, modalidade')
      .eq('ativo', true);

    if (cadastroError) {
      console.error('❌ Erro ao buscar cadastro_exames:', cadastroError);
      throw cadastroError;
    }

    console.log(`📋 Carregados ${cadastroExames?.length || 0} exames do cadastro`);

    // Criar mapa de exames
    const mapaExames = new Map<string, { especialidade: string; categoria?: string; modalidade?: string }>();
    cadastroExames?.forEach((exame) => {
      const nomeKey = exame.nome.toUpperCase().trim();
      mapaExames.set(nomeKey, {
        especialidade: exame.especialidade,
        categoria: exame.categoria,
        modalidade: exame.modalidade
      });
    });

    // 3. Processar cada registro
    let totalCorrigidos = 0;
    let totalNaoEncontrados = 0;
    const detalhesCorrecoes: any[] = [];

    for (const registro of registrosGeral) {
      if (!registro.ESTUDO_DESCRICAO) {
        console.warn(`⚠️ Registro ${registro.id} sem ESTUDO_DESCRICAO, pulando...`);
        totalNaoEncontrados++;
        continue;
      }

      const estudoKey = registro.ESTUDO_DESCRICAO.toUpperCase().trim();
      const dadosExame = mapaExames.get(estudoKey);

      if (dadosExame && dadosExame.especialidade) {
        // Atualizar com a especialidade correta do cadastro
        const { error: updateError } = await supabaseClient
          .from('volumetria_mobilemed')
          .update({
            ESPECIALIDADE: dadosExame.especialidade,
            updated_at: new Date().toISOString()
          })
          .eq('id', registro.id);

        if (updateError) {
          console.error(`❌ Erro ao atualizar registro ${registro.id}:`, updateError);
        } else {
          totalCorrigidos++;
          detalhesCorrecoes.push({
            id: registro.id,
            estudo: registro.ESTUDO_DESCRICAO,
            especialidade_antiga: 'GERAL',
            especialidade_nova: dadosExame.especialidade
          });

          if (totalCorrigidos % 100 === 0) {
            console.log(`📊 Progresso: ${totalCorrigidos} registros corrigidos`);
          }
        }
      } else {
        console.warn(`⚠️ Exame não encontrado no cadastro: ${registro.ESTUDO_DESCRICAO}`);
        totalNaoEncontrados++;
      }
    }

    console.log(`✅ Correção finalizada: ${totalCorrigidos} registros corrigidos, ${totalNaoEncontrados} não encontrados no cadastro`);

    // 4. Registrar no audit_logs
    await supabaseClient
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'CORRIGIR_ESPECIALIDADE_GERAL',
        record_id: 'bulk_correction',
        new_data: {
          total_processados: registrosGeral.length,
          total_corrigidos: totalCorrigidos,
          total_nao_encontrados: totalNaoEncontrados,
          detalhes_correcoes: detalhesCorrecoes.slice(0, 100) // Primeiros 100 para não sobrecarregar
        }
      });

    return new Response(
      JSON.stringify({
        sucesso: true,
        total_processados: registrosGeral.length,
        total_corrigidos: totalCorrigidos,
        total_nao_encontrados: totalNaoEncontrados,
        detalhes_amostra: detalhesCorrecoes.slice(0, 10)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro geral na correção de especialidade GERAL:', error);
    return new Response(
      JSON.stringify({ erro: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
