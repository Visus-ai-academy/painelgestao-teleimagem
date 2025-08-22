import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧪 Iniciando teste do sistema de exclusões...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Criar registros de teste que serão excluídos por diferentes regras
    const registrosTeste = [
      {
        "EMPRESA": "TESTE_EXCLUSAO_EMPRESA",
        "NOME_PACIENTE": "PACIENTE TESTE 01",
        "CODIGO_PACIENTE": "12345",
        "ESTUDO_DESCRICAO": "RESSONANCIA MAGNETICA DO CRANIO",
        "ACCESSION_NUMBER": "ACC123456",
        "MODALIDADE": "MR",
        "PRIORIDADE": "normal",
        "VALORES": 0, // Valor 0 será excluído
        "ESPECIALIDADE": "NE",
        "MEDICO": "DR TESTE SISTEMA",
        "DATA_REALIZACAO": "2025-08-22",
        "HORA_REALIZACAO": "10:00:00",
        "DATA_LAUDO": "2025-08-22",
        "HORA_LAUDO": "15:00:00",
        "DATA_PRAZO": "2025-08-23",
        "HORA_PRAZO": "10:00:00",
        "STATUS": "Finalizado",
        data_referencia: "2025-08-01",
        arquivo_fonte: "teste_sistema_exclusoes",
        lote_upload: "teste_001",
        periodo_referencia: "ago/25"
        // Este registro pode ser excluído por valor zero ou outras regras
      },
      {
        "EMPRESA": "TESTE_EXCLUSAO_DATA",
        "NOME_PACIENTE": "PACIENTE TESTE 02",
        "CODIGO_PACIENTE": "12346",
        "ESTUDO_DESCRICAO": "TOMOGRAFIA COMPUTADORIZADA DO TORAX",
        "ACCESSION_NUMBER": "ACC123457",
        "MODALIDADE": "CT",
        "PRIORIDADE": "urgência",
        "VALORES": 150.00,
        "ESPECIALIDADE": "CA",
        "MEDICO": "DRA TESTE SISTEMA",
        "DATA_REALIZACAO": "2025-09-15", // Data futura - será excluída
        "HORA_REALIZACAO": "14:30:00",
        "DATA_LAUDO": "2025-09-15",
        "HORA_LAUDO": "18:30:00",
        "DATA_PRAZO": "2025-09-16",
        "HORA_PRAZO": "14:30:00",
        "STATUS": "Finalizado",
        data_referencia: "2025-08-01",
        arquivo_fonte: "teste_sistema_exclusoes",
        lote_upload: "teste_001",
        periodo_referencia: "ago/25"
        // Este registro será excluído por data futura
      }
    ];

    let exclusoesCriadas = 0;
    const resultados = [];

    // 2. Tentar inserir cada registro de teste
    for (const [index, registro] of registrosTeste.entries()) {
      try {
        console.log(`🔍 Testando registro ${index + 1}:`, registro.EMPRESA);

        // Tentar inserir o registro - triggers aplicarão regras de exclusão
        const { data: insertResult, error: insertError } = await supabaseClient
          .from('volumetria_mobilemed')
          .insert(registro)
          .select();

        if (insertError) {
          console.log(`❌ Registro ${index + 1} rejeitado pelo banco:`, insertError.message);
          resultados.push({
            registro: index + 1,
            empresa: registro.EMPRESA,
            resultado: 'rejeitado_banco',
            motivo: insertError.message
          });
        } else if (!insertResult || insertResult.length === 0) {
          // Registro foi interceptado pelos triggers e retornou NULL
          console.log(`🚫 Registro ${index + 1} excluído pelos triggers de regras`);
          exclusoesCriadas++;
          resultados.push({
            registro: index + 1,
            empresa: registro.EMPRESA,
            resultado: 'excluido_trigger',
            motivo: 'Excluído por regras de negócio (trigger)'
          });
        } else {
          console.log(`✅ Registro ${index + 1} inserido com sucesso`);
          resultados.push({
            registro: index + 1,
            empresa: registro.EMPRESA,
            resultado: 'inserido',
            motivo: 'Registro válido processado com sucesso'
          });

          // Limpar registro de teste inserido
          await supabaseClient
            .from('volumetria_mobilemed')
            .delete()
            .eq('id', insertResult[0].id);
        }

      } catch (error) {
        console.error(`💥 Erro ao processar registro ${index + 1}:`, error);
        resultados.push({
          registro: index + 1,
          empresa: registro.EMPRESA,
          resultado: 'erro',
          motivo: error.message
        });
      }
    }

    // 3. Verificar quantos registros rejeitados foram criados
    const { data: registrosRejeitados, error: rejeitadosError } = await supabaseClient
      .from('registros_rejeitados_processamento')
      .select('*')
      .eq('lote_upload', 'teste_001')
      .order('created_at', { ascending: false });

    if (rejeitadosError) {
      console.error('❌ Erro ao buscar registros rejeitados:', rejeitadosError);
    }

    const totalRejeitados = registrosRejeitados?.length || 0;

    console.log(`🎯 Teste concluído: ${totalRejeitados} exclusões registradas`);

    // 4. Limpar registros de teste da tabela de rejeições
    if (totalRejeitados > 0) {
      await supabaseClient
        .from('registros_rejeitados_processamento')
        .delete()
        .eq('lote_upload', 'teste_001');

      console.log('🧹 Registros de teste limpos da tabela de rejeições');
    }

    return new Response(JSON.stringify({
      sucesso: true,
      registros_testados: registrosTeste.length,
      exclusoes_detectadas: totalRejeitados,
      exclusoes_por_trigger: exclusoesCriadas,
      resultados_detalhados: resultados,
      registros_rejeitados_criados: registrosRejeitados?.map(r => ({
        motivo: r.motivo_rejeicao,
        detalhes: r.detalhes_erro,
        dados: r.dados_originais
      })) || [],
      sistema_exclusoes: totalRejeitados > 0 ? 'FUNCIONANDO' : 'PROBLEMAS_DETECTADOS',
      mensagem: totalRejeitados > 0 
        ? 'Sistema de exclusões está funcionando corretamente'
        : 'Sistema pode não estar registrando exclusões - verifique triggers'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 ERRO no teste:', error);
    
    return new Response(JSON.stringify({ 
      erro: true, 
      mensagem: error.message,
      detalhes: 'Erro ao executar teste do sistema de exclusões'
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});