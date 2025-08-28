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
    if (periodo_referencia === 'jun/25') {
      // Para junho/25, a data limite é 01/06/2025
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
      dataLimite = new Date(anoCompleto, mesNumero - 1, 1); // Primeiro dia do mês
    }

    console.log(`Data limite para exclusão: ${dataLimite.toISOString().split('T')[0]}`);

    // Primeiro, contar quantos registros serão afetados
    const { data: registrosParaExcluir, error: errorContar } = await supabase
      .from('volumetria_mobilemed')
      .select('id, DATA_LAUDO, ESTUDO_DESCRICAO, EMPRESA')
      .eq('arquivo_fonte', arquivo_fonte)
      .gt('DATA_LAUDO', dataLimite.toISOString().split('T')[0]);

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

    if (!registrosParaExcluir || registrosParaExcluir.length === 0) {
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

    console.log(`Encontrados ${registrosParaExcluir.length} registros para exclusão`);

    // Coletar exemplos antes da exclusão
    const exemplosExcluidos = registrosParaExcluir.slice(0, 5).map(reg => ({
      data_laudo: reg.DATA_LAUDO,
      estudo_descricao: reg.ESTUDO_DESCRICAO,
      empresa: reg.EMPRESA
    }));

    // Executar exclusão direta com condições (mais eficiente)
    const { error: deleteError, count } = await supabase
      .from('volumetria_mobilemed')
      .delete({ count: 'exact' })
      .eq('arquivo_fonte', arquivo_fonte)
      .gt('DATA_LAUDO', dataLimite.toISOString().split('T')[0]);

    if (deleteError) {
      console.error('Erro ao excluir registros:', deleteError);
      throw new Error(`Erro na exclusão: ${deleteError.message}`);
    }

    const totalExcluidos = count || 0;
    console.log(`Total de ${totalExcluidos} registros excluídos com sucesso`);

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
          registros_encontrados: registrosParaExcluir.length,
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
      sucesso: true,
      arquivo_fonte,
      periodo_referencia,
      data_limite: dataLimite.toISOString().split('T')[0],
      registros_encontrados: registrosParaExcluir.length,
      registros_excluidos: totalExcluidos,
      exemplos_excluidos: exemplosExcluidos,
      regra_aplicada: 'v002/v003 - Exclusões por Período',
      data_processamento: new Date().toISOString(),
      observacao: `Excluídos ${totalExcluidos} registros com DATA_LAUDO posterior a ${dataLimite.toISOString().split('T')[0]}`
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