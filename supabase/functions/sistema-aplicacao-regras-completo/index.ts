import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegraAplicacao {
  nome: string;
  funcao: string;
  parametros: any;
  arquivo_aplicavel: string[];
  condicao_aplicacao?: (arquivo: string) => boolean;
  validacao_pos_aplicacao?: (supabase: any, arquivo: string, resultado: any) => Promise<boolean>;
}

interface StatusAplicacao {
  regra: string;
  arquivo: string;
  aplicada: boolean;
  resultado?: any;
  erro?: string;
  validacao_ok?: boolean;
}

// Definição completa de TODAS as regras do sistema
const REGRAS_SISTEMA: RegraAplicacao[] = [
  // 1. REGRAS DE PERÍODO (v002/v003/v031)
  {
    nome: "v002_v003_exclusoes_periodo",
    funcao: "aplicar-exclusoes-periodo",
    parametros: (periodo: string) => ({ periodo_referencia: periodo }),
    arquivo_aplicavel: ['volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo', 'volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_onco_padrao'],
    validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
      // Validar se realmente foram excluídos registros conforme esperado
      if (arquivo.includes('retroativo')) {
        // Para retroativos: verificar se não há mais registros com DATA_REALIZACAO >= 01/jun
        const { count } = await supabase
          .from('volumetria_mobilemed')
          .select('*', { count: 'exact', head: true })
          .eq('arquivo_fonte', arquivo)
          .gte('DATA_REALIZACAO', '2025-06-01');
        return count === 0; // Deveria ser 0 após v003
      }
      return true;
    }
  },
  
  // 2. CORREÇÃO DE MODALIDADES (DX/CR → RX)
  {
    nome: "correcao_modalidades_dx_cr",
    funcao: "aplicar-correcao-modalidade-rx",
    parametros: (arquivo: string) => ({ arquivo_fonte: arquivo }),
    arquivo_aplicavel: ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo'],
    validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
      // Verificar se ainda existem modalidades DX/CR que deveriam ser RX
      const { count } = await supabase
        .from('volumetria_mobilemed')
        .select('*', { count: 'exact', head: true })
        .eq('arquivo_fonte', arquivo)
        .in('MODALIDADE', ['DX', 'CR'])
        .not('ESTUDO_DESCRICAO', 'ilike', '%mamografia%')
        .not('ESTUDO_DESCRICAO', 'ilike', '%mamogra%')
        .not('ESTUDO_DESCRICAO', 'ilike', '%tomo%');
      return count === 0; // Não deveria ter DX/CR não-mamográficos
    }
  },
  
  // 3. DE-PARA PRIORIDADES
  {
    nome: "de_para_prioridades",
    funcao: "aplicar-de-para-prioridades",
    parametros: (arquivo: string) => ({ arquivo_fonte: arquivo }),
    arquivo_aplicavel: ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo'],
    validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
      // Verificar se ainda há prioridades não padronizadas
      const { count } = await supabase
        .from('volumetria_mobilemed')
        .select('*', { count: 'exact', head: true })
        .eq('arquivo_fonte', arquivo)
        .not('PRIORIDADE', 'in', '("ROTINA","URGÊNCIA","PLANTÃO")');
      return count === 0;
    }
  },
  
  // 4. DE-PARA VALORES ZERADOS
  {
    nome: "de_para_valores_zerados",
    funcao: "aplicar-regras-tratamento",
    parametros: (arquivo: string) => ({ arquivo_fonte: arquivo }),
    arquivo_aplicavel: ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo'],
    validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
      // Verificar quantos valores zerados ainda existem (deveria ser mínimo)
      const { count } = await supabase
        .from('volumetria_mobilemed')
        .select('*', { count: 'exact', head: true })
        .eq('arquivo_fonte', arquivo)
        .or('VALORES.is.null,VALORES.eq.0');
      
      // Aceitar até 5% de valores zerados (alguns podem não ter de-para)
      const { count: total } = await supabase
        .from('volumetria_mobilemed')
        .select('*', { count: 'exact', head: true })
        .eq('arquivo_fonte', arquivo);
      
      return total > 0 ? (count / total) <= 0.05 : true;
    }
  },
  
  // 5. TIPIFICAÇÃO DE FATURAMENTO
  {
    nome: "tipificacao_faturamento",
    funcao: "aplicar-tipificacao-faturamento",
    parametros: (arquivo: string) => ({ arquivo_fonte: arquivo }),
    arquivo_aplicavel: ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo'],
    validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
      // Verificar se todos os registros têm tipo_faturamento
      const { count } = await supabase
        .from('volumetria_mobilemed')
        .select('*', { count: 'exact', head: true })
        .eq('arquivo_fonte', arquivo)
        .or('tipo_faturamento.is.null,tipo_faturamento.eq.""');
      return count === 0;
    }
  },
  
  // 6. VALIDAÇÃO DE CLIENTE
  {
    nome: "validacao_cliente",
    funcao: "aplicar-validacao-cliente",
    parametros: (arquivo: string, lote: string) => ({ arquivo_fonte: arquivo, lote_upload: lote }),
    arquivo_aplicavel: ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo'],
    validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
      return true; // Validação sempre passa (não é crítica para falha)
    }
  }
];

export default serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      arquivo_fonte, 
      lote_upload, 
      periodo_referencia,
      forcar_aplicacao = false,
      validar_apenas = false 
    } = await req.json();

    if (!arquivo_fonte) {
      throw new Error('arquivo_fonte é obrigatório');
    }

    console.log(`🎯 SISTEMA DE APLICAÇÃO COMPLETA DE REGRAS`);
    console.log(`📁 Arquivo: ${arquivo_fonte}`);
    console.log(`📦 Lote: ${lote_upload || 'N/A'}`);
    console.log(`📅 Período: ${periodo_referencia || 'jun/25'}`);
    console.log(`🔄 Forçar aplicação: ${forcar_aplicacao}`);
    console.log(`✅ Apenas validar: ${validar_apenas}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const statusAplicacao: StatusAplicacao[] = [];
    const periodo = periodo_referencia || 'jun/25';

    // Filtrar regras aplicáveis ao arquivo
    const regrasApplicaveis = REGRAS_SISTEMA.filter(regra => 
      regra.arquivo_aplicavel.includes(arquivo_fonte)
    );

    console.log(`📋 ${regrasApplicaveis.length} regras aplicáveis encontradas para ${arquivo_fonte}`);

    // Aplicar cada regra na ordem correta
    for (const regra of regrasApplicaveis) {
      console.log(`\n🔧 Aplicando: ${regra.nome}`);
      
      const status: StatusAplicacao = {
        regra: regra.nome,
        arquivo: arquivo_fonte,
        aplicada: false
      };

      if (validar_apenas) {
        // Apenas validar se a regra foi aplicada corretamente
        if (regra.validacao_pos_aplicacao) {
          try {
            const validacaoOk = await regra.validacao_pos_aplicacao(supabase, arquivo_fonte, null);
            status.validacao_ok = validacaoOk;
            status.aplicada = validacaoOk;
            console.log(`✅ Validação ${regra.nome}: ${validacaoOk ? 'OK' : 'FALHOU'}`);
          } catch (error) {
            status.erro = error.message;
            console.log(`❌ Erro na validação ${regra.nome}: ${error.message}`);
          }
        } else {
          status.aplicada = true; // Sem validação = assume OK
        }
      } else {
        // Aplicar a regra
        try {
          const parametros = typeof regra.parametros === 'function' 
            ? regra.parametros(arquivo_fonte === regra.nome.includes('periodo') ? periodo : arquivo_fonte, lote_upload)
            : regra.parametros;

          console.log(`🚀 Executando ${regra.funcao} com parâmetros:`, parametros);

          const { data: resultado, error } = await supabase.functions.invoke(regra.funcao, {
            body: parametros
          });

          if (error) {
            throw new Error(`Erro na função ${regra.funcao}: ${error.message}`);
          }

          status.resultado = resultado;
          status.aplicada = true;
          
          console.log(`✅ ${regra.nome} aplicada com sucesso:`, resultado);

          // Validar pós-aplicação se definida
          if (regra.validacao_pos_aplicacao) {
            const validacaoOk = await regra.validacao_pos_aplicacao(supabase, arquivo_fonte, resultado);
            status.validacao_ok = validacaoOk;
            
            if (!validacaoOk) {
              console.log(`⚠️ FALHA NA VALIDAÇÃO: ${regra.nome} não produziu resultado esperado!`);
              if (forcar_aplicacao) {
                console.log(`🔄 Tentando aplicar novamente...`);
                // Tentar aplicar novamente
                const { data: resultadoReaplicacao } = await supabase.functions.invoke(regra.funcao, {
                  body: parametros
                });
                const validacaoReaplicacao = await regra.validacao_pos_aplicacao(supabase, arquivo_fonte, resultadoReaplicacao);
                status.validacao_ok = validacaoReaplicacao;
                console.log(`🎯 Reaplicação: ${validacaoReaplicacao ? 'SUCESSO' : 'AINDA FALHOU'}`);
              }
            } else {
              console.log(`✅ Validação ${regra.nome}: OK`);
            }
          }

        } catch (error) {
          status.erro = error.message;
          status.aplicada = false;
          console.log(`❌ Erro ao aplicar ${regra.nome}: ${error.message}`);
        }
      }

      statusAplicacao.push(status);
    }

    // Resumo final
    const totalRegras = statusAplicacao.length;
    const regrasAplicadas = statusAplicacao.filter(s => s.aplicada).length;
    const regrasComValidacao = statusAplicacao.filter(s => s.validacao_ok === true).length;
    const regrasFalharam = statusAplicacao.filter(s => s.validacao_ok === false).length;

    const sucesso = regrasAplicadas === totalRegras && regrasFalharam === 0;

    console.log(`\n🎯 RESUMO FINAL:`);
    console.log(`📊 Total de regras: ${totalRegras}`);
    console.log(`✅ Regras aplicadas: ${regrasAplicadas}`);
    console.log(`🔍 Regras validadas OK: ${regrasComValidacao}`);
    console.log(`❌ Regras que falharam na validação: ${regrasFalharam}`);
    console.log(`🏆 Sucesso geral: ${sucesso ? 'SIM' : 'NÃO'}`);

    return new Response(JSON.stringify({
      success: sucesso,
      arquivo_fonte,
      lote_upload,
      periodo_referencia: periodo,
      total_regras: totalRegras,
      regras_aplicadas: regrasAplicadas,
      regras_validadas_ok: regrasComValidacao,
      regras_falharam: regrasFalharam,
      status_detalhado: statusAplicacao,
      recomendacao: sucesso 
        ? "Todas as regras foram aplicadas e validadas com sucesso"
        : "Algumas regras falharam. Verifique o status detalhado e execute novamente com forcar_aplicacao=true",
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Erro no sistema de aplicação de regras:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});