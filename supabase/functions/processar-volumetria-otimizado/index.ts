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

      // FUNÇÃO ROBUSTA DE PARSING DE DATAS BRASILEIRAS - DEBUG COMPLETO
      const parseDataBrasileira = (dataBrasileira: string): Date | null => {
        if (!dataBrasileira || typeof dataBrasileira !== 'string') {
          console.log(`❌ Data inválida (vazio/não-string): "${dataBrasileira}"`);
          return null;
        }
        
        const dataNormalizada = dataBrasileira.trim();
        console.log(`🔍 Iniciando conversão da data: "${dataNormalizada}"`);
        
        // Suportar múltiplos formatos com prioridade para dd/mm/yyyy (formato dos uploads)
        const formatosBrasileiros = [
          /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/, // dd/mm/yyyy ou dd-mm-yyyy (PRIORITÁRIO)
          /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/,  // dd/mm/yy ou dd-mm-yy
          /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/   // yyyy/mm/dd ou yyyy-mm-dd (ISO)
        ];
        
        for (let i = 0; i < formatosBrasileiros.length; i++) {
          const formato = formatosBrasileiros[i];
          const match = dataNormalizada.match(formato);
          
          console.log(`🔍 Testando formato ${i}: ${formato} => Match: ${match ? 'SIM' : 'NÃO'}`);
          
          if (match) {
            let dia: number, mes: number, ano: number;
            
            console.log(`🔍 Match encontrado: ${JSON.stringify(match)}`);
            
            if (i === 2) {
              // Formato ISO: yyyy/mm/dd ou yyyy-mm-dd
              [, ano, mes, dia] = match.map(Number);
              console.log(`🔍 Formato ISO parseado: ${dia}/${mes}/${ano}`);
            } else {
              // Formatos brasileiros: dd/mm/yyyy ou dd/mm/yy
              let [, diaStr, mesStr, anoStr] = match;
              
              console.log(`🔍 Strings extraídas: dia="${diaStr}", mes="${mesStr}", ano="${anoStr}"`);
              
              // CORREÇÃO CRÍTICA: Interpretação correta de anos com 2 dígitos
              if (anoStr.length === 2) {
                const anoNum = parseInt(anoStr);
                console.log(`🔍 Ano 2 digitos: ${anoNum}`);
                // REGRA FIXA: 00-30 = 2000-2030 | 31-99 = 1931-1999
                if (anoNum <= 30) {
                  ano = 2000 + anoNum;
                  console.log(`🔍 Convertido para: ${ano} (século 21)`);
                } else {
                  ano = 1900 + anoNum;
                  console.log(`🔍 Convertido para: ${ano} (século 20)`);
                }
              } else {
                ano = parseInt(anoStr);
                console.log(`🔍 Ano 4 digitos: ${ano}`);
              }
              
              dia = parseInt(diaStr);
              mes = parseInt(mesStr);
              console.log(`🔍 Valores finais: ${dia}/${mes}/${ano}`);
            }
            
            // DEBUG: Mostrar validações de range
            console.log(`🔍 Validando ranges: dia=${dia} (1-31), mes=${mes} (1-12), ano=${ano} (1900-2030)`);
            const diaValido = dia >= 1 && dia <= 31;
            const mesValido = mes >= 1 && mes <= 12;
            const anoValido = ano >= 1900 && ano <= 2030;
            console.log(`🔍 Validações: dia=${diaValido}, mes=${mesValido}, ano=${anoValido}`);
            
            // Validações básicas de range
            if (!diaValido || !mesValido || !anoValido) {
              console.log(`❌ Fora do range válido: ${dia}/${mes}/${ano}`);
              continue;
            }
            
            // Criar e validar data JavaScript
            const data = new Date(ano, mes - 1, dia);
            console.log(`🔍 Data JavaScript criada: ${data.toISOString()}`);
            console.log(`🔍 Validando consistência: ano=${data.getFullYear()} (${ano}), mes=${data.getMonth()+1} (${mes}), dia=${data.getDate()} (${dia})`);
            
            // Validação de data JavaScript (detecta datas inválidas como 31/02)
            if (data.getFullYear() !== ano || data.getMonth() !== (mes - 1) || data.getDate() !== dia) {
              console.log(`❌ Data JavaScript inválida: ${dia}/${mes}/${ano} -> ${data.getFullYear()}/${data.getMonth()+1}/${data.getDate()}`);
              continue;
            }
            
            console.log(`✅ Data convertida com sucesso: "${dataBrasileira}" -> ${data.toISOString().split('T')[0]} (${dia}/${mes}/${ano})`);
            return data;
          }
        }
        
        console.log(`❌ NENHUM formato reconhecido para: "${dataBrasileira}"`);
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
            
            // CÁLCULO CORRETO DE PERÍODO BASEADO NO FORMATO BRASILEIRO
            let ano: number, mes: number;
            
            if (periodoAtual.includes('/')) {
              // Formato brasileiro: jun/25, mai/24, etc
              const [mesStr, anoStr] = periodoAtual.split('/');
              const meses: Record<string, number> = {
                'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
                'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12
              };
              mes = meses[mesStr.toLowerCase()] || new Date().getMonth() + 1;
              
              // CORREÇÃO DEFINITIVA: Interpretação correta de anos
              const anoNum = parseInt(anoStr);
              // REGRA FIXA PARA MEDICINA: 00-30 = 2000-2030 | 31-99 = 1931-1999
              if (anoNum <= 30) {
                ano = 2000 + anoNum; // 25 = 2025, 24 = 2024
              } else {
                ano = 1900 + anoNum; // 99 = 1999
              }
            } else if (periodoAtual.includes('-')) {
              // Formato ISO: 2025-06
              const [anoStr, mesStr] = periodoAtual.split('-');
              ano = parseInt(anoStr);
              mes = parseInt(mesStr);
            } else {
              // Fallback: usar data atual
              const agora = new Date();
              ano = agora.getFullYear();
              mes = agora.getMonth() + 1;
            }
            
            // DEFINIÇÃO CORRETA DAS DATAS DE VALIDAÇÃO
            const primeiroDiaMes = new Date(ano, mes - 1, 1);           // 01/MM/AAAA
            const ultimoDiaMes = new Date(ano, mes, 0);                 // Último dia do mês
            const inicioFaturamento = new Date(ano, mes - 1, 8);        // 08/MM/AAAA (mês de referência)
            const fimFaturamento = new Date(ano, mes, 7);               // 07/(MM+1)/AAAA (mês seguinte)
            
            console.log(`🗓️ PERÍODO VALIDAÇÃO: ${periodoAtual} => ${mes}/${ano}`);
            console.log(`📅 Primeiro dia: ${primeiroDiaMes.toISOString().split('T')[0]}`);
            console.log(`📅 Último dia: ${ultimoDiaMes.toISOString().split('T')[0]}`);
            console.log(`📅 Faturamento: ${inicioFaturamento.toISOString().split('T')[0]} até ${fimFaturamento.toISOString().split('T')[0]}`);
            
            // APLICAR REGRAS CORRETAS POR TIPO DE ARQUIVO
            if (isRetroativo) {
              // ========== ARQUIVOS RETROATIVOS: Regras v002 e v003 ==========
              
              // REGRA v003: DATA_REALIZACAO deve ser ANTERIOR ao primeiro dia do período
              if (record.DATA_REALIZACAO) {
                const dataRealizacao = parseDataBrasileira(record.DATA_REALIZACAO);
                if (!dataRealizacao) {
                  console.log(`❌ FORMATO INVÁLIDO - DATA_REALIZACAO: "${record.DATA_REALIZACAO}"`);
                  registrosRejeitados.push({
                    linha_original: linhaOriginal,
                    dados_originais: record,
                    motivo_rejeicao: 'FORMATO_DATA_REALIZACAO_INVALIDO',
                    detalhes_erro: `DATA_REALIZACAO com formato inválido: "${record.DATA_REALIZACAO}"`
                  });
                  totalErros++;
                  continue;
                }
                
                console.log(`🔍 v003 - DATA_REALIZACAO: ${record.DATA_REALIZACAO} -> ${dataRealizacao.toISOString().split('T')[0]}`);
                console.log(`🔍 v003 - Deve ser < ${primeiroDiaMes.toISOString().split('T')[0]}`);
                
                // v003: Rejeitar se DATA_REALIZACAO >= primeiro dia do mês
                if (dataRealizacao >= primeiroDiaMes) {
                  console.log(`❌ REJEIÇÃO v003: DATA_REALIZACAO ${dataRealizacao.toISOString().split('T')[0]} >= ${primeiroDiaMes.toISOString().split('T')[0]}`);
                  registrosRejeitados.push({
                    linha_original: linhaOriginal,
                    dados_originais: record,
                    motivo_rejeicao: 'REGRA_v003_DATA_REALIZACAO_RETROATIVO',
                    detalhes_erro: `DATA_REALIZACAO ${record.DATA_REALIZACAO} (${dataRealizacao.toISOString().split('T')[0]}) deve ser anterior a ${primeiroDiaMes.toISOString().split('T')[0]}`
                  });
                  totalErros++;
                  continue;
                }
              }
              
              // REGRA v002: DATA_LAUDO deve estar DENTRO da janela de faturamento
              if (record.DATA_LAUDO) {
                const dataLaudo = parseDataBrasileira(record.DATA_LAUDO);
                if (!dataLaudo) {
                  console.log(`❌ FORMATO INVÁLIDO - DATA_LAUDO: "${record.DATA_LAUDO}"`);
                  registrosRejeitados.push({
                    linha_original: linhaOriginal,
                    dados_originais: record,
                    motivo_rejeicao: 'FORMATO_DATA_LAUDO_INVALIDO',
                    detalhes_erro: `DATA_LAUDO com formato inválido: "${record.DATA_LAUDO}"`
                  });
                  totalErros++;
                  continue;
                }
                
                console.log(`🔍 v002 - DATA_LAUDO: ${record.DATA_LAUDO} -> ${dataLaudo.toISOString().split('T')[0]}`);
                console.log(`🔍 v002 - Deve estar entre ${inicioFaturamento.toISOString().split('T')[0]} e ${fimFaturamento.toISOString().split('T')[0]}`);
                
                // v002: Rejeitar se DATA_LAUDO fora da janela de faturamento
                if (dataLaudo < inicioFaturamento || dataLaudo > fimFaturamento) {
                  console.log(`❌ REJEIÇÃO v002: DATA_LAUDO ${dataLaudo.toISOString().split('T')[0]} fora da janela`);
                  registrosRejeitados.push({
                    linha_original: linhaOriginal,
                    dados_originais: record,
                    motivo_rejeicao: 'REGRA_v002_DATA_LAUDO_RETROATIVO',
                    detalhes_erro: `DATA_LAUDO ${record.DATA_LAUDO} (${dataLaudo.toISOString().split('T')[0]}) deve estar entre ${inicioFaturamento.toISOString().split('T')[0]} e ${fimFaturamento.toISOString().split('T')[0]}`
                  });
                  totalErros++;
                  continue;
                }
              }
            } else {
              // ========== ARQUIVOS NÃO-RETROATIVOS: Regra v031 ==========
              
              // REGRA v031: DATA_REALIZACAO deve estar DENTRO do mês de referência
              if (record.DATA_REALIZACAO) {
                const dataRealizacao = parseDataBrasileira(record.DATA_REALIZACAO);
                if (!dataRealizacao) {
                  console.log(`❌ FORMATO INVÁLIDO - DATA_REALIZACAO: "${record.DATA_REALIZACAO}"`);
                  registrosRejeitados.push({
                    linha_original: linhaOriginal,
                    dados_originais: record,
                    motivo_rejeicao: 'FORMATO_DATA_REALIZACAO_INVALIDO',
                    detalhes_erro: `DATA_REALIZACAO com formato inválido: "${record.DATA_REALIZACAO}"`
                  });
                  totalErros++;
                  continue;
                }
                
                console.log(`🔍 v031 - DATA_REALIZACAO: ${record.DATA_REALIZACAO} -> ${dataRealizacao.toISOString().split('T')[0]}`);
                console.log(`🔍 v031 - Deve estar entre ${primeiroDiaMes.toISOString().split('T')[0]} e ${ultimoDiaMes.toISOString().split('T')[0]}`);
                
                // v031: Rejeitar se DATA_REALIZACAO fora do mês
                if (dataRealizacao < primeiroDiaMes || dataRealizacao > ultimoDiaMes) {
                  console.log(`❌ REJEIÇÃO v031: DATA_REALIZACAO ${dataRealizacao.toISOString().split('T')[0]} fora do mês`);
                  registrosRejeitados.push({
                    linha_original: linhaOriginal,
                    dados_originais: record,
                    motivo_rejeicao: 'REGRA_v031_DATA_REALIZACAO_ATUAL',
                    detalhes_erro: `DATA_REALIZACAO ${record.DATA_REALIZACAO} (${dataRealizacao.toISOString().split('T')[0]}) deve estar no mês ${primeiroDiaMes.toISOString().split('T')[0]} a ${ultimoDiaMes.toISOString().split('T')[0]}`
                  });
                  totalErros++;
                  continue;
                }
              }
              
              // REGRA v031: DATA_LAUDO deve estar na janela estendida (até dia 7 do mês seguinte)
              if (record.DATA_LAUDO) {
                const dataLaudo = parseDataBrasileira(record.DATA_LAUDO);
                if (!dataLaudo) {
                  console.log(`❌ FORMATO INVÁLIDO - DATA_LAUDO: "${record.DATA_LAUDO}"`);
                  registrosRejeitados.push({
                    linha_original: linhaOriginal,
                    dados_originais: record,
                    motivo_rejeicao: 'FORMATO_DATA_LAUDO_INVALIDO',
                    detalhes_erro: `DATA_LAUDO com formato inválido: "${record.DATA_LAUDO}"`
                  });
                  totalErros++;
                  continue;
                }
                
                console.log(`🔍 v031 - DATA_LAUDO: ${record.DATA_LAUDO} -> ${dataLaudo.toISOString().split('T')[0]}`);
                console.log(`🔍 v031 - Deve estar entre ${primeiroDiaMes.toISOString().split('T')[0]} e ${fimFaturamento.toISOString().split('T')[0]}`);
                
                // v031: Rejeitar se DATA_LAUDO fora da janela estendida
                if (dataLaudo < primeiroDiaMes || dataLaudo > fimFaturamento) {
                  console.log(`❌ REJEIÇÃO v031: DATA_LAUDO ${dataLaudo.toISOString().split('T')[0]} fora da janela estendida`);
                  registrosRejeitados.push({
                    linha_original: linhaOriginal,
                    dados_originais: record,
                    motivo_rejeicao: 'REGRA_v031_DATA_LAUDO_ATUAL',
                    detalhes_erro: `DATA_LAUDO ${record.DATA_LAUDO} (${dataLaudo.toISOString().split('T')[0]}) deve estar entre ${primeiroDiaMes.toISOString().split('T')[0]} e ${fimFaturamento.toISOString().split('T')[0]}`
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

        // SALVAR TODAS AS REJEIÇÕES NO BANCO - GARANTIA ABSOLUTA
        if (registrosRejeitados.length > 0) {
          console.log(`💾 SALVANDO ${registrosRejeitados.length} registros rejeitados no banco...`);
          
          // Preparar dados com todas as informações necessárias
          const rejeicoes = registrosRejeitados.map(r => ({
            arquivo_fonte: arquivo_fonte,
            lote_upload: loteUpload,
            linha_original: r.linha_original,
            dados_originais: {
              EMPRESA: r.dados_originais.EMPRESA || 'N/I',
              NOME_PACIENTE: r.dados_originais.NOME_PACIENTE || 'N/I',
              MODALIDADE: r.dados_originais.MODALIDADE || 'N/I',
              ESPECIALIDADE: r.dados_originais.ESPECIALIDADE || 'N/I',
              ESTUDO_DESCRICAO: r.dados_originais.ESTUDO_DESCRICAO || 'N/I',
              DATA_REALIZACAO: r.dados_originais.DATA_REALIZACAO || 'N/I',
              DATA_LAUDO: r.dados_originais.DATA_LAUDO || 'N/I',
              VALORES: r.dados_originais.VALORES || 0,
              // Incluir data normalizada para debug
              DATA_REALIZACAO_NORMALIZADA: r.dados_originais.DATA_REALIZACAO ? 
                parseDataBrasileira(r.dados_originais.DATA_REALIZACAO)?.toISOString().split('T')[0] || 'ERRO_CONVERSAO' : 'N/A',
              DATA_LAUDO_NORMALIZADA: r.dados_originais.DATA_LAUDO ?
                parseDataBrasileira(r.dados_originais.DATA_LAUDO)?.toISOString().split('T')[0] || 'ERRO_CONVERSAO' : 'N/A'
            },
            motivo_rejeicao: r.motivo_rejeicao,
            detalhes_erro: r.detalhes_erro,
            created_at: new Date().toISOString()
          }));

          // Inserir em batches para garantir sucesso
          const BATCH_SIZE_REJEICOES = 50;
          let totalInseridosRejeicoes = 0;
          
          for (let i = 0; i < rejeicoes.length; i += BATCH_SIZE_REJEICOES) {
            const batch = rejeicoes.slice(i, i + BATCH_SIZE_REJEICOES);
            
            const { error: rejeicaoError } = await supabaseClient
              .from('registros_rejeitados_processamento')
              .insert(batch);

            if (rejeicaoError) {
              console.error(`❌ Erro no batch ${Math.floor(i/BATCH_SIZE_REJEICOES) + 1} de rejeições:`, rejeicaoError);
            } else {
              totalInseridosRejeicoes += batch.length;
              console.log(`✅ Batch ${Math.floor(i/BATCH_SIZE_REJEICOES) + 1}: ${batch.length} rejeições salvas`);
            }
          }
          
          console.log(`✅ TOTAL REJEIÇÕES SALVAS: ${totalInseridosRejeicoes}/${registrosRejeitados.length}`);
        } else {
          console.log(`📝 Nenhum registro rejeitado - todos foram processados com sucesso`);
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