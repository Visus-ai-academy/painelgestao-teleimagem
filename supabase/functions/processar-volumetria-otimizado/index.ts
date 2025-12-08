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
          
          // 🚫 EXCLUIR REGISTROS COM MODALIDADE "US" - Exames não realizados/não faturados
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
          
          // ✅ ACEITAR DEMAIS REGISTROS - Gravar com periodo_referencia correto
          const recordToInsert = {
            ...record,
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

      // ✅ PASSO 3: Aplicar tipificação de faturamento
      console.log('\n🎯 === APLICANDO TIPIFICAÇÃO DE FATURAMENTO ===');
      let tipificacaoSucesso = true;
      try {
        const { data: tipificacaoResult, error: tipificacaoError } = await supabaseClient.functions.invoke(
          'aplicar-tipificacao-faturamento',
          {
            body: {
              arquivo_fonte,
              lote_upload: loteUpload
            }
          }
        );

        if (tipificacaoError) {
          console.error('❌ ERRO ao aplicar tipificação:', tipificacaoError);
          tipificacaoSucesso = false;
        } else {
          console.log(`✅ Tipificação aplicada:`, tipificacaoResult);
        }
      } catch (tipificacaoError) {
        console.error(`❌ ERRO CRÍTICO na aplicação de tipificação:`, tipificacaoError);
        tipificacaoSucesso = false;
      }

      if (!tipificacaoSucesso) {
        console.warn(`⚠️ Tipificação falhou, mas processamento continua`);
      }

      // Variável para compatibilidade com código existente
      const regrasExclusao = sistemaSucesso ? totalCorrecoes : 0;

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