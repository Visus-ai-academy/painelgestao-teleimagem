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

    const { file_path, arquivo_fonte, periodo_referencia, test } = requestBody;
    
    console.log('🔍 [STAGING] Valores extraídos do request:', {
      file_path: file_path,
      file_path_type: typeof file_path,
      arquivo_fonte: arquivo_fonte,
      periodo_referencia: periodo_referencia,
      test: test
    });
    
    // Se for teste, retornar resposta de teste
    if (test === true) {
      console.log('🧪 [STAGING] Chamada de teste recebida - retornando sucesso');
      return new Response(
        JSON.stringify({ success: true, test: true, message: 'Função staging operacional' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // VALIDAÇÕES CRÍTICAS para processamento real
    if (!file_path || typeof file_path !== 'string' || file_path.trim() === '') {
      console.error('❌ [STAGING] file_path inválido:', { file_path, type: typeof file_path, requestBody });
      throw new Error('ERRO CRÍTICO: file_path obrigatório, deve ser string não-vazia');
    }
    if (!arquivo_fonte || arquivo_fonte.trim() === '') {
      console.error('❌ [STAGING] arquivo_fonte inválido:', { arquivo_fonte });
      throw new Error('ERRO CRÍTICO: arquivo_fonte obrigatório');
    }
    if (!periodo_referencia || periodo_referencia.trim() === '') {
      console.error('❌ [STAGING] periodo_referencia inválido:', { periodo_referencia });
      throw new Error('ERRO CRÍTICO: periodo_referencia obrigatório');
    }
    
    // Validar se file_path tem formato correto
    if (typeof file_path !== 'string' || file_path.length === 0) {
      throw new Error('ERRO: file_path deve ser uma string válida');
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
    
    // Extrair nome do arquivo de forma segura
    const arquivoNome = file_path.includes('/') ? file_path.split('/').pop() : file_path;
    console.log('📁 [STAGING] Nome do arquivo extraído:', arquivoNome);
    
    const { data: uploadRecord, error: uploadError } = await supabaseClient
      .from('processamento_uploads')
      .insert({
        tipo_arquivo: arquivo_fonte,
        arquivo_nome: arquivoNome || 'arquivo_desconhecido.xlsx',
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
      
      // Ler Excel com configurações ultra-leves para arquivos grandes
      console.log('📖 [STAGING] Lendo workbook com configurações otimizadas...');
      const workbook = XLSX.read(arrayBuffer, { 
        type: 'array',
        cellDates: false, // Evitar conversão automática de datas
        cellNF: false,
        cellHTML: false,
        dense: true, // Formato denso para economizar memória
        sheetStubs: false, // Não processar células vazias
        bookVBA: false, // Ignorar macros VBA
        bookSheets: false, // Não carregar metadados das sheets
        bookProps: false, // Não carregar propriedades do arquivo
        raw: false // Não usar valores raw
      });
      
      if (!workbook.SheetNames.length) {
        throw new Error('Arquivo Excel sem planilhas');
      }
      
      console.log('📋 [STAGING] Planilhas encontradas:', workbook.SheetNames);
      
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!worksheet) {
        throw new Error('Primeira planilha não encontrada');
      }
      
      // Para arquivos muito grandes, limitar o processamento
      const MAX_ROWS = fileSizeKB > 8000 ? 3000 : (fileSizeKB > 5000 ? 10000 : 50000);
      
      // Converter para JSON com otimizações
      console.log('🔄 [STAGING] Convertendo planilha para JSON...');
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        defval: '', // Usar string vazia para valores indefinidos
        blankrows: false,
        skipHidden: false,
        raw: false, // Não usar valores raw para evitar problemas de formato
        range: MAX_ROWS < 50000 ? `A1:Z${MAX_ROWS}` : undefined // Limitar range se necessário
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
      
      // 4. Processar em MICRO-LOTES para arquivos grandes
      const BATCH_SIZE = fileSizeKB > 8000 ? 10 : (fileSizeKB > 5000 ? 20 : 30);
      let loteAtual = 1;
      const totalLotes = Math.ceil(totalLinhas / BATCH_SIZE);
      
      console.log(`📦 [STAGING] Processando em ${totalLotes} micro-lotes de ${BATCH_SIZE} registros cada (otimizado para ${fileSizeKB}KB)`);

      for (let i = 0; i < jsonData.length; i += BATCH_SIZE) {
        const batch = jsonData.slice(i, i + BATCH_SIZE);
        
        console.log(`📦 [STAGING] Lote ${loteAtual}/${totalLotes} - ${batch.length} registros`);
        
        const stagingRecords: any[] = [];

        // Mapear dados do lote com campos reduzidos para economizar memória
        for (let j = 0; j < batch.length; j++) {
          const row = batch[j] as any;
          
          try {
            const empresa = String(row['EMPRESA'] || '').trim().substring(0, 100);
            const nomePaciente = String(row['NOME_PACIENTE'] || '').trim().substring(0, 100);

            // Validações básicas
            if (!empresa || !nomePaciente) {
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
              CODIGO_PACIENTE: String(row['CODIGO_PACIENTE'] || '').substring(0, 50) || null,
              ESTUDO_DESCRICAO: String(row['ESTUDO_DESCRICAO'] || '').substring(0, 100) || null,
              MODALIDADE: String(row['MODALIDADE'] || '').substring(0, 10) || null,
              VALORES: Number(row['VALORES']) || 0,
              ESPECIALIDADE: String(row['ESPECIALIDADE'] || '').substring(0, 50) || null,
              MEDICO: String(row['MEDICO'] || '').substring(0, 100) || null,
              periodo_referencia: periodo_referencia,
              arquivo_fonte: arquivo_fonte,
              lote_upload: lote_upload,
              status_processamento: 'pendente'
            };

            stagingRecords.push(record);
          } catch (error) {
            totalErros++;
          }
        }

        // Inserir micro-lote na tabela staging
        if (stagingRecords.length > 0) {
          try {
            await supabaseClient
              .from('volumetria_staging')
              .insert(stagingRecords);
            
            totalInseridos += stagingRecords.length;
            console.log(`✅ [STAGING] Lote ${loteAtual} inserido: ${stagingRecords.length} registros`);
          } catch (insertError) {
            console.error('❌ [STAGING] Erro ao inserir lote:', insertError);
            totalErros += stagingRecords.length;
          }
        }
        
        loteAtual++;
        
        // Pausa e garbage collection mais agressivos
        if (loteAtual % 3 === 0) {
          if (globalThis.gc) globalThis.gc(); // Forçar garbage collection se disponível
          await new Promise(resolve => setTimeout(resolve, 150));
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