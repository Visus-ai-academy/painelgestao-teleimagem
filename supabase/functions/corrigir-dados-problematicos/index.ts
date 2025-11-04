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

    console.log('🔧 Iniciando correção de dados problemáticos...');

    let totalCorrigidos = 0;
    const correcoes = {
      especialidades: 0,
      modalidades: 0,
      prioridades: 0,
      categorias: 0
    };

    // 1. Corrigir especialidade "ONCO MEDICINA INTERNA" → "MEDICINA INTERNA"
    console.log('🔄 Corrigindo ESPECIALIDADE "ONCO MEDICINA INTERNA" → "MEDICINA INTERNA"');
    const { data: oncoMedIntCorrigidos, error: errorOncoMedInt } = await supabase
      .from('volumetria_mobilemed')
      .update({ 
        "ESPECIALIDADE": 'MEDICINA INTERNA',
        updated_at: new Date().toISOString()
      })
      .eq('ESPECIALIDADE', 'ONCO MEDICINA INTERNA')
      .select('id');

    if (errorOncoMedInt) {
      console.error('❌ Erro ao corrigir ONCO MEDICINA INTERNA:', errorOncoMedInt);
    } else {
      const corrigidosOncoMedInt = oncoMedIntCorrigidos?.length || 0;
      correcoes.especialidades += corrigidosOncoMedInt;
      console.log(`✅ ${corrigidosOncoMedInt} registros corrigidos: "ONCO MEDICINA INTERNA" → "MEDICINA INTERNA"`);
    }

    // 2. Corrigir especialidade "CT" usando cadastro_exames (CT não é especialidade, é modalidade)
    console.log('🔄 Corrigindo ESPECIALIDADE "CT" baseado no cadastro_exames');
    
    // Buscar registros com CT
    const { data: registrosCt, error: errorSelectCt } = await supabase
      .from('volumetria_mobilemed')
      .select('id, "ESTUDO_DESCRICAO"')
      .eq('ESPECIALIDADE', 'CT');

    if (!errorSelectCt && registrosCt && registrosCt.length > 0) {
      console.log(`📊 Encontrados ${registrosCt.length} registros com ESPECIALIDADE = "CT"`);
      
      // Buscar cadastro de exames
      const { data: cadastroExames } = await supabase
        .from('cadastro_exames')
        .select('nome, especialidade')
        .eq('ativo', true);

      const mapaExames = new Map();
      cadastroExames?.forEach(ex => mapaExames.set(ex.nome.toUpperCase().trim(), ex.especialidade));

      let ctCorrigidos = 0;
      for (const reg of registrosCt) {
        if (reg.ESTUDO_DESCRICAO) {
          const especialidadeCorreta = mapaExames.get(reg.ESTUDO_DESCRICAO.toUpperCase().trim());
          if (especialidadeCorreta) {
            await supabase
              .from('volumetria_mobilemed')
              .update({ 
                "ESPECIALIDADE": especialidadeCorreta,
                updated_at: new Date().toISOString()
              })
              .eq('id', reg.id);
            ctCorrigidos++;
          }
        }
      }
      
      correcoes.especialidades += ctCorrigidos;
      console.log(`✅ ${ctCorrigidos} registros corrigidos: ESPECIALIDADE "CT" → especialidade do cadastro`);
    }

    // 3. Verificar e corrigir especialidade "Colunas" se existir
    console.log('🔄 Verificando ESPECIALIDADE "Colunas"');
    const { data: colunasCorrigidos, error: errorColunas } = await supabase
      .from('volumetria_mobilemed')
      .update({ 
        "ESPECIALIDADE": 'MUSCULOESQUELETICO',
        updated_at: new Date().toISOString()
      })
      .eq('ESPECIALIDADE', 'Colunas')
      .select('id');

    if (errorColunas) {
      console.error('❌ Erro ao corrigir especialidade Colunas:', errorColunas);
    } else {
      const corrigidosColunas = colunasCorrigidos?.length || 0;
      if (corrigidosColunas > 0) {
        correcoes.especialidades += corrigidosColunas;
        console.log(`✅ ${corrigidosColunas} registros corrigidos: ESPECIALIDADE "Colunas" → "MUSCULOESQUELETICO"`);
      }
    }

    // 4. Verificar e corrigir prioridade "AMBULATORIO" se existir
    console.log('🔄 Verificando PRIORIDADE "AMBULATORIO"');
    const { data: ambulatorioCorrigidos, error: errorAmbulatorio } = await supabase
      .from('volumetria_mobilemed')
      .update({ 
        "PRIORIDADE": 'ROTINA',
        updated_at: new Date().toISOString()
      })
      .eq('PRIORIDADE', 'AMBULATORIO')
      .select('id');

    if (errorAmbulatorio) {
      console.error('❌ Erro ao corrigir prioridade AMBULATORIO:', errorAmbulatorio);
    } else {
      const corrigidosAmbulatorio = ambulatorioCorrigidos?.length || 0;
      if (corrigidosAmbulatorio > 0) {
        correcoes.prioridades += corrigidosAmbulatorio;
        console.log(`✅ ${corrigidosAmbulatorio} registros corrigidos: PRIORIDADE "AMBULATORIO" → "ROTINA"`);
      }
    }

    // 5. Aplicar tipificação de faturamento nos registros corrigidos
    console.log('🔄 Aplicando tipificação de faturamento');
    const { data: tipificacaoResult, error: errorTipificacao } = await supabase
      .from('volumetria_mobilemed')
      .update({
        tipo_faturamento: 'padrao',
        updated_at: new Date().toISOString()
      })
      .or('ESPECIALIDADE.eq.MEDICINA INTERNA,ESPECIALIDADE.eq.GERAL,ESPECIALIDADE.eq.MUSCULOESQUELETICO')
      .is('tipo_faturamento', null)
      .select('id');

    if (!errorTipificacao && tipificacaoResult) {
      console.log(`✅ Tipificação aplicada em ${tipificacaoResult.length} registros`);
    }

    totalCorrigidos = correcoes.especialidades + correcoes.modalidades + correcoes.prioridades + correcoes.categorias;

    // Log da operação
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'CORRECAO_DADOS_PROBLEMATICOS',
        record_id: 'bulk_correction',
        new_data: {
          total_corrigidos: totalCorrigidos,
          correcoes_aplicadas: correcoes,
          regras_aplicadas: [
            'ESPECIALIDADE "ONCO MEDICINA INTERNA" → "MEDICINA INTERNA"',
            'ESPECIALIDADE "CT" → "GERAL"', 
            'ESPECIALIDADE "Colunas" → "MUSCULOESQUELETICO"',
            'PRIORIDADE "AMBULATORIO" → "ROTINA"',
            'Tipificação de faturamento aplicada'
          ]
        },
        user_email: 'system',
        severity: 'info'
      });

    const resultado = {
      success: true,
      total_registros_corrigidos: totalCorrigidos,
      correcoes_aplicadas: correcoes,
      regras_aplicadas: [
        'ESPECIALIDADE "ONCO MEDICINA INTERNA" → "MEDICINA INTERNA"',
        'ESPECIALIDADE "CT" → "GERAL"',
        'ESPECIALIDADE "Colunas" → "MUSCULOESQUELETICO"', 
        'PRIORIDADE "AMBULATORIO" → "ROTINA"',
        'Tipificação de faturamento aplicada'
      ],
      data_processamento: new Date().toISOString()
    };

    console.log('🏆 Correção finalizada:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('❌ Erro na correção de dados problemáticos:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: error.stack 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});