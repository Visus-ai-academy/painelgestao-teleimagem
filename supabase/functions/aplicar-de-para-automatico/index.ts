import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { arquivo_fonte, lote_upload } = await req.json();
    
    console.log(`📊 Aplicando de-para de valores zerados para arquivo: ${arquivo_fonte}`);

    // Buscar registros com valores zerados em batches menores para evitar timeout
    const batchSize = 500;
    let totalProcessados = 0;
    let totalAtualizados = 0;
    let offset = 0;

    while (true) {
      // Buscar registros com valores zerados em batch
      const { data: registrosZerados, error: errorBusca } = await supabase
        .from('volumetria_mobilemed')
        .select('id, ESTUDO_DESCRICAO')
        .eq('arquivo_fonte', arquivo_fonte)
        .eq('lote_upload', lote_upload || '')
        .or('VALORES.is.null,VALORES.eq.0')
        .range(offset, offset + batchSize - 1);

      if (errorBusca) {
        throw new Error(`Erro ao buscar registros: ${errorBusca.message}`);
      }

      if (!registrosZerados || registrosZerados.length === 0) {
        break; // Não há mais registros
      }

      console.log(`📋 Processando batch de ${registrosZerados.length} registros (offset: ${offset})`);

      // Buscar valores de referência para todos os exames deste batch
      const estudosDescricao = [...new Set(registrosZerados.map(r => r.ESTUDO_DESCRICAO))];
      
      const { data: valoresReferencia, error: errorReferencia } = await supabase
        .from('valores_referencia_de_para')
        .select('estudo_descricao, valores')
        .in('estudo_descricao', estudosDescricao)
        .eq('ativo', true);

      if (errorReferencia) {
        console.warn(`⚠️ Erro ao buscar valores de referência: ${errorReferencia.message}`);
      }

      // Criar mapa de valores para busca rápida (case insensitive)
      const mapaValores = new Map();
      if (valoresReferencia) {
        valoresReferencia.forEach(vr => {
          mapaValores.set(vr.estudo_descricao.toUpperCase().trim(), vr.valores);
        });
      }

      // Processar registros em lotes menores
      const updatePromises = [];
      for (const registro of registrosZerados) {
        const estudoKey = registro.ESTUDO_DESCRICAO?.toUpperCase()?.trim();
        const valorReferencia = mapaValores.get(estudoKey);
        
        if (valorReferencia && valorReferencia > 0) {
          updatePromises.push(
            supabase
              .from('volumetria_mobilemed')
              .update({ 
                VALORES: valorReferencia,
                updated_at: new Date().toISOString()
              })
              .eq('id', registro.id)
          );
          totalAtualizados++;
        }
        totalProcessados++;
      }

      // Executar atualizações em paralelo (máximo 10 por vez para evitar sobrecarga)
      const chunks = [];
      for (let i = 0; i < updatePromises.length; i += 10) {
        chunks.push(updatePromises.slice(i, i + 10));
      }

      for (const chunk of chunks) {
        await Promise.all(chunk);
      }

      offset += batchSize;

      // Log de progresso
      if (offset % 2000 === 0) {
        console.log(`📈 Progresso: ${totalProcessados} processados, ${totalAtualizados} atualizados`);
      }
    }

    const resultado = {
      sucesso: true,
      arquivo_fonte: arquivo_fonte || 'TODOS',
      lote_upload: lote_upload || 'N/A',
      total_processados: totalProcessados,
      total_atualizados: totalAtualizados,
      porcentagem_corrigida: totalProcessados > 0 ? Math.round((totalAtualizados / totalProcessados) * 100) : 0,
      data_processamento: new Date().toISOString()
    };

    console.log(`✅ De-Para concluído:`, resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('❌ Erro no de-para automático:', error);
    
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        erro: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});