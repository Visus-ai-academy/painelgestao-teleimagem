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

    const { arquivo_fonte = 'volumetria_padrao' } = await req.json();
    
    console.log(`🔧 Iniciando correção de regras para arquivo: ${arquivo_fonte}`);

    let totalCorrigidos = 0;
    const correcoes = {
      modalidades: 0,
      categorias: 0,
      prioridades: 0,
      especialidades: 0
    };

    // 1. Corrigir modalidades BMD para DO
    console.log('🔄 Corrigindo modalidade BMD → DO');
    const { data: registrosBMD, error: erroBMD } = await supabase
      .from('volumetria_mobilemed')
      .select('id, "ESTUDO_DESCRICAO"')
      .eq('arquivo_fonte', arquivo_fonte)
      .eq('MODALIDADE', 'BMD');

    if (erroBMD) throw erroBMD;

    if (registrosBMD && registrosBMD.length > 0) {
      const { error: updateBMD } = await supabase
        .from('volumetria_mobilemed')
        .update({ MODALIDADE: 'DO' })
        .eq('arquivo_fonte', arquivo_fonte)
        .eq('MODALIDADE', 'BMD');

      if (!updateBMD) {
        correcoes.modalidades = registrosBMD.length;
        console.log(`✅ ${registrosBMD.length} registros BMD corrigidos para DO`);
      }
    }

    // 2. Corrigir modalidades CR/DX para RX (exceto mamografias)
    console.log('🔄 Corrigindo modalidades CR/DX → RX');
    const { error: updateCRDX } = await supabase
      .from('volumetria_mobilemed')
      .update({ MODALIDADE: 'RX' })
      .eq('arquivo_fonte', arquivo_fonte)
      .in('MODALIDADE', ['CR', 'DX'])
      .not('ESTUDO_DESCRICAO', 'ilike', '%mamografia%');

    if (!updateCRDX) {
      console.log('✅ Modalidades CR/DX corrigidas para RX');
    }

    // 3. Corrigir mamografias CR/DX para MG
    const { error: updateMG } = await supabase
      .from('volumetria_mobilemed')
      .update({ MODALIDADE: 'MG' })
      .eq('arquivo_fonte', arquivo_fonte)
      .in('MODALIDADE', ['CR', 'DX'])
      .ilike('ESTUDO_DESCRICAO', '%mamografia%');

    if (!updateMG) {
      console.log('✅ Mamografias CR/DX corrigidas para MG');
    }

    // 4. Aplicar categorias vazias baseado no cadastro_exames
    console.log('🔄 Aplicando categorias baseadas no cadastro');
    const { data: semCategoria } = await supabase
      .from('volumetria_mobilemed')
      .select('id, "ESTUDO_DESCRICAO"')
      .eq('arquivo_fonte', arquivo_fonte)
      .or('CATEGORIA.is.null,CATEGORIA.eq.');

    if (semCategoria && semCategoria.length > 0) {
      // Buscar categorias do cadastro_exames
      const { data: cadastroExames } = await supabase
        .from('cadastro_exames')
        .select('nome, categoria')
        .not('categoria', 'is', null)
        .neq('categoria', '');

      const categoriasMap = new Map<string, string>();
      cadastroExames?.forEach(exame => {
        categoriasMap.set(exame.nome.toUpperCase().trim(), exame.categoria);
      });

      // Aplicar categorias
      for (const registro of semCategoria) {
        const categoria = categoriasMap.get(registro.ESTUDO_DESCRICAO?.toUpperCase()?.trim() || '');
        if (categoria) {
          await supabase
            .from('volumetria_mobilemed')
            .update({ CATEGORIA: categoria })
            .eq('id', registro.id);
          correcoes.categorias++;
        } else {
          // Categoria padrão
          await supabase
            .from('volumetria_mobilemed')
            .update({ CATEGORIA: 'SC' })
            .eq('id', registro.id);
          correcoes.categorias++;
        }
      }
      console.log(`✅ ${correcoes.categorias} categorias aplicadas`);
    }

    // 5. Padronizar prioridades
    console.log('🔄 Padronizando prioridades');
    const prioridadesMap = new Map([
      ['ROTINA', 'ROTINA'],
      ['Rotina', 'ROTINA'],
      ['rotina', 'ROTINA'],
      ['PLANTÃO', 'PLANTÃO'],
      ['Plantão', 'PLANTÃO'],
      ['plantão', 'PLANTÃO'],
      ['URGÊNCIA', 'URGÊNCIA'],
      ['Urgência', 'URGÊNCIA'],
      ['urgência', 'URGÊNCIA'],
      ['URGENCIA', 'URGÊNCIA'],
      ['Urgencia', 'URGÊNCIA'],
      ['urgencia', 'URGÊNCIA'],
      ['INTERNADO', 'ROTINA'], // CORREÇÃO: INTERNADO vira ROTINA
      ['Internado', 'ROTINA'],
      ['internado', 'ROTINA'],
    ]);

    for (const [original, nova] of prioridadesMap) {
      const { error } = await supabase
        .from('volumetria_mobilemed')
        .update({ PRIORIDADE: nova })
        .eq('arquivo_fonte', arquivo_fonte)
        .eq('PRIORIDADE', original);

      if (!error) {
        console.log(`✅ Prioridade ${original} → ${nova} aplicada`);
      }
    }

    // 6. Aplicar tipificação de faturamento
    console.log('🔄 Aplicando tipificação de faturamento');
    await supabase
      .from('volumetria_mobilemed')
      .update({ tipo_faturamento: 'alta_complexidade' })
      .eq('arquivo_fonte', arquivo_fonte)
      .in('MODALIDADE', ['CT', 'MR', 'DO']);

    await supabase
      .from('volumetria_mobilemed')
      .update({ tipo_faturamento: 'padrao' })
      .eq('arquivo_fonte', arquivo_fonte)
      .not('MODALIDADE', 'in', '("CT","MR","DO")');

    // Contar total de correções
    const { data: contagem } = await supabase
      .from('volumetria_mobilemed')
      .select('id', { count: 'exact' })
      .eq('arquivo_fonte', arquivo_fonte);

    totalCorrigidos = contagem?.length || 0;

    const resultado = {
      success: true,
      arquivo_fonte,
      total_registros_processados: totalCorrigidos,
      correcoes_aplicadas: correcoes,
      regras_aplicadas: [
        'Correção BMD → DO',
        'Correção CR/DX → RX/MG', 
        'Aplicação de categorias baseadas no cadastro',
        'Padronização de prioridades (INTERNADO → ROTINA)',
        'Tipificação de faturamento'
      ],
      data_processamento: new Date().toISOString()
    };

    console.log(`🏆 Correção finalizada:`, resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('💥 Erro na correção:', error);
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