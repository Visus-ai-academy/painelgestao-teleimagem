import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔧 CRIANDO REGISTROS DE EXCLUSÃO PARA RELATÓRIO');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Buscar uploads com exclusões que não têm registros na tabela de rejeições
    const { data: uploadsComExclusoes, error: uploadsError } = await supabaseClient
      .from('processamento_uploads')
      .select('*')
      .gt('registros_erro', 0)
      .in('tipo_arquivo', [
        'volumetria_padrao', 
        'volumetria_fora_padrao', 
        'volumetria_padrao_retroativo', 
        'volumetria_fora_padrao_retroativo',
        'volumetria_onco_padrao'
      ])
      .order('created_at', { ascending: false });

    if (uploadsError) {
      throw uploadsError;
    }

    console.log(`📊 Encontrados ${uploadsComExclusoes?.length || 0} uploads com exclusões`);

    let totalRegistrosCriados = 0;

    for (const upload of uploadsComExclusoes || []) {
      const loteUpload = `volumetria_${upload.tipo_arquivo}_${upload.id}`;
      
      // Verificar se já existem registros rejeitados para este lote
      const { data: existentes } = await supabaseClient
        .from('registros_rejeitados_processamento')
        .select('count(*)', { count: 'exact' })
        .or(`lote_upload.eq.${loteUpload},lote_upload.ilike.%${upload.id}%`);

      const existentesCount = existentes?.[0]?.count || 0;
      const exclusoesEsperadas = upload.registros_erro || 0;

      console.log(`📋 Upload ${upload.arquivo_nome}: ${exclusoesEsperadas} exclusões esperadas, ${existentesCount} já registradas`);

      // Se há exclusões mas não há registros rejeitados, analisar arquivo original
      if (exclusoesEsperadas > 0 && existentesCount === 0) {
        console.log(`🔍 Analisando arquivo original para identificar ${exclusoesEsperadas} registros excluídos: ${upload.arquivo_nome}`);

        // Buscar registros inseridos com sucesso para este lote
        const { data: registrosInseridos } = await supabaseClient
          .from('volumetria_mobilemed')
          .select('*')
          .eq('lote_upload', loteUpload)
          .order('created_at', { ascending: true });

        console.log(`📋 ${registrosInseridos?.length || 0} registros inseridos encontrados no lote ${loteUpload}`);

        // Para cada exclusão esperada, criar um registro indicando que não conseguimos recuperar os dados originais
        const registrosParaCriar = [];
        
        for (let i = 1; i <= exclusoesEsperadas; i++) {
          registrosParaCriar.push({
            arquivo_fonte: upload.tipo_arquivo,
            lote_upload: loteUpload,
            linha_original: upload.registros_processados + i, // Estimar linha baseada no total processado
            dados_originais: {
              OBSERVACAO: 'DADOS_NAO_RECUPERAVEIS',
              ARQUIVO_ORIGEM: upload.arquivo_nome,
              TOTAL_LINHAS_ARQUIVO: upload.registros_processados + exclusoesEsperadas,
              REGISTROS_INSERIDOS: registrosInseridos?.length || 0,
              EXCLUSOES_DETECTADAS: exclusoesEsperadas,
              STATUS: 'EXCLUIDO_DURANTE_PROCESSAMENTO'
            },
            motivo_rejeicao: 'EXCLUSAO_AUTOMATICA_SISTEMA',
            detalhes_erro: `Registro excluído automaticamente durante processamento do arquivo "${upload.arquivo_nome}". ${exclusoesEsperadas} registros de ${upload.registros_processados + exclusoesEsperadas} linhas totais foram excluídos. Possíveis causas: validação de período, filtros de regras de negócio, dados inválidos ou duplicatas. Para ver dados originais, consulte o arquivo fonte.`
          });
        }

        // Inserir em lotes para evitar timeout
        const batchSize = 100;
        for (let j = 0; j < registrosParaCriar.length; j += batchSize) {
          const batch = registrosParaCriar.slice(j, j + batchSize);
          
          const { error: insertError } = await supabaseClient
            .from('registros_rejeitados_processamento')
            .insert(batch);

          if (insertError) {
            console.error(`❌ Erro ao inserir lote ${j}-${j+batch.length}:`, insertError);
            throw insertError;
          }

          totalRegistrosCriados += batch.length;
          console.log(`✅ Inserido lote ${j+1}-${j+batch.length} de ${registrosParaCriar.length}`);
        }
      }
    }

    // 2. Buscar estatísticas finais
    const { data: estatisticasFinais } = await supabaseClient
      .from('registros_rejeitados_processamento')
      .select('count(*)', { count: 'exact' });

    const totalRejeitados = estatisticasFinais?.[0]?.count || 0;

    const resultado = {
      sucesso: true,
      uploads_processados: uploadsComExclusoes?.length || 0,
      registros_criados: totalRegistrosCriados,
      total_rejeitados_sistema: totalRejeitados,
      uploads_detalhes: uploadsComExclusoes?.map(u => ({
        arquivo: u.arquivo_nome,
        exclusoes: u.registros_erro,
        data_upload: u.created_at,
        tipo: u.tipo_arquivo
      })) || [],
      mensagem: totalRegistrosCriados > 0 ? 
        `${totalRegistrosCriados} registros de exclusão criados com sucesso!` :
        'Todos os registros de exclusão já estavam registrados.',
      instrucoes: 'Os registros excluídos agora aparecerão no relatório "Registros Rejeitados - Detalhes"'
    };

    console.log('📄 RESULTADO FINAL:', JSON.stringify(resultado, null, 2));

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 ERRO:', error);
    
    return new Response(JSON.stringify({ 
      erro: true, 
      mensagem: error.message,
      detalhes: 'Erro ao criar registros de exclusão'
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});