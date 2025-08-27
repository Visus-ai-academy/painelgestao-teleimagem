import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { arquivo_fonte } = await req.json();
    console.log(`Iniciando aplicação De-Para prioridades no arquivo: ${arquivo_fonte}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar mapeamentos de prioridades ativos
    const { data: mapeamentos, error: errorMapeamentos } = await supabase
      .from('valores_prioridade_de_para')
      .select('*')
      .eq('ativo', true);

    if (errorMapeamentos) {
      console.error('Erro ao buscar mapeamentos:', errorMapeamentos);
      return new Response(JSON.stringify({ 
        sucesso: false, 
        erro: errorMapeamentos.message 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      });
    }

    if (!mapeamentos || mapeamentos.length === 0) {
      console.log('Nenhum mapeamento de prioridade encontrado');
      return new Response(JSON.stringify({
        sucesso: true,
        arquivo_fonte,
        registros_encontrados: 0,
        registros_atualizados: 0,
        mensagem: 'Nenhum mapeamento de prioridade configurado'
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log(`Encontrados ${mapeamentos.length} mapeamentos de prioridade`);

    // Buscar registros que precisam ser atualizados
    const prioridadesOriginais = mapeamentos.map(m => m.prioridade_original);
    
    const { data: registrosParaAtualizar, error: errorRegistros } = await supabase
      .from('volumetria_mobilemed')
      .select('id, PRIORIDADE')
      .eq('arquivo_fonte', arquivo_fonte)
      .in('PRIORIDADE', prioridadesOriginais);

    if (errorRegistros) {
      console.error('Erro ao buscar registros:', errorRegistros);
      return new Response(JSON.stringify({ 
        sucesso: false, 
        erro: errorRegistros.message 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      });
    }

    if (!registrosParaAtualizar || registrosParaAtualizar.length === 0) {
      console.log('Nenhum registro encontrado para atualização');
      return new Response(JSON.stringify({
        sucesso: true,
        arquivo_fonte,
        registros_encontrados: 0,
        registros_atualizados: 0,
        mensagem: 'Nenhum registro encontrado para De-Para de prioridades'
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log(`Encontrados ${registrosParaAtualizar.length} registros para atualização`);

    // Criar mapa de conversão para facilitar lookup
    const mapaConversao = new Map();
    mapeamentos.forEach(m => {
      mapaConversao.set(m.prioridade_original, m.nome_final);
    });

    // Processar em lotes de 1000 registros
    let totalAtualizados = 0;
    const batchSize = 1000;
    const exemplosConvertidos = [];

    for (let i = 0; i < registrosParaAtualizar.length; i += batchSize) {
      const batch = registrosParaAtualizar.slice(i, i + batchSize);
      
      for (const registro of batch) {
        const novaprioridade = mapaConversao.get(registro.PRIORIDADE);
        
        if (novaprioridade && novaprioridade !== registro.PRIORIDADE) {
          const { error: updateError } = await supabase
            .from('volumetria_mobilemed')
            .update({ PRIORIDADE: novaprioridade })
            .eq('id', registro.id);

          if (updateError) {
            console.error(`Erro ao atualizar registro ${registro.id}:`, updateError);
            continue;
          }

          totalAtualizados++;
          
          // Coletar exemplos para o log
          if (exemplosConvertidos.length < 5) {
            exemplosConvertidos.push({
              prioridade_original: registro.PRIORIDADE,
              prioridade_nova: novaprioridade
            });
          }
        }
      }

      console.log(`Processado lote ${Math.floor(i / batchSize) + 1}, atualizados: ${totalAtualizados}`);
    }

    // Log da operação
    const { error: logError } = await supabase
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'CORRECAO_AUTOMATICA',
        record_id: arquivo_fonte,
        new_data: {
          arquivo_fonte,
          registros_encontrados: registrosParaAtualizar.length,
          registros_atualizados: totalAtualizados,
          exemplos_convertidos: exemplosConvertidos,
          regra: 'v018',
          tipo_correcao: 'DE_PARA_PRIORIDADES'
        },
        user_email: 'system',
        severity: 'info'
      });

    if (logError) {
      console.error('Erro ao registrar log:', logError);
    }

    const resultado = {
      sucesso: true,
      arquivo_fonte,
      registros_encontrados: registrosParaAtualizar.length,
      registros_atualizados: totalAtualizados,
      exemplos_convertidos: exemplosConvertidos,
      regra_aplicada: 'v018 - De-Para Prioridades',
      data_processamento: new Date().toISOString(),
      observacao: `${totalAtualizados} registros tiveram suas prioridades padronizadas`
    };

    console.log('De-Para prioridades concluído:', resultado);

    return new Response(JSON.stringify(resultado), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('Erro na função aplicar-de-para-prioridades:', error);
    return new Response(JSON.stringify({ 
      sucesso: false, 
      erro: error.message 
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500 
    });
  }
});