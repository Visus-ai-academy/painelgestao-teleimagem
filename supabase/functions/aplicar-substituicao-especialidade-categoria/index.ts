import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { arquivo_fonte } = await req.json();
    
    console.log(`🔄 Iniciando aplicação da regra v033 - Substituição de Especialidade/Categoria para arquivo: ${arquivo_fonte}`);
    
    let totalProcessados = 0;
    let totalSubstituidos = 0;
    let totalErros = 0;
    
    // Especialidades que devem ter substituição
    const especialidadesAlvo = [
      'Cardio com Score',
      'Corpo', 
      'Onco Medicina Interna'
    ];
    
    // Buscar todos os registros com as especialidades específicas
    const { data: registrosParaSubstituir, error: selectError } = await supabase
      .from('volumetria_mobilemed')
      .select('id, "ESTUDO_DESCRICAO", "ESPECIALIDADE", "CATEGORIA"')
      .in('"ESPECIALIDADE"', especialidadesAlvo)
      .eq('arquivo_fonte', arquivo_fonte);
    
    if (selectError) {
      console.error('❌ Erro ao buscar registros para substituição:', selectError);
      throw selectError;
    }
    
    if (!registrosParaSubstituir || registrosParaSubstituir.length === 0) {
      console.log('✅ Nenhum registro encontrado com as especialidades específicas');
      return new Response(
        JSON.stringify({
          sucesso: true,
          total_processados: 0,
          total_substituidos: 0,
          total_erros: 0,
          arquivo_fonte,
          observacoes: 'Nenhum registro necessitou substituição'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`📊 Encontrados ${registrosParaSubstituir.length} registros para análise`);
    
    // Buscar cadastro de exames para usar como referência
    const { data: cadastroExames, error: cadastroError } = await supabase
      .from('cadastro_exames')
      .select('nome, especialidade, categoria')
      .eq('ativo', true);
    
    if (cadastroError) {
      console.error('❌ Erro ao buscar cadastro de exames:', cadastroError);
      throw cadastroError;
    }
    
    // Criar mapa de exames para busca eficiente
    const mapaExames = new Map();
    cadastroExames?.forEach(exame => {
      mapaExames.set(exame.nome, {
        especialidade: exame.especialidade,
        categoria: exame.categoria
      });
    });
    
    // Processar cada registro
    for (const registro of registrosParaSubstituir) {
      totalProcessados++;
      
      try {
        const nomeExame = registro.ESTUDO_DESCRICAO;
        const dadosCadastro = mapaExames.get(nomeExame);
        
        if (dadosCadastro) {
          // Atualizar especialidade e categoria baseado no cadastro
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
            totalSubstituidos++;
            console.log(`✅ Substituído: ${nomeExame} - Especialidade: ${registro.ESPECIALIDADE} → ${dadosCadastro.especialidade}, Categoria: ${registro.CATEGORIA} → ${dadosCadastro.categoria}`);
          }
        } else {
          console.log(`⚠️ Exame não encontrado no cadastro: ${nomeExame}`);
          // Não consideramos como erro se o exame não está no cadastro
        }
      } catch (error) {
        console.error(`❌ Erro ao processar registro ${registro.id}:`, error);
        totalErros++;
      }
    }
    
    // Log da operação no audit_logs
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'REGRA_V033_SUBSTITUICAO_ESPECIALIDADE',
        record_id: arquivo_fonte,
        new_data: {
          total_processados: totalProcessados,
          total_substituidos: totalSubstituidos,
          total_erros: totalErros,
          arquivo_fonte,
          especialidades_alvo: especialidadesAlvo
        },
        user_email: 'system',
        severity: totalErros > 0 ? 'warning' : 'info'
      });
    
    const resultado = {
      sucesso: true,
      total_processados: totalProcessados,
      total_substituidos: totalSubstituidos,
      total_erros: totalErros,
      arquivo_fonte,
      observacoes: `Regra v033 aplicada com sucesso. ${totalSubstituidos} registros tiveram especialidade/categoria substituídas.`
    };
    
    console.log('✅ Regra v033 aplicada com sucesso:', resultado);
    
    return new Response(
      JSON.stringify(resultado),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('❌ Erro na aplicação da regra v033:', error);
    
    return new Response(
      JSON.stringify({
        sucesso: false,
        erro: error.message,
        observacoes: 'Erro ao aplicar regra v033 - Substituição de Especialidade/Categoria'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});