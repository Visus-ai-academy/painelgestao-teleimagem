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

    const { cliente_empresa } = await req.json();
    const empresaAlvo = cliente_empresa || 'CDATUCURUI';
    
    console.log(`🎯 Iniciando correção de especialidades DO para cliente: ${empresaAlvo}`);
    
    // Buscar cadastro de exames DO
    const { data: cadastroExames, error: cadastroError } = await supabase
      .from('cadastro_exames')
      .select('nome, modalidade, especialidade, categoria')
      .eq('ativo', true)
      .eq('modalidade', 'DO');

    if (cadastroError) {
      console.error('❌ Erro ao buscar cadastro de exames:', cadastroError);
      throw cadastroError;
    }

    console.log(`📚 Carregados ${cadastroExames?.length || 0} exames DO no cadastro`);

    // Criar mapa de exames
    const mapaExames = new Map();
    cadastroExames?.forEach(exame => {
      const key = exame.nome.toUpperCase().trim();
      mapaExames.set(key, {
        modalidade: exame.modalidade,
        especialidade: exame.especialidade,
        categoria: exame.categoria
      });
    });

    // Buscar registros DO do cliente com especialidade incorreta
    const { data: registros, error: selectError } = await supabase
      .from('volumetria_mobilemed')
      .select('id, "ESTUDO_DESCRICAO", "MODALIDADE", "ESPECIALIDADE", "CATEGORIA"')
      .eq('EMPRESA', empresaAlvo)
      .eq('MODALIDADE', 'DO')
      .neq('ESPECIALIDADE', 'D.O');

    if (selectError) {
      console.error('❌ Erro ao buscar registros:', selectError);
      throw selectError;
    }

    console.log(`📊 Encontrados ${registros?.length || 0} registros DO com especialidade incorreta`);

    let totalProcessados = 0;
    let totalAtualizados = 0;
    let totalErros = 0;
    const exemplosAplicados: any[] = [];

    // Processar em lotes de 100 registros
    const batchSize = 100;
    for (let i = 0; i < (registros?.length || 0); i += batchSize) {
      const lote = registros!.slice(i, i + batchSize);
      console.log(`🔄 Processando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil((registros?.length || 0) / batchSize)} - ${lote.length} registros`);
      
      for (const registro of lote) {
        totalProcessados++;
        
        try {
          const nomeExame = registro.ESTUDO_DESCRICAO?.toUpperCase().trim();
          const dadosCadastro = mapaExames.get(nomeExame);
          
          if (dadosCadastro) {
            const { error: updateError } = await supabase
              .from('volumetria_mobilemed')
              .update({
                'ESPECIALIDADE': dadosCadastro.especialidade,
                'CATEGORIA': dadosCadastro.categoria,
                updated_at: new Date().toISOString()
              })
              .eq('id', registro.id);

            if (updateError) {
              console.error(`❌ Erro ao atualizar registro ${registro.id}:`, updateError);
              totalErros++;
            } else {
              totalAtualizados++;
              
              // Armazenar exemplo para log
              if (exemplosAplicados.length < 10) {
                exemplosAplicados.push({
                  exame: registro.ESTUDO_DESCRICAO,
                  especialidade_antiga: registro.ESPECIALIDADE,
                  especialidade_nova: dadosCadastro.especialidade,
                  categoria_antiga: registro.CATEGORIA,
                  categoria_nova: dadosCadastro.categoria
                });
              }
              
              console.log(`✅ Corrigido: "${registro.ESTUDO_DESCRICAO}" → ESP:${dadosCadastro.especialidade}`);
            }
          } else {
            console.log(`⚠️ Exame não encontrado no cadastro: "${registro.ESTUDO_DESCRICAO}"`);
          }
        } catch (error) {
          console.error(`❌ Erro ao processar registro ${registro.id}:`, error);
          totalErros++;
        }
      }
    }

    // Log da operação no audit_logs
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'CORRIGIR_ESPECIALIDADES_DO',
        record_id: empresaAlvo,
        new_data: {
          cliente_empresa: empresaAlvo,
          total_processados: totalProcessados,
          total_atualizados: totalAtualizados,
          total_erros: totalErros,
          exemplos_aplicados: exemplosAplicados,
          data_processamento: new Date().toISOString()
        },
        user_email: 'system',
        severity: 'info'
      });

    const resultado = {
      sucesso: true,
      cliente_empresa: empresaAlvo,
      registros_processados: totalProcessados,
      registros_atualizados: totalAtualizados,
      registros_erro: totalErros,
      exemplos_aplicados: exemplosAplicados,
      data_processamento: new Date().toISOString(),
      observacao: `Corrigidas especialidades de ${totalAtualizados} exames DO do cliente ${empresaAlvo} para "D.O"`
    };

    console.log('✅ Especialidades DO corrigidas com sucesso:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro geral na correção de especialidades DO:', error);
    return new Response(
      JSON.stringify({ erro: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
