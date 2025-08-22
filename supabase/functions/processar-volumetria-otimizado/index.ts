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
    
    console.log(`\n🚀 INICIANDO PROCESSAMENTO:`);
    console.log(`📊 Total de registros recebidos: ${stagingData?.length || 0}`);
    console.log(`📁 Arquivo fonte: ${arquivo_fonte}`);
    console.log(`🆔 Upload ID: ${uploadId}`);

    if (!stagingData || !Array.isArray(stagingData)) {
      throw new Error('Dados de staging inválidos ou ausentes');
    }

    const loteUpload = `${arquivo_fonte}_${Date.now()}`;
    const dataReferencia = new Date().toISOString().split('T')[0];
    const periodoReferencia = '2025-06';

    let totalProcessados = 0;
    let totalInseridos = 0;
    let totalErros = 0;
    const registrosRejeitados: RejeicaoRecord[] = [];

    // Processar registros
    for (let i = 0; i < stagingData.length; i++) {
      const record = stagingData[i] as VolumetriaRecord;
      totalProcessados++;

      try {
        // Validações básicas
        if (!record.EMPRESA || record.EMPRESA.trim() === '') {
          registrosRejeitados.push({
            linha_original: i + 1,
            dados_originais: record,
            motivo_rejeicao: 'CAMPO_OBRIGATORIO_AUSENTE',
            detalhes_erro: 'Campo EMPRESA é obrigatório'
          });
          totalErros++;
          continue;
        }

        if (!record.ESTUDO_DESCRICAO || record.ESTUDO_DESCRICAO.trim() === '') {
          registrosRejeitados.push({
            linha_original: i + 1,
            dados_originais: record,
            motivo_rejeicao: 'CAMPO_OBRIGATORIO_AUSENTE',
            detalhes_erro: 'Campo ESTUDO_DESCRICAO é obrigatório'
          });
          totalErros++;
          continue;
        }

        // Validação de data
        if (record.DATA_LAUDO) {
          const dataLaudo = new Date(record.DATA_LAUDO);
          const dataLimite = new Date('2025-06-01');
          const dataLimiteFim = new Date('2025-07-07');
          
          if (dataLaudo < dataLimite || dataLaudo > dataLimiteFim) {
            registrosRejeitados.push({
              linha_original: i + 1,
              dados_originais: record,
              motivo_rejeicao: 'DATA_LAUDO_FORA_PERIODO',
              detalhes_erro: `DATA_LAUDO ${record.DATA_LAUDO} fora do período permitido (01/06/2025 a 07/07/2025)`
            });
            totalErros++;
            continue;
          }
        }

        // Se passou nas validações, inserir na volumetria
        const volumetriaRecord = {
          EMPRESA: record.EMPRESA,
          NOME_PACIENTE: record.NOME_PACIENTE || '',
          CODIGO_PACIENTE: record.CODIGO_PACIENTE || '',
          ESTUDO_DESCRICAO: record.ESTUDO_DESCRICAO,
          ACCESSION_NUMBER: record.ACCESSION_NUMBER || '',
          MODALIDADE: record.MODALIDADE || '',
          PRIORIDADE: record.PRIORIDADE || '',
          VALORES: record.VALORES || 0,
          ESPECIALIDADE: record.ESPECIALIDADE || '',
          MEDICO: record.MEDICO || '',
          DUPLICADO: record.DUPLICADO || '',
          DATA_REALIZACAO: record.DATA_REALIZACAO || null,
          HORA_REALIZACAO: record.HORA_REALIZACAO || null,
          DATA_TRANSFERENCIA: record.DATA_TRANSFERENCIA || null,
          HORA_TRANSFERENCIA: record.HORA_TRANSFERENCIA || null,
          DATA_LAUDO: record.DATA_LAUDO || null,
          HORA_LAUDO: record.HORA_LAUDO || null,
          DATA_PRAZO: record.DATA_PRAZO || null,
          HORA_PRAZO: record.HORA_PRAZO || null,
          STATUS: record.STATUS || '',
          DATA_REASSINATURA: record.DATA_REASSINATURA || null,
          HORA_REASSINATURA: record.HORA_REASSINATURA || null,
          MEDICO_REASSINATURA: record.MEDICO_REASSINATURA || '',
          SEGUNDA_ASSINATURA: record.SEGUNDA_ASSINATURA || '',
          POSSUI_IMAGENS_CHAVE: record.POSSUI_IMAGENS_CHAVE || '',
          IMAGENS_CHAVES: record.IMAGENS_CHAVES || '',
          IMAGENS_CAPTURADAS: record.IMAGENS_CAPTURADAS || '',
          CODIGO_INTERNO: record.CODIGO_INTERNO || '',
          DIGITADOR: record.DIGITADOR || '',
          COMPLEMENTAR: record.COMPLEMENTAR || '',
          CATEGORIA: record.CATEGORIA || 'SC',
          data_referencia: dataReferencia,
          arquivo_fonte: arquivo_fonte,
          lote_upload: loteUpload,
          periodo_referencia: periodoReferencia,
          tipo_faturamento: 'padrao',
          processamento_pendente: false
        };

        const { error: insertError } = await supabaseClient
          .from('volumetria_mobilemed')
          .insert([volumetriaRecord]);

        if (insertError) {
          console.error(`Erro ao inserir registro ${i + 1}:`, insertError);
          registrosRejeitados.push({
            linha_original: i + 1,
            dados_originais: record,
            motivo_rejeicao: 'ERRO_INSERCAO_BANCO',
            detalhes_erro: `Erro na inserção: ${insertError.message}`
          });
          totalErros++;
        } else {
          totalInseridos++;
        }

      } catch (error) {
        console.error(`Erro ao processar registro ${i + 1}:`, error);
        registrosRejeitados.push({
          linha_original: i + 1,
          dados_originais: record,
          motivo_rejeicao: 'ERRO_PROCESSAMENTO',
          detalhes_erro: `Erro durante processamento: ${error.message}`
        });
        totalErros++;
      }
    }

    // Salvar registros rejeitados
    console.log(`\n📋 SALVANDO ${registrosRejeitados.length} REJEIÇÕES...`);
    
    if (registrosRejeitados.length > 0) {
      try {
        const rejectionsToInsert = registrosRejeitados.map(rejection => ({
          arquivo_fonte: arquivo_fonte,
          lote_upload: loteUpload,
          linha_original: rejection.linha_original,
          dados_originais: rejection.dados_originais,
          motivo_rejeicao: rejection.motivo_rejeicao,
          detalhes_erro: rejection.detalhes_erro
        }));

        console.log(`📝 Exemplo de rejeição a ser salva:`, JSON.stringify(rejectionsToInsert[0], null, 2));

        const { error: rejectionsError } = await supabaseClient
          .from('registros_rejeitados_processamento')
          .insert(rejectionsToInsert);

        if (rejectionsError) {
          console.error(`❌ ERRO CRÍTICO ao salvar rejeições:`, rejectionsError);
        } else {
          console.log(`✅ SUCESSO: ${registrosRejeitados.length} rejeições salvas!`);
        }
      } catch (error) {
        console.error(`❌ EXCEÇÃO ao salvar rejeições:`, error);
      }
    }

    // Atualizar status do upload
    const { error: updateError } = await supabaseClient
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

    if (updateError) {
      console.error('Erro ao atualizar status do upload:', updateError);
    }

    const resultado = {
      sucesso: true,
      total_processados: totalProcessados,
      total_inseridos: totalInseridos,
      total_rejeitados: totalErros,
      rejeicoes_salvas: registrosRejeitados.length,
      lote_upload: loteUpload,
      detalhes: {
        arquivo_fonte,
        periodo_referencia: periodoReferencia,
        data_processamento: new Date().toISOString()
      }
    };

    console.log(`\n✅ PROCESSAMENTO CONCLUÍDO:`, resultado);

    return new Response(
      JSON.stringify(resultado),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('❌ ERRO GERAL no processamento:', error);
    
    return new Response(
      JSON.stringify({ 
        erro: true, 
        mensagem: error.message,
        stack: error.stack 
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