import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import * as XLSX from "https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🔄 PROCESSAMENTO DE STAGING SIMPLIFICADO E ROBUSTO
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // VALIDAR REQUEST BODY PRIMEIRO
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (jsonError) {
      console.error('❌ [STAGING] Erro ao fazer parse do JSON:', jsonError);
      throw new Error('Request body inválido - não é JSON válido');
    }

    console.log('📨 [STAGING] Request body recebido:', JSON.stringify(requestBody, null, 2));

    const { file_path, arquivo_fonte, periodo_referencia } = requestBody;
    
    // VALIDAÇÕES OBRIGATÓRIAS
    if (!file_path) {
      throw new Error('ERRO: file_path é obrigatório');
    }
    if (!arquivo_fonte) {
      throw new Error('ERRO: arquivo_fonte é obrigatório');
    }
    if (!periodo_referencia) {
      throw new Error('ERRO: periodo_referencia é obrigatório');
    }
    
    console.log('🔄 [STAGING] Iniciando processamento validado:', {
      file_path,
      arquivo_fonte,
      periodo_referencia
    });

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Registrar início do upload
    const lote_upload = crypto.randomUUID();
    console.log('🆔 [STAGING] Lote gerado:', lote_upload);
    
    const { data: uploadRecord, error: uploadError } = await supabaseClient
      .from('processamento_uploads')
      .insert({
        tipo_arquivo: arquivo_fonte,
        arquivo_nome: file_path.split('/').pop(),
        status: 'processando',
        periodo_referencia: periodo_referencia,
        detalhes_erro: {
          lote_upload: lote_upload,
          etapa: 'staging',
          inicio: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (uploadError) {
      console.error('❌ [STAGING] Erro ao registrar upload:', uploadError);
      throw uploadError;
    }

    console.log('📝 [STAGING] Upload registrado:', uploadRecord.id);

    // 2. Baixar arquivo do storage
    console.log('📥 [STAGING] Baixando arquivo do storage:', file_path);
    
    // Verificar se o bucket existe e o arquivo está acessível
    const { data: buckets, error: bucketsError } = await supabaseClient.storage.listBuckets();
    console.log('🪣 [STAGING] Buckets disponíveis:', buckets?.map(b => b.name));
    
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('uploads')
      .download(file_path);

    if (downloadError || !fileData) {
      console.error('❌ [STAGING] Erro ao baixar arquivo:', {
        error: downloadError,
        file_path: file_path,
        hasFileData: !!fileData
      });
      
      // Listar arquivos no bucket para debug
      try {
        const { data: files } = await supabaseClient.storage
          .from('uploads')
          .list('volumetria_uploads', { limit: 10 });
        console.log('📁 [STAGING] Arquivos no bucket:', files?.map(f => f.name).slice(0, 5));
      } catch (listError) {
        console.error('❌ [STAGING] Erro ao listar arquivos:', listError);
      }
      
      await supabaseClient
        .from('processamento_uploads')
        .update({
          status: 'erro',
          detalhes_erro: { 
            etapa: 'staging', 
            erro: 'Erro ao baixar arquivo do storage', 
            erro_detalhes: downloadError,
            file_path: file_path,
            timestamp: new Date().toISOString()
          },
          completed_at: new Date().toISOString()
        })
        .eq('id', uploadRecord.id);
      throw new Error(`Arquivo não encontrado no storage: ${file_path}`);
    }

    console.log('✅ [STAGING] Arquivo baixado com sucesso');

    // 3. Processar Excel de forma robusta
    console.log('📊 [STAGING] Processando arquivo Excel...');
    
    let totalLinhas = 0;
    let totalInseridos = 0;
    let totalErros = 0;
    
    try {
      const arrayBuffer = await fileData.arrayBuffer();
      const fileSizeKB = Math.round(arrayBuffer.byteLength / 1024);
      console.log(`📏 [STAGING] Tamanho do arquivo: ${fileSizeKB} KB`);
      
      // Ler Excel com configurações básicas
      console.log('📖 [STAGING] Lendo workbook...');
      const workbook = XLSX.read(arrayBuffer, { 
        type: 'array',
        cellDates: false, // Evitar conversão automática de datas
        cellNF: false,
        cellHTML: false,
        dense: false
      });
      
      if (!workbook.SheetNames.length) {
        throw new Error('Arquivo Excel sem planilhas');
      }
      
      console.log('📋 [STAGING] Planilhas encontradas:', workbook.SheetNames);
      
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!worksheet) {
        throw new Error('Primeira planilha não encontrada');
      }
      
      // Converter para JSON
      console.log('🔄 [STAGING] Convertendo planilha para JSON...');
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        defval: '', // Usar string vazia para valores indefinidos
        blankrows: false,
        skipHidden: false,
        raw: false // Não usar valores raw para evitar problemas de formato
      });
      
      totalLinhas = jsonData.length;
      console.log(`📋 [STAGING] ${totalLinhas} registros encontrados no Excel`);
      
      if (totalLinhas === 0) {
        throw new Error('Planilha não contém dados');
      }
      
      // Verificar colunas essenciais
      const firstRow = jsonData[0] as any;
      const colunas = Object.keys(firstRow);
      console.log('📄 [STAGING] Colunas detectadas:', colunas.slice(0, 5), '... total:', colunas.length);
      
      const colunasEssenciais = ['EMPRESA', 'NOME_PACIENTE'];
      const colunasPresentes = colunasEssenciais.filter(col => colunas.includes(col));
      
      if (colunasPresentes.length !== colunasEssenciais.length) {
        throw new Error(`Colunas essenciais faltando: ${colunasEssenciais.filter(c => !colunas.includes(c))}`);
      }
      
      console.log('✅ [STAGING] Colunas essenciais verificadas');
      
      // 4. Processar em lotes pequenos
      const BATCH_SIZE = 50;
      let loteAtual = 1;
      const totalLotes = Math.ceil(totalLinhas / BATCH_SIZE);
      
      console.log(`📦 [STAGING] Processando em ${totalLotes} lotes de ${BATCH_SIZE} registros cada`);

      for (let i = 0; i < jsonData.length; i += BATCH_SIZE) {
        const batch = jsonData.slice(i, i + BATCH_SIZE);
        
        console.log(`📦 [STAGING] Lote ${loteAtual}/${totalLotes} - ${batch.length} registros`);
        
        const stagingRecords: any[] = [];

        // Mapear dados do lote
        for (let j = 0; j < batch.length; j++) {
          const row = batch[j] as any;
          
          try {
            const empresa = String(row['EMPRESA'] || '').trim();
            const nomePaciente = String(row['NOME_PACIENTE'] || '').trim();

            // Log detalhado para debug
            if (j === 0) {
              console.log(`🔍 [STAGING] Exemplo primeiro registro do lote ${loteAtual}:`, {
                EMPRESA: empresa,
                NOME_PACIENTE: nomePaciente,
                ESTUDO_DESCRICAO: String(row['ESTUDO_DESCRICAO'] || '').substring(0, 20) + '...',
                VALORES: row['VALORES']
              });
            }

            // Validações básicas
            if (!empresa || !nomePaciente) {
              console.log(`⚠️ [STAGING] Registro ${i+j+1} inválido: empresa="${empresa}" paciente="${nomePaciente}"`);
              totalErros++;
              continue;
            }

            // Excluir clientes com "_local"
            if (empresa.toLowerCase().includes('_local')) {
              totalErros++;
              continue;
            }

            const record = {
              EMPRESA: empresa,
              NOME_PACIENTE: nomePaciente,
              CODIGO_PACIENTE: String(row['CODIGO_PACIENTE'] || '').trim() || null,
              ESTUDO_DESCRICAO: String(row['ESTUDO_DESCRICAO'] || '').trim() || null,
              ACCESSION_NUMBER: String(row['ACCESSION_NUMBER'] || '').trim() || null,
              MODALIDADE: String(row['MODALIDADE'] || '').trim() || null,
              PRIORIDADE: String(row['PRIORIDADE'] || '').trim() || null,
              VALORES: Number(row['VALORES']) || 0,
              ESPECIALIDADE: String(row['ESPECIALIDADE'] || '').trim() || null,
              MEDICO: String(row['MEDICO'] || '').trim() || null,
              DUPLICADO: String(row['DUPLICADO'] || '').trim() || null,
              DATA_REALIZACAO: row['DATA_REALIZACAO'] || null,
              HORA_REALIZACAO: row['HORA_REALIZACAO'] || null,
              DATA_TRANSFERENCIA: row['DATA_TRANSFERENCIA'] || null,
              HORA_TRANSFERENCIA: row['HORA_TRANSFERENCIA'] || null,
              DATA_LAUDO: row['DATA_LAUDO'] || null,
              HORA_LAUDO: row['HORA_LAUDO'] || null,
              DATA_PRAZO: row['DATA_PRAZO'] || null,
              HORA_PRAZO: row['HORA_PRAZO'] || null,
              STATUS: String(row['STATUS'] || '').trim() || null,
              DATA_REASSINATURA: row['DATA_REASSINATURA'] || null,
              HORA_REASSINATURA: row['HORA_REASSINATURA'] || null,
              MEDICO_REASSINATURA: String(row['MEDICO_REASSINATURA'] || '').trim() || null,
              SEGUNDA_ASSINATURA: String(row['SEGUNDA_ASSINATURA'] || '').trim() || null,
              POSSUI_IMAGENS_CHAVE: String(row['POSSUI_IMAGENS_CHAVE'] || '').trim() || null,
              IMAGENS_CHAVES: row['IMAGENS_CHAVES'] || null,
              IMAGENS_CAPTURADAS: row['IMAGENS_CAPTURADAS'] || null,
              CODIGO_INTERNO: row['CODIGO_INTERNO'] || null,
              DIGITADOR: String(row['DIGITADOR'] || '').trim() || null,
              COMPLEMENTAR: String(row['COMPLEMENTAR'] || '').trim() || null,
              CATEGORIA: String(row['CATEGORIA'] || '').trim() || null,
              tipo_faturamento: String(row['TIPO_FATURAMENTO'] || '').trim() || null,
              periodo_referencia: periodo_referencia,
              arquivo_fonte: arquivo_fonte,
              lote_upload: lote_upload,
              status_processamento: 'pendente'
            };

            stagingRecords.push(record);
          } catch (error) {
            console.error(`⚠️ [STAGING] Erro ao mapear registro ${i+j+1}:`, error);
            totalErros++;
          }
        }

        // Inserir lote na tabela staging
        console.log(`💾 [STAGING] Inserindo lote ${loteAtual} com ${stagingRecords.length} registros...`);
        
        if (stagingRecords.length > 0) {
          const { error: insertError, count } = await supabaseClient
            .from('volumetria_staging')
            .insert(stagingRecords);

          if (insertError) {
            console.error('❌ [STAGING] Erro ao inserir lote:', insertError);
            console.error('❌ [STAGING] Detalhes do erro:', JSON.stringify(insertError));
            
            // Tentar inserir registros individuais para identificar problema
            let sucessosIndividuais = 0;
            for (let k = 0; k < stagingRecords.length; k++) {
              try {
                await supabaseClient
                  .from('volumetria_staging')
                  .insert([stagingRecords[k]]);
                sucessosIndividuais++;
              } catch (individualError) {
                if (k < 3) { // Log apenas os 3 primeiros erros
                  console.error(`❌ [STAGING] Erro individual registro ${k+1}:`, individualError);
                }
                totalErros++;
              }
            }
            
            totalInseridos += sucessosIndividuais;
            console.log(`⚠️ [STAGING] Inserção individual: ${sucessosIndividuais}/${stagingRecords.length} sucessos`);
            
          } else {
            totalInseridos += stagingRecords.length;
            console.log(`✅ [STAGING] Lote ${loteAtual} inserido: ${stagingRecords.length} registros`);
          }
        } else {
          console.log(`⚠️ [STAGING] Lote ${loteAtual} vazio após validações`);
        }
        
        loteAtual++;
        
        // Pausa entre lotes para não sobrecarregar
        if (loteAtual % 3 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
    } catch (error) {
      console.error('❌ [STAGING] Erro ao processar Excel:', error);
      console.error('❌ [STAGING] Stack:', error.stack);
      
      await supabaseClient
        .from('processamento_uploads')
        .update({
          status: 'erro',
          detalhes_erro: { 
            etapa: 'staging', 
            erro: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
          },
          completed_at: new Date().toISOString()
        })
        .eq('id', uploadRecord.id);
      throw error;
    }

    console.log(`📊 [STAGING] RESUMO: ${totalLinhas} linhas → ${totalInseridos} inseridos, ${totalErros} erros`);

    // 5. Verificar se realmente inseriu dados no staging
    const { data: stagingCheck, count: stagingCount } = await supabaseClient
      .from('volumetria_staging')
      .select('*', { count: 'exact' })
      .eq('lote_upload', lote_upload);

    console.log(`🔍 [STAGING] Verificação final: ${stagingCount || 0} registros no staging`);
    
    if (!stagingCount || stagingCount === 0) {
      throw new Error(`CRÍTICO: Nenhum registro foi inserido no staging! Esperado: ${totalInseridos}`);
    }

    // 6. Atualizar status final
    await supabaseClient
      .from('processamento_uploads')
      .update({
        status: 'staging_concluido',
        registros_processados: totalLinhas,
        registros_inseridos: totalInseridos,
        registros_erro: totalErros,
        detalhes_erro: {
          etapa: 'staging_completo',
          registros_excel: totalLinhas,
          registros_staging: stagingCount,
          registros_erro: totalErros,
          lote_upload: lote_upload,
          verificacao_final: 'ok',
          concluido_em: new Date().toISOString()
        }
      })
      .eq('id', uploadRecord.id);

    const resultado = {
      success: true,
      message: `Staging processado: ${totalInseridos} registros`,
      upload_id: uploadRecord.id,
      lote_upload: lote_upload,
      registros_excel: totalLinhas,
      registros_inseridos_staging: stagingCount,
      registros_erro_staging: totalErros
    };

    console.log('✅ [STAGING] Processamento concluído com sucesso:', resultado);

    return new Response(
      JSON.stringify(resultado),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 [STAGING] Erro crítico final:', error);
    console.error('💥 [STAGING] Tipo do erro:', typeof error);
    console.error('💥 [STAGING] Message:', error.message);
    console.error('💥 [STAGING] Stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        error_type: typeof error,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})