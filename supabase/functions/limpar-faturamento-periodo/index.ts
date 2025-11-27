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

  console.log('[limpar-faturamento-periodo] INÍCIO DA FUNÇÃO');
  
  try {
    const { periodo } = await req.json();
    console.log('[limpar-faturamento-periodo] Período recebido:', periodo);

    if (!periodo) {
      throw new Error('Período é obrigatório');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const resultados = {
      faturamento: 0,
      demonstrativos: 0,
      relatorios_status: 0,
      pdfs_removidos: 0
    };

    // 1. Limpar tabela faturamento
    console.log('[limpar-faturamento-periodo] 1. Limpando tabela faturamento...');
    const { error: errorFaturamento, count: countFaturamento } = await supabase
      .from('faturamento')
      .delete()
      .eq('periodo_referencia', periodo);
    
    if (errorFaturamento) {
      console.error('[limpar-faturamento-periodo] Erro ao limpar faturamento:', errorFaturamento);
    } else {
      resultados.faturamento = countFaturamento || 0;
      console.log(`[limpar-faturamento-periodo] ✅ Faturamento: ${resultados.faturamento} registros removidos`);
    }

    // 2. Limpar tabela demonstrativos_faturamento_calculados
    console.log('[limpar-faturamento-periodo] 2. Limpando demonstrativos calculados...');
    const { error: errorDemonstrativos, count: countDemonstrativos } = await supabase
      .from('demonstrativos_faturamento_calculados')
      .delete()
      .eq('periodo_referencia', periodo);
    
    if (errorDemonstrativos) {
      console.error('[limpar-faturamento-periodo] Erro ao limpar demonstrativos:', errorDemonstrativos);
    } else {
      resultados.demonstrativos = countDemonstrativos || 0;
      console.log(`[limpar-faturamento-periodo] ✅ Demonstrativos: ${resultados.demonstrativos} registros removidos`);
    }

    // 3. Limpar tabela relatorios_faturamento_status
    console.log('[limpar-faturamento-periodo] 3. Limpando status de relatórios...');
    const { error: errorRelatorios, count: countRelatorios } = await supabase
      .from('relatorios_faturamento_status')
      .delete()
      .eq('periodo', periodo);
    
    if (errorRelatorios) {
      console.error('[limpar-faturamento-periodo] Erro ao limpar status de relatórios:', errorRelatorios);
    } else {
      resultados.relatorios_status = countRelatorios || 0;
      console.log(`[limpar-faturamento-periodo] ✅ Status de relatórios: ${resultados.relatorios_status} registros removidos`);
    }

    // 4. Limpar PDFs do storage bucket 'relatorios-faturamento'
    console.log('[limpar-faturamento-periodo] 4. Limpando PDFs do storage...');
    const { data: arquivos, error: errorListagem } = await supabase.storage
      .from('relatorios-faturamento')
      .list();
    
    if (errorListagem) {
      console.error('[limpar-faturamento-periodo] Erro ao listar arquivos:', errorListagem);
    } else if (arquivos && arquivos.length > 0) {
      const arquivosDoPeriodo = arquivos
        .filter(arquivo => arquivo.name.includes(periodo))
        .map(arquivo => arquivo.name);
      
      if (arquivosDoPeriodo.length > 0) {
        console.log(`[limpar-faturamento-periodo] Encontrados ${arquivosDoPeriodo.length} PDFs do período`);
        const { error: errorRemocao } = await supabase.storage
          .from('relatorios-faturamento')
          .remove(arquivosDoPeriodo);
        
        if (errorRemocao) {
          console.error('[limpar-faturamento-periodo] Erro ao remover PDFs:', errorRemocao);
        } else {
          resultados.pdfs_removidos = arquivosDoPeriodo.length;
          console.log(`[limpar-faturamento-periodo] ✅ PDFs: ${resultados.pdfs_removidos} arquivos removidos`);
        }
      }
    }

    console.log('[limpar-faturamento-periodo] ✅ LIMPEZA CONCLUÍDA');

    return new Response(JSON.stringify({
      success: true,
      periodo,
      resultados,
      message: `Limpeza completa do período ${periodo} realizada com sucesso`
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error('[limpar-faturamento-periodo] Erro:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error?.message || 'Erro desconhecido' 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});