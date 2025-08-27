import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔄 INICIANDO FINALIZAÇÃO DE UPLOADS TRAVADOS');

    // Buscar uploads travados há mais de 10 minutos
    const { data: uploadsTravados, error: fetchError } = await supabaseClient
      .from('processamento_uploads')
      .select('*')
      .eq('status', 'processando')
      .lt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

    if (fetchError) {
      throw new Error(`Erro ao buscar uploads: ${fetchError.message}`);
    }

    if (!uploadsTravados?.length) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Nenhum upload travado encontrado',
        uploads_finalizados: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📋 Encontrados ${uploadsTravados.length} uploads travados`);

    const resultados = [];

    for (const upload of uploadsTravados) {
      console.log(`🔧 Finalizando upload: ${upload.arquivo_nome}`);

      try {
        // Contar registros reais inseridos na volumetria
        const { count: registrosReais, error: countError } = await supabaseClient
          .from('volumetria_mobilemed')
          .select('*', { count: 'exact', head: true })
          .eq('lote_upload', upload.detalhes_erro?.lote_upload || 'unknown');

        if (countError) {
          console.error(`Erro ao contar registros para ${upload.arquivo_nome}:`, countError);
        }

        // Atualizar status para concluído
        const { error: updateError } = await supabaseClient
          .from('processamento_uploads')
          .update({
            status: 'concluido',
            completed_at: new Date().toISOString(),
            registros_inseridos: registrosReais || upload.registros_inseridos,
            detalhes_erro: {
              ...upload.detalhes_erro,
              status: 'Processamento Finalizado Automaticamente',
              registros_reais_inseridos: registrosReais,
              finalizado_em: new Date().toISOString(),
              motivo_finalizacao: 'Upload travado há mais de 10 minutos'
            }
          })
          .eq('id', upload.id);

        if (updateError) {
          throw new Error(`Erro ao atualizar upload ${upload.arquivo_nome}: ${updateError.message}`);
        }

        // Log de auditoria
        await supabaseClient
          .from('audit_logs')
          .insert({
            table_name: 'processamento_uploads',
            operation: 'FINALIZACAO_AUTOMATICA',
            record_id: upload.id,
            new_data: {
              arquivo_nome: upload.arquivo_nome,
              registros_processados: upload.registros_processados,
              registros_inseridos: registrosReais || upload.registros_inseridos,
              registros_erro: upload.registros_erro,
              tempo_travado_minutos: Math.round((Date.now() - new Date(upload.created_at).getTime()) / (1000 * 60))
            },
            user_email: 'system',
            severity: 'warning'
          });

        resultados.push({
          id: upload.id,
          arquivo_nome: upload.arquivo_nome,
          status: 'finalizado',
          registros_processados: upload.registros_processados,
          registros_inseridos: registrosReais || upload.registros_inseridos,
          registros_erro: upload.registros_erro
        });

        console.log(`✅ Upload finalizado: ${upload.arquivo_nome}`);

      } catch (err) {
        console.error(`❌ Erro ao finalizar ${upload.arquivo_nome}:`, err);
        resultados.push({
          id: upload.id,
          arquivo_nome: upload.arquivo_nome,
          status: 'erro',
          erro: err.message
        });
      }
    }

    console.log('🎉 FINALIZAÇÃO CONCLUÍDA!');

    return new Response(JSON.stringify({
      success: true,
      uploads_finalizados: resultados.filter(r => r.status === 'finalizado').length,
      uploads_com_erro: resultados.filter(r => r.status === 'erro').length,
      resultados: resultados,
      data_processamento: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 ERRO CRÍTICO:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Erro interno do servidor',
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});