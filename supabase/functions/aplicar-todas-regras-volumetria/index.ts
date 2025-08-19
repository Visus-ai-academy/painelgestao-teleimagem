import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { arquivo_fonte, periodo_referencia } = await req.json();
    
    console.log('🎯 [TODAS-REGRAS] Aplicando TODAS as regras em sequência:', {
      arquivo_fonte,
      periodo_referencia
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const resultados: any[] = [];

    // 1. Aplicar De-Para automático para valores zerados
    console.log('🔧 [TODAS-REGRAS] 1. Aplicando De-Para...');
    try {
      const { data: deParaResult, error: deParaError } = await supabase
        .rpc('aplicar_de_para_automatico', {
          arquivo_fonte_param: arquivo_fonte
        });
      
      if (deParaError) throw deParaError;
      resultados.push({ regra: 'de_para', resultado: deParaResult });
      console.log('✅ [TODAS-REGRAS] De-Para aplicado:', deParaResult);
    } catch (error) {
      console.error('⚠️ [TODAS-REGRAS] Erro no De-Para:', error);
      resultados.push({ regra: 'de_para', erro: error.message });
    }

    // 2. Aplicar correções de modalidade
    console.log('🔧 [TODAS-REGRAS] 2. Aplicando correções de modalidade...');
    try {
      const { data: modalidadeResult, error: modalidadeError } = await supabase.functions.invoke('aplicar-correcao-modalidade-rx');
      if (!modalidadeError) {
        const { data: modalidadeOTResult } = await supabase.functions.invoke('aplicar-correcao-modalidade-ot');
        resultados.push({ regra: 'correcoes_modalidade', resultado: { rx: modalidadeResult, ot: modalidadeOTResult } });
        console.log('✅ [TODAS-REGRAS] Correções modalidade aplicadas');
      }
    } catch (error) {
      console.error('⚠️ [TODAS-REGRAS] Erro nas correções modalidade:', error);
      resultados.push({ regra: 'correcoes_modalidade', erro: error.message });
    }

    // 3. Aplicar tipificação de faturamento
    console.log('🔧 [TODAS-REGRAS] 3. Aplicando tipificação...');
    try {
      const { data: tipificacaoResult, error: tipificacaoError } = await supabase.functions.invoke('aplicar-tipificacao-faturamento');
      if (!tipificacaoError) {
        resultados.push({ regra: 'tipificacao', resultado: tipificacaoResult });
        console.log('✅ [TODAS-REGRAS] Tipificação aplicada');
      }
    } catch (error) {
      console.error('⚠️ [TODAS-REGRAS] Erro na tipificação:', error);
      resultados.push({ regra: 'tipificacao', erro: error.message });
    }

    // 4. Aplicar quebras de exames
    console.log('🔧 [TODAS-REGRAS] 4. Aplicando quebras de exames...');
    try {
      const { data: quebrasResult, error: quebrasError } = await supabase
        .rpc('aplicar_regras_quebra_exames', {
          arquivo_fonte_param: arquivo_fonte
        });
      
      if (quebrasError) throw quebrasError;
      resultados.push({ regra: 'quebras_exames', resultado: quebrasResult });
      console.log('✅ [TODAS-REGRAS] Quebras aplicadas:', quebrasResult);
    } catch (error) {
      console.error('⚠️ [TODAS-REGRAS] Erro nas quebras:', error);
      resultados.push({ regra: 'quebras_exames', erro: error.message });
    }

    // 5. Aplicar especialidades automáticas
    console.log('🔧 [TODAS-REGRAS] 5. Aplicando especialidades...');
    try {
      const { data: especialidadeResult, error: especialidadeError } = await supabase.functions.invoke('aplicar-especialidade-automatica');
      if (!especialidadeError) {
        resultados.push({ regra: 'especialidades', resultado: especialidadeResult });
        console.log('✅ [TODAS-REGRAS] Especialidades aplicadas');
      }
    } catch (error) {
      console.error('⚠️ [TODAS-REGRAS] Erro nas especialidades:', error);
      resultados.push({ regra: 'especialidades', erro: error.message });
    }

    console.log('🎉 [TODAS-REGRAS] TODAS AS REGRAS APLICADAS:', resultados);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Todas as regras foram aplicadas com sucesso',
        regras_aplicadas: resultados.length,
        resultados: resultados,
        arquivo_fonte: arquivo_fonte,
        periodo_referencia: periodo_referencia,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 [TODAS-REGRAS] Erro crítico:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});