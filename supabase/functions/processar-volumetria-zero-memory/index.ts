import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🚀 PROCESSAMENTO ZERO-MEMÓRIA - APENAS MARCA PARA PROCESSAMENTO OFFLINE
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_path, arquivo_fonte, periodo_referencia } = await req.json();
    
    if (!file_path || !arquivo_fonte) {
      throw new Error('file_path e arquivo_fonte obrigatórios');
    }
    
    console.log('🎯 [ZERO-MEMORY] Processamento zero-memória iniciado:', { file_path, arquivo_fonte });

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
        detalhes_erro: { lote_upload, etapa: 'zero_memory', inicio: new Date().toISOString() }
      })
      .select()
      .single();

    if (uploadError) throw uploadError;
    console.log('✅ [ZERO-MEMORY] Upload registrado:', uploadRecord.id);

    // 2. Verificar se o arquivo existe no storage
    const { data: fileExists } = await supabaseClient.storage
      .from('uploads')
      .list('volumetria_uploads');

    const arquivoEncontrado = fileExists?.find(f => f.name === arquivoNome);
    
    if (!arquivoEncontrado) {
      await supabaseClient
        .from('processamento_uploads')
        .update({
          status: 'erro',
          detalhes_erro: { etapa: 'arquivo_nao_encontrado', erro: 'Arquivo não encontrado no storage' },
          completed_at: new Date().toISOString()
        })
        .eq('id', uploadRecord.id);
      throw new Error(`Arquivo não encontrado: ${file_path}`);
    }

    console.log('✅ [ZERO-MEMORY] Arquivo encontrado no storage');

    // 3. ZERO-MEMORY: Apenas criar registros indicativos para processamento offline
    const tamanhoKB = Math.round((arquivoEncontrado.metadata?.size || 0) / 1024);
    console.log(`📊 [ZERO-MEMORY] Arquivo ${tamanhoKB}KB - marcando para processamento offline`);
    
    // Criar registros de placeholder no staging
    const placeholderRecords = [];
    const numPlaceholders = Math.max(1, Math.floor(tamanhoKB / 100)); // 1 placeholder por 100KB
    
    for (let i = 0; i < numPlaceholders; i++) {
      placeholderRecords.push({
        EMPRESA: `PROCESSAMENTO_OFFLINE_${i + 1}`,
        NOME_PACIENTE: `Placeholder_${arquivoNome}_${i + 1}`,
        CODIGO_PACIENTE: `OFFLINE_${i + 1}`,
        ESTUDO_DESCRICAO: `Arquivo: ${arquivoNome} (${tamanhoKB}KB)`,
        MODALIDADE: 'OFFLINE',
        VALORES: 0,
        ESPECIALIDADE: 'AGUARDANDO_PROCESSAMENTO_OFFLINE',
        MEDICO: 'SISTEMA_PLACEHOLDER',
        periodo_referencia: periodo_referencia || 'jun/25',
        arquivo_fonte: arquivo_fonte,
        lote_upload: lote_upload,
        status_processamento: 'aguardando_processamento_offline'
      });
    }
    
    let totalInseridos = 0;
    let totalErros = 0;
    
    // Inserir placeholders (sem usar memória para Excel)
    try {
      await supabaseClient
        .from('volumetria_staging')
        .insert(placeholderRecords);
      totalInseridos = placeholderRecords.length;
      console.log(`✅ [ZERO-MEMORY] ${totalInseridos} placeholders criados`);
    } catch (insertError) {
      console.error('❌ [ZERO-MEMORY] Erro ao inserir placeholders:', insertError);
      totalErros = placeholderRecords.length;
    }

    // 4. Finalizar upload com status especial
    await supabaseClient
      .from('processamento_uploads')
      .update({
        status: 'aguardando_processamento_offline',
        registros_processados: totalInseridos,
        registros_inseridos: totalInseridos,
        registros_erro: totalErros,
        detalhes_erro: {
          etapa: 'zero_memory_completo',
          lote_upload: lote_upload,
          tamanho_kb: tamanhoKB,
          placeholders_criados: totalInseridos,
          arquivo_storage_path: file_path,
          requer_processamento_offline: true,
          concluido_em: new Date().toISOString()
        }
      })
      .eq('id', uploadRecord.id);

    const resultado = {
      success: true,
      message: `Arquivo marcado para processamento offline (${totalInseridos} placeholders)`,
      upload_id: uploadRecord.id,
      lote_upload: lote_upload,
      registros_inseridos_staging: totalInseridos,
      registros_erro_staging: totalErros,
      zero_memory: true,
      requer_processamento_offline: true,
      arquivo_storage_path: file_path
    };

    console.log('✅ [ZERO-MEMORY] Concluído:', resultado);

    return new Response(
      JSON.stringify(resultado),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 [ZERO-MEMORY] Erro:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString(),
        zero_memory: true
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});