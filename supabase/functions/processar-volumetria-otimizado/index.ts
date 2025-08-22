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
    
    // Determinar período de referência dinamicamente baseado no tipo de arquivo
    let dataReferencia: string;
    let periodoReferencia: string;
    
    // Para Jun/25, usar formato correto
    if (arquivo_fonte.includes('jun') || arquivo_fonte.includes('junho')) {
      dataReferencia = '2025-06-01';
      periodoReferencia = 'jun/25';
    } else {
      // Fallback para período atual
      dataReferencia = new Date().toISOString().split('T')[0];
      periodoReferencia = '2025-06';
    }

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

      // FUNÇÃO PARA CONVERTER DATA BRASILEIRA (dd/mm/yyyy) PARA Date
      const parseDataBrasileira = (dataBrasileira: string): Date | null => {
        if (!dataBrasileira || dataBrasileira.trim() === '') return null;
        
        console.log(`🔄 Processando data: "${dataBrasileira}"`);
        
        // Se já está no formato ISO (yyyy-mm-dd), usar diretamente
        if (dataBrasileira.includes('-') && dataBrasileira.length === 10) {
          const data = new Date(dataBrasileira);
          console.log(`📅 Data ISO: ${dataBrasileira} -> ${data.toISOString().split('T')[0]}`);
          return data;
        }
        
        // Converter formato brasileiro dd/mm/yyyy para yyyy-mm-dd
        const partes = dataBrasileira.trim().split('/');
        if (partes.length === 3) {
          const [dia, mes, ano] = partes;
          
          // Validar valores numéricos
          const diaNum = parseInt(dia, 10);
          const mesNum = parseInt(mes, 10);
          const anoNum = parseInt(ano, 10);
          
          if (isNaN(diaNum) || isNaN(mesNum) || isNaN(anoNum)) {
            console.log(`❌ Valores inválidos: dia=${dia}, mes=${mes}, ano=${ano}`);
            return null;
          }
          
          // Validar ranges
          if (diaNum < 1 || diaNum > 31 || mesNum < 1 || mesNum > 12) {
            console.log(`❌ Data fora de range: ${diaNum}/${mesNum}/${anoNum}`);
            return null;
          }
          
          // Criar no formato ISO: yyyy-mm-dd (usando Date constructor diretamente)
          const data = new Date(anoNum, mesNum - 1, diaNum); // mes-1 porque Date usa 0-11 para meses
          console.log(`📅 Data convertida: ${dataBrasileira} -> ${data.toISOString().split('T')[0]}`);
          
          // Verificar se a data criada é válida
          if (data.getFullYear() === anoNum && data.getMonth() === mesNum - 1 && data.getDate() === diaNum) {
            return data;
          } else {
            console.log(`❌ Data inválida após conversão: ${dataBrasileira}`);
            return null;
          }
        }
        
        console.log(`❌ Formato não reconhecido: "${dataBrasileira}"`);
        return null;
      };

      // APLICAR CONVERSÃO EM TODOS OS CAMPOS DE DATA
      const converterCamposData = (record: VolumetriaRecord): VolumetriaRecord => {
        const recordConvertido = { ...record };
        
        // Lista de todos os campos de data no formato dd/mm/yyyy
        const camposData = [
          'DATA_REALIZACAO', 'DATA_TRANSFERENCIA', 'DATA_LAUDO', 
          'DATA_PRAZO', 'DATA_REASSINATURA'
        ];
        
        camposData.forEach(campo => {
          const valorCampo = recordConvertido[campo as keyof VolumetriaRecord] as string;
          if (valorCampo && typeof valorCampo === 'string') {
            const dataConvertida = parseDataBrasileira(valorCampo);
            if (dataConvertida && !isNaN(dataConvertida.getTime())) {
              // Manter o formato original mas garantir que seja interpretado corretamente
              recordConvertido[campo as keyof VolumetriaRecord] = valorCampo as any;
            }
          }
        });
        
        return recordConvertido;
      };

      // Processar em batches para melhor performance
      for (let batchStart = 0; batchStart < stagingData.length; batchStart += BATCH_SIZE) {
        const batch = stagingData.slice(batchStart, batchStart + BATCH_SIZE);
        console.log(`📦 Processando batch ${Math.floor(batchStart/BATCH_SIZE) + 1}/${Math.ceil(stagingData.length/BATCH_SIZE)}`);

        const batchValidRecords: any[] = [];

        // Validar batch
        for (let i = 0; i < batch.length; i++) {
          const recordOriginal = batch[i] as VolumetriaRecord;
          const record = converterCamposData(recordOriginal); // Aplicar conversão de datas
          const linhaOriginal = batchStart + i + 1;
          totalProcessados++;

          // Validação de data baseada no tipo de arquivo e período de referência
          if (record.DATA_LAUDO || record.DATA_REALIZACAO) {
            const isRetroativo = arquivo_fonte.includes('retroativo');
            const periodoAtual = periodoReferencia;
            
            // Calcular datas válidas baseadas no período
            let ano: number, mes: number;
            if (periodoAtual.includes('/')) {
              // Formato jun/25
              const [mesStr, anoStr] = periodoAtual.split('/');
              const meses: Record<string, number> = {
                'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
                'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12
              };
              mes = meses[mesStr] || 6; // default junho
              ano = 2000 + parseInt(anoStr);
            } else {
              // Formato 2025-06
              [ano, mes] = periodoAtual.split('-').map(Number);
            }
            
            // Datas de validação por tipo de arquivo
            const primeiroDiaMes = new Date(ano, mes - 1, 1);
            const ultimoDiaMes = new Date(ano, mes, 0);
            const inicioFaturamento = new Date(ano, mes - 1, 8);
            const fimFaturamento = new Date(ano, mes, 7);
            
            console.log(`🗓️ VALIDAÇÃO PERÍODO: ${periodoAtual} | Mês: ${mes}/${ano}`);
            console.log(`📅 Datas válidas: ${primeiroDiaMes.toISOString().split('T')[0]} a ${ultimoDiaMes.toISOString().split('T')[0]}`);
            
            // Aplicar regras específicas por tipo de arquivo
            if (isRetroativo) {
              // ARQUIVOS RETROATIVOS: Regras v002/v003
              if (record.DATA_REALIZACAO) {
                const dataRealizacao = parseDataBrasileira(record.DATA_REALIZACAO);
                if (dataRealizacao && dataRealizacao >= primeiroDiaMes) {
                  console.log(`❌ REJEIÇÃO v003: DATA_REALIZACAO ${record.DATA_REALIZACAO} interpretada como ${dataRealizacao.toISOString().split('T')[0]} >= ${primeiroDiaMes.toISOString().split('T')[0]}`);
                  registrosRejeitados.push({
                    linha_original: linhaOriginal,
                    dados_originais: record,
                    motivo_rejeicao: 'REGRA_v003_DATA_REALIZACAO',
                    detalhes_erro: `DATA_REALIZACAO ${record.DATA_REALIZACAO} (convertida para ${dataRealizacao.toISOString().split('T')[0]}) >= ${primeiroDiaMes.toISOString().split('T')[0]} (retroativo)`
                  });
                  totalErros++;
                  continue;
                }
              }
              
              if (record.DATA_LAUDO) {
                const dataLaudo = parseDataBrasileira(record.DATA_LAUDO);
                if (dataLaudo && (dataLaudo < inicioFaturamento || dataLaudo > fimFaturamento)) {
                  console.log(`❌ REJEIÇÃO v002: DATA_LAUDO ${record.DATA_LAUDO} interpretada como ${dataLaudo.toISOString().split('T')[0]} fora de ${inicioFaturamento.toISOString().split('T')[0]} a ${fimFaturamento.toISOString().split('T')[0]}`);
                  registrosRejeitados.push({
                    linha_original: linhaOriginal,
                    dados_originais: record,
                    motivo_rejeicao: 'REGRA_v002_DATA_LAUDO',
                    detalhes_erro: `DATA_LAUDO ${record.DATA_LAUDO} (convertida para ${dataLaudo.toISOString().split('T')[0]}) fora do período ${inicioFaturamento.toISOString().split('T')[0]} a ${fimFaturamento.toISOString().split('T')[0]} (retroativo)`
                  });
                  totalErros++;
                  continue;
                }
              }
            } else {
              // ARQUIVOS NÃO-RETROATIVOS: Regra v031
              if (record.DATA_REALIZACAO) {
                const dataRealizacao = parseDataBrasileira(record.DATA_REALIZACAO);
                if (dataRealizacao && (dataRealizacao < primeiroDiaMes || dataRealizacao > ultimoDiaMes)) {
                  console.log(`❌ REJEIÇÃO v031: DATA_REALIZACAO ${record.DATA_REALIZACAO} interpretada como ${dataRealizacao.toISOString().split('T')[0]} fora de ${primeiroDiaMes.toISOString().split('T')[0]} a ${ultimoDiaMes.toISOString().split('T')[0]}`);
                  registrosRejeitados.push({
                    linha_original: linhaOriginal,
                    dados_originais: record,
                    motivo_rejeicao: 'REGRA_v031_DATA_REALIZACAO',
                    detalhes_erro: `DATA_REALIZACAO ${record.DATA_REALIZACAO} (convertida para ${dataRealizacao.toISOString().split('T')[0]}) fora do mês ${primeiroDiaMes.toISOString().split('T')[0]} a ${ultimoDiaMes.toISOString().split('T')[0]} (não-retroativo)`
                  });
                  totalErros++;
                  continue;
                }
              }
              
              if (record.DATA_LAUDO) {
                const dataLaudo = parseDataBrasileira(record.DATA_LAUDO);
                if (dataLaudo && (dataLaudo < primeiroDiaMes || dataLaudo > fimFaturamento)) {
                  console.log(`❌ REJEIÇÃO v031: DATA_LAUDO ${record.DATA_LAUDO} interpretada como ${dataLaudo.toISOString().split('T')[0]} fora de ${primeiroDiaMes.toISOString().split('T')[0]} a ${fimFaturamento.toISOString().split('T')[0]}`);
                  registrosRejeitados.push({
                    linha_original: linhaOriginal,
                    dados_originais: record,
                    motivo_rejeicao: 'REGRA_v031_DATA_LAUDO',
                    detalhes_erro: `DATA_LAUDO ${record.DATA_LAUDO} (convertida para ${dataLaudo.toISOString().split('T')[0]}) fora da janela ${primeiroDiaMes.toISOString().split('T')[0]} a ${fimFaturamento.toISOString().split('T')[0]} (não-retroativo)`
                  });
                  totalErros++;
                  continue;
                }
              }
            }
          }

          // Gravar exatamente como está no upload, preservando valores originais
          const recordToInsert = {
            ...record,
            data_referencia: dataReferencia,
            arquivo_fonte: arquivo_fonte,
            lote_upload: loteUpload,
            periodo_referencia: periodoReferencia,
            processamento_pendente: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          batchValidRecords.push(recordToInsert);
        }

        // Inserir registros válidos do batch
        if (batchValidRecords.length > 0) {
          const { error: insertError } = await supabaseClient
            .from('volumetria_mobilemed')
            .insert(batchValidRecords);

          if (insertError) {
            console.error(`❌ Erro ao inserir batch:`, insertError);
            // Adicionar todos os registros do batch como rejeitados
            for (let i = 0; i < batchValidRecords.length; i++) {
              registrosRejeitados.push({
                linha_original: batchStart + i + 1,
                dados_originais: batchValidRecords[i],
                motivo_rejeicao: 'ERRO_INSERCAO_BANCO',
                detalhes_erro: insertError.message
              });
              totalErros++;
            }
          } else {
            totalInseridos += batchValidRecords.length;
            console.log(`✅ Batch inserido: ${batchValidRecords.length} registros`);
          }
        }
      }

      // Inserir registros rejeitados
      if (registrosRejeitados.length > 0) {
        const rejectionsToInsert = registrosRejeitados.map(r => ({
          arquivo_fonte: arquivo_fonte,
          lote_upload: loteUpload,
          linha_original: r.linha_original,
          dados_originais: r.dados_originais,
          motivo_rejeicao: r.motivo_rejeicao,
          detalhes_erro: r.detalhes_erro
        }));

        const { error: rejectError } = await supabaseClient
          .from('registros_rejeitados_processamento')
          .insert(rejectionsToInsert);

        if (rejectError) {
          console.error('❌ Erro ao inserir rejeições:', rejectError);
        } else {
          console.log(`📝 Rejeições salvas: ${registrosRejeitados.length} registros`);
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});