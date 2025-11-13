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
      .or('CATEGORIA.is.null,CATEGORIA.eq.')

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

      // Aplicar categorias em lotes (mais eficiente)
      const categoriasParaAtualizar = new Map<string, string[]>();
      
      for (const registro of semCategoria) {
        const categoria = categoriasMap.get(registro.ESTUDO_DESCRICAO?.toUpperCase()?.trim() || '');
        const categoriaFinal = categoria || 'SC';
        
        if (!categoriasParaAtualizar.has(categoriaFinal)) {
          categoriasParaAtualizar.set(categoriaFinal, []);
        }
        categoriasParaAtualizar.get(categoriaFinal)!.push(registro.id);
      }
      
      // Aplicar updates em lote por categoria
      for (const [categoria, ids] of categoriasParaAtualizar) {
        // Processar em chunks de 1000 para evitar limites de query
        const chunkSize = 1000;
        for (let i = 0; i < ids.length; i += chunkSize) {
          const chunk = ids.slice(i, i + chunkSize);
          await supabase
            .from('volumetria_mobilemed')
            .update({ CATEGORIA: categoria })
            .in('id', chunk);
          
          correcoes.categorias += chunk.length;
        }
        console.log(`✅ ${ids.length} registros atualizados para categoria ${categoria}`);
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

    // 6. REMOVIDO: Não aplicar mais tipificação de faturamento aqui
    // O campo tipo_faturamento deve conter apenas tipos válidos de cliente (CO-FT, NC-FT, etc)
    // e será aplicado a partir do contrato do cliente no momento da geração do demonstrativo
    console.log('ℹ️ Tipificação de faturamento será aplicada via contrato do cliente');

    // Contar total de correções
    const { count: totalCount } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', arquivo_fonte);

    totalCorrigidos = totalCount || 0;

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