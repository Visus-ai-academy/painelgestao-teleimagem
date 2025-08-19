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
        status: 'processando',
        detalhes_erro: {
          etapa: 'background',
          inicio: new Date().toISOString()
        }
      })
      .eq('id', upload_id);

    // 2. Buscar dados do staging - usando lotes menores para economizar memória
    console.log('📥 [BACKGROUND] Buscando dados do staging...');
    const { data: stagingData, error: stagingError } = await supabaseClient
      .from('processamento_uploads')
      .select('detalhes_erro, registros_inseridos')
      .eq('id', upload_id)
      .single();

    if (stagingError || !stagingData) {
      console.error('❌ [BACKGROUND] Erro ao buscar dados do upload:', stagingError);
      throw new Error('Upload não encontrado');
    }

    const lote_upload = stagingData.detalhes_erro?.lote_upload;
    
    // Processar em lotes ainda menores para economizar memória
    const BATCH_SIZE = 50;
    let totalProcessados = 0;
    let totalInseridos = 0;
    let totalErros = 0;

    // Buscar dados do staging em lotes MUITO menores para economizar memória
    let hasMoreRecords = true;
    let offset = 0;
    const FETCH_SIZE = 100; // Reduzido de 200 para 100

    while (hasMoreRecords) {
      const { data: records, error: fetchError } = await supabaseClient
        .from('volumetria_staging')
        .select('*')
        .eq('lote_upload', lote_upload)
        .eq('status_processamento', 'pendente')
        .range(offset, offset + FETCH_SIZE - 1);

      if (fetchError) {
        console.error('❌ [BACKGROUND] Erro ao buscar staging:', fetchError);
        throw fetchError;
      }

      if (!records || records.length === 0) {
        hasMoreRecords = false;
        break;
      }

      console.log(`📋 [BACKGROUND] Processando ${records.length} registros (offset: ${offset})`);

    if (records && records.length > 0) {
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        
        console.log(`🔄 [BACKGROUND] Processando lote ${Math.floor((offset + i)/BATCH_SIZE) + 1}`);

        const processedRecords: any[] = [];
        const stagingIdsToUpdate: string[] = [];

        // Aplicar transformações e validações
        for (const record of batch) {
          try {
            // Aplicar transformações e validações
            const processedRecord = {
              EMPRESA: await applyClientNameCleaning(record.EMPRESA),
              NOME_PACIENTE: record.NOME_PACIENTE,
              CODIGO_PACIENTE: record.CODIGO_PACIENTE,
              ESTUDO_DESCRICAO: record.ESTUDO_DESCRICAO,
              ACCESSION_NUMBER: record.ACCESSION_NUMBER,
              MODALIDADE: await applyModalityCorrections(record),
              PRIORIDADE: await applyPriorityMapping(record.PRIORIDADE),
              VALORES: record.VALORES,
              ESPECIALIDADE: record.ESPECIALIDADE,
              MEDICO: await applyMedicoNormalization(record.MEDICO),
              DUPLICADO: record.DUPLICADO,
              DATA_REALIZACAO: record.DATA_REALIZACAO,
              HORA_REALIZACAO: record.HORA_REALIZACAO,
              DATA_TRANSFERENCIA: record.DATA_TRANSFERENCIA,
              HORA_TRANSFERENCIA: record.HORA_TRANSFERENCIA,
              DATA_LAUDO: record.DATA_LAUDO,
              HORA_LAUDO: record.HORA_LAUDO,
              DATA_PRAZO: record.DATA_PRAZO,
              HORA_PRAZO: record.HORA_PRAZO,
              STATUS: record.STATUS,
              DATA_REASSINATURA: record.DATA_REASSINATURA,
              HORA_REASSINATURA: record.HORA_REASSINATURA,
              MEDICO_REASSINATURA: record.MEDICO_REASSINATURA,
              SEGUNDA_ASSINATURA: record.SEGUNDA_ASSINATURA,
              POSSUI_IMAGENS_CHAVE: record.POSSUI_IMAGENS_CHAVE,
              IMAGENS_CHAVES: record.IMAGENS_CHAVES,
              IMAGENS_CAPTURADAS: record.IMAGENS_CAPTURADAS,
              CODIGO_INTERNO: record.CODIGO_INTERNO,
              DIGITADOR: record.DIGITADOR,
              COMPLEMENTAR: record.COMPLEMENTAR,
              CATEGORIA: await applyCategoryMapping(record.ESTUDO_DESCRICAO),
              tipo_faturamento: await applyBillingType(record),
              data_referencia: record.data_referencia,
              periodo_referencia: record.periodo_referencia,
              arquivo_fonte: record.arquivo_fonte,
              lote_upload: record.lote_upload,
              processamento_pendente: false,
              processado_em: new Date().toISOString()
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
      
      // Atualizar offset para próxima busca
      offset += FETCH_SIZE;
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

    // 4.5. Aplicar regras de substituição de especialidade/categoria (v033 e v034)
    if (totalInseridos > 0) {
      console.log('🔧 [BACKGROUND] Aplicando regras v033 e v034...');
      try {
        const { data: especialidadeResult } = await supabaseClient.functions.invoke('aplicar-substituicao-especialidade-categoria', {
          body: {
            arquivo_fonte: arquivo_fonte
          }
        });
        
        if (especialidadeResult?.sucesso) {
          regrasAplicadas.push('v033_v034_especialidade_categoria');
          console.log('✅ [BACKGROUND] Regras v033 e v034 aplicadas com sucesso');
          console.log(`   - v033: ${especialidadeResult.total_substituidos_v033} registros processados`);
          console.log(`   - v034: ${especialidadeResult.total_substituidos_v034} registros Colunas processados`);
          console.log(`   - Categorias: ${especialidadeResult.total_categorias_aplicadas} atualizadas`);
        }
      } catch (error) {
        console.error('⚠️ [BACKGROUND] Erro ao aplicar regras v033/v034:', error);
      }
    }

    // 5. Finalizar processamento
    await supabaseClient
      .from('processamento_uploads')
      .update({
        status: 'concluido',
        registros_processados: totalProcessados,
        registros_inseridos: totalInseridos,
        registros_erro: totalErros + (stagingData.registros_inseridos - totalProcessados),
        completed_at: new Date().toISOString(),
        detalhes_erro: {
          etapa: 'completo',
          registros_staging: stagingData.registros_inseridos,
          registros_processados: totalProcessados,
          registros_finais: totalInseridos,
          registros_erro: totalErros,
          regras_aplicadas: regrasAplicadas,
          lote_upload: lote_upload,
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
          .eq('lote_upload', lote_upload);
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
  let modalidade = record.MODALIDADE || '';
  
  // REGRA: Correção CR/DX para RX ou MG baseado no ESTUDO_DESCRICAO
  if (modalidade === 'CR' || modalidade === 'DX') {
    if (record.ESTUDO_DESCRICAO === 'MAMOGRAFIA') {
      modalidade = 'MG';
    } else {
      modalidade = 'RX';
    }
  }
  
  // REGRA: Correção OT para DO
  if (modalidade === 'OT') {
    modalidade = 'DO';
  }
  
  return modalidade;
}

async function applyCategoryMapping(estudo: string): Promise<string> {
  if (!estudo) return 'SC';
  
  const estudoUpper = estudo.toUpperCase();
  
  // Mapear categoria baseado no estudo
  if (estudoUpper.includes('ONCO') || estudoUpper.includes('ONCOLOGIA')) {
    return 'Onco';
  }
  
  return 'Geral';
}

async function applyPriorityMapping(prioridade: string): Promise<string> {
  return prioridade || 'NORMAL';
}

async function applyBillingType(record: any): Promise<string> {
  const categoria = record.CATEGORIA || '';
  const prioridade = record.PRIORIDADE || '';
  const modalidade = record.MODALIDADE || '';
  
  if (categoria.toLowerCase().includes('onco')) {
    return 'oncologia';
  } else if (prioridade.toLowerCase().includes('urgencia')) {
    return 'urgencia';
  } else if (['CT', 'MR'].includes(modalidade)) {
    return 'alta_complexidade';
  } else {
    return 'padrao';
  }
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