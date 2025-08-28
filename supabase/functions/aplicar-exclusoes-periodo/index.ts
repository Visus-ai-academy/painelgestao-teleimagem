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
    const { arquivo_fonte, periodo_referencia } = await req.json();
    console.log(`Aplicando exclusões por período - Arquivo: ${arquivo_fonte}, Período: ${periodo_referencia}`);

    // Validar arquivo_fonte
    const arquivosValidos = [
      'volumetria_padrao',
      'volumetria_fora_padrao', 
      'volumetria_padrao_retroativo',
      'volumetria_fora_padrao_retroativo',
      'volumetria_onco_padrao',
      'arquivo_1_padrao',
      'arquivo_2_padrao',
      'arquivo_3_padrao', 
      'arquivo_4_padrao',
      'arquivo_5_padrao'
    ];

    if (!arquivosValidos.includes(arquivo_fonte)) {
      return new Response(JSON.stringify({
        sucesso: false,
        erro: `Arquivo ${arquivo_fonte} não é válido para esta regra`
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let dataLimite: Date;
    
    // Determinar data limite baseada no período de referência
    // Para dados retroativos de jun/25, excluir registros com DATA_LAUDO >= 01/06/2025
    if (periodo_referencia === 'jun/25') {
      dataLimite = new Date('2025-06-01');
    } else {
      // Para outros períodos, calcular dinamicamente
      const [mes, ano] = periodo_referencia.split('/');
      const meses: { [key: string]: number } = {
        'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
        'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12
      };
      const anoCompleto = 2000 + parseInt(ano);
      const mesNumero = meses[mes];
      dataLimite = new Date(anoCompleto, mesNumero - 1, 1);
    }

    console.log(`Data limite para exclusão: ${dataLimite.toISOString().split('T')[0]}`);

    // Primeiro, contar quantos registros serão afetados
    const { count: totalParaExcluir, error: errorContar } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', arquivo_fonte)
      .gte('DATA_LAUDO', dataLimite.toISOString().split('T')[0]);

    if (errorContar) {
      console.error('Erro ao contar registros:', errorContar);
      return new Response(JSON.stringify({ 
        sucesso: false, 
        erro: errorContar.message 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      });
    }

    console.log(`Encontrados ${totalParaExcluir || 0} registros para exclusão`);

    if (!totalParaExcluir || totalParaExcluir === 0) {
      console.log('Nenhum registro encontrado para exclusão');
      return new Response(JSON.stringify({
        sucesso: true,
        arquivo_fonte,
        registros_encontrados: 0,
        registros_excluidos: 0,
        data_limite: dataLimite.toISOString().split('T')[0],
        mensagem: 'Nenhum registro fora do período encontrado'
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Buscar alguns exemplos antes da exclusão
    const { data: exemplosData, error: exemplosError } = await supabase
      .from('volumetria_mobilemed')
      .select('DATA_LAUDO, ESTUDO_DESCRICAO, EMPRESA')
      .eq('arquivo_fonte', arquivo_fonte)
      .gte('DATA_LAUDO', dataLimite.toISOString().split('T')[0])
      .limit(5);

    const exemplosExcluidos = exemplosData?.map(reg => ({
      data_laudo: reg.DATA_LAUDO,
      estudo_descricao: reg.ESTUDO_DESCRICAO,
      empresa: reg.EMPRESA
    })) || [];

    let totalExcluidos = 0;

    // Executar exclusão em lotes pequenos para evitar problemas de timeout e EarlyDrop
    const BATCH_SIZE = 1000; // Processar em lotes de 1000 registros
    totalExcluidos = 0;
    let processedBatches = 0;
    
    try {
      console.log(`Iniciando exclusão em lotes de ${BATCH_SIZE} registros com DATA_LAUDO >= ${dataLimite.toISOString().split('T')[0]}...`);
      
      // Processar em lotes até não haver mais registros para excluir
      while (true) {
        const { error: deleteError, count } = await supabase
          .from('volumetria_mobilemed')
          .delete({ count: 'exact' })
          .eq('arquivo_fonte', arquivo_fonte)
          .gte('DATA_LAUDO', dataLimite.toISOString().split('T')[0])
          .limit(BATCH_SIZE);

        if (deleteError) {
          console.error('❌ Erro ao excluir registros no lote:', deleteError);
          
          return new Response(JSON.stringify({
            sucesso: false,
            arquivo_fonte,
            periodo_referencia,
            erro: `Falha na exclusão (lote ${processedBatches + 1}): ${deleteError.message}`,
            registros_encontrados: totalParaExcluir || 0,
            registros_excluidos: totalExcluidos,
            data_limite: dataLimite.toISOString().split('T')[0],
            regra_aplicada: 'v002/v003 - Exclusões por Período'
          }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          });
        }

        const batchDeleted = count || 0;
        totalExcluidos += batchDeleted;
        processedBatches++;
        
        console.log(`Lote ${processedBatches}: ${batchDeleted} registros excluídos (Total: ${totalExcluidos})`);
        
        // Se o lote excluiu menos que o tamanho do lote, significa que acabaram os registros
        if (batchDeleted < BATCH_SIZE) {
          break;
        }
        
        // Pequena pausa entre lotes para evitar sobrecarga
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      console.log(`✅ Exclusão concluída: ${totalExcluidos} registros excluídos em ${processedBatches} lotes de ${totalParaExcluir} encontrados`);
      
      // Verificar se realmente excluiu o esperado
      if (totalParaExcluir > 0 && totalExcluidos === 0) {
        console.error(`⚠️ ALERTA: ${totalParaExcluir} registros deveriam ser excluídos, mas 0 foram excluídos`);
        
        return new Response(JSON.stringify({
          sucesso: false,
          arquivo_fonte,
          periodo_referencia,
          erro: `Falha: ${totalParaExcluir} registros encontrados mas nenhum excluído`,
          registros_encontrados: totalParaExcluir,
          registros_excluidos: 0,
          data_limite: dataLimite.toISOString().split('T')[0],
          regra_aplicada: 'v002/v003 - Exclusões por Período'
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        });
      }
      
    } catch (error) {
      console.error('💥 Erro durante exclusão:', error);
      
      return new Response(JSON.stringify({
        sucesso: false,
        arquivo_fonte,
        periodo_referencia,
        erro: `Exceção durante exclusão: ${error.message}`,
        registros_encontrados: totalParaExcluir || 0,
        registros_excluidos: 0,
        data_limite: dataLimite.toISOString().split('T')[0],
        regra_aplicada: 'v002/v003 - Exclusões por Período'
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      });
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
          periodo_referencia,
          data_limite: dataLimite.toISOString().split('T')[0],
          registros_encontrados: totalParaExcluir || 0,
          registros_excluidos: totalExcluidos,
          exemplos_excluidos: exemplosExcluidos,
          regra: 'v002_v003',
          tipo_correcao: 'EXCLUSOES_PERIODO'
        },
        user_email: 'system',
        severity: 'info'
      });

    if (logError) {
      console.error('Erro ao registrar log:', logError);
    }

    const resultado = {
      sucesso: totalExcluidos >= 0, // Considera sucesso mesmo se não excluiu nada (não havia registros)
      arquivo_fonte,
      periodo_referencia,  
      data_limite: dataLimite.toISOString().split('T')[0],
      registros_encontrados: totalParaExcluir || 0,
      registros_excluidos: totalExcluidos,
      exemplos_excluidos: exemplosExcluidos,
      regra_aplicada: 'v002/v003 - Exclusões por Período',
      data_processamento: new Date().toISOString(),
      observacao: `Excluídos ${totalExcluidos} registros com DATA_LAUDO >= ${dataLimite.toISOString().split('T')[0]}`
    };

    console.log('Exclusões por período concluídas:', resultado);

    return new Response(JSON.stringify(resultado), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('Erro na função aplicar-exclusoes-periodo:', error);
    return new Response(JSON.stringify({ 
      sucesso: false, 
      erro: error.message 
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500 
    });
  }
});