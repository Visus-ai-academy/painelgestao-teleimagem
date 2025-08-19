import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🔄 PROCESSAMENTO DE DADOS PENDENTES NO STAGING
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 [PENDENTES] Iniciando processamento de dados pendentes...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Buscar todos os lotes pendentes
    const { data: lotesPendentes } = await supabaseClient
      .from('volumetria_staging')
      .select('lote_upload, arquivo_fonte, COUNT(*) as total')
      .eq('status_processamento', 'pendente')
      .group('lote_upload, arquivo_fonte')
      .order('created_at', { ascending: false });

    console.log(`📋 [PENDENTES] ${lotesPendentes?.length || 0} lotes pendentes encontrados`);

    if (!lotesPendentes || lotesPendentes.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum dado pendente encontrado',
          lotes_processados: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalInseridos = 0;
    let totalErros = 0;
    let lotesProcessados = 0;

    // 2. Processar cada lote pendente
    for (const lote of lotesPendentes) {
      console.log(`🔄 [PENDENTES] Processando lote ${lote.lote_upload} (${lote.total} registros)`);

      try {
        // Buscar registros do lote
        const { data: registros } = await supabaseClient
          .from('volumetria_staging')
          .select('*')
          .eq('lote_upload', lote.lote_upload)
          .eq('status_processamento', 'pendente');

        if (!registros || registros.length === 0) {
          console.log(`⚠️ [PENDENTES] Lote ${lote.lote_upload} sem registros válidos`);
          continue;
        }

        // Processar registros em micro-lotes
        const BATCH_SIZE = 10;
        const finalRecords: any[] = [];
        const stagingIds: string[] = [];

        for (const record of registros) {
          try {
            // Aplicar regras básicas
            let empresa = record.EMPRESA || '';
            let modalidade = record.MODALIDADE || '';

            // Limpeza básica
            if (empresa.includes('CEDI-') || empresa.includes('CEDI_')) {
              empresa = 'CEDIDIAG';
            }

            if (modalidade === 'CR' || modalidade === 'DX') {
              modalidade = record.ESTUDO_DESCRICAO === 'MAMOGRAFIA' ? 'MG' : 'RX';
            }
            if (modalidade === 'OT') {
              modalidade = 'DO';
            }

            const finalRecord = {
              EMPRESA: empresa,
              NOME_PACIENTE: record.NOME_PACIENTE || '',
              CODIGO_PACIENTE: record.CODIGO_PACIENTE,
              ESTUDO_DESCRICAO: record.ESTUDO_DESCRICAO,
              MODALIDADE: modalidade,
              PRIORIDADE: record.PRIORIDADE || 'normal',
              VALORES: Number(record.VALORES) || 0,
              ESPECIALIDADE: record.ESPECIALIDADE,
              MEDICO: record.MEDICO,
              CATEGORIA: record.CATEGORIA || 'SC',
              data_referencia: new Date().toISOString().split('T')[0],
              periodo_referencia: record.periodo_referencia || 'jun/25',
              arquivo_fonte: record.arquivo_fonte,
              lote_upload: record.lote_upload,
              tipo_faturamento: 'padrao',
              processamento_pendente: false
            };

            finalRecords.push(finalRecord);
            stagingIds.push(record.id);
          } catch (recordError) {
            console.error('⚠️ [PENDENTES] Erro ao processar registro:', recordError);
            totalErros++;
          }
        }

        // Inserir em micro-lotes
        for (let i = 0; i < finalRecords.length; i += BATCH_SIZE) {
          const batch = finalRecords.slice(i, i + BATCH_SIZE);
          const batchIds = stagingIds.slice(i, i + BATCH_SIZE);

          try {
            const { error: insertError } = await supabaseClient
              .from('volumetria_mobilemed')
              .insert(batch);

            if (insertError) {
              console.error('❌ [PENDENTES] Erro na inserção:', insertError);
              totalErros += batch.length;
            } else {
              totalInseridos += batch.length;
              
              // Marcar como processado no staging
              await supabaseClient
                .from('volumetria_staging')
                .update({ status_processamento: 'concluido' })
                .in('id', batchIds);
            }
          } catch (batchError) {
            console.error('❌ [PENDENTES] Erro no lote:', batchError);
            totalErros += batch.length;
          }
        }

        lotesProcessados++;
        console.log(`✅ [PENDENTES] Lote ${lote.lote_upload} processado`);

      } catch (loteError) {
        console.error(`❌ [PENDENTES] Erro ao processar lote ${lote.lote_upload}:`, loteError);
        totalErros += parseInt(lote.total);
      }
    }

    // 3. Atualizar uploads relacionados
    for (const lote of lotesPendentes) {
      try {
        const { data: upload } = await supabaseClient
          .from('processamento_uploads')
          .select('*')
          .eq('detalhes_erro->>lote_upload', lote.lote_upload)
          .single();

        if (upload) {
          const { count: finalCount } = await supabaseClient
            .from('volumetria_mobilemed')
            .select('*', { count: 'exact' })
            .eq('lote_upload', lote.lote_upload);

          await supabaseClient
            .from('processamento_uploads')
            .update({
              status: 'concluido',
              registros_inseridos: finalCount || 0,
              completed_at: new Date().toISOString(),
              detalhes_erro: {
                ...upload.detalhes_erro,
                etapa: 'processamento_pendentes_completo',
                registros_finais: finalCount || 0,
                processado_em: new Date().toISOString()
              }
            })
            .eq('id', upload.id);
        }
      } catch (updateError) {
        console.error('⚠️ [PENDENTES] Erro ao atualizar upload:', updateError);
      }
    }

    const resultado = {
      success: true,
      message: `Processamento de pendentes concluído: ${totalInseridos} registros inseridos`,
      lotes_processados: lotesProcessados,
      registros_inseridos: totalInseridos,
      registros_erro: totalErros,
      timestamp: new Date().toISOString()
    };

    console.log('✅ [PENDENTES] Processamento concluído:', resultado);

    return new Response(
      JSON.stringify(resultado),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 [PENDENTES] Erro crítico:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});