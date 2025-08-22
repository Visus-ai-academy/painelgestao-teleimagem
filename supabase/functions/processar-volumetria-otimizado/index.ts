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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: stagingData, uploadId, arquivo_fonte = 'volumetria_padrao' } = await req.json();
    
    console.log(`🚀 PROCESSAMENTO INICIADO - ${stagingData?.length || 0} registros`);

    if (!stagingData || !Array.isArray(stagingData)) {
      throw new Error('Dados de staging inválidos');
    }

    const loteUpload = `${arquivo_fonte}_${Date.now()}`;
    const dataReferencia = new Date().toISOString().split('T')[0];
    const periodoReferencia = '2025-06';

    // ========== RESPOSTA IMEDIATA ==========
    // Enviar resposta imediatamente para não bloquear o frontend
    const responsePromise = new Response(
      JSON.stringify({
        sucesso: true,
        status: 'processando',
        lote_upload: loteUpload,
        total_registros: stagingData.length,
        mensagem: 'Processamento iniciado em background'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

    // ========== PROCESSAMENTO EM BACKGROUND ==========
    const backgroundProcessing = async () => {
      let totalProcessados = 0;
      let totalInseridos = 0;
      let totalErros = 0;
      const registrosRejeitados: RejeicaoRecord[] = [];
      const BATCH_SIZE = 100; // Processar em batches para performance

      console.log(`⚡ Background: Iniciando processamento de ${stagingData.length} registros em batches de ${BATCH_SIZE}`);

      // Processar em batches para melhor performance
      for (let batchStart = 0; batchStart < stagingData.length; batchStart += BATCH_SIZE) {
        const batch = stagingData.slice(batchStart, batchStart + BATCH_SIZE);
        console.log(`📦 Processando batch ${Math.floor(batchStart/BATCH_SIZE) + 1}/${Math.ceil(stagingData.length/BATCH_SIZE)}`);

        const batchValidRecords: any[] = [];

        // Validar batch
        for (let i = 0; i < batch.length; i++) {
          const record = batch[i] as VolumetriaRecord;
          const linhaOriginal = batchStart + i + 1;
          totalProcessados++;

          // Validações básicas removidas - campos podem estar vazios

          // Validação de data usando período de referência do arquivo
          if (record.DATA_LAUDO) {
            const dataLaudo = new Date(record.DATA_LAUDO);
            const periodoReferencia = record.periodo_referencia || record.data_referencia;
            
            // Calcular período válido baseado na data_referencia
            let dataLimiteInicio: Date, dataLimiteFim: Date;
            
            if (periodoReferencia && periodoReferencia.includes('-')) {
              // Formato YYYY-MM
              const [ano, mes] = periodoReferencia.split('-').map(Number);
              dataLimiteInicio = new Date(ano, mes - 1, 1); // 01 do mês
              dataLimiteFim = new Date(ano, mes, 7); // 07 do mês seguinte
            } else {
              // Fallback para período fixo apenas se não houver data_referencia
              dataLimiteInicio = new Date('2025-06-01');
              dataLimiteFim = new Date('2025-07-07');
            }
            
            if (dataLaudo < dataLimiteInicio || dataLaudo > dataLimiteFim) {
              registrosRejeitados.push({
                linha_original: linhaOriginal,
                dados_originais: record,
                motivo_rejeicao: 'DATA_LAUDO_FORA_PERIODO',
                detalhes_erro: `DATA_LAUDO ${record.DATA_LAUDO} fora do período (${dataLimiteInicio.toISOString().split('T')[0]} a ${dataLimiteFim.toISOString().split('T')[0]})`
              });
              totalErros++;
              continue;
            }
          }

          // Gravar exatamente como está no upload, preservando valores originais
          batchValidRecords.push({
            EMPRESA: record.EMPRESA || null,
            NOME_PACIENTE: record.NOME_PACIENTE || null,
            CODIGO_PACIENTE: record.CODIGO_PACIENTE || null,
            ESTUDO_DESCRICAO: record.ESTUDO_DESCRICAO || null,
            ACCESSION_NUMBER: record.ACCESSION_NUMBER || null,
            MODALIDADE: record.MODALIDADE || null,
            PRIORIDADE: record.PRIORIDADE || null,
            VALORES: record.VALORES || null,
            ESPECIALIDADE: record.ESPECIALIDADE || null,
            MEDICO: record.MEDICO || null,
            DUPLICADO: record.DUPLICADO || null,
            DATA_REALIZACAO: record.DATA_REALIZACAO || null,
            HORA_REALIZACAO: record.HORA_REALIZACAO || null,
            DATA_TRANSFERENCIA: record.DATA_TRANSFERENCIA || null,
            HORA_TRANSFERENCIA: record.HORA_TRANSFERENCIA || null,
            DATA_LAUDO: record.DATA_LAUDO || null,
            HORA_LAUDO: record.HORA_LAUDO || null,
            DATA_PRAZO: record.DATA_PRAZO || null,
            HORA_PRAZO: record.HORA_PRAZO || null,
            STATUS: record.STATUS || null,
            DATA_REASSINATURA: record.DATA_REASSINATURA || null,
            HORA_REASSINATURA: record.HORA_REASSINATURA || null,
            MEDICO_REASSINATURA: record.MEDICO_REASSINATURA || null,
            SEGUNDA_ASSINATURA: record.SEGUNDA_ASSINATURA || null,
            POSSUI_IMAGENS_CHAVE: record.POSSUI_IMAGENS_CHAVE || null,
            IMAGENS_CHAVES: record.IMAGENS_CHAVES || null,
            IMAGENS_CAPTURADAS: record.IMAGENS_CAPTURADAS || null,
            CODIGO_INTERNO: record.CODIGO_INTERNO || null,
            DIGITADOR: record.DIGITADOR || null,
            COMPLEMENTAR: record.COMPLEMENTAR || null,
            CATEGORIA: record.CATEGORIA || null,
            data_referencia: dataReferencia,
            arquivo_fonte: arquivo_fonte,
            lote_upload: loteUpload,
            periodo_referencia: periodoReferencia,
            tipo_faturamento: 'padrao',
            processamento_pendente: false
          });
        }

        // Inserir batch válido em uma operação
        if (batchValidRecords.length > 0) {
          const { error: batchError } = await supabaseClient
            .from('volumetria_mobilemed')
            .insert(batchValidRecords);

          if (batchError) {
            console.error(`❌ Erro no batch:`, batchError);
            totalErros += batchValidRecords.length;
          } else {
            totalInseridos += batchValidRecords.length;
            console.log(`✅ Batch inserido: ${batchValidRecords.length} registros`);
          }
        }
      }

      // Salvar rejeições em batch
      if (registrosRejeitados.length > 0) {
        console.log(`📋 Salvando ${registrosRejeitados.length} rejeições...`);
        
        const rejectionsToInsert = registrosRejeitados.map(rejection => ({
          arquivo_fonte: arquivo_fonte,
          lote_upload: loteUpload,
          linha_original: rejection.linha_original,
          dados_originais: rejection.dados_originais,
          motivo_rejeicao: rejection.motivo_rejeicao,
          detalhes_erro: rejection.detalhes_erro
        }));

        const { error: rejectionsError } = await supabaseClient
          .from('registros_rejeitados_processamento')
          .insert(rejectionsToInsert);

        if (rejectionsError) {
          console.error(`❌ Erro ao salvar rejeições:`, rejectionsError);
        } else {
          console.log(`✅ ${registrosRejeitados.length} rejeições salvas!`);
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
            regras_aplicadas: 0
          }
        })
        .eq('id', uploadId);

      console.log(`✅ BACKGROUND CONCLUÍDO: ${totalInseridos} inseridos, ${totalErros} rejeitados de ${totalProcessados} processados`);
    };

    // Executar processamento em background
    EdgeRuntime.waitUntil(backgroundProcessing());

    return responsePromise;

  } catch (error) {
    console.error('❌ ERRO:', error);
    
    return new Response(
      JSON.stringify({ 
        erro: true, 
        mensagem: error.message 
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
})