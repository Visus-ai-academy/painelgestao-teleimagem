import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import * as XLSX from "https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🚀 PROCESSAMENTO COMPLETO COM REGRAS - OTIMIZADO PARA EVITAR MEMORY LIMIT
serve(async (req) => {
  console.log('📊 [EXCEL+REGRAS] Função iniciada - método:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_path, arquivo_fonte, periodo_referencia } = await req.json();
    
    console.log('📊 [EXCEL+REGRAS] Processamento completo iniciado:', { file_path, arquivo_fonte });

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Registrar upload
    const lote_upload = crypto.randomUUID();
    const arquivoNome = file_path.includes('/') ? file_path.split('/').pop() : file_path;
    
    const { data: uploadRecord, error: uploadError } = await supabaseClient
      .from('processamento_uploads')
      .insert({
        tipo_arquivo: arquivo_fonte,
        arquivo_nome: arquivoNome || 'arquivo.xlsx',
        status: 'processando',
        periodo_referencia: periodo_referencia || 'jun/25',
        detalhes_erro: { lote_upload, etapa: 'excel_com_regras', inicio: new Date().toISOString() }
      })
      .select()
      .single();

    if (uploadError) {
      console.error('❌ [EXCEL+REGRAS] Erro ao registrar upload:', uploadError);
      throw uploadError;
    }
    console.log('✅ [EXCEL+REGRAS] Upload registrado:', uploadRecord.id);

    // 2. Download e processamento do arquivo Excel
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('uploads')
      .download(file_path);

    if (downloadError || !fileData) {
      console.error('❌ [EXCEL+REGRAS] Erro no download:', downloadError);
      throw new Error(`Arquivo não encontrado: ${file_path}`);
    }

    console.log('✅ [EXCEL+REGRAS] Arquivo baixado com sucesso');

    // 3. PROCESSAMENTO EXCEL OTIMIZADO
    const arrayBuffer = await fileData.arrayBuffer();
    const fileSizeKB = Math.round(arrayBuffer.byteLength / 1024);
    console.log(`📊 [EXCEL+REGRAS] Processando ${fileSizeKB}KB com regras`);
    
    // Configuração ultra-leve para evitar memory limit
    const workbook = XLSX.read(arrayBuffer, { 
      type: 'array',
      cellDates: false,
      cellNF: false,
      cellHTML: false,
      dense: true,
      sheetStubs: false,
      bookVBA: false,
      bookSheets: false,
      bookProps: false,
      raw: false
    });
    
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    
    // Converter para JSON em chunks pequenos
    const CHUNK_SIZE = 50; // Reduzido para 50 linhas por vez
    let totalProcessados = 0;
    let totalInseridos = 0;
    let totalExcluidos = 0;
    let regrasAplicadas = 0;
    let currentRow = 1; // Pular header
    
    console.log('🔄 [EXCEL+REGRAS] Iniciando processamento em chunks de 50 linhas');
    
    while (true) {
      // Forçar garbage collection
      if (globalThis.gc) globalThis.gc();
      
      // Ler chunk
      const range = `A${currentRow + 1}:Z${currentRow + CHUNK_SIZE}`;
      
      let chunkData;
      try {
        chunkData = XLSX.utils.sheet_to_json(worksheet, { 
          defval: '',
          blankrows: false,
          raw: false,
          range: range
        });
      } catch (err) {
        console.log('📋 [EXCEL+REGRAS] Fim dos dados ou erro na leitura:', err.message);
        break;
      }
      
      if (!chunkData || chunkData.length === 0) {
        console.log('📋 [EXCEL+REGRAS] Chunk vazio, finalizando processamento');
        break;
      }
      
      console.log(`📦 [EXCEL+REGRAS] Processando chunk: ${chunkData.length} linhas`);
      
      // 4. APLICAR REGRAS DURANTE O PROCESSAMENTO
      const registrosProcessados = [];
      
      for (const row of chunkData) {
        try {
          totalProcessados++;
          
          let empresa = String(row['EMPRESA'] || '').trim();
          let nomePaciente = String(row['NOME_PACIENTE'] || '').trim();
          let modalidade = String(row['MODALIDADE'] || '').trim();
          let especialidade = String(row['ESPECIALIDADE'] || '').trim();
          let medico = String(row['MEDICO'] || '').trim();
          let prioridade = String(row['PRIORIDADE'] || '').trim();
          let categoria = String(row['CATEGORIA'] || '').trim();
          let valores = Number(row['VALORES']) || 0;
          
          // Validações básicas
          if (!empresa || !nomePaciente) {
            totalExcluidos++;
            continue;
          }
          
          // REGRA: Limpeza de nome do cliente
          const empresaOriginal = empresa;
          if (empresa === 'CEDI-RJ' || empresa === 'CEDI-RO' || empresa === 'CEDI-UNIMED') {
            empresa = 'CEDIDIAG';
            regrasAplicadas++;
          }
          
          // REGRA: Correção de modalidade
          if (modalidade === 'CR' || modalidade === 'DX') {
            modalidade = 'RX';
            regrasAplicadas++;
          }
          if (modalidade === 'OT') {
            modalidade = 'DO';
            regrasAplicadas++;
          }
          
          // REGRA: Normalização do médico
          if (medico) {
            const medicoOriginal = medico;
            medico = medico.replace(/\s*\([^)]*\)\s*/g, '') // Remover códigos (E1), (E2)
                          .replace(/^DR[A]?\s+/i, '') // Remover DR/DRA
                          .replace(/\.$/, '') // Remover ponto final
                          .trim();
            if (medico !== medicoOriginal) regrasAplicadas++;
          }
          
          // REGRA: Categoria padrão se vazia
          if (!categoria || categoria === '') {
            categoria = 'SC';
            regrasAplicadas++;
          }
          
          // REGRA: De-para de prioridades (urgência/urgencia -> urgencia)
          if (prioridade.toLowerCase() === 'urgência') {
            prioridade = 'urgencia';
            regrasAplicadas++;
          }
          
          // REGRA: Tipificação de faturamento
          let tipoFaturamento = 'padrao';
          if (categoria.toLowerCase().includes('onco')) {
            tipoFaturamento = 'oncologia';
            regrasAplicadas++;
          } else if (prioridade.toLowerCase() === 'urgencia') {
            tipoFaturamento = 'urgencia';
            regrasAplicadas++;
          } else if (['CT', 'MR'].includes(modalidade)) {
            tipoFaturamento = 'alta_complexidade';
            regrasAplicadas++;
          }
          
          // Criar registro processado
          registrosProcessados.push({
            id: crypto.randomUUID(),
            "EMPRESA": empresa.substring(0, 100),
            "NOME_PACIENTE": nomePaciente.substring(0, 100),
            "CODIGO_PACIENTE": String(row['CODIGO_PACIENTE'] || '').substring(0, 50) || null,
            "ESTUDO_DESCRICAO": String(row['ESTUDO_DESCRICAO'] || '').substring(0, 200) || null,
            "ACCESSION_NUMBER": String(row['ACCESSION_NUMBER'] || '').substring(0, 50) || null,
            "MODALIDADE": modalidade.substring(0, 10),
            "PRIORIDADE": prioridade.substring(0, 20),
            "VALORES": valores,
            "ESPECIALIDADE": especialidade.substring(0, 50) || null,
            "MEDICO": medico ? medico.substring(0, 100) : null,
            "DUPLICADO": false,
            "DATA_REALIZACAO": row['DATA_REALIZACAO'] ? String(row['DATA_REALIZACAO']).substring(0, 10) : null,
            "HORA_REALIZACAO": row['HORA_REALIZACAO'] ? String(row['HORA_REALIZACAO']).substring(0, 8) : null,
            "DATA_LAUDO": row['DATA_LAUDO'] ? String(row['DATA_LAUDO']).substring(0, 10) : null,
            "HORA_LAUDO": row['HORA_LAUDO'] ? String(row['HORA_LAUDO']).substring(0, 8) : null,
            "DATA_PRAZO": row['DATA_PRAZO'] ? String(row['DATA_PRAZO']).substring(0, 10) : null,
            "HORA_PRAZO": row['HORA_PRAZO'] ? String(row['HORA_PRAZO']).substring(0, 8) : null,
            "STATUS": String(row['STATUS'] || 'PROCESSADO').substring(0, 20),
            data_referencia: new Date().toISOString().split('T')[0],
            arquivo_fonte: arquivo_fonte,
            lote_upload: lote_upload,
            periodo_referencia: periodo_referencia || 'jun/25',
            "CATEGORIA": categoria.substring(0, 10),
            tipo_faturamento: tipoFaturamento,
            processamento_pendente: false
          });
          
        } catch (rowError) {
          console.error('❌ [EXCEL+REGRAS] Erro na linha:', rowError);
          totalExcluidos++;
        }
      }
      
      // 5. Inserir registros processados em lotes de 10
      for (let i = 0; i < registrosProcessados.length; i += 10) {
        const lote = registrosProcessados.slice(i, i + 10);
        
        try {
          await supabaseClient
            .from('volumetria_mobilemed')
            .insert(lote);
          totalInseridos += lote.length;
          console.log(`✅ [EXCEL+REGRAS] Lote inserido: ${lote.length} registros`);
        } catch (insertError) {
          console.error(`❌ [EXCEL+REGRAS] Erro na inserção:`, insertError);
          totalExcluidos += lote.length;
        }
        
        // Pausa entre inserções
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      
      currentRow += CHUNK_SIZE;
      
      // Log de progresso
      if (currentRow % 200 === 0) {
        console.log(`📊 [EXCEL+REGRAS] Progresso: ${totalInseridos} inseridos, ${regrasAplicadas} regras aplicadas`);
      }
      
      // Pausa entre chunks
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`📊 [EXCEL+REGRAS] FINAL: ${totalInseridos} inseridos, ${totalExcluidos} excluídos, ${regrasAplicadas} regras aplicadas`);

    // 6. Finalizar upload
    await supabaseClient
      .from('processamento_uploads')
      .update({
        status: 'concluido',
        registros_processados: totalProcessados,
        registros_inseridos: totalInseridos,
        registros_atualizados: 0,
        registros_erro: totalExcluidos,
        completed_at: new Date().toISOString(),
        detalhes_erro: {
          etapa: 'excel_com_regras_completo',
          lote_upload: lote_upload,
          regras_aplicadas: regrasAplicadas,
          concluido_em: new Date().toISOString()
        }
      })
      .eq('id', uploadRecord.id);

    const resultado = {
      success: true,
      message: `Excel processado: ${totalInseridos} registros com ${regrasAplicadas} regras aplicadas`,
      upload_id: uploadRecord.id,
      stats: {
        inserted_count: totalInseridos,
        total_rows: totalProcessados,
        error_count: totalExcluidos,
        regras_aplicadas: regrasAplicadas
      },
      processamento_completo_com_regras: true
    };

    console.log('✅ [EXCEL+REGRAS] Concluído com sucesso:', resultado);

    return new Response(
      JSON.stringify(resultado),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 [EXCEL+REGRAS] Erro crítico:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        processamento_completo_com_regras: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});