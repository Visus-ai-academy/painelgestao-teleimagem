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

    console.log('🔄 Iniciando aplicação de categorias faltando...');

    const { arquivo_fonte } = await req.json();
    const arquivoFonte = arquivo_fonte || 'volumetria_padrao';

    let totalCorrigidos = 0;
    let processadosLote = 0;
    let exemplosCategorias: Record<string, number> = {};

    // 1. Buscar todos os registros sem categoria
    console.log('📊 Buscando registros sem categoria...');
    const { data: registrosSemCategoria, error: errorRegistros } = await supabase
      .from('volumetria_mobilemed')
      .select('id, "ESTUDO_DESCRICAO", "MODALIDADE", "ESPECIALIDADE"')
      .eq('arquivo_fonte', arquivoFonte)
      .or('"CATEGORIA".is.null,"CATEGORIA".eq.""')
      .limit(30000);

    if (errorRegistros) {
      throw new Error(`Erro ao buscar registros: ${errorRegistros.message}`);
    }

    console.log(`📈 Encontrados ${registrosSemCategoria?.length || 0} registros sem categoria`);

    if (!registrosSemCategoria || registrosSemCategoria.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        total_corrigidos: 0,
        arquivo_fonte: arquivoFonte,
        message: 'Nenhum registro sem categoria encontrado'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Buscar cadastro de exames para referência
    const { data: cadastroExames } = await supabase
      .from('cadastro_exames')
      .select('nome, categoria')
      .eq('ativo', true)
      .not('categoria', 'is', null);

    const mapeamentoCategorias = new Map();
    cadastroExames?.forEach(exame => {
      const nomeNormalizado = exame.nome.toUpperCase().trim();
      mapeamentoCategorias.set(nomeNormalizado, exame.categoria);
    });

    console.log(`📚 Carregados ${mapeamentoCategorias.size} mapeamentos do cadastro de exames`);

    // 3. Categorias padrão por modalidade
    const categoriasPadrao: Record<string, string> = {
      'TC': 'TC',
      'RM': 'RM', 
      'RX': 'RX',
      'MG': 'MG',
      'US': 'US',
      'DO': 'DO',
      'MN': 'MN',
      'CR': 'RX',
      'DX': 'RX',
      'BMD': 'DO',
      'OT': 'GERAL'
    };

    // 4. Processar em lotes de 500
    const tamanhoLote = 500;
    const totalLotes = Math.ceil(registrosSemCategoria.length / tamanhoLote);

    for (let i = 0; i < totalLotes; i++) {
      const inicio = i * tamanhoLote;
      const fim = Math.min(inicio + tamanhoLote, registrosSemCategoria.length);
      const lote = registrosSemCategoria.slice(inicio, fim);

      console.log(`🔄 Processando lote ${i + 1}/${totalLotes} (${lote.length} registros)`);

      // Agrupar atualizações por categoria para fazer bulk updates
      const atualizacoesPorCategoria: Record<string, string[]> = {};

      for (const registro of lote) {
        let categoria = '';
        
        // Primeiro: tentar encontrar no cadastro de exames
        const estudoNormalizado = registro.ESTUDO_DESCRICAO?.toUpperCase().trim() || '';
        
        // Busca exata primeiro
        if (mapeamentoCategorias.has(estudoNormalizado)) {
          categoria = mapeamentoCategorias.get(estudoNormalizado);
        } else {
          // Busca por palavras-chave
          let encontrado = false;
          for (const [nomeExame, cat] of mapeamentoCategorias) {
            if (estudoNormalizado.includes(nomeExame) || nomeExame.includes(estudoNormalizado)) {
              categoria = cat;
              encontrado = true;
              break;
            }
          }
          
          // Se não encontrou, usar categoria padrão por modalidade
          if (!encontrado) {
            categoria = categoriasPadrao[registro.MODALIDADE] || 'GERAL';
          }
        }

        if (categoria) {
          if (!atualizacoesPorCategoria[categoria]) {
            atualizacoesPorCategoria[categoria] = [];
          }
          atualizacoesPorCategoria[categoria].push(registro.id);
        }
      }

      // Executar atualizações em bulk por categoria
      for (const [categoria, ids] of Object.entries(atualizacoesPorCategoria)) {
        if (ids.length > 0) {
          const { error: updateError } = await supabase
            .from('volumetria_mobilemed')
            .update({ 
              "CATEGORIA": categoria,
              updated_at: new Date().toISOString()
            })
            .in('id', ids);

          if (!updateError) {
            totalCorrigidos += ids.length;
            exemplosCategorias[categoria] = (exemplosCategorias[categoria] || 0) + ids.length;
            console.log(`✅ ${ids.length} registros atualizados para categoria ${categoria}`);
          } else {
            console.error(`❌ Erro ao atualizar categoria ${categoria}:`, updateError);
          }
        }
      }

      processadosLote += lote.length;
    }

    // Log da operação
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'APLICAR_CATEGORIAS_FALTANDO',
        record_id: `bulk_${arquivoFonte}`,
        new_data: {
          arquivo_fonte: arquivoFonte,
          total_processados: processadosLote,
          total_corrigidos: totalCorrigidos,
          exemplos_categorias: exemplosCategorias,
          mapeamentos_disponiveis: mapeamentoCategorias.size
        },
        user_email: 'system',
        severity: 'info'
      });

    const resultado = {
      success: true,
      arquivo_fonte: arquivoFonte,
      total_registros_processados: processadosLote,
      total_registros_corrigidos: totalCorrigidos,
      categorias_aplicadas: exemplosCategorias,
      mapeamentos_utilizados: mapeamentoCategorias.size,
      data_processamento: new Date().toISOString()
    };

    console.log('🏆 Aplicação de categorias finalizada:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('❌ Erro na aplicação de categorias:', error);
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