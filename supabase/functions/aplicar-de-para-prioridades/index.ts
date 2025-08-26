import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { arquivo_fonte } = await req.json();
    
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`🏷️ Iniciando aplicação de De-Para Prioridades para arquivo: ${arquivo_fonte}`);
    
    // Buscar mapeamento de prioridades
    const { data: deParaPrioridades, error: deParaError } = await supabaseClient
      .from('valores_prioridade_de_para')
      .select('prioridade_original, nome_final');

    if (deParaError) {
      console.error('❌ Erro ao buscar De-Para prioridades:', deParaError);
      throw deParaError;
    }

    console.log(`📚 Carregados ${deParaPrioridades?.length || 0} mapeamentos de prioridade`);

    if (!deParaPrioridades || deParaPrioridades.length === 0) {
      const resultado = {
        sucesso: true,
        arquivo_fonte,
        registros_processados: 0,
        registros_atualizados: 0,
        registros_erro: 0,
        regra_aplicada: 'v018 - De-Para Prioridades',
        observacao: 'Nenhum mapeamento de prioridade encontrado'
      };

      console.log('⚠️ Nenhum mapeamento de prioridade encontrado');
      return new Response(JSON.stringify(resultado), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Criar mapa de prioridades para busca eficiente
    const mapaPrioridades = new Map();
    deParaPrioridades.forEach(item => {
      mapaPrioridades.set(item.prioridade_original, item.nome_final);
    });

    // Buscar registros com prioridades que podem ser mapeadas
    const prioridadesOriginais = Array.from(mapaPrioridades.keys());
    
    const { data: registrosParaAtualizar, error: selectError } = await supabaseClient
      .from('volumetria_mobilemed')
      .select('id, "PRIORIDADE"')
      .eq('arquivo_fonte', arquivo_fonte)
      .in('"PRIORIDADE"', prioridadesOriginais);

    if (selectError) {
      console.error('❌ Erro ao buscar registros para atualização:', selectError);
      throw selectError;
    }

    console.log(`📊 Encontrados ${registrosParaAtualizar?.length || 0} registros para aplicar De-Para`);

    let totalProcessados = 0;
    let totalAtualizados = 0;
    let totalErros = 0;
    const exemplosMapeados: any[] = [];

    // Processar em lotes de 100 registros
    const batchSize = 100;
    for (let i = 0; i < (registrosParaAtualizar?.length || 0); i += batchSize) {
      const lote = registrosParaAtualizar!.slice(i, i + batchSize);
      console.log(`🔄 Processando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil((registrosParaAtualizar?.length || 0) / batchSize)} - ${lote.length} registros`);
      
      for (const registro of lote) {
        totalProcessados++;
        
        try {
          const prioridadeOriginal = registro.PRIORIDADE;
          const prioridadeFinal = mapaPrioridades.get(prioridadeOriginal);
          
          if (prioridadeFinal && prioridadeFinal !== prioridadeOriginal) {
            const { error: updateError } = await supabaseClient
              .from('volumetria_mobilemed')
              .update({
                'PRIORIDADE': prioridadeFinal,
                updated_at: new Date().toISOString()
              })
              .eq('id', registro.id);

            if (updateError) {
              console.error(`❌ Erro ao atualizar prioridade do registro ${registro.id}:`, updateError);
              totalErros++;
            } else {
              totalAtualizados++;
              
              // Armazenar exemplo para log
              if (exemplosMapeados.length < 10) {
                exemplosMapeados.push({
                  prioridade_original: prioridadeOriginal,
                  prioridade_final: prioridadeFinal
                });
              }
              
              console.log(`✅ Prioridade mapeada: "${prioridadeOriginal}" → "${prioridadeFinal}"`);
            }
          }
        } catch (error) {
          console.error(`❌ Erro ao processar registro ${registro.id}:`, error);
          totalErros++;
        }
      }
    }

    // Log da operação no audit_logs
    await supabaseClient
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'APLICAR_DE_PARA_PRIORIDADES',
        record_id: arquivo_fonte,
        new_data: {
          regra: 'v018',
          arquivo_fonte,
          total_processados: totalProcessados,
          total_atualizados: totalAtualizados,
          total_erros: totalErros,
          exemplos_mapeados: exemplosMapeados,
          data_processamento: new Date().toISOString()
        },
        user_email: 'system',
        severity: 'info'
      });

    const resultado = {
      sucesso: true,
      arquivo_fonte,
      registros_processados: totalProcessados,
      registros_atualizados: totalAtualizados,
      registros_erro: totalErros,
      exemplos_mapeados: exemplosMapeados,
      regra_aplicada: 'v018 - De-Para Prioridades',
      data_processamento: new Date().toISOString(),
      observacao: `Aplicado De-Para de prioridades para ${totalAtualizados} registros`
    };

    console.log('✅ De-Para de prioridades aplicado com sucesso:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro geral na aplicação de De-Para prioridades:', error);
    return new Response(
      JSON.stringify({ erro: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});