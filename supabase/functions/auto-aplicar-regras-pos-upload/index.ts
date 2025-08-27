import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UploadEvent {
  arquivo_fonte: string;
  lote_upload: string;
  status: string;
  total_registros: number;
}

export default serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      arquivo_fonte, 
      lote_upload, 
      status,
      total_registros,
      auto_aplicar = true 
    }: UploadEvent & { auto_aplicar?: boolean } = await req.json();

    console.log(`🚀 SISTEMA AUTOMÁTICO DE APLICAÇÃO DE REGRAS`);
    console.log(`📁 Arquivo: ${arquivo_fonte}`);
    console.log(`📦 Lote: ${lote_upload}`);
    console.log(`📊 Total registros: ${total_registros}`);
    console.log(`⚡ Auto aplicar: ${auto_aplicar}`);

    if (!arquivo_fonte || !lote_upload) {
      throw new Error('Parâmetros arquivo_fonte e lote_upload são obrigatórios');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Se o upload não foi concluído com sucesso, não aplicar regras
    if (status !== 'completed' && status !== 'staging_concluido') {
      console.log(`❌ Upload não concluído (status: ${status}). Aguardando conclusão...`);
      return new Response(JSON.stringify({
        success: false,
        message: 'Upload não concluído ainda',
        arquivo_fonte,
        lote_upload,
        status_upload: status
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Se auto_aplicar está desabilitado, apenas registrar e aguardar
    if (!auto_aplicar) {
      console.log(`⏸️ Auto-aplicação desabilitada. Regras deverão ser aplicadas manualmente.`);
      return new Response(JSON.stringify({
        success: true,
        message: 'Auto-aplicação desabilitada',
        arquivo_fonte,
        lote_upload,
        requer_aplicacao_manual: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`⚡ Iniciando aplicação automática de regras...`);

    // Registrar início do processo automático
    const { error: logError } = await supabase
      .from('audit_logs')
      .insert({
        table_name: 'sistema_automatico',
        operation: 'APLICACAO_AUTOMATICA_INICIADA',
        record_id: lote_upload,
        new_data: {
          arquivo_fonte,
          lote_upload,
          total_registros,
          timestamp_inicio: new Date().toISOString()
        },
        user_email: 'system-auto',
        severity: 'info'
      });

    // Chamar o sistema completo de aplicação de regras
    console.log(`🔧 Chamando sistema completo de aplicação de regras...`);
    
    const { data: resultadoRegras, error: errorRegras } = await supabase.functions.invoke(
      'sistema-aplicacao-regras-completo',
      {
        body: {
          arquivo_fonte,
          lote_upload,
          periodo_referencia: 'jun/25', // Pode ser parametrizado
          forcar_aplicacao: true, // Forçar aplicação em modo automático
          validar_apenas: false
        }
      }
    );

    if (errorRegras) {
      console.error(`❌ Erro na aplicação das regras:`, errorRegras);
      
      // Log do erro
      await supabase
        .from('audit_logs')
        .insert({
          table_name: 'sistema_automatico',
          operation: 'APLICACAO_AUTOMATICA_ERRO',
          record_id: lote_upload,
          new_data: {
            arquivo_fonte,
            lote_upload,
            erro: errorRegras.message,
            timestamp_erro: new Date().toISOString()
          },
          user_email: 'system-auto',
          severity: 'error'
        });

      return new Response(JSON.stringify({
        success: false,
        error: 'Erro na aplicação automática das regras',
        details: errorRegras.message,
        arquivo_fonte,
        lote_upload,
        requer_intervencao: true
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ Regras aplicadas automaticamente:`, resultadoRegras);

    // Verificar se todas as regras foram aplicadas com sucesso
    const sucesso_total = resultadoRegras?.success && 
                          resultadoRegras?.regras_falharam === 0;

    // Log do resultado
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'sistema_automatico',
        operation: sucesso_total ? 'APLICACAO_AUTOMATICA_SUCESSO' : 'APLICACAO_AUTOMATICA_PARCIAL',
        record_id: lote_upload,
        new_data: {
          arquivo_fonte,
          lote_upload,
          resultado_completo: resultadoRegras,
          sucesso_total,
          timestamp_fim: new Date().toISOString()
        },
        user_email: 'system-auto',
        severity: sucesso_total ? 'info' : 'warning'
      });

    // Atualizar status do processamento
    await supabase
      .from('processamento_uploads')
      .update({
        status: sucesso_total ? 'regras_aplicadas' : 'regras_parciais',
        detalhes_erro: sucesso_total ? null : {
          ...resultadoRegras,
          requer_atencao: true
        },
        updated_at: new Date().toISOString()
      })
      .eq('lote_upload', lote_upload);

    const mensagemStatus = sucesso_total 
      ? 'Todas as regras foram aplicadas automaticamente com sucesso!'
      : `Algumas regras falharam. ${resultadoRegras?.regras_falharam || 0} de ${resultadoRegras?.total_regras || 0} regras falharam.`;

    console.log(`🏁 ${mensagemStatus}`);

    return new Response(JSON.stringify({
      success: sucesso_total,
      message: mensagemStatus,
      arquivo_fonte,
      lote_upload,
      detalhes_aplicacao: {
        total_regras: resultadoRegras?.total_regras || 0,
        regras_aplicadas: resultadoRegras?.regras_aplicadas || 0,
        regras_validadas_ok: resultadoRegras?.regras_validadas_ok || 0,
        regras_falharam: resultadoRegras?.regras_falharam || 0,
        status_detalhado: resultadoRegras?.status_detalhado || []
      },
      requer_intervencao: !sucesso_total,
      timestamp_processamento: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Erro no sistema automático de aplicação:', error);
    
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