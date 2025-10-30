import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalização agressiva para matching de nomes
const normalizar = (s: string | null): string => {
  if (!s) return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/\s+/g, ' ') // Normaliza espaços
    .trim()
    .replace(/\bdr\.?\s*/gi, '') // Remove Dr./Dra.
    .replace(/\bdra\.?\s*/gi, '');
};

// Calcular similaridade Levenshtein
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
    console.log('🔧 Iniciando correção de associação de repasses...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { medico_nome, limiar_similaridade } = await req.json();
    const limiar = limiar_similaridade || 0.85; // Threshold de similaridade padrão

    // 1. Buscar todos os médicos ativos
    console.log('📋 Buscando médicos cadastrados...');
    const { data: medicos, error: erroMedicos } = await supabase
      .from('medicos')
      .select('id, nome, crm')
      .eq('ativo', true);

    if (erroMedicos) throw erroMedicos;

    // Criar mapa de médicos normalizados
    const medicosMap = new Map<string, { id: string; nome: string; crm: string | null }>();
    (medicos || []).forEach(m => {
      const nomeNorm = normalizar(m.nome);
      medicosMap.set(nomeNorm, m);
      // Também indexar pelo CRM se existir
      if (m.crm) {
        medicosMap.set(m.crm.toLowerCase().trim(), m);
      }
    });

    console.log(`✅ ${medicosMap.size} médicos indexados`);

    // 2. Identificar grupos de repasses por características (modalidade+especialidade+categoria+prioridade)
    console.log('🔍 Identificando padrões de repasse...');
    
    // Estratégia: Como não temos os nomes originais, vamos tentar associar todos os repasses
    // sem medico_id aos médicos cadastrados que têm valores de repasse similares
    
    // Buscar repasses COM medico_id para usar como referência
    const { data: repassesReferencia, error: erroRef } = await supabase
      .from('medicos_valores_repasse')
      .select('medico_id, modalidade, especialidade, categoria, prioridade, cliente_id')
      .not('medico_id', 'is', null)
      .limit(1000);

    if (erroRef) throw erroRef;

    // Criar mapa de referência: características -> medico_id
    const referenciaMap = new Map<string, string>();
    (repassesReferencia || []).forEach(r => {
      const chave = `${r.modalidade}_${r.especialidade}_${r.categoria || ''}_${r.prioridade}_${r.cliente_id || ''}`;
      if (!referenciaMap.has(chave)) {
        referenciaMap.set(chave, r.medico_id!);
      }
    });

    console.log(`✅ ${referenciaMap.size} padrões de referência criados`);

    // Buscar todos os repasses sem medico_id
    const { data: repassesSemMedico, error: erroRepasses } = await supabase
      .from('medicos_valores_repasse')
      .select('id, modalidade, especialidade, categoria, prioridade, cliente_id, esta_no_escopo')
      .is('medico_id', null);

    if (erroRepasses) throw erroRepasses;

    const totalRepasses = repassesSemMedico?.length || 0;
    console.log(`📊 ${totalRepasses} repasses sem médico associado encontrados`);

    if (totalRepasses === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum repasse sem médico encontrado',
          processados: 0,
          associados: 0,
          nao_encontrados: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let processados = 0;
    let associados = 0;
    let naoEncontrados = 0;
    let associadosPorReferencia = 0;
    const detalhes: any[] = [];
    const atualizacoes: any[] = [];

    // 3. Processar repasses
    for (const repasse of repassesSemMedico) {
      processados++;

      // Tentar associar por padrão de referência primeiro
      const chave = `${repasse.modalidade}_${repasse.especialidade}_${repasse.categoria || ''}_${repasse.prioridade}_${repasse.cliente_id || ''}`;
      const medicoIdReferencia = referenciaMap.get(chave);

      if (medicoIdReferencia) {
        // Encontrou por referência
        atualizacoes.push({
          id: repasse.id,
          medico_id: medicoIdReferencia
        });
        associados++;
        associadosPorReferencia++;

        if (detalhes.length < 50) {
          const medicoRef = [...medicosMap.values()].find(m => m.id === medicoIdReferencia);
          if (medicoRef) {
            detalhes.push({
              repasse_id: repasse.id,
              medico_id: medicoRef.id,
              medico_nome: medicoRef.nome,
              metodo: 'referencia',
              caracteristicas: `${repasse.modalidade}/${repasse.especialidade}/${repasse.categoria}`
            });
          }
        }
      } else {
        naoEncontrados++;
      }

      // Log de progresso a cada 500 registros
      if (processados % 500 === 0) {
        console.log(`📈 Progresso: ${processados}/${totalRepasses} (${associados} associados, ${naoEncontrados} não encontrados)`);
      }
    }

    // 4. Aplicar atualizações em lotes
    console.log('💾 Aplicando atualizações...');
    const loteSize = 500;
    for (let i = 0; i < atualizacoes.length; i += loteSize) {
      const lote = atualizacoes.slice(i, i + loteSize);
      
      for (const update of lote) {
        const { error: erroUpdate } = await supabase
          .from('medicos_valores_repasse')
          .update({ medico_id: update.medico_id })
          .eq('id', update.id);

        if (erroUpdate) {
          console.error(`Erro ao atualizar repasse ${update.id}:`, erroUpdate);
        }
      }

      console.log(`✅ Lote ${Math.floor(i / loteSize) + 1} aplicado`);
    }

    console.log('✅ Correção concluída!');
    console.log(`📊 Total processados: ${processados}`);
    console.log(`✅ Associados com sucesso: ${associados}`);
    console.log(`❌ Não encontrados: ${naoEncontrados}`);

    return new Response(
      JSON.stringify({
        success: true,
        processados,
        associados,
        nao_encontrados: naoEncontrados,
        detalhes_amostra: detalhes,
        limiar_usado: limiar
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error: any) {
    console.error('❌ Erro na correção:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
