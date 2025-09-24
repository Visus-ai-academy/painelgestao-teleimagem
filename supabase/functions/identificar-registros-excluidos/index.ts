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
    console.log('🔍 IDENTIFICANDO os 2 registros excluídos...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Criar 5 registros de teste similares ao upload original para identificar qual tipo falha
    const registrosTeste = [
      // Teste 1: Registro normal (deve passar)
      {
        "EMPRESA": "TESTE_NORMAL",
        "NOME_PACIENTE": "PACIENTE TESTE NORMAL",
        "CODIGO_PACIENTE": "12345",
        "ESTUDO_DESCRICAO": "RESSONANCIA MAGNETICA DO CRANIO",
        "ACCESSION_NUMBER": "ACC123456",
        "MODALIDADE": "MR",
        "PRIORIDADE": "normal",
        "VALORES": 100.00,
        "ESPECIALIDADE": "NE",
        "MEDICO": "DR TESTE NORMAL",
        "DATA_REALIZACAO": "22/08/2025",
        "HORA_REALIZACAO": "10:00:00",
        "DATA_LAUDO": "22/08/2025",
        "HORA_LAUDO": "15:00:00",
        "DATA_PRAZO": "23/08/2025",
        "HORA_PRAZO": "10:00:00",
        "STATUS": "Finalizado",
        "lote_upload": "teste_exclusoes_001"
      },
      // Teste 2: Data malformada (pode falhar)
      {
        "EMPRESA": "TESTE_DATA_MALFORMADA",
        "NOME_PACIENTE": "PACIENTE TESTE DATA",
        "CODIGO_PACIENTE": "12346",
        "ESTUDO_DESCRICAO": "TOMOGRAFIA COMPUTADORIZADA",
        "ACCESSION_NUMBER": "ACC123457",
        "MODALIDADE": "CT",
        "PRIORIDADE": "urgência",
        "VALORES": 150.00,
        "ESPECIALIDADE": "CA",
        "MEDICO": "DRA TESTE DATA",
        "DATA_REALIZACAO": "32/13/2025", // Data inválida
        "HORA_REALIZACAO": "14:30:00",
        "DATA_LAUDO": "32/13/2025", // Data inválida
        "HORA_LAUDO": "18:30:00",
        "DATA_PRAZO": "33/13/2025", // Data inválida
        "HORA_PRAZO": "14:30:00",
        "STATUS": "Finalizado",
        "lote_upload": "teste_exclusoes_002"
      },
      // Teste 3: Campos null/vazios (pode falhar)
      {
        "EMPRESA": null,
        "NOME_PACIENTE": "",
        "CODIGO_PACIENTE": "12347",
        "ESTUDO_DESCRICAO": "ULTRASSOM ABDOMINAL",
        "ACCESSION_NUMBER": "ACC123458",
        "MODALIDADE": "US",
        "PRIORIDADE": "normal",
        "VALORES": null,
        "ESPECIALIDADE": "",
        "MEDICO": null,
        "DATA_REALIZACAO": "22/08/2025",
        "HORA_REALIZACAO": "10:00:00",
        "DATA_LAUDO": "22/08/2025",
        "HORA_LAUDO": "15:00:00",
        "DATA_PRAZO": "23/08/2025",
        "HORA_PRAZO": "10:00:00",
        "STATUS": "Finalizado",
        "lote_upload": "teste_exclusoes_003"
      },
      // Teste 4: Valores negativos/inválidos (pode falhar)
      {
        "EMPRESA": "TESTE_VALORES_INVALIDOS",
        "NOME_PACIENTE": "PACIENTE TESTE VALORES",
        "CODIGO_PACIENTE": "12348",
        "ESTUDO_DESCRICAO": "RADIOGRAFIA TORAX",
        "ACCESSION_NUMBER": "ACC123459",
        "MODALIDADE": "RX",
        "PRIORIDADE": "normal",
        "VALORES": -100.00, // Valor negativo
        "ESPECIALIDADE": "RA",
        "MEDICO": "DR TESTE VALORES",
        "DATA_REALIZACAO": "22/08/2025",
        "HORA_REALIZACAO": "10:00:00",
        "DATA_LAUDO": "22/08/2025",
        "HORA_LAUDO": "15:00:00",
        "DATA_PRAZO": "23/08/2025",
        "HORA_PRAZO": "10:00:00",
        "STATUS": "Finalizado",
        "lote_upload": "teste_exclusoes_004"
      },
      // Teste 5: Caracteres especiais/encoding (pode falhar)
      {
        "EMPRESA": "TESTE_ÇÃRÁCTÉRES_ËSPÈCIÀIS",
        "NOME_PACIENTE": "JOSÉ DA SILVA JOÃO ÇÃO AÇÃO",
        "CODIGO_PACIENTE": "12349",
        "ESTUDO_DESCRICAO": "MAMOGRAFIA BILATERAL COM CONTRASTE IÔNICO",
        "ACCESSION_NUMBER": "ACC123460",
        "MODALIDADE": "MG",
        "PRIORIDADE": "urgência",
        "VALORES": 200.50,
        "ESPECIALIDADE": "MG",
        "MEDICO": "DRA MARÍA JOSÉ CONCEIÇÃO",
        "DATA_REALIZACAO": "22/08/2025",
        "HORA_REALIZACAO": "10:00:00",
        "DATA_LAUDO": "22/08/2025",
        "HORA_LAUDO": "15:00:00",
        "DATA_PRAZO": "23/08/2025",
        "HORA_PRAZO": "10:00:00",
        "STATUS": "Finalizado",
        "lote_upload": "teste_exclusoes_005"
      }
    ];

    const resultados = [];
    let totalTentativas = 0;
    let totalSucessos = 0;
    let totalFalhas = 0;

    // Testar cada registro individualmente
    for (const [index, registro] of registrosTeste.entries()) {
      totalTentativas++;
      const numeroTeste = index + 1;
      
      console.log(`🧪 TESTE ${numeroTeste}: ${registro.EMPRESA || 'SEM_EMPRESA'}`);
      
      try {
        // Adicionar campos obrigatórios
        const registroCompleto = {
          ...registro,
          data_referencia: new Date().toISOString().split('T')[0],
          arquivo_fonte: 'teste_identificacao',
          periodo_referencia: 'teste/25',
          processamento_pendente: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { data: insertResult, error: insertError } = await supabaseClient
          .from('volumetria_mobilemed')
          .insert([registroCompleto])
          .select('id');

        if (insertError) {
          console.log(`❌ TESTE ${numeroTeste} FALHOU:`, {
            empresa: registro.EMPRESA || 'NULL',
            erro_codigo: insertError.code,
            erro_mensagem: insertError.message,
            erro_detalhes: insertError.details,
            erro_hint: insertError.hint
          });
          
          totalFalhas++;
          resultados.push({
            teste: numeroTeste,
            empresa: registro.EMPRESA || 'NULL',
            paciente: registro.NOME_PACIENTE || 'NULL',
            resultado: 'FALHOU',
            motivo_falha: insertError.message,
            codigo_erro: insertError.code,
            tipo_problema: classificarErro(insertError)
          });
        } else if (!insertResult || insertResult.length === 0) {
          console.log(`🚫 TESTE ${numeroTeste} INTERCEPTADO por triggers/regras`);
          
          totalFalhas++;
          resultados.push({
            teste: numeroTeste,
            empresa: registro.EMPRESA || 'NULL',
            paciente: registro.NOME_PACIENTE || 'NULL',
            resultado: 'INTERCEPTADO',
            motivo_falha: 'Interceptado por triggers ou regras de negócio',
            tipo_problema: 'TRIGGER_REJECTION'
          });
        } else {
          console.log(`✅ TESTE ${numeroTeste} SUCESSO:`, insertResult[0].id);
          
          totalSucessos++;
          resultados.push({
            teste: numeroTeste,
            empresa: registro.EMPRESA || 'NULL',
            paciente: registro.NOME_PACIENTE || 'NULL',
            resultado: 'SUCESSO',
            id_inserido: insertResult[0].id
          });

          // Limpar registro de teste
          await supabaseClient
            .from('volumetria_mobilemed')
            .delete()
            .eq('id', insertResult[0].id);
        }

      } catch (error) {
        console.error(`💥 ERRO GERAL no teste ${numeroTeste}:`, error);
        totalFalhas++;
        resultados.push({
          teste: numeroTeste,
          empresa: registro.EMPRESA || 'NULL',
          resultado: 'ERRO_GERAL',
          motivo_falha: error.message,
          tipo_problema: 'EXCEPTION'
        });
      }
    }

    // Função para classificar tipos de erro
    function classificarErro(error: any): string {
      if (error.code === '23505') return 'DUPLICATE_KEY';
      if (error.code === '23502') return 'NOT_NULL_VIOLATION';
      if (error.code === '23503') return 'FOREIGN_KEY_VIOLATION';
      if (error.code === '22001') return 'STRING_TOO_LONG';
      if (error.code === '22P02') return 'INVALID_TEXT_REPRESENTATION';
      if (error.message?.toLowerCase().includes('date')) return 'DATE_FORMAT_ERROR';
      if (error.message?.toLowerCase().includes('numeric')) return 'NUMERIC_ERROR';
      return 'OTHER';
    }

    const relatorio = {
      experimento: {
        total_tentativas: totalTentativas,
        total_sucessos: totalSucessos,
        total_falhas: totalFalhas,
        taxa_sucesso: `${Math.round(totalSucessos/totalTentativas*100)}%`,
        tipos_problemas_encontrados: [...new Set(resultados.filter(r => r.tipo_problema).map(r => r.tipo_problema))]
      },
      resultados_detalhados: resultados,
      analise: {
        problemas_identificados: resultados.filter(r => r.resultado !== 'SUCESSO'),
        possivel_causa_das_2_exclusoes: resultados.find(r => r.resultado !== 'SUCESSO')?.tipo_problema || 'DESCONHECIDO'
      },
      conclusao: totalFalhas > 0 ? 
        `Identificados ${totalFalhas} tipos de problemas que podem causar exclusões` :
        'Todos os testes passaram - problema pode estar em outro local'
    };

    console.log('📄 RELATÓRIO DE IDENTIFICAÇÃO:', JSON.stringify(relatorio, null, 2));

    return new Response(JSON.stringify(relatorio), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 ERRO na identificação:', error);
    
    return new Response(JSON.stringify({ 
      erro: true, 
      mensagem: error.message,
      stack: error.stack
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});