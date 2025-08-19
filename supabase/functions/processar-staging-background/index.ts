import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🏗️ PROCESSAMENTO BACKGROUND - Segunda etapa da nova arquitetura
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { upload_id, arquivo_fonte, periodo_referencia } = await req.json();
    
    console.log('🏗️ [BACKGROUND] Iniciando processamento background:', {
      upload_id,
      arquivo_fonte,
      periodo_referencia
    });

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Atualizar status para processando regras
    await supabaseClient
      .from('processamento_uploads')
      .update({
        status: 'processando_regras',
        detalhes_processamento: {
          etapa: 'background',
          inicio: new Date().toISOString()
        }
      })
      .eq('id', upload_id);

    // 2. Buscar dados do staging
    console.log('📥 [BACKGROUND] Buscando dados do staging...');
    const { data: stagingData, error: stagingError } = await supabaseClient
      .from('processamento_uploads')
      .select('lote_upload, registros_inseridos_staging')
      .eq('id', upload_id)
      .single();

    if (stagingError || !stagingData) {
      console.error('❌ [BACKGROUND] Erro ao buscar dados do upload:', stagingError);
      throw new Error('Upload não encontrado');
    }

    const { data: records, error: fetchError } = await supabaseClient
      .from('volumetria_staging')
      .select('*')
      .eq('lote_upload', stagingData.lote_upload)
      .eq('status_processamento', 'pendente');

    if (fetchError) {
      console.error('❌ [BACKGROUND] Erro ao buscar staging:', fetchError);
      throw fetchError;
    }

    console.log(`📋 [BACKGROUND] ${records?.length || 0} registros para processar`);

    // 3. Processar registros com regras de negócio
    const BATCH_SIZE = 100;
    let totalProcessados = 0;
    let totalInseridos = 0;
    let totalErros = 0;

    if (records && records.length > 0) {
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        
        console.log(`🔄 [BACKGROUND] Processando lote ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(records.length/BATCH_SIZE)}`);

        const processedRecords: any[] = [];
        const stagingIdsToUpdate: string[] = [];

        // Aplicar regras de negócio
        for (const record of batch) {
          try {
            // Aplicar transformações e validações
            const processedRecord = {
              EMPRESA: await applyClientNameCleaning(record.empresa),
              ESTUDO_DESCRICAO: record.estudo_descricao,
              MODALIDADE: await applyModalityCorrections(record),
              ESPECIALIDADE: record.especialidade,
              MEDICO: await applyMedicoNormalization(record.medico),
              DATA_EXAME: record.data_exame,
              DATA_LAUDO: record.data_laudo,
              PRIORIDADE: await applyPriorityMapping(record.prioridade),
              VALORES: record.valores,
              CATEGORIA: await applyCategoryMapping(record.estudo_descricao),
              TIPO_FATURAMENTO: await applyBillingType(record),
              PREPARO: record.preparo,
              periodo_referencia: record.periodo_referencia,
              arquivo_fonte: record.arquivo_fonte,
              lote_upload: record.lote_upload,
              processed_at: new Date().toISOString()
            };

            // Verificar se deve ser excluído
            const shouldExclude = await shouldExcludeRecord(processedRecord, arquivo_fonte);
            
            if (!shouldExclude && await validateRetroactiveRules(processedRecord)) {
              processedRecords.push(processedRecord);
              stagingIdsToUpdate.push(record.id);
            }

            totalProcessados++;
          } catch (error) {
            console.error('⚠️ [BACKGROUND] Erro ao processar registro:', error);
            totalErros++;
          }
        }

        // Inserir registros processados
        if (processedRecords.length > 0) {
          const { error: insertError } = await supabaseClient
            .from('volumetria_mobilemed')
            .insert(processedRecords);

          if (insertError) {
            console.error('❌ [BACKGROUND] Erro ao inserir registros:', insertError);
            totalErros += processedRecords.length;
          } else {
            totalInseridos += processedRecords.length;
            
            // Atualizar status no staging
            await supabaseClient
              .from('volumetria_staging')
              .update({ status_processamento: 'concluido' })
              .in('id', stagingIdsToUpdate);
            
            console.log(`✅ [BACKGROUND] Lote inserido: ${processedRecords.length} registros`);
          }
        }
      }
    }

    // 4. Aplicar quebras automáticas se houver registros inseridos
    let regrasAplicadas = [];
    if (totalInseridos > 0) {
      console.log('🔧 [BACKGROUND] Aplicando quebras automáticas...');
      try {
        const { data: quebraResult } = await supabaseClient.functions.invoke('aplicar-quebras-automatico', {
          body: {
            arquivo_fonte: arquivo_fonte,
            periodo_referencia: periodo_referencia
          }
        });
        
        if (quebraResult?.success) {
          regrasAplicadas.push('quebras_automaticas');
          console.log('✅ [BACKGROUND] Quebras automáticas aplicadas');
        }
      } catch (error) {
        console.error('⚠️ [BACKGROUND] Erro ao aplicar quebras:', error);
      }
    }

    // 5. Finalizar processamento
    await supabaseClient
      .from('processamento_uploads')
      .update({
        status: 'concluido',
        registros_processados: totalProcessados,
        registros_inseridos: totalInseridos,
        registros_erro: totalErros + (stagingData.registros_inseridos_staging - totalProcessados),
        completed_at: new Date().toISOString(),
        detalhes_processamento: {
          etapa: 'completo',
          registros_staging: stagingData.registros_inseridos_staging,
          registros_processados: totalProcessados,
          registros_finais: totalInseridos,
          registros_erro: totalErros,
          regras_aplicadas: regrasAplicadas,
          concluido_em: new Date().toISOString()
        }
      })
      .eq('id', upload_id);

    // 6. Agendar limpeza do staging (após 1 hora)
    setTimeout(async () => {
      try {
        await supabaseClient
          .from('volumetria_staging')
          .delete()
          .eq('lote_upload', stagingData.lote_upload);
        console.log(`🧹 [BACKGROUND] Staging limpo para lote: ${stagingData.lote_upload}`);
      } catch (error) {
        console.error('⚠️ [BACKGROUND] Erro ao limpar staging:', error);
      }
    }, 60 * 60 * 1000); // 1 hora

    const resultado = {
      success: true,
      message: 'Processamento background concluído',
      upload_id: upload_id,
      registros_processados: totalProcessados,
      registros_inseridos: totalInseridos,
      registros_erro: totalErros,
      regras_aplicadas: regrasAplicadas
    };

    console.log('✅ [BACKGROUND] Processamento concluído:', resultado);

    return new Response(
      JSON.stringify(resultado),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 [BACKGROUND] Erro crítico:', error);
    
    // Atualizar status como erro
    try {
      const { upload_id } = await req.json();
      if (upload_id) {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        await supabaseClient
          .from('processamento_uploads')
          .update({
            status: 'erro',
            detalhes_erro: {
              etapa: 'background',
              erro: error.message,
              timestamp: new Date().toISOString()
            },
            completed_at: new Date().toISOString()
          })
          .eq('id', upload_id);
      }
    } catch (updateError) {
      console.error('💥 [BACKGROUND] Erro ao atualizar status:', updateError);
    }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Funções auxiliares para aplicar regras
async function applyClientNameCleaning(empresa: string): Promise<string> {
  return empresa.trim().toUpperCase();
}

async function applyMedicoNormalization(medico: string): Promise<string> {
  return medico.trim();
}

async function applyModalityCorrections(record: any): Promise<string> {
  return record.modalidade || '';
}

async function applyCategoryMapping(estudo: string): Promise<string> {
  return estudo.includes('ONCO') ? 'Onco' : 'Geral';
}

async function applyPriorityMapping(prioridade: string): Promise<string> {
  return prioridade || 'NORMAL';
}

async function applyBillingType(record: any): Promise<string> {
  return record.tipo_faturamento || 'PADRAO';
}

async function shouldExcludeRecord(record: any, arquivoFonte: string): Promise<boolean> {
  // Lista de clientes para exclusão
  const clientesParaExcluir = [
    'TESTE', 'TEST', 'DEMO', 'EXEMPLO'
  ];
  
  return clientesParaExcluir.some(cliente => 
    record.EMPRESA.includes(cliente)
  );
}

async function validateRetroactiveRules(record: any): Promise<boolean> {
  // Validações básicas
  return record.EMPRESA && record.VALORES > 0;
}