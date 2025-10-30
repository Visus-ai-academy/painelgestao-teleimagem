import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MedicoComparativo {
  nome_volumetria: string | null;
  nome_cadastro: string | null;
  medico_cadastro_id: string | null;
  status_cadastro: boolean | null; // true = Ativo, false = Inativo
  nome_repasse: string | null;
  quantidade_exames_volumetria: number;
  quantidade_registros_repasse: number;
  status: 'ok' | 'divergente_volumetria' | 'divergente_repasse' | 'divergente_ambos';
  sugestoes_cadastro: Array<{ id: string; nome: string; similaridade: number }>;
}

interface ComparativoResult {
  comparacoes: MedicoComparativo[];
  estatisticas: {
    total_cadastrados: number;
    total_divergencias: number;
    total_mapeados: number;
  };
}

interface MedicoCadastrado {
  id: string;
  nome: string;
  crm: string | null;
  ativo: boolean;
  nome_normalizado: string;
}

interface MedicoVolumetria {
  nome_original: string;
  nome_normalizado: string;
  quantidade_exames: number;
  encontrado_cadastro: boolean;
  sugestoes_match: string[];
}

interface MedicoRepasse {
  medico_id: string | null;
  medico_nome: string | null;
  nome_normalizado: string;
  quantidade_registros: number;
  encontrado_cadastro: boolean;
}

interface Divergencia {
  tipo: 'volumetria_nao_cadastrado' | 'repasse_sem_medico' | 'nome_diferente' | 'possivel_match';
  origem: 'volumetria' | 'repasse';
  nome_origem: string;
  medico_id?: string;
  sugestoes: string[];
  detalhes: string;
}

// Função de normalização para comparação
const normalizar = (s: string | null): string => {
  if (!s) return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\bdr\.?\s*/gi, '')
    .replace(/\bdra\.?\s*/gi, '');
};

// Extrai tokens de um nome (palavras individuais)
const extrairTokens = (nome: string): string[] => {
  return normalizar(nome)
    .split(/\s+/)
    .filter(t => t.length > 0);
};

// Verifica se um token é uma inicial (ex: "m", "m.")
const ehInicial = (token: string): boolean => {
  return token.length === 1 || (token.length === 2 && token.endsWith('.'));
};

// Extrai a letra de uma inicial
const letraInicial = (token: string): string => {
  return token.charAt(0);
};

// Verifica se dois nomes podem ser o mesmo considerando abreviações
const matchComAbreviacoes = (nome1: string, nome2: string): boolean => {
  const tokens1 = extrairTokens(nome1);
  const tokens2 = extrairTokens(nome2);
  
  if (tokens1.length === 0 || tokens2.length === 0) return false;
  
  // Se os nomes são exatamente iguais após normalização
  if (tokens1.join(' ') === tokens2.join(' ')) return true;
  
  // Verifica se todos os tokens de um nome correspondem aos do outro
  // considerando que iniciais podem corresponder a nomes completos
  const verificarMatch = (tokensA: string[], tokensB: string[]): boolean => {
    let matchCount = 0;
    const usedIndices = new Set<number>();
    
    for (const tokenA of tokensA) {
      let encontrou = false;
      
      for (let i = 0; i < tokensB.length; i++) {
        if (usedIndices.has(i)) continue;
        
        const tokenB = tokensB[i];
        
        // Match exato
        if (tokenA === tokenB) {
          matchCount++;
          usedIndices.add(i);
          encontrou = true;
          break;
        }
        
        // Se tokenA é inicial, verifica se tokenB começa com a mesma letra
        if (ehInicial(tokenA) && tokenB.startsWith(letraInicial(tokenA))) {
          matchCount++;
          usedIndices.add(i);
          encontrou = true;
          break;
        }
        
        // Se tokenB é inicial, verifica se tokenA começa com a mesma letra
        if (ehInicial(tokenB) && tokenA.startsWith(letraInicial(tokenB))) {
          matchCount++;
          usedIndices.add(i);
          encontrou = true;
          break;
        }
      }
      
      if (!encontrou) return false;
    }
    
    // Considera match se pelo menos 70% dos tokens correspondem
    return matchCount >= Math.min(tokensA.length, tokensB.length) * 0.7;
  };
  
  return verificarMatch(tokens1, tokens2) || verificarMatch(tokens2, tokens1);
};

// Calcular similaridade entre strings (Levenshtein simplificado)
const calcularSimilaridade = (s1: string, s2: string): number => {
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const maxLen = Math.max(len1, len2);
  return maxLen === 0 ? 1 : 1 - matrix[len1][len2] / maxLen;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Iniciando comparativo de nomes de médicos...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Buscar todos os médicos cadastrados (incluindo inativos)
    console.log('📋 Buscando médicos cadastrados...');
    const { data: medicosCadastrados, error: erroCadastrados } = await supabase
      .from('medicos')
      .select('id, nome, crm, ativo');

    if (erroCadastrados) throw erroCadastrados;

    const cadastrados: MedicoCadastrado[] = (medicosCadastrados || []).map(m => ({
      id: m.id,
      nome: m.nome,
      crm: m.crm,
      ativo: m.ativo,
      nome_normalizado: normalizar(m.nome)
    }));

    console.log(`✅ Encontrados ${cadastrados.length} médicos cadastrados`);

    // 2. Buscar médicos únicos da volumetria
    console.log('📊 Buscando médicos da volumetria...');
    const { data: volumetriaData, error: erroVolumetria } = await supabase
      .from('volumetria_mobilemed')
      .select('MEDICO');

    if (erroVolumetria) throw erroVolumetria;

    // Nomes a serem ignorados (não são médicos)
    const nomesIgnorados = [
      'teste medico',
      'ana caroline blanco carreiro',
      'juliano manzoli marques luiz'
    ];

    // Agrupar e contar por médico (ignorando nomes da lista)
    const volumetriaMap = new Map<string, number>();
    (volumetriaData || []).forEach(v => {
      if (v.MEDICO) {
        const normalizado = normalizar(v.MEDICO);
        // Ignorar nomes da lista de exclusão
        if (nomesIgnorados.includes(normalizado)) {
          return;
        }
        volumetriaMap.set(v.MEDICO, (volumetriaMap.get(v.MEDICO) || 0) + 1);
      }
    });

    const volumetria: MedicoVolumetria[] = Array.from(volumetriaMap.entries()).map(([nome, qtd]) => {
      const nomeNorm = normalizar(nome);
      
      // Busca por match exato ou com abreviações
      const encontrado = cadastrados.some(c => 
        c.nome_normalizado === nomeNorm || matchComAbreviacoes(nome, c.nome)
      );
      
      // Buscar sugestões de match (similaridade > 0.75 ou match com abreviações)
      const sugestoes: string[] = [];
      if (!encontrado) {
        cadastrados.forEach(c => {
          const similaridade = calcularSimilaridade(nomeNorm, c.nome_normalizado);
          const temAbreviacao = matchComAbreviacoes(nome, c.nome);
          
          if (temAbreviacao || (similaridade > 0.75 && similaridade < 1)) {
            const score = temAbreviacao ? 95 : Math.round(similaridade * 100);
            sugestoes.push(`${c.nome} (${score}%)`);
          }
        });
        
        // Ordenar por score
        sugestoes.sort((a, b) => {
          const scoreA = parseInt(a.match(/\((\d+)%\)/)?.[1] || '0');
          const scoreB = parseInt(b.match(/\((\d+)%\)/)?.[1] || '0');
          return scoreB - scoreA;
        });
      }

      return {
        nome_original: nome,
        nome_normalizado: nomeNorm,
        quantidade_exames: qtd,
        encontrado_cadastro: encontrado,
        sugestoes_match: sugestoes.slice(0, 3) // Top 3 sugestões
      };
    });

    console.log(`✅ Encontrados ${volumetria.length} médicos únicos na volumetria`);

    // 3. Buscar médicos do repasse (incluindo nome original)
    console.log('💰 Buscando médicos do repasse...');
    const { data: repasseData, error: erroRepasse } = await supabase
      .from('medicos_valores_repasse')
      .select('medico_id, medico_nome_original');

    if (erroRepasse) throw erroRepasse;

    // Agrupar por medico_id OU medico_nome_original
    const repasseMap = new Map<string, { medico_id: string | null; nome_original: string | null; qtd: number }>();
    
    (repasseData || []).forEach(r => {
      const key = r.medico_id || r.medico_nome_original || 'SEM_MEDICO';
      const existing = repasseMap.get(key);
      
      if (existing) {
        existing.qtd++;
      } else {
        repasseMap.set(key, {
          medico_id: r.medico_id,
          nome_original: r.medico_nome_original,
          qtd: 1
        });
      }
    });

    // Buscar nomes dos médicos que têm ID
    const medicosIds = Array.from(repasseMap.values())
      .filter(r => r.medico_id && r.medico_id !== 'SEM_MEDICO')
      .map(r => r.medico_id as string);
    
    const { data: medicosRepasse } = medicosIds.length > 0 
      ? await supabase.from('medicos').select('id, nome').in('id', medicosIds)
      : { data: [] };

    const medicosRepasseMap = new Map((medicosRepasse || []).map(m => [m.id, m.nome]));

    const repasse: MedicoRepasse[] = Array.from(repasseMap.entries()).map(([key, dados]) => {
      // Se tem medico_id, usar o nome do cadastro
      const nomeUsado = dados.medico_id 
        ? medicosRepasseMap.get(dados.medico_id) || dados.nome_original
        : dados.nome_original;
      
      const nomeNorm = normalizar(nomeUsado || '');
      const encontrado = dados.medico_id && dados.medico_id !== 'SEM_MEDICO' && 
                        cadastrados.some(c => c.id === dados.medico_id);

      return {
        medico_id: dados.medico_id === 'SEM_MEDICO' ? null : dados.medico_id,
        medico_nome: nomeUsado || null,
        nome_normalizado: nomeNorm,
        quantidade_registros: dados.qtd,
        encontrado_cadastro: encontrado
      };
    });

    console.log(`✅ Encontrados ${repasse.length} médicos no repasse`);

    // 4. Criar comparações unificadas
    console.log('🔍 Criando comparações unificadas...');
    const comparacoesMap = new Map<string, MedicoComparativo>();

    // Adicionar médicos cadastrados como base
    cadastrados.forEach(c => {
      comparacoesMap.set(c.nome_normalizado, {
        nome_volumetria: null,
        nome_cadastro: c.nome,
        medico_cadastro_id: c.id,
        status_cadastro: c.ativo,
        nome_repasse: null,
        quantidade_exames_volumetria: 0,
        quantidade_registros_repasse: 0,
        status: 'ok',
        sugestoes_cadastro: []
      });
    });

    // Adicionar dados da volumetria
    volumetria.forEach(v => {
      // Busca por match exato ou com abreviações
      const cadastrado = cadastrados.find(c => 
        c.nome_normalizado === v.nome_normalizado || matchComAbreviacoes(v.nome_original, c.nome)
      );
      
      if (cadastrado) {
        const comp = comparacoesMap.get(cadastrado.nome_normalizado)!;
        comp.nome_volumetria = v.nome_original;
        comp.quantidade_exames_volumetria = v.quantidade_exames;
        
        // Verificar se nome é diferente (mas não considerar divergente se for só abreviação)
        const nomesDiferentes = v.nome_original !== cadastrado.nome;
        const ehApenasAbreviacao = matchComAbreviacoes(v.nome_original, cadastrado.nome);
        
        if (nomesDiferentes && !ehApenasAbreviacao) {
          comp.status = comp.status === 'divergente_repasse' ? 'divergente_ambos' : 'divergente_volumetria';
        }
      } else {
        // Médico não cadastrado - criar nova entrada com sugestões
        const sugestoes = cadastrados
          .map(c => {
            const similaridade = calcularSimilaridade(v.nome_normalizado, c.nome_normalizado);
            const temAbreviacao = matchComAbreviacoes(v.nome_original, c.nome);
            const score = temAbreviacao ? 0.95 : similaridade;
            
            return {
              id: c.id,
              nome: c.nome,
              similaridade: score
            };
          })
          .filter(s => s.similaridade > 0.7)
          .sort((a, b) => b.similaridade - a.similaridade)
          .slice(0, 3);

        comparacoesMap.set(v.nome_original, {
          nome_volumetria: v.nome_original,
          nome_cadastro: null,
          medico_cadastro_id: null,
          status_cadastro: null,
          nome_repasse: null,
          quantidade_exames_volumetria: v.quantidade_exames,
          quantidade_registros_repasse: 0,
          status: 'divergente_volumetria',
          sugestoes_cadastro: sugestoes
        });
      }
    });

    // Adicionar dados do repasse
    repasse.forEach(r => {
      if (r.medico_id) {
        // Repasse com médico_id - buscar no cadastro
        const cadastrado = cadastrados.find(c => c.id === r.medico_id);
        if (cadastrado) {
          const comp = comparacoesMap.get(cadastrado.nome_normalizado)!;
          comp.nome_repasse = r.medico_nome || null;
          comp.quantidade_registros_repasse = r.quantidade_registros;
          
          // Verificar se nome é diferente
          if (r.medico_nome && r.medico_nome !== cadastrado.nome) {
            comp.status = comp.status === 'divergente_volumetria' ? 'divergente_ambos' : 'divergente_repasse';
          }
        }
      } else if (r.medico_nome) {
        // Repasse SEM medico_id, mas COM nome - tentar fazer match por nome
        const cadastrado = cadastrados.find(c => 
          c.nome_normalizado === r.nome_normalizado || matchComAbreviacoes(r.medico_nome || '', c.nome)
        );
        
        if (cadastrado) {
          // Encontrou match por nome - adicionar ao médico cadastrado
          const comp = comparacoesMap.get(cadastrado.nome_normalizado)!;
          comp.nome_repasse = r.medico_nome;
          comp.quantidade_registros_repasse = (comp.quantidade_registros_repasse || 0) + r.quantidade_registros;
          
          // Marcar como divergente pois não tem medico_id associado
          if (comp.status === 'ok') {
            comp.status = 'divergente_repasse';
          } else if (comp.status === 'divergente_volumetria') {
            comp.status = 'divergente_ambos';
          }
        } else {
          // Não encontrou match - criar nova entrada com sugestões
          const sugestoes = cadastrados
            .map(c => {
              const similaridade = calcularSimilaridade(r.nome_normalizado, c.nome_normalizado);
              const temAbreviacao = matchComAbreviacoes(r.medico_nome || '', c.nome);
              const score = temAbreviacao ? 0.95 : similaridade;
              
              return {
                id: c.id,
                nome: c.nome,
                similaridade: score
              };
            })
            .filter(s => s.similaridade > 0.7)
            .sort((a, b) => b.similaridade - a.similaridade)
            .slice(0, 3);
          
          comparacoesMap.set(r.medico_nome, {
            nome_volumetria: null,
            nome_cadastro: null,
            medico_cadastro_id: null,
            status_cadastro: null,
            nome_repasse: r.medico_nome,
            quantidade_exames_volumetria: 0,
            quantidade_registros_repasse: r.quantidade_registros,
            status: 'divergente_repasse',
            sugestoes_cadastro: sugestoes
          });
        }
      } else {
        // Repasse sem médico e sem nome - agrupar como "SEM MÉDICO"
        const nomeRepasse = 'SEM MÉDICO';
        const existing = comparacoesMap.get(nomeRepasse);
        
        if (existing) {
          existing.quantidade_registros_repasse += r.quantidade_registros;
        } else {
          comparacoesMap.set(nomeRepasse, {
            nome_volumetria: null,
            nome_cadastro: null,
            medico_cadastro_id: null,
            status_cadastro: null,
            nome_repasse: nomeRepasse,
            quantidade_exames_volumetria: 0,
            quantidade_registros_repasse: r.quantidade_registros,
            status: 'divergente_repasse',
            sugestoes_cadastro: []
          });
        }
      }
    });

    const comparacoes = Array.from(comparacoesMap.values())
      .sort((a, b) => {
        // Priorizar divergências
        if (a.status !== 'ok' && b.status === 'ok') return -1;
        if (a.status === 'ok' && b.status !== 'ok') return 1;
        // Depois por quantidade de exames
        return b.quantidade_exames_volumetria - a.quantidade_exames_volumetria;
      });

    const estatisticas = {
      total_cadastrados: cadastrados.length,
      total_divergencias: comparacoes.filter(c => c.status !== 'ok').length,
      total_mapeados: comparacoes.filter(c => c.status === 'ok' && (c.quantidade_exames_volumetria > 0 || c.quantidade_registros_repasse > 0)).length
    };

    console.log('✅ Comparativo concluído:', estatisticas);

    const resultado: ComparativoResult = {
      comparacoes,
      estatisticas
    };

    return new Response(
      JSON.stringify(resultado),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error: any) {
    console.error('❌ Erro no comparativo:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
