import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { arquivo_fonte } = await req.json();
    
    console.log('🔧 REPROCESSANDO REGRAS PARA:', arquivo_fonte);
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let registrosAtualizados = 0;
    const mensagens: string[] = [];

    // Aplicar regras específicas baseadas no tipo de arquivo
    switch (arquivo_fonte) {
      case 'volumetria_padrao_retroativo':
        console.log('📋 Aplicando regras para Arquivo 3: Volumetria Padrão Retroativo');
        
        // 1. Remover registros muito antigos (antes de 2023)
        const { error: deleteError3 } = await supabaseClient
          .from('volumetria_mobilemed')
          .delete()
          .eq('arquivo_fonte', arquivo_fonte)
          .lt('data_referencia', '2023-01-01');
        
        if (deleteError3) {
          console.warn('⚠️ Erro ao remover dados antigos:', deleteError3);
        } else {
          console.log('✅ Dados anteriores a 2023 removidos');
        }

        // 2. Preencher especialidade padrão para registros sem especialidade
        const { data: updateResult3, error: error3 } = await supabaseClient
          .from('volumetria_mobilemed')
          .update({ 'ESPECIALIDADE': 'RADIOLOGIA' })
          .eq('arquivo_fonte', arquivo_fonte)
          .is('ESPECIALIDADE', null)
          .select('id');
        
        if (error3) {
          console.error('❌ Erro ao preencher especialidade:', error3);
        } else {
          registrosAtualizados += updateResult3?.length || 0;
          mensagens.push(`Especialidade preenchida em ${updateResult3?.length || 0} registros`);
          console.log(`✅ Especialidade preenchida em ${updateResult3?.length || 0} registros`);
        }

        // 3. Aplicar valores padrão para registros zerados
        const { data: updateValores3, error: errorValores3 } = await supabaseClient
          .from('volumetria_mobilemed')
          .update({ 'VALORES': 1 })
          .eq('arquivo_fonte', arquivo_fonte)
          .or('VALORES.is.null,VALORES.eq.0')
          .select('id');
        
        if (errorValores3) {
          console.error('❌ Erro ao aplicar valores padrão:', errorValores3);
        } else {
          registrosAtualizados += updateValores3?.length || 0;
          mensagens.push(`Valores padrão aplicados em ${updateValores3?.length || 0} registros`);
          console.log(`✅ Valores padrão aplicados em ${updateValores3?.length || 0} registros`);
        }
        break;

      case 'volumetria_fora_padrao_retroativo':
        console.log('📋 Aplicando regras para Arquivo 4: Volumetria Fora Padrão Retroativo');
        
        // 1. Remover registros muito antigos (antes de 2023)
        const { error: deleteError4 } = await supabaseClient
          .from('volumetria_mobilemed')
          .delete()
          .eq('arquivo_fonte', arquivo_fonte)
          .lt('data_referencia', '2023-01-01');
        
        if (deleteError4) {
          console.warn('⚠️ Erro ao remover dados antigos:', deleteError4);
        } else {
          console.log('✅ Dados anteriores a 2023 removidos');
        }

        // 2. Aplicar De-Para específico para este arquivo
        const { data: deParaResult4, error: deParaError4 } = await supabaseClient
          .rpc('aplicar_de_para_automatico', { 
            arquivo_fonte_param: arquivo_fonte 
          });
        
        if (deParaError4) {
          console.error('❌ Erro ao aplicar De-Para:', deParaError4);
        } else {
          registrosAtualizados += deParaResult4?.registros_atualizados || 0;
          mensagens.push(`De-Para aplicado em ${deParaResult4?.registros_atualizados || 0} registros`);
          console.log(`✅ De-Para aplicado em ${deParaResult4?.registros_atualizados || 0} registros`);
        }
        break;

      case 'volumetria_padrao':
        console.log('📋 Aplicando regras para Arquivo 1: Volumetria Padrão');
        
        // Preencher valores padrão para registros zerados
        const { data: updateResult1, error: error1 } = await supabaseClient
          .from('volumetria_mobilemed')
          .update({
            'VALORES': 1,
            'MODALIDADE': 'CR'
          })
          .eq('arquivo_fonte', arquivo_fonte)
          .or('VALORES.is.null,VALORES.eq.0')
          .select('id');
        
        if (error1) {
          console.error('❌ Erro ao aplicar valores padrão:', error1);
        } else {
          registrosAtualizados += updateResult1?.length || 0;
          mensagens.push(`Valores padrão aplicados em ${updateResult1?.length || 0} registros`);
          console.log(`✅ Valores padrão aplicados em ${updateResult1?.length || 0} registros`);
        }
        break;

      case 'volumetria_fora_padrao':
        console.log('📋 Aplicando regras para Arquivo 2: Volumetria Fora Padrão');
        
        // Aplicar De-Para específico para este arquivo
        const { data: deParaResult2, error: deParaError2 } = await supabaseClient
          .rpc('aplicar_de_para_automatico', { 
            arquivo_fonte_param: arquivo_fonte 
          });
        
        if (deParaError2) {
          console.error('❌ Erro ao aplicar De-Para:', deParaError2);
        } else {
          registrosAtualizados += deParaResult2?.registros_atualizados || 0;
          mensagens.push(`De-Para aplicado em ${deParaResult2?.registros_atualizados || 0} registros`);
          console.log(`✅ De-Para aplicado em ${deParaResult2?.registros_atualizados || 0} registros`);
        }
        break;

      default:
        mensagens.push(`Nenhuma regra específica para ${arquivo_fonte}`);
        console.log(`⚠️ Nenhuma regra específica para ${arquivo_fonte}`);
    }

    // Aplicar regras gerais de prioridade
    try {
      console.log('🔧 Aplicando regras de prioridade...');
      const { data: prioridadeResult } = await supabaseClient.rpc('aplicar_de_para_prioridade');
      registrosAtualizados += prioridadeResult?.registros_atualizados || 0;
      mensagens.push(`Prioridades atualizadas: ${prioridadeResult?.registros_atualizados || 0} registros`);
      console.log(`✅ Prioridades atualizadas: ${prioridadeResult?.registros_atualizados || 0} registros`);
    } catch (prioridadeError) {
      console.warn('⚠️ Erro nas regras de prioridade (ignorado):', prioridadeError.message);
    }

    console.log(`✅ REPROCESSAMENTO CONCLUÍDO: ${registrosAtualizados} registros atualizados`);

    return new Response(JSON.stringify({
      success: true,
      message: `Regras reprocessadas com sucesso para ${arquivo_fonte}`,
      arquivo_fonte: arquivo_fonte,
      registros_atualizados: registrosAtualizados,
      detalhes: mensagens
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 ERRO:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});