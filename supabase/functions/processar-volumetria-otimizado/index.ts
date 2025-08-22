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
    
    console.log(`🚀 PROCESSAMENTO INICIADO - ${stagingData?.length || 0} registros`);

    if (!stagingData || !Array.isArray(stagingData)) {
      throw new Error('Dados de staging inválidos');
    }

    const loteUpload = `${arquivo_fonte}_${Date.now()}`;
    
    // Determinar período de referência dinamicamente baseado no tipo de arquivo
    let dataReferencia: string;
    let periodoReferencia: string;
    
    console.log(`📋 ARQUIVO: ${arquivo_fonte}`);
    
    // DETERMINAÇÃO DINÂMICA DO PERÍODO BASEADA NO ARQUIVO E DATA ATUAL
    const agora = new Date();
    const anoAtual = agora.getFullYear();
    const mesAtual = agora.getMonth() + 1;
    
    if (arquivo_fonte.includes('jun') || arquivo_fonte.includes('junho')) {
      // Para arquivo de junho, usar o período correto baseado no ano
      const anoArquivo = arquivo_fonte.includes('2024') ? 2024 : anoAtual;
      dataReferencia = `${anoArquivo}-06-01`;
      periodoReferencia = `jun/${anoArquivo.toString().slice(-2)}`;
      console.log(`📅 PERÍODO DETECTADO (junho): ${periodoReferencia} | Data ref: ${dataReferencia}`);
    } else if (arquivo_fonte.includes('mai') || arquivo_fonte.includes('maio')) {
      const anoArquivo = arquivo_fonte.includes('2024') ? 2024 : anoAtual;
      dataReferencia = `${anoArquivo}-05-01`;
      periodoReferencia = `mai/${anoArquivo.toString().slice(-2)}`;
      console.log(`📅 PERÍODO DETECTADO (maio): ${periodoReferencia} | Data ref: ${dataReferencia}`);
    } else {
      // Para outros arquivos, usar período atual ou anterior conforme necessário
      dataReferencia = `${anoAtual}-${mesAtual.toString().padStart(2, '0')}-01`;
      const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
      periodoReferencia = `${meses[mesAtual-1]}/${anoAtual.toString().slice(-2)}`;
      console.log(`📅 PERÍODO ATUAL: ${periodoReferencia} | Data ref: ${dataReferencia}`);
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

      // FUNÇÃO ROBUSTA DE PARSING DE DATAS BRASILEIRAS - CORRIGIDA
      const parseDataBrasileira = (dataBrasileira: string): Date | null => {
        if (!dataBrasileira || typeof dataBrasileira !== 'string') {
          console.log('❌ Data vazia ou inválida:', dataBrasileira);
          return null;
        }
        
        const dataNormalizada = dataBrasileira.trim();
        console.log(`🔍 Tentando converter data: "${dataNormalizada}"`);
        
        // Suportar múltiplos formatos: dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd, dd/mm/yy
        const formatosBrasileiros = [
          /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/, // dd/mm/yyyy ou dd-mm-yyyy
          /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/,  // dd/mm/yy ou dd-mm-yy
          /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/   // yyyy/mm/dd ou yyyy-mm-dd
        ];
        
        for (let i = 0; i < formatosBrasileiros.length; i++) {
          const formato = formatosBrasileiros[i];
          const match = dataNormalizada.match(formato);
          
          if (match) {
            let dia: number, mes: number, ano: number;
            
            if (i === 2) {
              // Formato yyyy/mm/dd ou yyyy-mm-dd
              [, ano, mes, dia] = match.map(Number);
            } else {
              // Formatos dd/mm/yyyy ou dd/mm/yy
              let [, diaStr, mesStr, anoStr] = match;
              
              // CORREÇÃO CRÍTICA: Conversão inteligente de anos
              if (anoStr.length === 2) {
                const anoNum = parseInt(anoStr);
                // Para período atual (2024/2025): 00-05 = 2000-2005, 06-30 = 2006-2030, 31-99 = 1931-1999
                // Para arquivos históricos: interpretar com base no contexto
                if (anoNum <= 5) {
                  anoStr = `200${anoStr}`;
                } else if (anoNum <= 30) {
                  anoStr = `20${anoStr}`;
                } else {
                  anoStr = `19${anoStr}`;
                }
              }
              
              dia = parseInt(diaStr);
              mes = parseInt(mesStr);
              ano = parseInt(anoStr);
            }
            
            console.log(`🔍 Parsed formato ${i}: ${dataNormalizada} -> ${dia}/${mes}/${ano}`);
            
            // Validar números
            if (isNaN(dia) || isNaN(mes) || isNaN(ano)) {
              console.log(`❌ Valores inválidos: dia=${dia}, mes=${mes}, ano=${ano}`);
              continue;
            }
            
            // Validações de range
            if (dia < 1 || dia > 31 || mes < 1 || mes > 12) {
              console.log(`❌ Data fora de range: ${dia}/${mes}/${ano}`);
              continue;
            }
            
            // VALIDAÇÃO CRÍTICA: Rejeitar datas futuras além do período atual
            const hoje = new Date();
            const anoAtual = hoje.getFullYear();
            const mesAtual = hoje.getMonth() + 1;
            
            if (ano > anoAtual || (ano === anoAtual && mes > mesAtual + 1)) {
              console.log(`❌ Data futura rejeitada: ${dia}/${mes}/${ano} (atual: ${mesAtual}/${anoAtual})`);
              return null;
            }
            
            // Criar data
            const data = new Date(ano, mes - 1, dia);
            
            // Verificar se a data criada é válida
            if (data.getFullYear() !== ano || data.getMonth() !== (mes - 1) || data.getDate() !== dia) {
              console.log(`❌ Data inválida após conversão: ${dataNormalizada}`);
              continue;
            }
            
            console.log(`✅ Data convertida: ${dataBrasileira} -> ${data.toISOString().split('T')[0]}`);
            return data;
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
            
            // Calcular datas válidas baseadas no período - CORRIGIDO
            let ano: number, mes: number;
            if (periodoAtual.includes('/')) {
              // Formato jun/25, mai/24, etc
              const [mesStr, anoStr] = periodoAtual.split('/');
              const meses: Record<string, number> = {
                'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
                'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12
              };
              mes = meses[mesStr] || new Date().getMonth() + 1;
              // CORREÇÃO CRÍTICA: Interpretação correta do ano
              const anoNum = parseInt(anoStr);
              if (anoNum <= 30) {
                ano = 2000 + anoNum; // 24 = 2024, 25 = 2025
              } else {
                ano = 1900 + anoNum; // 99 = 1999, etc
              }
            } else {
              // Formato 2024-06
              const [anoStr, mesStr] = periodoAtual.split('-');
              ano = parseInt(anoStr);
              mes = parseInt(mesStr);
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
                console.log(`🔍 RETROATIVO - DATA_REALIZACAO: "${record.DATA_REALIZACAO}" -> ${dataRealizacao ? dataRealizacao.toISOString().split('T')[0] : 'INVÁLIDA'}`);
                console.log(`🔍 Comparando com limite: ${primeiroDiaMes.toISOString().split('T')[0]} (>= para rejeitar)`);
                
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
                console.log(`🔍 RETROATIVO - DATA_LAUDO: "${record.DATA_LAUDO}" -> ${dataLaudo ? dataLaudo.toISOString().split('T')[0] : 'INVÁLIDA'}`);
                console.log(`🔍 Janela válida: ${inicioFaturamento.toISOString().split('T')[0]} a ${fimFaturamento.toISOString().split('T')[0]}`);
                
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
                console.log(`🔍 NÃO-RETROATIVO - DATA_REALIZACAO: "${record.DATA_REALIZACAO}" -> ${dataRealizacao ? dataRealizacao.toISOString().split('T')[0] : 'INVÁLIDA'}`);
                console.log(`🔍 Mês válido: ${primeiroDiaMes.toISOString().split('T')[0]} a ${ultimoDiaMes.toISOString().split('T')[0]}`);
                
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
                console.log(`🔍 NÃO-RETROATIVO - DATA_LAUDO: "${record.DATA_LAUDO}" -> ${dataLaudo ? dataLaudo.toISOString().split('T')[0] : 'INVÁLIDA'}`);
                console.log(`🔍 Janela válida: ${primeiroDiaMes.toISOString().split('T')[0]} a ${fimFaturamento.toISOString().split('T')[0]}`);
                
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

      // 📝 INSERIR REGISTROS REJEITADOS NA TABELA DE REJEIÇÕES
      console.log(`📝 Tentando inserir ${registrosRejeitados.length} registros rejeitados...`);
      
      if (registrosRejeitados.length > 0) {
        const rejectionsToInsert = registrosRejeitados.map(r => ({
          arquivo_fonte: arquivo_fonte,
          lote_upload: loteUpload,
          linha_original: r.linha_original,
          dados_originais: r.dados_originais,
          motivo_rejeicao: r.motivo_rejeicao,
          detalhes_erro: r.detalhes_erro,
          created_at: new Date().toISOString()
        }));

        console.log(`📝 Exemplo de rejeição a inserir:`, JSON.stringify(rejectionsToInsert[0], null, 2));

        // Inserir em batches menores para evitar timeouts
        const BATCH_SIZE_REJEITADOS = 50;
        let totalInseridosRejeitados = 0;
        
        for (let i = 0; i < rejectionsToInsert.length; i += BATCH_SIZE_REJEITADOS) {
          const batchRejeitados = rejectionsToInsert.slice(i, i + BATCH_SIZE_REJEITADOS);
          const batchNum = Math.floor(i/BATCH_SIZE_REJEITADOS) + 1;
          const totalBatches = Math.ceil(rejectionsToInsert.length/BATCH_SIZE_REJEITADOS);
          
          console.log(`📝 Inserindo batch ${batchNum}/${totalBatches} de registros rejeitados (${batchRejeitados.length} registros)...`);

          const { data: insertedRejections, error: rejectError } = await supabaseClient
            .from('registros_rejeitados_processamento')
            .insert(batchRejeitados);

          if (rejectError) {
            console.error(`❌ Erro ao inserir batch ${batchNum} de rejeições:`, rejectError);
            console.error('❌ Detalhes completos do erro:', {
              code: rejectError.code,
              message: rejectError.message,
              details: rejectError.details,
              hint: rejectError.hint
            });
            // Continuar com próximo batch mesmo se um falhar
          } else {
            totalInseridosRejeitados += batchRejeitados.length;
            console.log(`✅ Batch ${batchNum} de rejeições inserido com sucesso (${batchRejeitados.length} registros)`);
          }
        }
        
        console.log(`✅ TOTAL DE REJEIÇÕES INSERIDAS: ${totalInseridosRejeitados}/${registrosRejeitados.length}`);
      } else {
        console.log(`📝 Nenhum registro rejeitado para inserir`);
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