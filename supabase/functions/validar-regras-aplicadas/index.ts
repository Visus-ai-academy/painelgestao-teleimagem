import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidacaoRegra {
  regra: string;
  aplicada: boolean;
  detalhes?: any;
  erro?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { arquivo_fonte } = await req.json();
    
    if (!arquivo_fonte) {
      throw new Error('Parâmetro arquivo_fonte é obrigatório');
    }

    console.log(`🔍 Validando regras aplicadas para: ${arquivo_fonte}`);

    const validacoes: ValidacaoRegra[] = [];

    // ============================================================================
    // VALIDAÇÃO 1: MODALIDADES PROBLEMÁTICAS
    // ============================================================================
    
    const { count: modalidadesProblematicas } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', arquivo_fonte)
      .in('MODALIDADE', ['BMD', 'CR', 'DX', 'OT']);

    validacoes.push({
      regra: 'Modalidades Corrigidas',
      aplicada: (modalidadesProblematicas || 0) === 0,
      detalhes: { registros_problematicos: modalidadesProblematicas }
    });

    // ============================================================================
    // VALIDAÇÃO 2: ESPECIALIDADES PROBLEMÁTICAS
    // ============================================================================
    
    const { count: especialidadesProblematicas } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', arquivo_fonte)
      .in('ESPECIALIDADE', ['ONCO MEDICINA INTERNA', 'CT', 'Colunas']);

    validacoes.push({
      regra: 'Especialidades Corrigidas',
      aplicada: (especialidadesProblematicas || 0) === 0,
      detalhes: { registros_problematicos: especialidadesProblematicas }
    });

    // ============================================================================
    // VALIDAÇÃO 3: PRIORIDADES PROBLEMÁTICAS
    // ============================================================================
    
    const { count: prioridadesProblematicas } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', arquivo_fonte)
      .eq('PRIORIDADE', 'AMBULATORIO');

    validacoes.push({
      regra: 'Prioridades Corrigidas',
      aplicada: (prioridadesProblematicas || 0) === 0,
      detalhes: { registros_problematicos: prioridadesProblematicas }
    });

    // ============================================================================
    // VALIDAÇÃO 4: CATEGORIAS APLICADAS
    // ============================================================================
    
    const { count: totalRegistros } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', arquivo_fonte);

    const { count: semCategoria } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', arquivo_fonte)
      .or('"CATEGORIA".is.null,"CATEGORIA".eq.""');

    const percentualSemCategoria = totalRegistros > 0 ? ((semCategoria || 0) / totalRegistros) * 100 : 0;

    validacoes.push({
      regra: 'Categorias Aplicadas',
      aplicada: percentualSemCategoria < 5, // Menos de 5% sem categoria é aceitável
      detalhes: { 
        sem_categoria: semCategoria,
        total: totalRegistros,
        percentual_sem_categoria: percentualSemCategoria.toFixed(2) + '%'
      }
    });

    // ============================================================================
    // VALIDAÇÃO 5: TIPIFICAÇÃO DE FATURAMENTO
    // ============================================================================
    
    const { count: semTipificacao } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', arquivo_fonte)
      .or('tipo_faturamento.is.null,tipo_faturamento.eq.""');

    const percentualSemTipificacao = totalRegistros > 0 ? ((semTipificacao || 0) / totalRegistros) * 100 : 0;

    validacoes.push({
      regra: 'Tipificação de Faturamento',
      aplicada: percentualSemTipificacao < 5,
      detalhes: {
        sem_tipificacao: semTipificacao,
        total: totalRegistros,
        percentual_sem_tipificacao: percentualSemTipificacao.toFixed(2) + '%'
      }
    });

    const todasValidas = validacoes.every(v => v.aplicada);

    const resultado = {
      todas_validas: todasValidas,
      total_registros: totalRegistros,
      validacoes,
      arquivo_fonte,
      timestamp: new Date().toISOString()
    };

    console.log('📋 Validação concluída:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('❌ Erro na validação:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});