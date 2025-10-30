import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ComparativoResult {
  medicos_cadastrados: MedicoCadastrado[];
  medicos_volumetria: MedicoVolumetria[];
  medicos_repasse: MedicoRepasse[];
  divergencias: Divergencia[];
  estatisticas: {
    total_cadastrados: number;
    total_volumetria: number;
    total_repasse: number;
    divergencias_encontradas: number;
    sugestoes_normalizacao: number;
  };
}

interface MedicoCadastrado {
  id: string;
  nome: string;
  crm: string | null;
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

    // 1. Buscar todos os médicos cadastrados
    console.log('📋 Buscando médicos cadastrados...');
    const { data: medicosCadastrados, error: erroCadastrados } = await supabase
      .from('medicos')
      .select('id, nome, crm')
      .eq('ativo', true);

    if (erroCadastrados) throw erroCadastrados;

    const cadastrados: MedicoCadastrado[] = (medicosCadastrados || []).map(m => ({
      id: m.id,
      nome: m.nome,
      crm: m.crm,
      nome_normalizado: normalizar(m.nome)
    }));

    console.log(`✅ Encontrados ${cadastrados.length} médicos cadastrados`);

    // 2. Buscar médicos únicos da volumetria
    console.log('📊 Buscando médicos da volumetria...');
    const { data: volumetriaData, error: erroVolumetria } = await supabase
      .from('volumetria_mobilemed')
      .select('medico');

    if (erroVolumetria) throw erroVolumetria;

    // Agrupar e contar por médico
    const volumetriaMap = new Map<string, number>();
    (volumetriaData || []).forEach(v => {
      if (v.medico) {
        const normalizado = normalizar(v.medico);
        volumetriaMap.set(v.medico, (volumetriaMap.get(v.medico) || 0) + 1);
      }
    });

    const volumetria: MedicoVolumetria[] = Array.from(volumetriaMap.entries()).map(([nome, qtd]) => {
      const nomeNorm = normalizar(nome);
      const encontrado = cadastrados.some(c => c.nome_normalizado === nomeNorm);
      
      // Buscar sugestões de match (similaridade > 0.8)
      const sugestoes: string[] = [];
      if (!encontrado) {
        cadastrados.forEach(c => {
          const similaridade = calcularSimilaridade(nomeNorm, c.nome_normalizado);
          if (similaridade > 0.8 && similaridade < 1) {
            sugestoes.push(`${c.nome} (${Math.round(similaridade * 100)}%)`);
          }
        });
      }

      return {
        nome_original: nome,
        nome_normalizado: nomeNorm,
        quantidade_exames: qtd,
        encontrado_cadastro: encontrado,
        sugestoes_match: sugestoes
      };
    });

    console.log(`✅ Encontrados ${volumetria.length} médicos únicos na volumetria`);

    // 3. Buscar médicos do repasse
    console.log('💰 Buscando médicos do repasse...');
    const { data: repasseData, error: erroRepasse } = await supabase
      .from('medicos_valores_repasse')
      .select('medico_id');

    if (erroRepasse) throw erroRepasse;

    // Agrupar por medico_id
    const repasseMap = new Map<string, number>();
    (repasseData || []).forEach(r => {
      const key = r.medico_id || 'SEM_MEDICO';
      repasseMap.set(key, (repasseMap.get(key) || 0) + 1);
    });

    // Buscar nomes dos médicos do repasse
    const medicosIds = Array.from(repasseMap.keys()).filter(id => id !== 'SEM_MEDICO');
    const { data: medicosRepasse } = await supabase
      .from('medicos')
      .select('id, nome')
      .in('id', medicosIds);

    const medicosRepasseMap = new Map((medicosRepasse || []).map(m => [m.id, m.nome]));

    const repasse: MedicoRepasse[] = Array.from(repasseMap.entries()).map(([id, qtd]) => {
      const nome = medicosRepasseMap.get(id);
      const nomeNorm = normalizar(nome || '');
      const encontrado = id !== 'SEM_MEDICO' && cadastrados.some(c => c.id === id);

      return {
        medico_id: id === 'SEM_MEDICO' ? null : id,
        medico_nome: nome || null,
        nome_normalizado: nomeNorm,
        quantidade_registros: qtd,
        encontrado_cadastro: encontrado
      };
    });

    console.log(`✅ Encontrados ${repasse.length} médicos no repasse`);

    // 4. Identificar divergências
    console.log('🔍 Identificando divergências...');
    const divergencias: Divergencia[] = [];

    // Médicos da volumetria não cadastrados
    volumetria.forEach(v => {
      if (!v.encontrado_cadastro) {
        divergencias.push({
          tipo: v.sugestoes_match.length > 0 ? 'possivel_match' : 'volumetria_nao_cadastrado',
          origem: 'volumetria',
          nome_origem: v.nome_original,
          sugestoes: v.sugestoes_match,
          detalhes: `${v.quantidade_exames} exames na volumetria`
        });
      }
    });

    // Repasses sem médico associado
    repasse.forEach(r => {
      if (!r.medico_id) {
        divergencias.push({
          tipo: 'repasse_sem_medico',
          origem: 'repasse',
          nome_origem: 'SEM MÉDICO ASSOCIADO',
          sugestoes: [],
          detalhes: `${r.quantidade_registros} registros de repasse sem médico`
        });
      }
    });

    const estatisticas = {
      total_cadastrados: cadastrados.length,
      total_volumetria: volumetria.length,
      total_repasse: repasse.length,
      divergencias_encontradas: divergencias.length,
      sugestoes_normalizacao: divergencias.filter(d => d.tipo === 'possivel_match').length
    };

    console.log('✅ Comparativo concluído:', estatisticas);

    const resultado: ComparativoResult = {
      medicos_cadastrados: cadastrados,
      medicos_volumetria: volumetria,
      medicos_repasse: repasse,
      divergencias,
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
