import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { arquivo_fonte, periodo_referencia } = await req.json();
    
    console.log(`🔄 Iniciando aplicação da regra v034 (ColunasxMusculoxNeuro) - OTIMIZADO`);
    console.log(`📁 Arquivo: ${arquivo_fonte || 'TODOS'}`);
    console.log(`📅 Período: ${periodo_referencia || 'TODOS'}`);
    
    // BUSCAR NEUROLOGISTAS DA TABELA medicos_neurologistas
    const { data: neurologistasDb, error: neuroError } = await supabase
      .from('medicos_neurologistas')
      .select('nome')
      .eq('ativo', true);
    
    if (neuroError) {
      console.error('❌ Erro ao buscar neurologistas da tabela:', neuroError);
      throw neuroError;
    }
    
    const medicosNeuroLista = neurologistasDb?.map(n => n.nome.toUpperCase().replace(/^DR[A]?\s+/i, '').trim()) || [];
    
    if (medicosNeuroLista.length === 0) {
      console.warn('⚠️ Nenhum neurologista encontrado na tabela medicos_neurologistas');
      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: 'Nenhum neurologista cadastrado na tabela medicos_neurologistas'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`👨‍⚕️ Neurologistas carregados da tabela: ${medicosNeuroLista.length} médicos`);
    
    // Construir query para buscar registros com especialidade COLUNAS
    let query = supabase
      .from('volumetria_mobilemed')
      .select('id, "MEDICO"')
      .or('ESPECIALIDADE.eq.COLUNAS,ESPECIALIDADE.eq.Colunas,ESPECIALIDADE.ilike.colunas');
    
    if (arquivo_fonte) {
      query = query.eq('arquivo_fonte', arquivo_fonte);
    }
    
    if (periodo_referencia) {
      query = query.eq('periodo_referencia', periodo_referencia);
    }
    
    const { data: registrosColunas, error: selectError } = await query;
    
    if (selectError) {
      console.error('❌ Erro ao buscar registros com especialidade Colunas:', selectError);
      throw selectError;
    }
    
    if (!registrosColunas || registrosColunas.length === 0) {
      console.log('✅ Nenhum registro encontrado com especialidade "Colunas"');
      return new Response(
        JSON.stringify({
          sucesso: true,
          total_processados: 0,
          total_alterados_musculo: 0,
          total_alterados_neuro: 0,
          arquivo_fonte: arquivo_fonte || 'TODOS',
          observacoes: 'Nenhum registro com especialidade "Colunas" encontrado'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`📊 Encontrados ${registrosColunas.length} registros com especialidade "Colunas"`);
    
    // Separar registros em listas para NEURO e MUSCULO ESQUELETICO
    const idsNeuro: string[] = [];
    const idsMusculo: string[] = [];
    
    for (const registro of registrosColunas) {
      const medico = (registro.MEDICO || '').toUpperCase().replace(/^DR[A]?\s+/i, '').trim();
      
      // Verificar se médico está na lista de neurologistas
      let ehNeurologista = false;
      for (const medicoNeuro of medicosNeuroLista) {
        if (medico === medicoNeuro || medico.startsWith(medicoNeuro.split(' ')[0])) {
          ehNeurologista = true;
          break;
        }
      }
      
      if (ehNeurologista) {
        idsNeuro.push(registro.id);
      } else {
        idsMusculo.push(registro.id);
      }
    }
    
    console.log(`📋 Classificação: ${idsNeuro.length} NEURO, ${idsMusculo.length} MUSCULO ESQUELETICO`);
    
    let totalAlteradosNeuro = 0;
    let totalAlteradosMusculo = 0;
    
    // BATCH UPDATE - NEURO (em lotes de 500)
    const BATCH_SIZE = 500;
    
    if (idsNeuro.length > 0) {
      console.log(`🧠 Atualizando ${idsNeuro.length} registros para NEURO + SC...`);
      
      for (let i = 0; i < idsNeuro.length; i += BATCH_SIZE) {
        const batch = idsNeuro.slice(i, i + BATCH_SIZE);
        
        const { error: updateNeuroError } = await supabase
          .from('volumetria_mobilemed')
          .update({
            'ESPECIALIDADE': 'NEURO',
            'CATEGORIA': 'SC',
            updated_at: new Date().toISOString()
          })
          .in('id', batch);
        
        if (updateNeuroError) {
          console.error(`❌ Erro ao atualizar batch NEURO ${i}-${i + batch.length}:`, updateNeuroError);
        } else {
          totalAlteradosNeuro += batch.length;
          console.log(`  ✅ Batch NEURO ${i + 1}-${i + batch.length} atualizado`);
        }
      }
    }
    
    // BATCH UPDATE - MUSCULO ESQUELETICO (em lotes de 500)
    if (idsMusculo.length > 0) {
      console.log(`💪 Atualizando ${idsMusculo.length} registros para MUSCULO ESQUELETICO...`);
      
      for (let i = 0; i < idsMusculo.length; i += BATCH_SIZE) {
        const batch = idsMusculo.slice(i, i + BATCH_SIZE);
        
        const { error: updateMusculoError } = await supabase
          .from('volumetria_mobilemed')
          .update({
            'ESPECIALIDADE': 'MUSCULO ESQUELETICO',
            updated_at: new Date().toISOString()
          })
          .in('id', batch);
        
        if (updateMusculoError) {
          console.error(`❌ Erro ao atualizar batch MUSCULO ${i}-${i + batch.length}:`, updateMusculoError);
        } else {
          totalAlteradosMusculo += batch.length;
          console.log(`  ✅ Batch MUSCULO ${i + 1}-${i + batch.length} atualizado`);
        }
      }
    }
    
    const resultado = {
      sucesso: true,
      total_processados: registrosColunas.length,
      total_alterados_musculo: totalAlteradosMusculo,
      total_alterados_neuro: totalAlteradosNeuro,
      arquivo_fonte: arquivo_fonte || 'TODOS',
      neurologistas_cadastrados: medicosNeuroLista.length,
      observacoes: `Regra v034 aplicada (BATCH). ${totalAlteradosMusculo} → MUSCULO ESQUELETICO, ${totalAlteradosNeuro} → NEURO + SC`
    };
    
    console.log('✅ Regra v034 (ColunasxMusculoxNeuro) aplicada com sucesso:', resultado);
    
    return new Response(
      JSON.stringify(resultado),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('❌ Erro na aplicação da regra v034:', error);
    
    return new Response(
      JSON.stringify({
        sucesso: false,
        erro: error.message,
        observacoes: 'Erro ao aplicar regra v034 (ColunasxMusculoxNeuro)'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
