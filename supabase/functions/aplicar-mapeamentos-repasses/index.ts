import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalização de nomes (mesma lógica do DB)
const normalizarNome = (nome: string | null): string => {
  if (!nome) return '';
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\bdr\.?\s*/gi, '')
    .replace(/\bdra\.?\s*/gi, '');
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Iniciando aplicação de mapeamentos aos repasses existentes...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Buscar todos os mapeamentos ativos
    console.log('📋 Carregando mapeamentos...');
    const { data: mapeamentos, error: erroMap } = await supabase
      .from('mapeamento_nomes_medicos')
      .select('nome_origem_normalizado, medico_id, medico_nome')
      .eq('ativo', true);

    if (erroMap) throw erroMap;

    if (!mapeamentos || mapeamentos.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum mapeamento ativo encontrado',
          processados: 0,
          atualizados: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ ${mapeamentos.length} mapeamentos carregados`);

    // Criar mapa para busca rápida
    const mapaNomes = new Map<string, string>();
    mapeamentos.forEach(m => {
      mapaNomes.set(m.nome_origem_normalizado, m.medico_id);
    });

    // 2. Buscar repasses sem médico que têm nome original
    console.log('🔍 Buscando repasses sem médico...');
    const { data: repassesSemMedico, error: erroRepasses } = await supabase
      .from('medicos_valores_repasse')
      .select('id, medico_nome_original')
      .is('medico_id', null)
      .not('medico_nome_original', 'is', null);

    if (erroRepasses) throw erroRepasses;

    const totalRepasses = repassesSemMedico?.length || 0;
    console.log(`📊 ${totalRepasses} repasses sem médico encontrados`);

    if (totalRepasses === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum repasse sem médico encontrado',
          processados: 0,
          atualizados: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let processados = 0;
    let atualizados = 0;
    let naoEncontrados = 0;
    const detalhes: any[] = [];
    const atualizacoes: Array<{ id: string; medico_id: string }> = [];

    // 3. Processar cada repasse
    for (const repasse of repassesSemMedico) {
      processados++;

      const nomeOriginal = repasse.medico_nome_original;
      if (!nomeOriginal) {
        naoEncontrados++;
        continue;
      }

      // Normalizar e buscar no mapa
      const nomeNormalizado = normalizarNome(nomeOriginal);
      const medicoId = mapaNomes.get(nomeNormalizado);

      if (medicoId) {
        atualizacoes.push({
          id: repasse.id,
          medico_id: medicoId
        });

        if (detalhes.length < 50) {
          const mapeamento = mapeamentos.find(m => m.medico_id === medicoId);
          detalhes.push({
            repasse_id: repasse.id,
            nome_original: nomeOriginal,
            medico_associado: mapeamento?.medico_nome
          });
        }
      } else {
        naoEncontrados++;
      }

      // Log de progresso a cada 500 registros
      if (processados % 500 === 0) {
        console.log(`📈 Progresso: ${processados}/${totalRepasses} (${atualizacoes.length} a atualizar)`);
      }
    }

    // 4. Aplicar atualizações em lotes
    console.log(`💾 Aplicando ${atualizacoes.length} atualizações...`);
    const loteSize = 500;
    
    for (let i = 0; i < atualizacoes.length; i += loteSize) {
      const lote = atualizacoes.slice(i, i + loteSize);
      
      for (const update of lote) {
        const { error: erroUpdate } = await supabase
          .from('medicos_valores_repasse')
          .update({ medico_id: update.medico_id })
          .eq('id', update.id);

        if (erroUpdate) {
          console.error(`❌ Erro ao atualizar ${update.id}:`, erroUpdate);
        } else {
          atualizados++;
        }
      }

      console.log(`✅ Lote ${Math.floor(i / loteSize) + 1}/${Math.ceil(atualizacoes.length / loteSize)} aplicado`);
    }

    console.log('✅ Aplicação de mapeamentos concluída!');
    console.log(`📊 Processados: ${processados}`);
    console.log(`✅ Atualizados: ${atualizados}`);
    console.log(`❌ Não encontrados: ${naoEncontrados}`);

    return new Response(
      JSON.stringify({
        success: true,
        processados,
        atualizados,
        nao_encontrados: naoEncontrados,
        total_mapeamentos_usados: mapeamentos.length,
        detalhes_amostra: detalhes
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error: any) {
    console.error('❌ Erro na aplicação de mapeamentos:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
