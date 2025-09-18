import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🧹 Limpando uploads travados...');

    // Limpar uploads que estão em "processing" há mais de 10 minutos
    const cutoffTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    // Primeiro limpar upload_logs
    const { data: uplogsAntigos, error: selectUplogsError } = await supabaseClient
      .from('upload_logs')
      .select('*')
      .eq('status', 'processing')
      .lt('created_at', cutoffTime);

    if (uplogsAntigos && uplogsAntigos.length > 0) {
      const { error: updateUplogsError } = await supabaseClient
        .from('upload_logs')
        .update({
          status: 'failed',
          error_message: 'Upload travado - limpeza automática após timeout'
        })
        .eq('status', 'processing')
        .lt('created_at', cutoffTime);

      if (updateUplogsError) {
        console.error('❌ Erro ao atualizar upload_logs:', updateUplogsError);
      } else {
        console.log(`✅ ${uplogsAntigos.length} upload_logs marcados como failed`);
      }
    }
    
    // Buscar uploads travados há mais de 10 minutos
    const { data: uploadsAntigos, error: selectError } = await supabaseClient
      .from('processamento_uploads')
      .select('*')
      .eq('status', 'processando')
      .lt('created_at', cutoffTime);

    if (selectError) {
      console.error('❌ Erro ao buscar uploads antigos:', selectError);
      throw selectError;
    }

    console.log(`📋 Encontrados ${uploadsAntigos?.length || 0} uploads travados`);

    if (uploadsAntigos && uploadsAntigos.length > 0) {
      let uploadsFinalizados = 0;
      let uploadsComErro = 0;

      for (const upload of uploadsAntigos) {
        console.log(`🔍 Verificando upload: ${upload.arquivo_nome || 'sem nome'}`);

        try {
          // Verificar se existem dados reais na volumetria para este upload
          const loteUpload = upload.detalhes_erro && typeof upload.detalhes_erro === 'object' 
            ? upload.detalhes_erro.lote_upload 
            : `lote_${upload.created_at.split('T')[0]}`;

          const { count: registrosReais, error: countError } = await supabaseClient
            .from('volumetria_mobilemed')
            .select('*', { count: 'exact', head: true })
            .eq('lote_upload', loteUpload);

          if (countError) {
            console.error(`Erro ao contar registros para ${upload.arquivo_nome}:`, countError);
          }

          // Se há dados reais, marcar como concluído
          if (registrosReais && registrosReais > 0) {
            const { error: updateError } = await supabaseClient
              .from('processamento_uploads')
              .update({
                status: 'concluido',
                completed_at: new Date().toISOString(),
                registros_inseridos: registrosReais,
                detalhes_erro: {
                  ...(upload.detalhes_erro || {}),
                  status: 'Finalizado automaticamente - dados encontrados na base',
                  registros_reais_inseridos: registrosReais,
                  timestamp_finalizacao: new Date().toISOString()
                }
              })
              .eq('id', upload.id);

            if (updateError) {
              console.error(`❌ Erro ao finalizar ${upload.arquivo_nome}:`, updateError);
            } else {
              console.log(`✅ Upload finalizado como concluído: ${upload.arquivo_nome} (${registrosReais} registros)`);
              uploadsFinalizados++;
            }
          } else {
            // Se não há dados reais, marcar como erro
            const { error: updateError } = await supabaseClient
              .from('processamento_uploads')
              .update({
                status: 'erro',
                detalhes_erro: {
                  erro: 'Timeout durante processamento - nenhum dado encontrado na base',
                  timestamp_limpeza: new Date().toISOString(),
                  duracao_travado: '30+ minutos',
                  registros_esperados: upload.registros_processados || 0,
                  registros_encontrados: 0
                }
              })
              .eq('id', upload.id);

            if (updateError) {
              console.error(`❌ Erro ao marcar como erro ${upload.arquivo_nome}:`, updateError);
            } else {
              console.log(`❌ Upload marcado como erro: ${upload.arquivo_nome} (nenhum dado encontrado)`);
              uploadsComErro++;
            }
          }
        } catch (err) {
          console.error(`💥 Erro ao processar ${upload.arquivo_nome}:`, err);
          uploadsComErro++;
        }
      }

      console.log(`✅ Finalização automática: ${uploadsFinalizados} concluídos, ${uploadsComErro} com erro`);
    }

    // Também limpar uploads muito antigos (mais de 24 horas) que falharam
    const cutoffTimeDelete = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { error: deleteError } = await supabaseClient
      .from('processamento_uploads')
      .delete()
      .in('status', ['erro', 'processando'])
      .lt('created_at', cutoffTimeDelete);

    if (deleteError) {
      console.warn('⚠️ Erro ao deletar uploads antigos:', deleteError);
    } else {
      console.log('🗑️ Uploads muito antigos removidos');
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Uploads travados limpos com sucesso',
      uploads_corrigidos: uploadsAntigos?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 ERRO:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});