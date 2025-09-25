import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🧪 TESTE DE INSERÇÃO DE REGISTROS REJEITADOS');

    // Teste de inserção de um registro rejeitado fictício
    const testRecord = {
      arquivo_fonte: 'teste_debug',
      lote_upload: `teste_${Date.now()}`,
      linha_original: 1,
      dados_originais: {
        EMPRESA: 'TESTE_CLIENTE',
        NOME_PACIENTE: 'TESTE PACIENTE',
        DATA_REALIZACAO: '01/06/2025',
        DATA_LAUDO: '15/06/2025',
        ESTUDO_DESCRICAO: 'TESTE EXAME'
      },
      motivo_rejeicao: 'TESTE_DEBUG_SISTEMA',
      detalhes_erro: 'Teste de inserção para debug do sistema',
      created_at: new Date().toISOString()
    };

    console.log('📝 Tentando inserir registro de teste:', testRecord);

    // Tentar inserir registro
    const { data: insertedData, error: insertError } = await supabaseClient
      .from('registros_rejeitados_processamento')
      .insert([testRecord])
      .select('*');

    if (insertError) {
      console.error('❌ Erro na inserção:', insertError);
      console.error('❌ Detalhes completos do erro:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint
      });

      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: 'Falha na inserção',
          detalhes: {
            code: insertError.code,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint
          }
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          },
          status: 500 
        }
      );
    }

    console.log('✅ Registro inserido com sucesso:', insertedData);

    // Verificar se consegue ler de volta
    const { data: readData, error: readError } = await supabaseClient
      .from('registros_rejeitados_processamento')
      .select('*')
      .eq('lote_upload', testRecord.lote_upload);

    if (readError) {
      console.error('❌ Erro na leitura:', readError);
    } else {
      console.log('📖 Registros lidos de volta:', readData);
    }

    // Contar total de registros na tabela
    const { count, error: countError } = await supabaseClient
      .from('registros_rejeitados_processamento')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Erro na contagem:', countError);
    } else {
      console.log(`📊 Total de registros na tabela: ${count}`);
    }

    return new Response(
      JSON.stringify({
        sucesso: true,
        registro_inserido: insertedData?.[0],
        registros_lidos: readData,
        total_registros: count,
        mensagem: 'Teste de inserção concluído com sucesso'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('❌ ERRO GERAL:', error);
    
    return new Response(
      JSON.stringify({ 
        erro: true, 
        mensagem: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});