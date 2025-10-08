import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { arquivo_fonte } = await req.json();
    
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`🎯 Iniciando aplicação da regra v023 - Especialidade Automática para arquivo: ${arquivo_fonte}`);
    
    // Buscar registros sem especialidade ou com especialidade vazia
    const { data: registrosSemEspecialidade, error: selectError } = await supabaseClient
      .from('volumetria_mobilemed')
      .select('id, "ESTUDO_DESCRICAO", "MODALIDADE", "ESPECIALIDADE"')
      .eq('arquivo_fonte', arquivo_fonte)
      .or('"ESPECIALIDADE".is.null,"ESPECIALIDADE".eq.'); // Sem especialidade ou vazio

    if (selectError) {
      console.error('❌ Erro ao buscar registros sem especialidade:', selectError);
      throw selectError;
    }

    console.log(`📊 Encontrados ${registrosSemEspecialidade?.length || 0} registros sem especialidade`);

    let totalProcessados = 0;
    let totalAtualizados = 0;
    let totalErros = 0;
    const exemplosAplicados: any[] = [];

    // Regras de aplicação automática de especialidade baseado na modalidade
    const regrasEspecialidade: Record<string, string> = {
      'RX': 'RX',
      'CT': 'CT',
      'MR': 'RM',
      'US': 'US',
      'MM': 'MAMA',
      'DR': 'RX',
      'CR': 'RX',
      'DX': 'RX',
      'RF': 'RX',
      'RM': 'RM',
      'TC': 'CT',
      'ECO': 'US',
      'MAMOGRAFIA': 'MAMA',
      'TOMOSSINTESE': 'MAMA'
    };

    // Processar em lotes de 100 registros
    const batchSize = 100;
    for (let i = 0; i < (registrosSemEspecialidade?.length || 0); i += batchSize) {
      const lote = registrosSemEspecialidade!.slice(i, i + batchSize);
      console.log(`🔄 Processando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil((registrosSemEspecialidade?.length || 0) / batchSize)} - ${lote.length} registros`);
      
      for (const registro of lote) {
        totalProcessados++;
        
        try {
          const modalidade = registro.MODALIDADE;
          const especialidadeAutomatica = regrasEspecialidade[modalidade];
          
          if (especialidadeAutomatica) {
            const { error: updateError } = await supabaseClient
              .from('volumetria_mobilemed')
              .update({
                'ESPECIALIDADE': especialidadeAutomatica,
                updated_at: new Date().toISOString()
              })
              .eq('id', registro.id);

            if (updateError) {
              console.error(`❌ Erro ao atualizar especialidade do registro ${registro.id}:`, updateError);
              totalErros++;
            } else {
              totalAtualizados++;
              
              // Armazenar exemplo para log
              if (exemplosAplicados.length < 10) {
                exemplosAplicados.push({
                  exame: registro.ESTUDO_DESCRICAO,
                  modalidade: modalidade,
                  especialidade_aplicada: especialidadeAutomatica
                });
              }
              
              console.log(`✅ Especialidade aplicada: "${registro.ESTUDO_DESCRICAO}" - Modalidade: ${modalidade} → Especialidade: ${especialidadeAutomatica}`);
            }
          } else {
            // Se não há regra automática, aplicar especialidade genérica baseada no tipo de exame
            const nomeExame = registro.ESTUDO_DESCRICAO?.toLowerCase() || '';
            let especialidadeGenerica = 'GERAL'; // Padrão genérico (será corrigido depois)
            
            // ✅ ORDEM DE VERIFICAÇÃO ESPECÍFICA PARA GERAL (prioridade maior)
            if (nomeExame.includes('cranio') || nomeExame.includes('cerebral') || nomeExame.includes('neuro') || nomeExame.includes('encefalo')) {
              especialidadeGenerica = 'NEURO';
            } else if (nomeExame.includes('torax') || nomeExame.includes('pulmonar') || nomeExame.includes('cardiaco') || nomeExame.includes('toracica')) {
              especialidadeGenerica = 'MEDICINA INTERNA';
            } else if (nomeExame.includes('abdome') || nomeExame.includes('abdominal') || nomeExame.includes('gastro') || nomeExame.includes('hepato')) {
              especialidadeGenerica = 'MEDICINA INTERNA';
            } else if (nomeExame.includes('pelve') || nomeExame.includes('pelvic') || nomeExame.includes('bacia')) {
              especialidadeGenerica = 'MEDICINA INTERNA';
            } else if (nomeExame.includes('coluna') || nomeExame.includes('vertebral') || nomeExame.includes('lombar') || nomeExame.includes('cervical')) {
              especialidadeGenerica = 'MUSCULO ESQUELETICO';
            } else if (nomeExame.includes('membro') || nomeExame.includes('joelho') || nomeExame.includes('ombro') || nomeExame.includes('cotovelo') || nomeExame.includes('punho') || nomeExame.includes('mao') || nomeExame.includes('pe')) {
              especialidadeGenerica = 'MUSCULO ESQUELETICO';
            } else if (nomeExame.includes('mama') || nomeExame.includes('mamaria')) {
              especialidadeGenerica = 'MAMA';
            }

            const { error: updateError } = await supabaseClient
              .from('volumetria_mobilemed')
              .update({
                'ESPECIALIDADE': especialidadeGenerica,
                updated_at: new Date().toISOString()
              })
              .eq('id', registro.id);

            if (updateError) {
              console.error(`❌ Erro ao atualizar especialidade genérica do registro ${registro.id}:`, updateError);
              totalErros++;
            } else {
              totalAtualizados++;
              
              if (exemplosAplicados.length < 10) {
                exemplosAplicados.push({
                  exame: registro.ESTUDO_DESCRICAO,
                  modalidade: modalidade,
                  especialidade_aplicada: especialidadeGenerica
                });
              }
            }
          }
        } catch (error) {
          console.error(`❌ Erro ao processar registro ${registro.id}:`, error);
          totalErros++;
        }
      }
    }

    // Log da operação no audit_logs
    await supabaseClient
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'APLICAR_ESPECIALIDADE_AUTOMATICA',
        record_id: arquivo_fonte,
        new_data: {
          regra: 'v023',
          arquivo_fonte,
          total_processados: totalProcessados,
          total_atualizados: totalAtualizados,
          total_erros: totalErros,
          exemplos_aplicados: exemplosAplicados,
          data_processamento: new Date().toISOString()
        },
        user_email: 'system',
        severity: 'info'
      });

    const resultado = {
      sucesso: true,
      arquivo_fonte,
      registros_processados: totalProcessados,
      registros_atualizados: totalAtualizados,
      registros_erro: totalErros,
      exemplos_aplicados: exemplosAplicados,
      regra_aplicada: 'v023 - Aplicação Especialidade Automática',
      data_processamento: new Date().toISOString(),
      observacao: `Aplicadas especialidades automáticas para ${totalAtualizados} exames baseadas na modalidade e nome do exame`
    };

    console.log('✅ Especialidade automática aplicada com sucesso:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro geral na aplicação de especialidade automática:', error);
    return new Response(
      JSON.stringify({ erro: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});