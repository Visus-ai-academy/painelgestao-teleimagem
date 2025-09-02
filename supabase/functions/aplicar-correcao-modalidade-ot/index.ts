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

    const requestBody = await req.json().catch(() => ({}));
    const { arquivo_fonte } = requestBody;

    console.log('📦 Dados recebidos:', requestBody);

    // Se arquivo_fonte for null, processar todos os arquivos
    const processingAllFiles = !arquivo_fonte || arquivo_fonte === null || arquivo_fonte === '';
    const targetFile = processingAllFiles ? 'TODOS' : arquivo_fonte;
    
    console.log(`📁 Processando: ${processingAllFiles ? 'TODOS OS ARQUIVOS' : arquivo_fonte}`);

    // Validar arquivo_fonte apenas se não for processamento geral
    if (!processingAllFiles) {
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
        throw new Error(`Arquivo fonte inválido: ${arquivo_fonte}. Deve ser um dos: ${arquivosValidos.join(', ')}`);
      }
    }

    console.log(`Iniciando correção de modalidade OT para DO no arquivo: ${targetFile}`);

    // 1. Buscar registros que precisam ser corrigidos - USANDO COUNT PARA EFICIÊNCIA
    let query = supabase
      .from('volumetria_mobilemed')
      .select('id', { count: 'exact', head: true })
      .eq('MODALIDADE', 'OT');
    
    if (!processingAllFiles) {
      query = query.eq('arquivo_fonte', arquivo_fonte);
    }
    
    const { count, error: errorCount } = await query;

    if (errorCount) {
      throw new Error(`Erro ao contar registros para correção: ${errorCount.message}`);
    }

    if (!count || count === 0) {
      console.log(`Nenhum exame OT encontrado no arquivo: ${targetFile}`);
      return new Response(JSON.stringify({
        sucesso: true,
        arquivo_fonte: targetFile,
        registros_encontrados: 0,
        registros_corrigidos: 0,
        mensagem: 'Nenhum exame OT encontrado para correção'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`Encontrados ${count} exames OT para correção`);

    // 2. Aplicar correção EM LOTES para evitar timeout
    const BATCH_SIZE = 500;
    let totalCorrigidos = 0;
    let offset = 0;

    while (offset < count) {
      console.log(`Processando lote ${Math.floor(offset/BATCH_SIZE) + 1}/${Math.ceil(count/BATCH_SIZE)}`);
      
      // Buscar IDs do lote atual
      let batchQuery = supabase
        .from('volumetria_mobilemed')
        .select('id')
        .eq('MODALIDADE', 'OT')
        .range(offset, offset + BATCH_SIZE - 1);
      
      if (!processingAllFiles) {
        batchQuery = batchQuery.eq('arquivo_fonte', arquivo_fonte);
      }
      
      const { data: batchIds, error: errorBatch } = await batchQuery;

      if (errorBatch || !batchIds?.length) {
        console.log(`Fim dos registros no offset ${offset}`);
        break;
      }

      // Atualizar o lote atual
      const { data: resultadoUpdate, error: errorUpdate } = await supabase
        .from('volumetria_mobilemed')
        .update({ 
          "MODALIDADE": 'DO',
          updated_at: new Date().toISOString()
        })
        .in('id', batchIds.map(r => r.id))
        .select('id, "ESTUDO_DESCRICAO"');

      if (errorUpdate) {
        console.error(`Erro no lote ${Math.floor(offset/BATCH_SIZE) + 1}:`, errorUpdate.message);
        break;
      }

      const loteCorrigidos = resultadoUpdate?.length || 0;
      totalCorrigidos += loteCorrigidos;
      
      console.log(`Lote ${Math.floor(offset/BATCH_SIZE) + 1}: ${loteCorrigidos} registros corrigidos`);
      
      offset += BATCH_SIZE;
      
      // Pequena pausa entre lotes para evitar sobrecarga
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`Correção aplicada com sucesso: ${totalCorrigidos} registros atualizados`);

    // 3. Criar relatório de correções (só precisamos de exemplos)
    const { data: exemplos } = await supabase
      .from('volumetria_mobilemed')
      .select('"ESTUDO_DESCRICAO", "MODALIDADE"')
      .eq('arquivo_fonte', arquivo_fonte)
      .eq('MODALIDADE', 'DO')
      .limit(5);

    const exemplosCorrigan = exemplos?.map(registro => ({
      estudo_descricao: registro.ESTUDO_DESCRICAO,
      modalidade_anterior: 'OT',
      modalidade_nova: 'DO'
    })) || [];

    // 4. Log da operação
    const { error: logError } = await supabase
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'CORRECAO_AUTOMATICA',
        record_id: arquivo_fonte,
        new_data: {
          arquivo_fonte,
          registros_encontrados: count,
          registros_corrigidos: totalCorrigidos,
          exemplos_corrigidos: exemplosCorrigan,
          regra: 'v031',
          tipo_correcao: 'MODALIDADE_OT'
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
      registros_encontrados: count,
      registros_corrigidos: totalCorrigidos,
      exemplos_corrigidos: exemplosCorrigan,
      regra_aplicada: 'v031 - Correção de Modalidade OT para DO',
      data_processamento: new Date().toISOString(),
      observacao: `Processados ${totalCorrigidos} exames com MODALIDADE "OT" alterados para "DO" em lotes de ${BATCH_SIZE}`
    };

    console.log('Correção de modalidade OT concluída:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Erro geral na correção de modalidade OT:', error);
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