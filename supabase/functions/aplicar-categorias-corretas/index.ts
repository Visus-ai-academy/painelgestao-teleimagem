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

    console.log('🎯 Iniciando correção de categorias...');
    
    let totalCorrigidos = 0;
    const detalhesCorrecao: any = {};

    // Processar todos os arquivos de volumetria
    const arquivos = ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo'];

    for (const arquivo of arquivos) {
      console.log(`\n🔄 Processando arquivo: ${arquivo}`);
      
      // 1. MR → RM (Ressonância Magnética)
      const { data: mrData, error: mrError } = await supabase
        .from('volumetria_mobilemed')
        .update({ 
          "CATEGORIA": 'RM',
          updated_at: new Date().toISOString()
        })
        .eq('arquivo_fonte', arquivo)
        .eq('MODALIDADE', 'MR')
        .or('"CATEGORIA".is.null,"CATEGORIA".eq."","CATEGORIA".eq.SC')
        .select('id');

      const mrCorrigidos = mrData?.length || 0;
      console.log(`📊 MR → RM: ${mrCorrigidos} registros`);

      // 2. CT → TC (Tomografia Computadorizada)
      const { data: ctData, error: ctError } = await supabase
        .from('volumetria_mobilemed')
        .update({ 
          "CATEGORIA": 'TC',
          updated_at: new Date().toISOString()
        })
        .eq('arquivo_fonte', arquivo)
        .eq('MODALIDADE', 'CT')
        .or('"CATEGORIA".is.null,"CATEGORIA".eq."","CATEGORIA".eq.SC')
        .select('id');

      const ctCorrigidos = ctData?.length || 0;
      console.log(`📊 CT → TC: ${ctCorrigidos} registros`);

      // 3. RX → RX (Radiografia)
      const { data: rxData, error: rxError } = await supabase
        .from('volumetria_mobilemed')
        .update({ 
          "CATEGORIA": 'RX',
          updated_at: new Date().toISOString()
        })
        .eq('arquivo_fonte', arquivo)
        .eq('MODALIDADE', 'RX')
        .or('"CATEGORIA".is.null,"CATEGORIA".eq."","CATEGORIA".eq.SC')
        .select('id');

      const rxCorrigidos = rxData?.length || 0;
      console.log(`📊 RX → RX: ${rxCorrigidos} registros`);

      // 4. MG → MG (Mamografia)
      const { data: mgData, error: mgError } = await supabase
        .from('volumetria_mobilemed')
        .update({ 
          "CATEGORIA": 'MG',
          updated_at: new Date().toISOString()
        })
        .eq('arquivo_fonte', arquivo)
        .eq('MODALIDADE', 'MG')
        .or('"CATEGORIA".is.null,"CATEGORIA".eq."","CATEGORIA".eq.SC')
        .select('id');

      const mgCorrigidos = mgData?.length || 0;
      console.log(`📊 MG → MG: ${mgCorrigidos} registros`);

      // 5. DO → DO (Densitometria Óssea)
      const { data: doData, error: doError } = await supabase
        .from('volumetria_mobilemed')
        .update({ 
          "CATEGORIA": 'DO',
          updated_at: new Date().toISOString()
        })
        .eq('arquivo_fonte', arquivo)
        .eq('MODALIDADE', 'DO')
        .or('"CATEGORIA".is.null,"CATEGORIA".eq."","CATEGORIA".eq.SC')
        .select('id');

      const doCorrigidos = doData?.length || 0;
      console.log(`📊 DO → DO: ${doCorrigidos} registros`);

      const totalArquivo = mrCorrigidos + ctCorrigidos + rxCorrigidos + mgCorrigidos + doCorrigidos;
      totalCorrigidos += totalArquivo;
      
      detalhesCorrecao[arquivo] = {
        MR_para_RM: mrCorrigidos,
        CT_para_TC: ctCorrigidos,
        RX_para_RX: rxCorrigidos,
        MG_para_MG: mgCorrigidos,
        DO_para_DO: doCorrigidos,
        total_arquivo: totalArquivo,
        erros: [mrError, ctError, rxError, mgError, doError].filter(e => e).map(e => e.message)
      };

      console.log(`✅ Total corrigido em ${arquivo}: ${totalArquivo} registros`);
    }

    // Aplicar especialidades baseadas no cadastro de exames para registros sem especialidade
    console.log('\n🔄 Aplicando especialidades do cadastro...');
    
    let especialidadesCorrigidas = 0;
    for (const arquivo of arquivos) {
      const { data: especialidadeData, error: especialidadeError } = await supabase
        .from('volumetria_mobilemed')
        .update({
          "ESPECIALIDADE": supabase.raw(`(
            SELECT ce.especialidade 
            FROM cadastro_exames ce 
            WHERE ce.nome = volumetria_mobilemed."ESTUDO_DESCRICAO" 
              AND ce.ativo = true 
              AND ce.especialidade IS NOT NULL 
              AND ce.especialidade != ''
            LIMIT 1
          )`),
          updated_at: new Date().toISOString()
        })
        .eq('arquivo_fonte', arquivo)
        .or('"ESPECIALIDADE".is.null,"ESPECIALIDADE".eq."","ESPECIALIDADE".eq.GERAL')
        .select('id');

      const espCorrigidos = especialidadeData?.length || 0;
      especialidadesCorrigidas += espCorrigidos;
      console.log(`📊 Especialidades corrigidas em ${arquivo}: ${espCorrigidos} registros`);
    }

    const resultado = {
      success: true,
      total_corrigidos: totalCorrigidos,
      especialidades_corrigidas: especialidadesCorrigidas,
      detalhes_por_arquivo: detalhesCorrecao,
      timestamp: new Date().toISOString(),
      observacao: 'Correção completa de categorias e especialidades aplicada'
    };

    console.log('🏆 Correção de categorias concluída:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('❌ Erro na correção de categorias:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        erro: error.message,
        detalhes: error.stack,
        observacoes: 'Erro interno na correção de categorias'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});