import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessamentoStatus {
  arquivo_fonte: string;
  total_registros: number;
  regras_aplicadas: boolean;
  necessita_processamento: boolean;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔍 Verificando necessidade de aplicar regras v002/v003 automaticamente...');

    // Verificar arquivos retroativos que precisam de processamento
    const arquivosRetroativos = ['volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo'];
    const statusProcessamento: ProcessamentoStatus[] = [];

    let totalProcessados = 0;

    for (const arquivo of arquivosRetroativos) {
      // Contar registros no arquivo
      const { count: totalRegistros } = await supabase
        .from('volumetria_mobilemed')
        .select('*', { count: 'exact', head: true })
        .eq('arquivo_fonte', arquivo);

      const registros = totalRegistros || 0;
      
      // Determinar se precisa de processamento baseado na quantidade esperada
      let necessitaProcessamento = false;
      let estimativaEsperada = 0;

      if (arquivo === 'volumetria_padrao_retroativo') {
        // Esperamos ~230 registros após regras v002/v003
        estimativaEsperada = 230;
        necessitaProcessamento = registros > estimativaEsperada * 10; // Margem de 10x
      } else if (arquivo === 'volumetria_fora_padrao_retroativo') {
        // Esperamos ~0 registros após regras v002/v003  
        estimativaEsperada = 0;
        necessitaProcessamento = registros > 10; // Qualquer quantidade significativa precisa processamento
      }

      console.log(`📊 ${arquivo}: ${registros} registros, esperado: ~${estimativaEsperada}, precisa processar: ${necessitaProcessamento}`);

      statusProcessamento.push({
        arquivo_fonte: arquivo,
        total_registros: registros,
        regras_aplicadas: !necessitaProcessamento,
        necessita_processamento: necessitaProcessamento
      });

      // Se necessita processamento, aplicar regras automaticamente
      if (necessitaProcessamento) {
        console.log(`🚀 Aplicando regras v002/v003 automaticamente para ${arquivo}...`);

        try {
          // Executar regras v002/v003 via edge function
          const { data: resultRegras, error: errorRegras } = await supabase.functions.invoke('aplicar-exclusoes-periodo', {
            body: {
              periodo_referencia: 'jun/25' // Período atual configurado
            }
          });

          if (errorRegras) {
            console.error(`❌ Erro ao aplicar regras para ${arquivo}:`, errorRegras);
          } else {
            console.log(`✅ Regras aplicadas com sucesso para ${arquivo}:`, resultRegras);
            totalProcessados += resultRegras.total_excluidos || 0;
            
            // Atualizar status
            statusProcessamento[statusProcessamento.length - 1].regras_aplicadas = true;
            statusProcessamento[statusProcessamento.length - 1].necessita_processamento = false;
          }

        } catch (error) {
          console.error(`💥 Falha crítica ao processar ${arquivo}:`, error);
        }
      }
    }

    // Log do resultado
    console.log(`🎯 Processamento automático concluído. Total de registros processados: ${totalProcessados}`);

    return new Response(JSON.stringify({
      success: true,
      processamento_automatico: true,
      total_arquivos_verificados: arquivosRetroativos.length,
      total_registros_processados: totalProcessados,
      status_por_arquivo: statusProcessamento,
      regras_aplicadas: ['v002', 'v003'],
      periodo_referencia: 'jun/25',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Erro no processamento automático:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}