import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { arquivo_fonte } = await req.json();
    
    console.log(`🔄 Iniciando correção de especialidades inválidas para arquivo: ${arquivo_fonte}`);
    
    // Mapeamento de especialidades inválidas para válidas
    const mapeamentoEspecialidades: Record<string, string> = {
      'ANGIOTCS': 'MEDICINA INTERNA',
      'CABEÇA-PESCOÇO': 'NEURO',
      'TÓRAX': 'MEDICINA INTERNA',
      'CORPO': 'MEDICINA INTERNA',
      'D.O': 'MUSCULO ESQUELETICO',
      'TOMOGRAFIA': 'MEDICINA INTERNA',
      'CARDIO COM SCORE': 'CARDIO'
    };
    
    let totalProcessados = 0;
    let totalCorrigidos = 0;
    const detalhesCorrecoes: any[] = [];
    
    // Buscar registros com especialidades inválidas
    const especialidadesInvalidas = Object.keys(mapeamentoEspecialidades);
    
    const { data: registros, error: selectError } = await supabase
      .from('volumetria_mobilemed')
      .select('id, "ESTUDO_DESCRICAO", "ESPECIALIDADE", "MODALIDADE"')
      .in('"ESPECIALIDADE"', especialidadesInvalidas)
      .eq('arquivo_fonte', arquivo_fonte);
    
    if (selectError) {
      console.error('❌ Erro ao buscar registros:', selectError);
      throw selectError;
    }
    
    if (!registros || registros.length === 0) {
      console.log('✅ Nenhum registro com especialidade inválida encontrado');
      return new Response(
        JSON.stringify({
          sucesso: true,
          total_processados: 0,
          total_corrigidos: 0,
          arquivo_fonte
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`📊 Encontrados ${registros.length} registros com especialidades inválidas`);
    
    // Processar cada registro
    for (const registro of registros) {
      totalProcessados++;
      
      const especialidadeAtual = registro.ESPECIALIDADE;
      const novaEspecialidade = mapeamentoEspecialidades[especialidadeAtual];
      
      if (novaEspecialidade) {
        const { error: updateError } = await supabase
          .from('volumetria_mobilemed')
          .update({
            'ESPECIALIDADE': novaEspecialidade,
            updated_at: new Date().toISOString()
          })
          .eq('id', registro.id);
        
        if (updateError) {
          console.error(`❌ Erro ao atualizar registro ${registro.id}:`, updateError);
        } else {
          totalCorrigidos++;
          
          if (detalhesCorrecoes.length < 10) {
            detalhesCorrecoes.push({
              exame: registro.ESTUDO_DESCRICAO,
              especialidade_antiga: especialidadeAtual,
              especialidade_nova: novaEspecialidade
            });
          }
          
          console.log(`✅ Corrigido: ${registro.ESTUDO_DESCRICAO} - ${especialidadeAtual} → ${novaEspecialidade}`);
        }
      }
    }
    
    // Log da operação
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'CORRIGIR_ESPECIALIDADES_INVALIDAS',
        record_id: arquivo_fonte,
        new_data: {
          total_processados: totalProcessados,
          total_corrigidos: totalCorrigidos,
          detalhes_correcoes: detalhesCorrecoes,
          mapeamento_usado: mapeamentoEspecialidades
        },
        user_email: 'system',
        severity: 'info'
      });
    
    const resultado = {
      sucesso: true,
      total_processados: totalProcessados,
      total_corrigidos: totalCorrigidos,
      detalhes_correcoes: detalhesCorrecoes,
      arquivo_fonte
    };
    
    console.log('✅ Correção de especialidades inválidas concluída:', resultado);
    
    return new Response(
      JSON.stringify(resultado),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('❌ Erro na correção de especialidades inválidas:', error);
    
    return new Response(
      JSON.stringify({
        sucesso: false,
        erro: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});