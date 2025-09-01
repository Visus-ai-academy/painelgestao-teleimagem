import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UploadEvent {
  arquivo_fonte: string;
  upload_id: string;
  arquivo_nome: string;
  status: string;
  total_registros: number;
  periodo_referencia?: string;
}

export default serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      arquivo_fonte, 
      upload_id,
      arquivo_nome,
      status,
      total_registros,
      periodo_referencia
    }: UploadEvent = await req.json();

    console.log(`🚀 APLICAÇÃO AUTOMÁTICA V002/V003`);
    console.log(`📁 Tipo Arquivo: ${arquivo_fonte}`);
    console.log(`📂 Nome Arquivo: ${arquivo_nome}`);
    console.log(`🆔 Upload ID: ${upload_id}`);
    console.log(`📊 Total registros: ${total_registros}`);
    console.log(`📋 Status do upload: ${status}`);
    console.log(`📅 Período referência: ${periodo_referencia || 'jun/25 (fallback)'}`);

    if (!arquivo_fonte || !upload_id) {
      throw new Error('Parâmetros arquivo_fonte e upload_id são obrigatórios');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Verificar se há registros no banco antes da aplicação
    const { count: registrosAntes } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', arquivo_fonte);
    
    console.log(`📊 Registros no banco antes da aplicação: ${registrosAntes || 0}`);

    // Se o upload não foi concluído com sucesso, não aplicar regras
    if (status !== 'concluido') {
      console.log(`❌ Upload não concluído (status: ${status}). Aguardando conclusão...`);
      return new Response(JSON.stringify({
        success: false,
        message: 'Upload não concluído ainda',
        arquivo_fonte,
        upload_id,
        status_upload: status
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verificar se é um arquivo que precisa das regras v002/v003
    const arquivosComRegrasV002V003 = [
      'volumetria_padrao_retroativo',
      'volumetria_fora_padrao_retroativo'
    ];

    if (!arquivosComRegrasV002V003.includes(arquivo_fonte)) {
      console.log(`⏸️ Arquivo ${arquivo_fonte} não precisa das regras v002/v003`);
      return new Response(JSON.stringify({
        success: true,
        message: 'Arquivo não requer regras v002/v003',
        arquivo_fonte,
        upload_id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`⚡ Aplicando regras v002/v003 para ${arquivo_fonte}...`);

    // Registrar início do processo automático
    const { error: logError } = await supabase
      .from('audit_logs')
      .insert({
        table_name: 'sistema_automatico_v002_v003',
        operation: 'APLICACAO_V002_V003_INICIADA',
        record_id: upload_id,
        new_data: {
          arquivo_fonte,
          upload_id,
          arquivo_nome,
          total_registros,
          timestamp_inicio: new Date().toISOString()
        },
        user_email: 'system-auto',
        severity: 'info'
      });

    // Aplicar apenas as regras v002/v003 (exclusões por período)
    console.log(`🔧 Chamando aplicar-exclusoes-periodo...`);
    
    const { data: resultadoV002V003, error: errorV002V003 } = await supabase.functions.invoke(
      'aplicar-exclusoes-periodo',
      {
        body: {
          arquivo_fonte,
          periodo_referencia: periodo_referencia || 'jun/25'
        }
      }
    );

    if (errorV002V003) {
      console.error(`❌ Erro na aplicação v002/v003:`, errorV002V003);
      
      // Log do erro
      await supabase
        .from('audit_logs')
        .insert({
          table_name: 'sistema_automatico_v002_v003',
          operation: 'APLICACAO_V002_V003_ERRO',
          record_id: upload_id,
          new_data: {
            arquivo_fonte,
            upload_id,
            erro: errorV002V003.message,
            timestamp_erro: new Date().toISOString()
          },
          user_email: 'system-auto',
          severity: 'error'
        });

      return new Response(JSON.stringify({
        success: false,
        error: 'Erro na aplicação automática das regras v002/v003',
        details: errorV002V003.message,
        arquivo_fonte,
        upload_id,
        requer_intervencao: true
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ Regras v002/v003 aplicadas automaticamente:`, resultadoV002V003);
    
    // Verificar registros após aplicação
    const { count: registrosDepois } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', arquivo_fonte);
    
    console.log(`📊 Registros no banco após aplicação: ${registrosDepois || 0}`);

    const sucesso = resultadoV002V003?.sucesso === true;

    // Log do resultado
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'sistema_automatico_v002_v003',
        operation: sucesso ? 'APLICACAO_V002_V003_SUCESSO' : 'APLICACAO_V002_V003_FALHA',
        record_id: upload_id,
        new_data: {
          arquivo_fonte,
          upload_id,
          resultado_completo: resultadoV002V003,
          sucesso,
          timestamp_fim: new Date().toISOString()
        },
        user_email: 'system-auto',
        severity: sucesso ? 'info' : 'warning'
      });

    // Atualizar status do processamento
    await supabase
      .from('processamento_uploads')
      .update({
        status: sucesso ? 'regras_v002_v003_aplicadas' : 'regras_v002_v003_falha',
        detalhes_erro: sucesso ? null : {
          ...resultadoV002V003,
          requer_atencao: true
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', upload_id);

    const mensagemStatus = sucesso 
      ? `Regras v002/v003 aplicadas automaticamente! ${resultadoV002V003?.registros_excluidos || 0} registros excluídos.`
      : `Falha na aplicação das regras v002/v003.`;

    console.log(`🏁 ${mensagemStatus}`);

    return new Response(JSON.stringify({
      success: sucesso,
      message: mensagemStatus,
      arquivo_fonte,
      upload_id,
      detalhes_aplicacao: {
        registros_encontrados: resultadoV002V003?.registros_encontrados || 0,
        registros_excluidos: resultadoV002V003?.registros_excluidos || 0,
        data_limite: resultadoV002V003?.data_limite,
        exemplos_excluidos: resultadoV002V003?.exemplos_excluidos || []
      },
      requer_intervencao: !sucesso,
      timestamp_processamento: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Erro no sistema automático v002/v003:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp_erro: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});