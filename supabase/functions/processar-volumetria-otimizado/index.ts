import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

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

    const { data: stagingData, uploadId, arquivo_fonte = 'volumetria_padrao', periodo } = await req.json();
    
    console.log(`🚀 PROCESSAMENTO INICIADO - Dados recebidos:`);
    console.log(`📋 Upload ID: ${uploadId}`);
    console.log(`📋 Arquivo fonte: ${arquivo_fonte}`);
    console.log(`📋 Período recebido:`, periodo);
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

      // Determinar período de referência usando o período enviado pelo frontend
      let periodoReferenciaDb: string; // Formato YYYY-MM para banco de dados
      
      if (periodo && periodo.ano && periodo.mes) {
        // Usar período enviado pelo frontend
        periodoReferenciaDb = `${periodo.ano}-${periodo.mes.toString().padStart(2, '0')}`;
        console.log(`📅 PERÍODO RECEBIDO DO FRONTEND: ${periodoReferenciaDb}`);
      } else {
        // Fallback: usar mês atual do servidor
        const agora = new Date();
        const anoAtual = agora.getFullYear();
        const mesAtual = agora.getMonth() + 1;
        periodoReferenciaDb = `${anoAtual}-${mesAtual.toString().padStart(2, '0')}`;
        console.warn(`⚠️ PERÍODO NÃO ENVIADO - Usando mês atual do servidor: ${periodoReferenciaDb}`);
      }

      // Converter para formato usado nas edge functions de regras (mmm/YY)
      const [ano, mes] = periodoReferenciaDb.split('-');
      const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      const periodoReferenciaEdge = `${meses[parseInt(mes) - 1]}/${ano.slice(-2)}`;

      console.log(`📋 PERÍODO DE REFERÊNCIA - DB: ${periodoReferenciaDb} | Edge: ${periodoReferenciaEdge}`);

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
          
          // 🚫 FILTRO 1: EXCLUIR REGISTROS COM STATUS DIFERENTE DE "Assinado" ou "Reassinado"
          const statusRecord = (record.STATUS || '').toString().trim().toLowerCase();
          if (statusRecord !== 'assinado' && statusRecord !== 'reassinado') {
            registrosRejeitados.push({
              linha_original: linhaOriginal,
              dados_originais: record,
              motivo_rejeicao: 'STATUS_INVALIDO',
              detalhes_erro: `Status "${record.STATUS || 'VAZIO'}" não é válido. Apenas registros com status "Assinado" ou "Reassinado" são aceitos.`
            });
            totalErros++;
            continue; // Pular este registro
          }
          
          // 🚫 FILTRO 2: EXCLUIR REGISTROS COM MODALIDADE "US" - Exames não realizados/não faturados
          if (record.MODALIDADE === 'US') {
            registrosRejeitados.push({
              linha_original: linhaOriginal,
              dados_originais: record,
              motivo_rejeicao: 'MODALIDADE_US_EXCLUIDA',
              detalhes_erro: 'Exames com modalidade US não são realizados, faturados e não têm repasse médico. Excluídos automaticamente.'
            });
            totalErros++;
            continue; // Pular este registro
          }
          
          // 🚫 FILTRO 3: REGRA V003 - Para arquivos RETROATIVOS, excluir registros com DATA_REALIZACAO >= primeiro dia do mês de referência
          const isRetroativo = arquivo_fonte.includes('retroativo');
          if (isRetroativo && record.DATA_REALIZACAO) {
            // Converter DATA_REALIZACAO para string YYYY-MM-DD de forma robusta
            let dataRealizacaoStr: string;
            const dataRaw = record.DATA_REALIZACAO;
            
            if (typeof dataRaw === 'number') {
              // É um número de série do Excel (dias desde 1900-01-01)
              const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Excel epoch
              const dataDate = new Date(excelEpoch.getTime() + dataRaw * 24 * 60 * 60 * 1000);
              dataRealizacaoStr = dataDate.toISOString().split('T')[0];
            } else if (typeof dataRaw === 'string') {
              // Tentar parsear como data
              const parsed = new Date(dataRaw);
              if (!isNaN(parsed.getTime())) {
                dataRealizacaoStr = parsed.toISOString().split('T')[0];
              } else {
                dataRealizacaoStr = dataRaw; // Manter como está se já for YYYY-MM-DD
              }
            } else {
              dataRealizacaoStr = String(dataRaw);
            }
            
            const [anoRef, mesRef] = periodoReferenciaDb.split('-').map(Number);
            const primeiroDiaMesRefStr = `${anoRef}-${String(mesRef).padStart(2, '0')}-01`;
            
            // Comparação por string YYYY-MM-DD é segura e precisa
            if (dataRealizacaoStr >= primeiroDiaMesRefStr) {
              registrosRejeitados.push({
                linha_original: linhaOriginal,
                dados_originais: record,
                motivo_rejeicao: 'REGRA_V003_DATA_REALIZACAO_FORA_PERIODO',
                detalhes_erro: `Registro retroativo com DATA_REALIZACAO (${dataRealizacaoStr}) >= primeiro dia do mês de referência (${primeiroDiaMesRefStr}). Para arquivos retroativos, apenas exames realizados ANTES do mês de referência devem ser considerados.`
              });
              totalErros++;
              continue; // Pular este registro
            }
          }
          
          // 🚫 FILTRO 4: REGRA V002 - Para arquivos RETROATIVOS, excluir registros com DATA_LAUDO fora da janela (08/mês até 07/mês+1)
          if (isRetroativo && record.DATA_LAUDO) {
            // Converter DATA_LAUDO para string YYYY-MM-DD de forma robusta
            let dataLaudoStr: string;
            const laudoRaw = record.DATA_LAUDO;
            
            if (typeof laudoRaw === 'number') {
              const excelEpoch = new Date(Date.UTC(1899, 11, 30));
              const dataDate = new Date(excelEpoch.getTime() + laudoRaw * 24 * 60 * 60 * 1000);
              dataLaudoStr = dataDate.toISOString().split('T')[0];
            } else if (typeof laudoRaw === 'string') {
              const parsed = new Date(laudoRaw);
              if (!isNaN(parsed.getTime())) {
                dataLaudoStr = parsed.toISOString().split('T')[0];
              } else {
                dataLaudoStr = laudoRaw;
              }
            } else {
              dataLaudoStr = String(laudoRaw);
            }
            
            const [anoRef, mesRef] = periodoReferenciaDb.split('-').map(Number);
            // Janela de laudo: dia 08 do mês de referência até dia 07 do mês seguinte
            const dataInicioJanela = `${anoRef}-${String(mesRef).padStart(2, '0')}-08`;
            const mesProximo = mesRef === 12 ? 1 : mesRef + 1;
            const anoProximo = mesRef === 12 ? anoRef + 1 : anoRef;
            const dataFimJanela = `${anoProximo}-${String(mesProximo).padStart(2, '0')}-07`;
            
            // Excluir se DATA_LAUDO está fora da janela
            if (dataLaudoStr < dataInicioJanela || dataLaudoStr > dataFimJanela) {
              registrosRejeitados.push({
                linha_original: linhaOriginal,
                dados_originais: record,
                motivo_rejeicao: 'REGRA_V002_DATA_LAUDO_FORA_JANELA',
                detalhes_erro: `Registro retroativo com DATA_LAUDO (${dataLaudoStr}) fora da janela permitida (${dataInicioJanela} até ${dataFimJanela}). Apenas laudos emitidos dentro desta janela são válidos para o período.`
              });
              totalErros++;
              continue; // Pular este registro
            }
          }
          
          // 🚫 FILTRO 5: Para arquivos PADRÃO (01 e 02), excluir registros com DATA_LAUDO posterior ao dia 07 do mês seguinte ao período de referência
          const isPadrao = !arquivo_fonte.includes('retroativo');
          if (isPadrao && record.DATA_LAUDO) {
            // Converter DATA_LAUDO para string YYYY-MM-DD de forma robusta
            let dataLaudoPadraoStr: string;
            const laudoPadraoRaw = record.DATA_LAUDO;
            
            if (typeof laudoPadraoRaw === 'number') {
              const excelEpoch = new Date(Date.UTC(1899, 11, 30));
              const dataDate = new Date(excelEpoch.getTime() + laudoPadraoRaw * 24 * 60 * 60 * 1000);
              dataLaudoPadraoStr = dataDate.toISOString().split('T')[0];
            } else if (typeof laudoPadraoRaw === 'string') {
              const parsed = new Date(laudoPadraoRaw);
              if (!isNaN(parsed.getTime())) {
                dataLaudoPadraoStr = parsed.toISOString().split('T')[0];
              } else {
                dataLaudoPadraoStr = laudoPadraoRaw;
              }
            } else {
              dataLaudoPadraoStr = String(laudoPadraoRaw);
            }
            
            const [anoRef, mesRef] = periodoReferenciaDb.split('-').map(Number);
            // Limite: dia 07 do mês seguinte ao período de referência
            const mesProximoPadrao = mesRef === 12 ? 1 : mesRef + 1;
            const anoProximoPadrao = mesRef === 12 ? anoRef + 1 : anoRef;
            const dataLimiteLaudoPadrao = `${anoProximoPadrao}-${String(mesProximoPadrao).padStart(2, '0')}-07`;
            
            // Excluir se DATA_LAUDO é posterior ao dia 07 do mês seguinte (> limite)
            if (dataLaudoPadraoStr > dataLimiteLaudoPadrao) {
              registrosRejeitados.push({
                linha_original: linhaOriginal,
                dados_originais: record,
                motivo_rejeicao: 'REGRA_PADRAO_DATA_LAUDO_APOS_LIMITE',
                detalhes_erro: `Arquivo padrão com DATA_LAUDO (${dataLaudoPadraoStr}) posterior ao limite permitido (${dataLimiteLaudoPadrao}). Para arquivos padrão, laudos devem ser emitidos até o dia 07 do mês seguinte ao período de referência.`
              });
              totalErros++;
              continue; // Pular este registro
            }
          }
          
          // ✅ ACEITAR DEMAIS REGISTROS - Gravar com periodo_referencia correto
          // CRÍTICO: Remover tipo_faturamento e tipo_cliente do record para evitar tipificação automática
          // Esses campos devem ser aplicados APENAS via "Aplicar Tipificação Geral" manualmente
          const { tipo_faturamento, tipo_cliente, ...recordSemTipificacao } = record as any;
          
          // 🔧 REGRA V030: Normalizar MODALIDADE CR/DX ANTES de inserir no banco
          // Esta correção é aplicada na raiz, evitando que CR/DX sejam gravados incorretamente
          let modalidadeNormalizada = recordSemTipificacao.MODALIDADE;
          
          if (modalidadeNormalizada === 'CR' || modalidadeNormalizada === 'DX') {
            const descricaoExame = (recordSemTipificacao.ESTUDO_DESCRICAO || '').toLowerCase();
            
            // Se é mamografia/tomossíntese → MG, caso contrário → RX
            if (descricaoExame.includes('mamografia') || 
                descricaoExame.includes('mamogra') || 
                descricaoExame.includes('tomossintese') || 
                descricaoExame.includes('tomo de mama') ||
                descricaoExame.includes('tomo mama')) {
              modalidadeNormalizada = 'MG';
              console.log(`🔧 CR/DX → MG (mamografia): ${descricaoExame.substring(0, 40)}...`);
            } else {
              modalidadeNormalizada = 'RX';
            }
          }
          
          // 🔧 REGRA V031: Normalizar MODALIDADE BMD → DO
          if (modalidadeNormalizada === 'BMD') {
            modalidadeNormalizada = 'DO';
          }
          
          const recordToInsert = {
            ...recordSemTipificacao,
            MODALIDADE: modalidadeNormalizada, // Modalidade já normalizada
            tipo_faturamento: null, // Forçar NULL - tipificação é manual
            tipo_cliente: null, // Forçar NULL - tipificação é manual
            periodo_referencia: periodoReferenciaDb,
            arquivo_fonte: arquivo_fonte,
            lote_upload: loteUpload,
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
              // ✅ CORREÇÃO: Usar contagem REAL de registros inseridos (não o tamanho do batch enviado)
              const realInsertCount = insertData?.length || 0;
              totalInseridos += realInsertCount;
              
              // Se houve diferença, registrar como warning
              if (realInsertCount !== batchValidRecords.length) {
                console.warn(`⚠️ Batch ${batchNumber}: Enviados ${batchValidRecords.length}, inseridos ${realInsertCount} (diferença de ${batchValidRecords.length - realInsertCount})`);
              }
              
              console.log(`✅ Batch ${batchNumber} inserido: ${realInsertCount} registros`);
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

      // Salvar rejeições se houver - usando a tabela registros_rejeitados_processamento
      if (registrosRejeitados.length > 0) {
        console.log(`💾 Salvando ${registrosRejeitados.length} registros rejeitados na tabela registros_rejeitados_processamento...`);
        try {
          const rejeicoes = registrosRejeitados.map(r => ({
            arquivo_fonte: arquivo_fonte,
            linha_original: r.linha_original,
            dados_originais: r.dados_originais,
            motivo_rejeicao: r.motivo_rejeicao,
            detalhes_erro: r.detalhes_erro,
            lote_upload: loteUpload,
            created_at: new Date().toISOString()
          }));

          // Inserir rejeições em batches pequenos
          const BATCH_SIZE_REJEICOES = 50;
          for (let i = 0; i < rejeicoes.length; i += BATCH_SIZE_REJEICOES) {
            const batchRejeicoes = rejeicoes.slice(i, i + BATCH_SIZE_REJEICOES);
            
            const { error: insertError } = await supabaseClient
              .from('registros_rejeitados_processamento')
              .insert(batchRejeicoes);
            
            if (insertError) {
              console.error(`❌ Erro ao salvar batch de rejeições:`, insertError);
            } else {
              console.log(`✅ Batch de ${batchRejeicoes.length} rejeições salvo com sucesso`);
            }
          }
          
          console.log(`✅ Total de ${registrosRejeitados.length} registros rejeitados salvos`);
        } catch (saveError) {
          console.error(`❌ Erro ao salvar rejeições:`, saveError);
        }
      }

      // 🎯 SISTEMA AUTOMÁTICO GARANTIDO - TODAS AS 27 REGRAS
      let regrasAplicadas = 0;
      let totalCorrecoes = 0;
      let sistemaSucesso = false;
      
      try {
        console.log(`🚀 APLICAÇÃO AUTOMÁTICA GARANTIDA - Todas as 27 regras para: ${arquivo_fonte}`);
        
        // Usar a nova função que garante aplicação de TODAS as regras
        const { data: sistemaResult } = await supabaseClient.functions.invoke(
          'aplicar-regras-sistema-completo',
          { 
            body: { 
              arquivo_fonte: arquivo_fonte,
              periodo_referencia: periodoReferenciaEdge, // Formato mmm/YY para edge functions
              aplicar_todos_arquivos: false // Aplicar apenas no arquivo atual
            } 
          }
        );
        
        if (sistemaResult && sistemaResult.success) {
          sistemaSucesso = true;
          totalCorrecoes = sistemaResult.total_corrigidos || 0;
          regrasAplicadas = sistemaResult.total_processados || 0;
          
          console.log(`✅ TODAS AS REGRAS APLICADAS AUTOMATICAMENTE:`);
          console.log(`   - Registros processados: ${regrasAplicadas}`);
          console.log(`   - Total de correções aplicadas: ${totalCorrecoes}`);
          console.log(`   - Arquivos processados: ${sistemaResult.status_regras?.length || 0}`);
          
          // Log detalhado por arquivo
          sistemaResult.status_regras?.forEach((regra: any) => {
            console.log(`   📁 ${regra.regra}: ${regra.detalhes?.total_correções || 0} correções`);
          });
          
        } else {
          console.error(`❌ Sistema automático falhou:`, sistemaResult);
        }
        
      } catch (regrasError) {
        console.error(`❌ ERRO CRÍTICO na aplicação automática das regras:`, regrasError);
        sistemaSucesso = false;
      }
      
      // Se falhou, interromper o processamento - dados sem regras aplicadas são inválidos
      if (!sistemaSucesso) {
        throw new Error(`Falha crítica: Regras não puderam ser aplicadas automaticamente em ${arquivo_fonte}. Dados rejeitados por inconsistência.`);
      }

      // ✅ PASSO 2.2: Corrigir exames fora do padrão usando vinculações valores_referencia_de_para
      console.log('\n🎯 === CORREÇÃO EXAMES FORA DO PADRÃO (vinculação) ===');
      try {
        const { data: foraPadraoResult, error: foraPadraoError } = await supabaseClient.functions.invoke(
          'corrigir-volumetria-fora-padrao',
          {
            body: { arquivo_fonte }
          }
        );

        if (foraPadraoError) {
          console.warn('⚠️ Aviso na correção de exames fora do padrão:', foraPadraoError);
        } else if (foraPadraoResult && foraPadraoResult.sucesso) {
          console.log(`✅ Exames fora do padrão corrigidos:`);
          console.log(`   - Registros encontrados: ${foraPadraoResult.registros_encontrados || 0}`);
          console.log(`   - Registros corrigidos: ${foraPadraoResult.registros_corrigidos || 0}`);
          console.log(`   - Sem mapeamento: ${foraPadraoResult.registros_sem_mapeamento || 0}`);
        } else {
          console.log(`ℹ️ Nenhuma correção de exames fora do padrão necessária`);
        }
      } catch (foraPadraoError) {
        console.warn('⚠️ Aviso na correção de exames fora do padrão (não crítico):', foraPadraoError);
      }

      // ✅ PASSO 2.5: Correção específica MAMA → MAMO para modalidade MG
      console.log('\n🎯 === CORREÇÃO MAMA → MAMO (Modalidade MG) ===');
      try {
        const { data: mamaMamoResult, error: mamaMamoError } = await supabaseClient.functions.invoke(
          'corrigir-mama-mamo-retroativo',
          {
            body: { arquivo_fonte }
          }
        );

        if (mamaMamoError) {
          console.warn('⚠️ Aviso na correção MAMA → MAMO:', mamaMamoError);
        } else {
          console.log(`✅ Correção MAMA → MAMO aplicada: ${mamaMamoResult?.total_corrigidos || 0} registros corrigidos`);
        }
      } catch (mamaMamoError) {
        console.warn('⚠️ Aviso na correção MAMA → MAMO (não crítico):', mamaMamoError);
      }

      // ✅ PASSO 2.6: Aplicar quebras automáticas de exames
      console.log('\n🎯 === APLICANDO QUEBRAS AUTOMÁTICAS DE EXAMES ===');
      let quebrasSucesso = true;
      let totalQuebrados = 0;
      try {
        const { data: quebrasResult, error: quebrasError } = await supabaseClient.functions.invoke(
          'aplicar-quebras-automatico',
          {
            body: { lote_upload: loteUpload }
          }
        );

        if (quebrasError) {
          console.error('❌ ERRO ao aplicar quebras:', quebrasError);
          quebrasSucesso = false;
        } else if (quebrasResult && quebrasResult.sucesso) {
          totalQuebrados = quebrasResult.registros_quebrados || 0;
          console.log(`✅ Quebras aplicadas: ${quebrasResult.registros_processados || 0} exames processados, ${totalQuebrados} exames quebrados criados`);
        } else {
          console.log(`ℹ️ Nenhuma quebra necessária ou aplicável`);
        }
      } catch (quebrasError) {
        console.error(`❌ ERRO na aplicação de quebras (não crítico):`, quebrasError);
        quebrasSucesso = false;
      }

      if (!quebrasSucesso) {
        console.warn(`⚠️ Quebras falharam, mas processamento continua`);
      }

      // ✅ PASSO 2.7: Aplicar agrupamento de clientes (CEMVALENCA → CEMVALENCA_RX/PL, DIAGNOSTICA, etc.)
      // CRÍTICO: Deve executar ANTES da tipificação para que os clientes sejam agrupados corretamente
      console.log('\n🎯 === APLICANDO AGRUPAMENTO DE CLIENTES ===');
      let agrupamentoSucesso = true;
      try {
        const { data: agrupamentoResult, error: agrupamentoError } = await supabaseClient.functions.invoke(
          'aplicar-agrupamento-clientes',
          {
            body: {}
          }
        );

        if (agrupamentoError) {
          console.error('❌ ERRO ao aplicar agrupamento:', agrupamentoError);
          agrupamentoSucesso = false;
        } else if (agrupamentoResult && agrupamentoResult.success) {
          console.log(`✅ Agrupamento aplicado:`);
          console.log(`   - Total mapeados: ${agrupamentoResult.total_mapeados || 0}`);
          console.log(`   - DIAGNOSTICA agrupados: ${agrupamentoResult.diagnostica_agrupados || 0}`);
          console.log(`   - CEMVALENCA_RX movidos: ${agrupamentoResult.cemvalenca_rx_movidos || 0}`);
          console.log(`   - CEMVALENCA_PL movidos: ${agrupamentoResult.cemvalenca_pl_movidos || 0}`);
        } else {
          console.log(`ℹ️ Nenhum agrupamento necessário`);
        }
      } catch (agrupamentoError) {
        console.error(`❌ ERRO na aplicação de agrupamento (não crítico):`, agrupamentoError);
        agrupamentoSucesso = false;
      }

      if (!agrupamentoSucesso) {
        console.warn(`⚠️ Agrupamento falhou, mas processamento continua`);
      }

      // ⚠️ PASSO 2.8: Regras v002/v003 DESATIVADAS NO UPLOAD AUTOMÁTICO
      // As regras v002/v003 NÃO devem ser aplicadas automaticamente durante o upload
      // Motivo: Excluem registros baseados no período selecionado, mas a lógica precisa 
      // ser aplicada MANUALMENTE após análise correta do período de faturamento vs período dos dados
      // 
      // Para aplicar manualmente, o usuário deve usar o componente CorrecaoRegrasV002V003
      // ou chamar a edge function aplicar-exclusoes-periodo com o período CORRETO
      let regrasExclusao = 0;
      if (arquivo_fonte.includes('retroativo')) {
        console.log('\n⚠️ === REGRAS v002/v003 NÃO APLICADAS AUTOMATICAMENTE ===');
        console.log(`   📝 Arquivo retroativo detectado: ${arquivo_fonte}`);
        console.log(`   📝 As regras v002/v003 devem ser aplicadas MANUALMENTE`);
        console.log(`   📝 Use "Correção v002/v003" após definir o período de faturamento correto`);
        console.log(`   📝 Período atual salvo nos registros: ${periodoReferenciaDb}`);
      } else {
        console.log('\nℹ️ Regras v002/v003 não aplicáveis (arquivo não é retroativo)');
      }

      // ℹ️ TIPIFICAÇÃO: Removida do pipeline automático
      // A tipificação deve ser aplicada MANUALMENTE pelo usuário via "Aplicar Tipificação Geral"
      // no menu Sistema de Regras após o upload ser concluído
      console.log('\nℹ️ Tipificação NÃO aplicada automaticamente - usar "Aplicar Tipificação Geral" manualmente');

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
            quebras_aplicadas: totalQuebrados,
            arquivo_retroativo: arquivo_fonte.includes('retroativo'),
            debug_info: {
              arquivo_fonte,
              lote_upload,
              periodo_referencia_db: periodoReferenciaDb,
              periodo_referencia_edge: periodoReferenciaEdge
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