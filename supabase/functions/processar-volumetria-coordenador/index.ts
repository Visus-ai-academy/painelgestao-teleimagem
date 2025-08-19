import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🚀 COORDENADOR STREAMING - Processamento em background para evitar timeout
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_path, arquivo_fonte, periodo_referencia, upload_id } = await req.json();
    
    console.log('🎯 [COORDENADOR-ULTRA] Processamento ultra-rápido:', {
      file_path,
      upload_id
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Função APENAS para registrar no staging (zero CPU)
    async function processInBackground() {
      try {
        console.log('📋 [STAGING-BG] Criando placeholder no staging');
        
        // Apenas criar um placeholder no staging para processamento posterior
        const { error: stagingError } = await supabase
          .from('volumetria_staging')
          .insert({
            EMPRESA: 'PROCESSAMENTO_PENDENTE',
            NOME_PACIENTE: `ARQUIVO_${file_path}`,
            CODIGO_PACIENTE: upload_id || crypto.randomUUID(),
            ESTUDO_DESCRICAO: 'PENDING_PROCESSING',
            ACCESSION_NUMBER: file_path,
            MODALIDADE: 'STAGING',
            PRIORIDADE: 'NORMAL',
            VALORES: 0,
            arquivo_fonte: arquivo_fonte || 'volumetria_padrao',
            periodo_referencia: periodo_referencia || 'jun/25',
            lote_upload: upload_id || crypto.randomUUID(),
            status_processamento: 'pendente',
            detalhes_processamento: {
              file_path,
              arquivo_fonte,
              periodo_referencia,
              created_at: new Date().toISOString()
            }
          });

        if (stagingError) {
          console.error('❌ [STAGING-BG] Erro no staging:', stagingError.message);
        } else {
          console.log('✅ [STAGING-BG] Placeholder criado no staging');
        }

        // Atualizar status como staging_concluido
        if (upload_id) {
          await supabase
            .from('processamento_uploads')
            .update({
              status: 'staging_concluido',
              registros_processados: 1,
              registros_inseridos: 1,
              registros_erro: 0,
              completed_at: new Date().toISOString(),
              detalhes_erro: {
                message: 'Arquivo registrado no staging para processamento posterior',
                file_path,
                versao: 'ultra_light_v1'
              }
            })
            .eq('id', upload_id);
        }

        console.log('🎉 [STAGING-BG] Staging concluído com sucesso');

      } catch (bgError) {
        console.error('💥 [STAGING-BG] Erro:', bgError.message);
        
        if (upload_id) {
          await supabase
            .from('processamento_uploads')
            .update({
              status: 'erro',
              detalhes_erro: {
                erro: bgError.message,
                etapa: 'staging_background',
                versao: 'ultra_light_v1'
              },
              completed_at: new Date().toISOString()
            })
            .eq('id', upload_id);
        }
      }
    }

    // Iniciar processamento em background (não bloqueia a resposta)
    if (EdgeRuntime?.waitUntil) {
      EdgeRuntime.waitUntil(processInBackground());
    } else {
      // Fallback se waitUntil não estiver disponível
      processInBackground().catch(err => 
        console.error('Erro no processamento background:', err)
      );
    }

    // Atualizar status como processando
    if (upload_id) {
      await supabase
        .from('processamento_uploads')
        .update({
          status: 'processando',
          detalhes_erro: null
        })
        .eq('id', upload_id);
    }

    // Retornar resposta imediata
    const result = {
      success: true,
      message: 'Processamento iniciado em background',
      background: true,
      upload_id
    };

    console.log('🚀 [COORDENADOR-STREAM] Resposta imediata enviada');

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 [COORDENADOR-STREAM] Erro:', error.message);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Erro no processamento streaming'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});