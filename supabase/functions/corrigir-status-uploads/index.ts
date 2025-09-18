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

    console.log('🔧 Corrigindo status de uploads...');

    // Buscar uploads marcados como erro que têm dados inseridos
    const { data: uploadsErroneos, error: selectError } = await supabaseClient
      .from('processamento_uploads')
      .select('*')
      .eq('status', 'erro')
      .gt('registros_inseridos', 0)
      .in('tipo_arquivo', [
        'volumetria_padrao', 
        'volumetria_fora_padrao', 
        'volumetria_padrao_retroativo', 
        'volumetria_fora_padrao_retroativo'
      ]);

    if (selectError) {
      console.error('❌ Erro ao buscar uploads:', selectError);
      throw selectError;
    }

    console.log(`📋 Encontrados ${uploadsErroneos?.length || 0} uploads para corrigir`);

    let uploadsCorrigidos = 0;

    if (uploadsErroneos && uploadsErroneos.length > 0) {
      for (const upload of uploadsErroneos) {
        // Verificar se o erro foi por timeout e há dados inseridos
        const detalhesErro = typeof upload.detalhes_erro === 'string' 
          ? JSON.parse(upload.detalhes_erro) 
          : upload.detalhes_erro;

        if (detalhesErro?.erro?.includes('Timeout durante processamento') && upload.registros_inseridos > 0) {
          // Corrigir status para concluído
          const { error: updateError } = await supabaseClient
            .from('processamento_uploads')
            .update({
              status: 'concluido',
              completed_at: new Date().toISOString(),
              detalhes_erro: {
                ...detalhesErro,
                status: 'Corrigido automaticamente - dados encontrados na base',
                timestamp_correcao: new Date().toISOString(),
                motivo_correcao: 'Upload foi processado com sucesso mas marcado incorretamente como erro'
              }
            })
            .eq('id', upload.id);

          if (updateError) {
            console.error(`❌ Erro ao corrigir ${upload.arquivo_nome}:`, updateError);
          } else {
            console.log(`✅ Status corrigido: ${upload.arquivo_nome} (${upload.registros_inseridos} registros)`);
            uploadsCorrigidos++;
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Status de uploads corrigido com sucesso',
      uploads_encontrados: uploadsErroneos?.length || 0,
      uploads_corrigidos: uploadsCorrigidos
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