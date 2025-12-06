import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalizar string para comparação (remove acentos, preposições, case)
function normalizar(str: string): string {
  return str
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/\b(DE|DA|DO|DAS|DOS|COM|SEM|PARA|POR|EM|NO|NA|NOS|NAS|E|OU)\b/gi, ' ') // Remove preposições
    .replace(/[^A-Z0-9\s]/g, '') // Remove caracteres especiais
    .replace(/\s+/g, ' ') // Normaliza espaços
    .trim();
}

// Calcular similaridade entre duas strings
function calcularSimilaridade(str1: string, str2: string): number {
  const s1 = normalizar(str1);
  const s2 = normalizar(str2);

  // Se são iguais após normalização
  if (s1 === s2) return 100;

  // Verificar contenção: se um está contido no outro
  if (s1.includes(s2) || s2.includes(s1)) {
    // O menor está contido no maior - alta similaridade
    const menor = s1.length < s2.length ? s1 : s2;
    const maior = s1.length < s2.length ? s2 : s1;
    // Quanto mais o menor representa do maior, maior a similaridade
    const proporcao = menor.length / maior.length;
    // Se menor tem pelo menos 50% do tamanho, considerar 90%+
    if (proporcao >= 0.3) return Math.round(85 + (proporcao * 15));
  }

  // Tokenizar
  const tokens1 = new Set(s1.split(/\s+/).filter(t => t.length > 1));
  const tokens2 = new Set(s2.split(/\s+/).filter(t => t.length > 1));

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  // Verificar se todos os tokens do menor estão no maior (contenção de tokens)
  const menorTokens = tokens1.size < tokens2.size ? tokens1 : tokens2;
  const maiorTokens = tokens1.size < tokens2.size ? tokens2 : tokens1;
  const todosContidos = [...menorTokens].every(t => maiorTokens.has(t));
  
  if (todosContidos && menorTokens.size >= 2) {
    // Todos os tokens do cadastro estão no fora do padrão
    const proporcao = menorTokens.size / maiorTokens.size;
    return Math.round(85 + (proporcao * 15));
  }

  // Calcular interseção
  const intersecao = [...tokens1].filter(t => tokens2.has(t)).length;
  const uniao = new Set([...tokens1, ...tokens2]).size;

  // Jaccard similarity * 100
  const jaccard = (intersecao / uniao) * 100;

  return Math.round(jaccard);
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

    const body = await req.json().catch(() => ({}));
    const limiarSimilaridade = body.limiar || 90; // Default: 90% de similaridade

    console.log(`🔗 INICIANDO VINCULAÇÃO AUTOMÁTICA - Limiar: ${limiarSimilaridade}%`);

    // 1. Buscar valores_referencia_de_para SEM vinculação
    const { data: valoresSemVinculo, error: errorValores } = await supabase
      .from('valores_referencia_de_para')
      .select('id, estudo_descricao')
      .is('cadastro_exame_id', null)
      .eq('ativo', true);

    if (errorValores) {
      throw new Error(`Erro ao buscar valores: ${errorValores.message}`);
    }

    console.log(`📦 Encontrados ${valoresSemVinculo?.length || 0} exames fora do padrão sem vinculação`);

    if (!valoresSemVinculo || valoresSemVinculo.length === 0) {
      return new Response(JSON.stringify({
        sucesso: true,
        mensagem: 'Todos os exames já estão vinculados',
        vinculados: 0,
        nao_vinculados: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 2. Buscar cadastro_exames ativos
    const { data: cadastroExames, error: errorCadastro } = await supabase
      .from('cadastro_exames')
      .select('id, nome')
      .eq('ativo', true);

    if (errorCadastro) {
      throw new Error(`Erro ao buscar cadastro: ${errorCadastro.message}`);
    }

    console.log(`📋 Carregados ${cadastroExames?.length || 0} exames do cadastro`);

    // 3. Criar índice normalizado para busca rápida
    const cadastroNormalizado = cadastroExames?.map(exame => ({
      id: exame.id,
      nome: exame.nome,
      nomeNormalizado: normalizar(exame.nome)
    })) || [];

    // 4. Processar vinculações automáticas
    let vinculados = 0;
    let naoVinculados = 0;
    const detalhesVinculados: any[] = [];
    const detalhesNaoVinculados: any[] = [];

    for (const valor of valoresSemVinculo) {
      const estudoNormalizado = normalizar(valor.estudo_descricao);
      
      // Buscar melhor correspondência
      let melhorMatch: { id: string; nome: string; similaridade: number } | null = null;

      for (const exame of cadastroNormalizado) {
        // Primeiro: verificar correspondência exata normalizada
        if (estudoNormalizado === exame.nomeNormalizado) {
          melhorMatch = { id: exame.id, nome: exame.nome, similaridade: 100 };
          break;
        }

        // Segundo: calcular similaridade
        const similaridade = calcularSimilaridade(valor.estudo_descricao, exame.nome);
        
        if (similaridade >= limiarSimilaridade) {
          if (!melhorMatch || similaridade > melhorMatch.similaridade) {
            melhorMatch = { id: exame.id, nome: exame.nome, similaridade };
          }
        }
      }

      if (melhorMatch) {
        // Vincular automaticamente
        const { error: errorUpdate } = await supabase
          .from('valores_referencia_de_para')
          .update({ 
            cadastro_exame_id: melhorMatch.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', valor.id);

        if (!errorUpdate) {
          vinculados++;
          detalhesVinculados.push({
            fora_padrao: valor.estudo_descricao,
            cadastro: melhorMatch.nome,
            similaridade: melhorMatch.similaridade
          });
          console.log(`✅ Vinculado: "${valor.estudo_descricao}" → "${melhorMatch.nome}" (${melhorMatch.similaridade}%)`);
        } else {
          console.error(`❌ Erro ao vincular ${valor.id}:`, errorUpdate);
        }
      } else {
        naoVinculados++;
        if (detalhesNaoVinculados.length < 20) {
          detalhesNaoVinculados.push({
            fora_padrao: valor.estudo_descricao
          });
        }
        console.log(`⚠️ Sem correspondência: "${valor.estudo_descricao}"`);
      }
    }

    const resultado = {
      sucesso: true,
      limiar_utilizado: limiarSimilaridade,
      total_processados: valoresSemVinculo.length,
      vinculados,
      nao_vinculados: naoVinculados,
      exemplos_vinculados: detalhesVinculados.slice(0, 10),
      exemplos_nao_vinculados: detalhesNaoVinculados.slice(0, 10),
      data_processamento: new Date().toISOString()
    };

    console.log('📊 Resultado final:', { vinculados, naoVinculados });

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Erro na vinculação automática:', error);
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        erro: error.message,
        detalhes: error.stack 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
