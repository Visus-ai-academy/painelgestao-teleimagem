import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VolumetriaRecord {
  EMPRESA?: string;
  NOME_PACIENTE?: string;
  CODIGO_PACIENTE?: string;
  ESTUDO_DESCRICAO?: string;
  ACCESSION_NUMBER?: string;
  MODALIDADE?: string;
  PRIORIDADE?: string;
  VALORES?: number;
  ESPECIALIDADE?: string;
  MEDICO?: string;
  DUPLICADO?: string;
  DATA_REALIZACAO?: string;
  HORA_REALIZACAO?: string;
  DATA_TRANSFERENCIA?: string;
  HORA_TRANSFERENCIA?: string;
  DATA_LAUDO?: string;
  HORA_LAUDO?: string;
  DATA_PRAZO?: string;
  HORA_PRAZO?: string;
  STATUS?: string;
  DATA_REASSINATURA?: string;
  HORA_REASSINATURA?: string;
  MEDICO_REASSINATURA?: string;
  SEGUNDA_ASSINATURA?: string;
  POSSUI_IMAGENS_CHAVE?: string;
  IMAGENS_CHAVES?: string;
  IMAGENS_CAPTURADAS?: string;
  CODIGO_INTERNO?: string;
  DIGITADOR?: string;
  COMPLEMENTAR?: string;
  CATEGORIA?: string;
}

interface RejeicaoRecord {
  linha_original: number;
  dados_originais: any;
  motivo_rejeicao: string;
  detalhes_erro: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { data: stagingData, uploadId, arquivo_fonte = 'volumetria_padrao' } = await req.json();
    
    console.log(`🚀 PROCESSAMENTO INICIADO - Dados recebidos:`);
    console.log(`📋 Upload ID: ${uploadId}`);
    console.log(`📋 Arquivo fonte: ${arquivo_fonte}`);
    console.log(`📋 Registros para processar: ${stagingData?.length || 0}`);

    if (!stagingData || !Array.isArray(stagingData)) {
      throw new Error('Dados de staging inválidos');
    }

    const loteUpload = `${arquivo_fonte}_${Date.now()}`;
    
    // Função de processamento principal SÍNCRONA
    const processarDados = async () => {
      let totalProcessados = 0;
      let totalInseridos = 0;
      let totalErros = 0;
      const registrosRejeitados: RejeicaoRecord[] = [];
      const BATCH_SIZE = 50; // Reduzir para evitar timeouts

      // Determinar período de referência dinamicamente
      let dataReferencia: string;
      let periodoReferencia: string;
      
      const agora = new Date();
      const anoAtual = agora.getFullYear();
      const mesAtual = agora.getMonth() + 1;
      
      if (arquivo_fonte.includes('jun') || arquivo_fonte.includes('junho')) {
        periodoReferencia = 'jun/25';
        dataReferencia = '2025-06-01';
      } else if (arquivo_fonte.includes('mai') || arquivo_fonte.includes('maio')) {
        periodoReferencia = 'mai/25';
        dataReferencia = '2025-05-01';
      } else if (arquivo_fonte.includes('jul') || arquivo_fonte.includes('julho')) {
        periodoReferencia = 'jul/25';
        dataReferencia = '2025-07-01';
      } else if (arquivo_fonte.includes('ago') || arquivo_fonte.includes('agosto')) {
        periodoReferencia = 'ago/25';
        dataReferencia = '2025-08-01';
      } else if (arquivo_fonte.includes('retroativo')) {
        const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
        periodoReferencia = `${meses[mesAtual - 1]}/25`;
        dataReferencia = `${anoAtual}-${mesAtual.toString().padStart(2, '0')}-01`;
      } else {
        const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
        periodoReferencia = `${meses[mesAtual - 1]}/25`;
        dataReferencia = `${anoAtual}-${mesAtual.toString().padStart(2, '0')}-01`;
      }

      console.log(`📋 PERÍODO DETERMINADO: ${periodoReferencia} (${dataReferencia})`);

      // Processar em batches menores
      for (let batchStart = 0; batchStart < stagingData.length; batchStart += BATCH_SIZE) {
        const batch = stagingData.slice(batchStart, batchStart + BATCH_SIZE);
        const batchNumber = Math.floor(batchStart/BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(stagingData.length/BATCH_SIZE);
        
        console.log(`📦 Processando batch ${batchNumber}/${totalBatches} (${batch.length} registros)`);

        const batchValidRecords: any[] = [];

        // Processar cada registro do batch
        for (let i = 0; i < batch.length; i++) {
          const record = batch[i] as VolumetriaRecord;
          const linhaOriginal = batchStart + i + 1;
          totalProcessados++;
          
          // ✅ ACEITAR TODOS OS REGISTROS - Validações desabilitadas
          const recordToInsert = {
            ...record,
            data_referencia: dataReferencia,
            arquivo_fonte: arquivo_fonte,
            lote_upload: loteUpload,
            periodo_referencia: periodoReferencia,
            processamento_pendente: false,
            controle_origem_id: null,
            created_by: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          batchValidRecords.push(recordToInsert);
        }

        // Inserir batch com timeout e retry
        if (batchValidRecords.length > 0) {
          console.log(`🔄 Inserindo batch ${batchNumber}: ${batchValidRecords.length} registros`);
          
          try {
            // Criar timeout promise
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Timeout na inserção do batch')), 30000);
            });

            // Inserção com timeout
            const insertPromise = supabaseClient
              .from('volumetria_mobilemed')
              .insert(batchValidRecords)
              .select('id');

            const result = await Promise.race([insertPromise, timeoutPromise]);
            const { data: insertData, error: insertError } = result as any;

            if (insertError) {
              console.error(`❌ Erro no batch ${batchNumber}:`, insertError.message);
              
              // Adicionar registros como rejeitados
              batchValidRecords.forEach((record, idx) => {
                registrosRejeitados.push({
                  linha_original: batchStart + idx + 1,
                  dados_originais: record,
                  motivo_rejeicao: 'ERRO_INSERCAO_BANCO',
                  detalhes_erro: `${insertError.code || 'UNKNOWN'}: ${insertError.message}`
                });
              });
              totalErros += batchValidRecords.length;
            } else {
              totalInseridos += batchValidRecords.length;
              console.log(`✅ Batch ${batchNumber} inserido com sucesso`);
            }
          } catch (batchError) {
            console.error(`❌ Timeout/erro no batch ${batchNumber}:`, batchError);
            totalErros += batchValidRecords.length;
          }
        }

        // Atualizar progresso após cada batch
        const progresso = Math.round(((batchStart + batch.length) / stagingData.length) * 100);
        try {
          await supabaseClient
            .from('processamento_uploads')
            .update({
              registros_processados: totalProcessados,
              registros_inseridos: totalInseridos,
              registros_erro: totalErros,
              detalhes_erro: {
                status: `Processando... ${progresso}%`,
                progresso: progresso,
                batch_atual: batchNumber,
                total_batches: totalBatches
              }
            })
            .eq('id', uploadId);
        } catch (updateError) {
          console.warn(`⚠️ Erro ao atualizar progresso:`, updateError);
        }

        // Pequena pausa entre batches para evitar sobrecarga
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Salvar rejeições se houver
      if (registrosRejeitados.length > 0) {
        console.log(`💾 Salvando ${registrosRejeitados.length} registros rejeitados...`);
        try {
          const rejeicoes = registrosRejeitados.map(r => ({
            empresa: r.dados_originais.EMPRESA || 'N/I',
            nome_paciente: r.dados_originais.NOME_PACIENTE || 'N/I',
            arquivo_fonte: arquivo_fonte,
            erro_detalhes: `${r.motivo_rejeicao}: ${r.detalhes_erro}`,
            dados_originais: r.dados_originais,
            status: 'rejeitado',
            created_at: new Date().toISOString()
          }));

          // Inserir rejeições em batches pequenos
          const BATCH_SIZE_REJEICOES = 20;
          for (let i = 0; i < rejeicoes.length; i += BATCH_SIZE_REJEICOES) {
            const batchRejeicoes = rejeicoes.slice(i, i + BATCH_SIZE_REJEICOES);
            
            await supabaseClient
              .from('volumetria_erros')
              .insert(batchRejeicoes);
          }
        } catch (saveError) {
          console.error(`❌ Erro ao salvar rejeições:`, saveError);
        }
      }

      // Aplicar regras de de-para
      let regrasAplicadas = 0;
      try {
        console.log(`🔧 Aplicando regras de de-para para: ${arquivo_fonte}`);
        const { data: regrasTratamento } = await supabaseClient.functions.invoke(
          'aplicar-regras-tratamento',
          { body: { arquivo_fonte: arquivo_fonte } }
        );
        regrasAplicadas = regrasTratamento?.registros_atualizados || 0;
        console.log(`✅ Regras aplicadas: ${regrasAplicadas} registros`);
      } catch (regrasError) {
        console.error(`❌ Erro ao aplicar regras:`, regrasError);
      }

      // Aplicar regras v002/v003 automaticamente para arquivos retroativos
      let regrasExclusao = 0;
      if (arquivo_fonte.includes('retroativo')) {
        try {
          console.log(`🔥 Aplicando regras v002/v003 automaticamente para arquivo retroativo: ${arquivo_fonte}`);
          const { data: exclusoesResult } = await supabaseClient.functions.invoke(
            'aplicar-exclusoes-periodo',
            { 
              body: { 
                periodo_referencia: periodoReferencia,
                automatico: true,
                aplicar_sempre: true 
              } 
            }
          );
          regrasExclusao = exclusoesResult?.total_excluidos || 0;
          console.log(`✅ Regras v002/v003 aplicadas: ${regrasExclusao} registros excluídos`);
        } catch (exclusoesError) {
          console.error(`❌ Erro ao aplicar regras v002/v003:`, exclusoesError);
        }
      }

      // Atualizar status final
      await supabaseClient
        .from('processamento_uploads')
        .update({
          status: 'concluido',
          registros_processados: totalProcessados,
          registros_inseridos: totalInseridos,
          registros_erro: totalErros,
          completed_at: new Date().toISOString(),
          detalhes_erro: {
            status: 'Processamento Concluído',
            total_processado: totalProcessados,
            total_inserido: totalInseridos,
            total_erros: totalErros,
            regras_aplicadas: regrasAplicadas,
            regras_exclusao_aplicadas: regrasExclusao,
            arquivo_retroativo: arquivo_fonte.includes('retroativo'),
            debug_info: {
              arquivo_fonte,
              lote_upload,
              periodo_referencia: periodoReferencia
            }
          }
        })
        .eq('id', uploadId);

      console.log(`✅ PROCESSAMENTO CONCLUÍDO: ${totalInseridos} inseridos, ${totalErros} rejeitados, ${regrasAplicadas} regras aplicadas${arquivo_fonte.includes('retroativo') ? `, ${regrasExclusao} exclusões v002/v003` : ''} de ${totalProcessados} processados`);
      
      return {
        sucesso: true,
        totalProcessados,
        totalInseridos,
        totalErros,
        regrasAplicadas,
        regrasExclusao,
        arquivo_fonte,
        lote_upload: loteUpload
      };
    };

    // Executar processamento SÍNCRONO com timeout global
    console.log(`🔄 Iniciando processamento síncrono...`);
    
    const timeoutGlobal = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout global no processamento')), 120000); // 2 minutos
    });

    const resultado = await Promise.race([processarDados(), timeoutGlobal]);
    
    return new Response(
      JSON.stringify(resultado),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ ERRO NO PROCESSAMENTO:', error);
    
    // Em caso de erro, tentar marcar upload como erro
    try {
      const { uploadId } = await req.json();
      if (uploadId) {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        await supabaseClient
          .from('processamento_uploads')
          .update({
            status: 'erro',
            detalhes_erro: {
              status: 'Erro no Processamento',
              erro: error.message,
              timestamp: new Date().toISOString()
            }
          })
          .eq('id', uploadId);
      }
    } catch (updateError) {
      console.error('❌ Erro ao atualizar status de erro:', updateError);
    }
    
    return new Response(
      JSON.stringify({ 
        erro: true, 
        mensagem: error.message,
        detalhes: 'Processamento falhou. Verifique os logs para mais detalhes.'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});