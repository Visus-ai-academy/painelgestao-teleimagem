import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🏗️ PROCESSAMENTO BACKGROUND SIMPLIFICADO
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { upload_id, arquivo_fonte, periodo_referencia } = await req.json();
    
    console.log('🏗️ [BACKGROUND] Iniciando processamento simplificado:', {
      upload_id,
      arquivo_fonte,
      periodo_referencia
    });

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Buscar informações do upload
    const { data: uploadData, error: uploadError } = await supabaseClient
      .from('processamento_uploads')
      .select('*')
      .eq('id', upload_id)
      .single();

    if (uploadError || !uploadData) {
      console.error('❌ [BACKGROUND] Upload não encontrado:', uploadError);
      throw new Error('Upload não encontrado');
    }

    const lote_upload = uploadData.detalhes_erro?.lote_upload;
    console.log('🔍 [BACKGROUND] Lote para processar:', lote_upload);

    // 2. Verificar dados no staging
    const { data: stagingCheck, count: stagingCount } = await supabaseClient
      .from('volumetria_staging')
      .select('*', { count: 'exact' })
      .eq('lote_upload', lote_upload)
      .eq('status_processamento', 'pendente');

    console.log(`📋 [BACKGROUND] Registros no staging: ${stagingCount || 0}`);

    if (!stagingCount || stagingCount === 0) {
      throw new Error('Nenhum registro pendente encontrado no staging');
    }

    // 3. Atualizar status para processando
    await supabaseClient
      .from('processamento_uploads')
      .update({
        status: 'processando_regras',
        detalhes_erro: {
          ...uploadData.detalhes_erro,
          etapa: 'background_iniciado',
          staging_encontrado: stagingCount,
          inicio_background: new Date().toISOString()
        }
      })
      .eq('id', upload_id);

    // 4. Processar TODOS os dados do staging de uma vez (approach simples)
    console.log('🔄 [BACKGROUND] Buscando todos os registros do staging...');
    
    const { data: allRecords, error: fetchError } = await supabaseClient
      .from('volumetria_staging')
      .select('*')
      .eq('lote_upload', lote_upload)
      .eq('status_processamento', 'pendente');

    if (fetchError) {
      console.error('❌ [BACKGROUND] Erro ao buscar staging:', fetchError);
      throw fetchError;
    }

    console.log(`📋 [BACKGROUND] ${allRecords?.length || 0} registros carregados para processamento`);

    if (!allRecords || allRecords.length === 0) {
      throw new Error('Nenhum registro encontrado no staging para processar');
    }

    let totalProcessados = 0;
    let totalInseridos = 0;
    let totalErros = 0;

    // 5. Processar em lotes otimizados para inserção final  
    const BATCH_SIZE = 100; // Aumentado de 25 para 100
    
    for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
      const batch = allRecords.slice(i, i + BATCH_SIZE);
      
      console.log(`🔄 [BACKGROUND] Processando lote ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(allRecords.length/BATCH_SIZE)}`);

      const finalRecords: any[] = [];
      const stagingIdsToUpdate: string[] = [];

      // Aplicar regras simples (sem muita complexidade)
      for (const record of batch) {
        try {
          // Aplicar apenas regras básicas
          let empresa = record.EMPRESA;
          let modalidade = record.MODALIDADE;
          
          // Normalizar cliente CEDI-* para CEDIDIAG
          if (empresa && (empresa.includes('CEDI-') || empresa.includes('CEDI_'))) {
            empresa = 'CEDIDIAG';
          }
          
          // Correção simples de modalidade
          if (modalidade === 'CR' || modalidade === 'DX') {
            modalidade = record.ESTUDO_DESCRICAO === 'MAMOGRAFIA' ? 'MG' : 'RX';
          }
          if (modalidade === 'OT') {
            modalidade = 'DO';
          }

          const finalRecord = {
            EMPRESA: empresa,
            NOME_PACIENTE: record.NOME_PACIENTE,
            CODIGO_PACIENTE: record.CODIGO_PACIENTE,
            ESTUDO_DESCRICAO: record.ESTUDO_DESCRICAO,
            ACCESSION_NUMBER: record.ACCESSION_NUMBER,
            MODALIDADE: modalidade,
            PRIORIDADE: record.PRIORIDADE || 'normal',
            VALORES: Number(record.VALORES) || 0,
            ESPECIALIDADE: record.ESPECIALIDADE,
            MEDICO: record.MEDICO,
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
            CATEGORIA: record.CATEGORIA || 'SC',
            tipo_faturamento: record.tipo_faturamento || 'padrao',
            data_referencia: new Date().toISOString().split('T')[0],
            periodo_referencia: record.periodo_referencia,
            arquivo_fonte: record.arquivo_fonte,
            lote_upload: record.lote_upload,
            processamento_pendente: false
          };

          finalRecords.push(finalRecord);
          stagingIdsToUpdate.push(record.id);
          totalProcessados++;
        } catch (error) {
          console.error('⚠️ [BACKGROUND] Erro ao processar registro:', error);
          totalErros++;
        }
      }

      // Inserir no volumetria_mobilemed
      if (finalRecords.length > 0) {
        console.log(`💾 [BACKGROUND] Inserindo ${finalRecords.length} registros finais...`);
        
        const { error: insertError } = await supabaseClient
          .from('volumetria_mobilemed')
          .insert(finalRecords);

        if (insertError) {
          console.error('❌ [BACKGROUND] Erro ao inserir registros finais:', insertError);
          console.error('❌ [BACKGROUND] Exemplo registro com erro:', JSON.stringify(finalRecords[0], null, 2));
          totalErros += finalRecords.length;
        } else {
          totalInseridos += finalRecords.length;
          
          // Marcar registros como processados no staging
          await supabaseClient
            .from('volumetria_staging')
            .update({ status_processamento: 'concluido' })
            .in('id', stagingIdsToUpdate);
          
          console.log(`✅ [BACKGROUND] Lote inserido com sucesso: ${finalRecords.length} registros`);
        }
      }
    }

    // 6. Verificação final
    const { count: finalCount } = await supabaseClient
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact' })
      .eq('lote_upload', lote_upload);

    console.log(`🔍 [BACKGROUND] Verificação final: ${finalCount || 0} registros inseridos na tabela final`);

    // 7. Atualizar status final do upload
    await supabaseClient
      .from('processamento_uploads')
      .update({
        status: 'concluido',
        registros_processados: totalProcessados,
        registros_inseridos: finalCount || totalInseridos,
        registros_erro: totalErros + Math.max(0, stagingCount - totalProcessados),
        completed_at: new Date().toISOString(),
        detalhes_erro: {
          etapa: 'background_completo',
          registros_staging: stagingCount,
          registros_processados: totalProcessados,
          registros_finais: finalCount || totalInseridos,
          registros_erro: totalErros,
          lote_upload: lote_upload,
          verificacao_final: 'ok',
          concluido_em: new Date().toISOString()
        }
      })
      .eq('id', upload_id);

    const resultado = {
      success: true,
      message: `Background processado: ${finalCount || totalInseridos} registros inseridos`,
      upload_id: upload_id,
      registros_processados: totalProcessados,
      registros_inseridos: finalCount || totalInseridos,
      registros_erro: totalErros,
      regras_aplicadas: ['limpeza_cliente', 'correcao_modalidade']
    };

    console.log('✅ [BACKGROUND] Processamento concluído:', resultado);

    return new Response(
      JSON.stringify(resultado),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 [BACKGROUND] Erro crítico:', error);
    
    // Tentar atualizar status como erro
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
              etapa: 'background_erro',
              erro: error.message,
              stack: error.stack,
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
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});