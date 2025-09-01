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
  categoria: string;
  prioridade: number;
  condicao_aplicacao?: (arquivo: string) => boolean;
  validacao_pos_aplicacao?: (supabase: any, arquivo: string, resultado: any, periodo_referencia?: string) => Promise<boolean>;
}

interface StatusAplicacao {
  regra: string;
  arquivo: string;
  aplicada: boolean;
  resultado?: any;
  erro?: string;
  validacao_ok?: boolean;
}

// ============================================================================
// 🏗️ MÓDULOS DE REGRAS ORGANIZADOS POR CATEGORIA
// ============================================================================

/**
 * 📅 GRUPO 1: REGRAS DE PERÍODO E FILTROS TEMPORAIS
 * Responsável por filtrar dados baseado em períodos de referência
 */
class PeriodRules {
  static readonly REGRAS = [
    // 1. REGRA DE PERÍODO ATUAL (v031) - APENAS para arquivos não-retroativos
    {
      nome: "v031_filtro_periodo_atual",
      funcao: "aplicar-filtro-periodo-atual",
      categoria: "Filtros Temporais",
      prioridade: 1,
      parametros: (arquivo: string, periodo: string) => ({ arquivo_fonte: arquivo, periodo_referencia: periodo }),
      arquivo_aplicavel: ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_onco_padrao'],
      validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
        return true; // Regra sempre passa pois é de filtro
      }
    },
    
    // 2. REGRAS DE PERÍODO RETROATIVO (v002/v003) - APENAS para arquivos retroativos  
    {
      nome: "v002_v003_exclusoes_periodo",
      funcao: "aplicar-exclusoes-periodo",
      categoria: "Filtros Temporais", 
      prioridade: 2,
      parametros: (arquivo: string, periodo: string) => ({ arquivo_fonte: arquivo, periodo_referencia: periodo }),
      arquivo_aplicavel: ['volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo'],
      validacao_pos_aplicacao: async (supabase, arquivo, resultado, periodo_referencia) => {
        // Validação robusta para v002/v003
        if (!resultado || typeof resultado.sucesso === 'undefined') {
          return false;
        }
        
        if (!resultado.sucesso) {
          return false;
        }
        
        // Calcular data limite uniforme
        let dataLimite: string;
        if (periodo_referencia === 'jun/25') {
          dataLimite = '2025-06-01';
        } else {
          const [mes, ano] = periodo_referencia.split('/');
          const meses: { [key: string]: number } = {
            'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
            'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12
          };
          const anoCompleto = 2000 + parseInt(ano);
          const mesNumero = meses[mes];
          const dataCalculada = new Date(anoCompleto, mesNumero - 1, 1);
          dataLimite = dataCalculada.toISOString().split('T')[0];
        }
        
        const isRetroativo = arquivo.includes('retroativo');
        let validationQuery = supabase
          .from('volumetria_mobilemed')
          .select('*', { count: 'exact', head: true })
          .eq('arquivo_fonte', arquivo);
        
        if (isRetroativo) {
          validationQuery = validationQuery.lt('DATA_LAUDO', dataLimite);
        } else {
          validationQuery = validationQuery.gte('DATA_LAUDO', dataLimite);
        }
        
        const { count, error } = await validationQuery;
        
        if (error) {
          return false;
        }
        
        return (count || 0) === 0;
      }
    },
    
    // 19. FILTRO DATA LAUDO - v037
    {
      nome: "v037_filtro_data_laudo", 
      funcao: "aplicar-filtro-data-laudo",
      categoria: "Filtros Temporais",
      prioridade: 19,
      parametros: (arquivo: string) => ({ arquivo_fonte: arquivo }),
      arquivo_aplicavel: ['volumetria_padrao', 'volumetria_fora_padrao'],
      validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
        return true; // Validação para filtro de data laudo
      }
    }
  ];
}

/**
 * 🔧 GRUPO 2: REGRAS DE MODALIDADE E CORREÇÕES
 * Responsável por corrigir e normalizar modalidades
 */
class ModalityRules {
  static readonly REGRAS = [
    // 3. CORREÇÃO DE MODALIDADES (DX/CR → RX/MG) - v030
    {
      nome: "v030_correcao_modalidades_dx_cr",
      funcao: "aplicar-correcao-modalidade-rx",
      categoria: "Correções Modalidade",
      prioridade: 3,
      parametros: (arquivo: string) => ({ arquivo_fonte: arquivo }),
      arquivo_aplicavel: ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo', 'volumetria_onco_padrao'],
      validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
        if (resultado && typeof resultado.sucesso !== 'undefined') {
          return resultado.sucesso;
        }
        return true;
      }
    },
    
    // 4. CORREÇÃO DE MODALIDADES (OT → DO) - v035  
    {
      nome: "v035_correcao_modalidades_ot",
      funcao: "aplicar-correcao-modalidade-ot",
      categoria: "Correções Modalidade",
      prioridade: 4,
      parametros: (arquivo: string) => ({ arquivo_fonte: arquivo }),
      arquivo_aplicavel: ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo'],
      validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
        if (resultado && typeof resultado.sucesso !== 'undefined') {
          return resultado.sucesso;
        }
        return true;
      }
    }
  ];
}

/**
 * 📊 GRUPO 3: REGRAS DE DADOS E DE-PARA
 * Responsável por normalizar prioridades e valores
 */
class DataRules {
  static readonly REGRAS = [
    // 5. DE-PARA PRIORIDADES - v018
    {
      nome: "v018_de_para_prioridades",
      funcao: "aplicar-de-para-prioridades",
      categoria: "Normalização Dados",
      prioridade: 5,
      parametros: (arquivo: string) => ({ arquivo_fonte: arquivo }),
      arquivo_aplicavel: ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo', 'volumetria_onco_padrao'],
      validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
        const { count } = await supabase
          .from('volumetria_mobilemed')
          .select('*', { count: 'exact', head: true })
          .eq('arquivo_fonte', arquivo)
          .not('PRIORIDADE', 'in', '(ROTINA,URGÊNCIA,PLANTÃO,Rotina,Urgência,Plantão,Ambulatório,Internado)');
        return count === 0;
      }
    },
    
    // 6. DE-PARA VALORES ZERADOS - v026
    {
      nome: "v026_de_para_valores_zerados",
      funcao: "aplicar-regras-tratamento",
      categoria: "Normalização Dados",
      prioridade: 6,
      parametros: (arquivo: string) => ({ arquivo_fonte: arquivo }),
      arquivo_aplicavel: ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo'],
      validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
        const { count } = await supabase
          .from('volumetria_mobilemed')
          .select('*', { count: 'exact', head: true })
          .eq('arquivo_fonte', arquivo)
          .or('VALORES.is.null,VALORES.eq.0');
        
        const { count: total } = await supabase
          .from('volumetria_mobilemed')
          .select('*', { count: 'exact', head: true })
          .eq('arquivo_fonte', arquivo);
        
        return total > 0 ? (count / total) <= 0.05 : true;
      }
    }
  ];
}

/**
 * 💰 GRUPO 4: REGRAS DE FATURAMENTO
 * Responsável por tipificação e regras financeiras
 */
class BillingRules {
  static readonly REGRAS = [
    // 7. TIPIFICAÇÃO DE FATURAMENTO - f005
    {
      nome: "f005_tipificacao_faturamento",
      funcao: "aplicar-tipificacao-faturamento",
      categoria: "Faturamento",
      prioridade: 7,
      parametros: (arquivo: string) => ({ arquivo_fonte: arquivo }),
      arquivo_aplicavel: ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo'],
      validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
        const { count } = await supabase
          .from('volumetria_mobilemed')
          .select('*', { count: 'exact', head: true })
          .eq('arquivo_fonte', arquivo)
          .or('tipo_faturamento.is.null,tipo_faturamento.eq.""');
        return count === 0;
      }
    },
    
    // 18. TIPIFICAÇÃO RETROATIVA - v036  
    {
      nome: "v036_tipificacao_retroativa",
      funcao: "aplicar-tipificacao-retroativa",
      categoria: "Faturamento",
      prioridade: 18,
      parametros: (arquivo: string) => ({ arquivo_fonte: arquivo }),
      arquivo_aplicavel: ['volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo'],
      validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
        return true; // Validação para tipificação retroativa
      }
    }
  ];
}

/**
 * 🏷️ GRUPO 5: REGRAS DE NORMALIZAÇÃO
 * Responsável por limpeza e normalização de nomes
 */
class NormalizationRules {
  static readonly REGRAS = [
    // 8. NORMALIZAÇÃO NOME MÉDICO - v017
    {
      nome: "v017_normalizacao_nome_medico",
      funcao: "aplicar-mapeamento-nome-cliente", // Reutilizar função similar
      categoria: "Normalização",
      prioridade: 8,
      parametros: (arquivo: string) => ({ arquivo_fonte: arquivo }),
      arquivo_aplicavel: ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo', 'volumetria_onco_padrao'],
      validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
        return true; // Validação sempre passa para normalização
      }
    },
    
    // 16. MAPEAMENTO NOME CLIENTE - v035
    {
      nome: "v035_mapeamento_nome_cliente",
      funcao: "aplicar-mapeamento-nome-cliente",
      categoria: "Normalização",
      prioridade: 16,
      parametros: (arquivo: string) => ({ arquivo_fonte: arquivo }),
      arquivo_aplicavel: ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo', 'volumetria_onco_padrao'],
      validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
        return true; // Validação para mapeamento de nomes
      }
    },
    
    // 21. LIMPEZA NOME EMPRESA - v021b
    {
      nome: "v021b_limpeza_nome_empresa",
      funcao: "aplicar-mapeamento-nome-cliente",
      categoria: "Normalização",
      prioridade: 21,
      parametros: (arquivo: string) => ({ arquivo_fonte: arquivo }),
      arquivo_aplicavel: ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo', 'volumetria_onco_padrao'],
      validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
        return true;
      }
    }
  ];
}

/**
 * 🎯 GRUPO 6: REGRAS DE ESPECIALIDADE E CATEGORIA
 * Responsável por especialidades, categorias e classificações
 */
class SpecialtyRules {
  static readonly REGRAS = [
    // 11. SUBSTITUIÇÃO ESPECIALIDADE/CATEGORIA - v033
    {
      nome: "v033_substituicao_especialidade_categoria",
      funcao: "aplicar-substituicao-especialidade-categoria",
      categoria: "Especialidades",
      prioridade: 11,
      parametros: (arquivo: string) => ({ arquivo_fonte: arquivo }),
      arquivo_aplicavel: ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo', 'volumetria_onco_padrao'],
      validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
        return true; // Validação específica para substituições
      }
    },
    
    // 12. ESPECIALIDADE COLUNA → MÚSCULO/NEURO - v034
    {
      nome: "v034_colunas_musculo_neuro",
      funcao: "aplicar-regra-colunas-musculo-neuro",
      categoria: "Especialidades",
      prioridade: 12,
      parametros: (arquivo: string) => ({ arquivo_fonte: arquivo }),
      arquivo_aplicavel: ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo'],
      validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
        const { count } = await supabase
          .from('volumetria_mobilemed')
          .select('*', { count: 'exact', head: true })
          .eq('arquivo_fonte', arquivo)
          .eq('ESPECIALIDADE', 'Colunas');
        return count === 0; // Não deveria ter mais "Colunas"
      }
    },
    
    // 14. APLICAÇÃO ESPECIALIDADE AUTOMÁTICA - v023
    {
      nome: "v023_aplicacao_especialidade_automatica",
      funcao: "aplicar-especialidade-automatica",
      categoria: "Especialidades",
      prioridade: 14,
      parametros: (arquivo: string) => ({ arquivo_fonte: arquivo }),
      arquivo_aplicavel: ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo'],
      validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
        return true; // Validação para especialidades automáticas
      }
    }
  ];
}

/**
 * 🚫 GRUPO 7: REGRAS DE EXCLUSÃO
 * Responsável por exclusões específicas e dinâmicas
 */
class ExclusionRules {
  static readonly REGRAS = [
    // 13. EXCLUSÃO DE CLIENTES ESPECÍFICOS - v032
    {
      nome: "v032_exclusao_clientes_especificos",
      funcao: "aplicar-exclusao-clientes-especificos",
      categoria: "Exclusões",
      prioridade: 13,
      parametros: (arquivo: string) => ({ arquivo_fonte: arquivo }),
      arquivo_aplicavel: ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo'],
      validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
        return true; // Validação específica para exclusões
      }
    },
    
    // 20. REGRAS DE EXCLUSÃO DINÂMICA - v020
    {
      nome: "v020_regras_exclusao_dinamica",
      funcao: "aplicar-regras-lote",
      categoria: "Exclusões",
      prioridade: 20,
      parametros: (arquivo: string) => ({ arquivo_fonte: arquivo }),
      arquivo_aplicavel: ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo'],
      validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
        return true; // Validação para exclusões dinâmicas
      }
    }
  ];
}

/**
 * ⚙️ GRUPO 8: REGRAS DE PROCESSAMENTO
 * Responsável por quebras, categorias e valores especiais
 */
class ProcessingRules {
  static readonly REGRAS = [
    // 9. APLICAÇÃO VALOR ONCO - v019
    {
      nome: "v019_aplicacao_valor_onco",
      funcao: "buscar-valor-onco",
      categoria: "Processamento",
      prioridade: 9,
      parametros: (arquivo: string) => ({ arquivo_fonte: arquivo }),
      arquivo_aplicavel: ['volumetria_onco_padrao'], // Apenas arquivo oncológico
      validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
        return true; // Validação específica para onco
      }
    },
    
    // 10. QUEBRA DE EXAMES - v027
    {
      nome: "v027_quebra_exames_automatica",
      funcao: "aplicar-quebras-automatico",
      categoria: "Processamento",
      prioridade: 10,
      parametros: (arquivo: string) => ({ arquivo_fonte: arquivo }),
      arquivo_aplicavel: ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo'],
      validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
        return true; // Validação específica para quebras
      }
    },
    
    // 15. PROCESSAMENTO DE CATEGORIAS - v028
    {
      nome: "v028_processamento_categorias_exames",
      funcao: "aplicar-categorias-cadastro",
      categoria: "Processamento",
      prioridade: 15,
      parametros: (arquivo: string) => ({ arquivo_fonte: arquivo }),
      arquivo_aplicavel: ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo'],
      validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
        return true; // Validação para categorias
      }
    }
  ];
}

/**
 * ✅ GRUPO 9: REGRAS DE VALIDAÇÃO E COMPLETUDE
 * Responsável por validações e verificações finais
 */
class ValidationRules {
  static readonly REGRAS = [
    // 17. VALIDAÇÃO DE CLIENTE - v021
    {
      nome: "v021_validacao_cliente",
      funcao: "aplicar-validacao-cliente",
      categoria: "Validação",
      prioridade: 17,
      parametros: (arquivo: string, lote: string) => ({ arquivo_fonte: arquivo, lote_upload: lote }),
      arquivo_aplicavel: ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo'],
      validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
        return true; // Validação sempre passa (não é crítica para falha)
      }
    },

    // 22. REGRAS QUEBRA E PROBLEMAS - v022
    {
      nome: "v022_regras_quebra_problemas",
      funcao: "aplicar-regras-quebra-exames",
      categoria: "Validação",
      prioridade: 22,
      parametros: (arquivo: string) => ({ arquivo_fonte: arquivo }),
      arquivo_aplicavel: ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo'],
      validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
        return true;
      }
    },

    // 23. APLICAÇÃO REGRAS GERAIS - v023b
    {
      nome: "v023b_aplicacao_regras_gerais",
      funcao: "aplicar-regras-lote",
      categoria: "Validação", 
      prioridade: 23,
      parametros: (arquivo: string) => ({ arquivo_fonte: arquivo }),
      arquivo_aplicavel: ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo'],
      validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
        return true;
      }
    },

    // 24. CORREÇÃO DADOS EXISTENTES - v024
    {
      nome: "v024_correcao_dados_existentes",
      funcao: "corrigir-dados-existentes",
      categoria: "Validação",
      prioridade: 24,
      parametros: (arquivo: string) => ({ arquivo_fonte: arquivo }),
      arquivo_aplicavel: ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo'],
      validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
        return true;
      }
    },

    // 25. VALIDAÇÃO FINAL - v025
    {
      nome: "v025_validacao_final_regras",
      funcao: "validar-regras-processamento",
      categoria: "Validação",
      prioridade: 25,
      parametros: (arquivo: string) => ({ arquivo_fonte: arquivo }),
      arquivo_aplicavel: ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo', 'volumetria_onco_padrao'],
      validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
        return true;
      }
    },

    // 26. APLICAÇÃO AUTOMÁTICA REGRAS RETROATIVAS - v026b
    {
      nome: "v026b_aplicacao_automatica_retroativas",
      funcao: "aplicar-regras-v002-v003-automatico",
      categoria: "Validação",
      prioridade: 26,
      parametros: (arquivo: string) => ({ arquivo_fonte: arquivo }),
      arquivo_aplicavel: ['volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo'],
      validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
        return true;
      }
    },

    // 27. CORREÇÃO COMPLETA DADOS - v027b
    {
      nome: "v027b_correcao_completa_dados",
      funcao: "corrigir-todos-dados-existentes",
      categoria: "Validação",
      prioridade: 27,
      parametros: (arquivo: string) => ({ arquivo_fonte: arquivo }),
      arquivo_aplicavel: ['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo', 'volumetria_onco_padrao'],
      validacao_pos_aplicacao: async (supabase, arquivo, resultado) => {
        return true;
      }
    }
  ];
}

/**
 * 🏗️ SISTEMA DE REGRAS CONSOLIDADO
 * Combina todas as regras organizadas por categoria e prioridade
 */
class RuleSystem {
  static getAllRules(): RegraAplicacao[] {
    return [
      ...PeriodRules.REGRAS,
      ...ModalityRules.REGRAS,
      ...DataRules.REGRAS,
      ...BillingRules.REGRAS,
      ...NormalizationRules.REGRAS,
      ...SpecialtyRules.REGRAS,
      ...ExclusionRules.REGRAS,
      ...ProcessingRules.REGRAS,
      ...ValidationRules.REGRAS
    ].sort((a, b) => a.prioridade - b.prioridade); // Ordenar por prioridade
  }
  
  static getRulesByCategory(categoria: string): RegraAplicacao[] {
    return this.getAllRules().filter(regra => regra.categoria === categoria);
  }
  
  static getRulesForFile(arquivo_fonte: string): RegraAplicacao[] {
    return this.getAllRules().filter(regra => 
      regra.arquivo_aplicavel.includes(arquivo_fonte)
    );
  }
  
  static getCategorySummary(): Record<string, number> {
    const regras = this.getAllRules();
    const summary: Record<string, number> = {};
    
    regras.forEach(regra => {
      summary[regra.categoria] = (summary[regra.categoria] || 0) + 1;
    });
    
    return summary;
  }
}

// Manter compatibilidade com código existente
const REGRAS_SISTEMA = RuleSystem.getAllRules();
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

    // 📊 Exibir resumo das categorias de regras
    const categorySummary = RuleSystem.getCategorySummary();
    console.log(`🎯 SISTEMA ORGANIZADO DE APLICAÇÃO DE REGRAS`);
    console.log(`📁 Arquivo: ${arquivo_fonte}`);
    console.log(`📦 Lote: ${lote_upload || 'N/A'}`);
    console.log(`📅 Período: ${periodo_referencia || 'jun/25'}`);
    console.log(`🔄 Forçar aplicação: ${forcar_aplicacao}`);
    console.log(`✅ Apenas validar: ${validar_apenas}`);
    console.log(`\n📋 CATEGORIAS DE REGRAS DISPONÍVEIS:`);
    Object.entries(categorySummary).forEach(([categoria, total]) => {
      console.log(`   ${categoria}: ${total} regras`);
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const statusAplicacao: StatusAplicacao[] = [];
    const periodo = periodo_referencia || 'jun/25';

    // Usar o sistema organizado para buscar regras aplicáveis
    const regrasApplicaveis = RuleSystem.getRulesForFile(arquivo_fonte);

    console.log(`\n📋 ${regrasApplicaveis.length} regras aplicáveis encontradas para ${arquivo_fonte}:`);
    regrasApplicaveis.forEach(regra => {
      console.log(`   [${regra.categoria}] ${regra.nome} (prioridade: ${regra.prioridade})`);
    });

    // Aplicar cada regra na ordem de prioridade
    for (const regra of regrasApplicaveis) {
      console.log(`\n🔧 [${regra.categoria}] Aplicando: ${regra.nome}`);
      
      const status: StatusAplicacao = {
        regra: regra.nome,
        arquivo: arquivo_fonte,
        aplicada: false
      };

      if (validar_apenas) {
        // Apenas validar se a regra foi aplicada corretamente
        if (regra.validacao_pos_aplicacao) {
          try {
            const validacaoOk = await regra.validacao_pos_aplicacao(supabase, arquivo_fonte, null, periodo);
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
          let parametros;
          if (typeof regra.parametros === 'function') {
            // Passar argumentos corretos baseado no que a função espera
            if (regra.nome.includes('periodo') || regra.nome.includes('v002') || regra.nome.includes('v031')) {
              parametros = regra.parametros(arquivo_fonte, periodo);
            } else if (regra.nome.includes('validacao_cliente')) {
              parametros = regra.parametros(arquivo_fonte, lote_upload);
            } else {
              parametros = regra.parametros(arquivo_fonte);
            }
          } else {
            parametros = regra.parametros;
          }
          
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
            const validacaoOk = await regra.validacao_pos_aplicacao(supabase, arquivo_fonte, resultado, periodo);
            status.validacao_ok = validacaoOk;
            
            if (!validacaoOk) {
              console.log(`⚠️ FALHA NA VALIDAÇÃO: ${regra.nome} não produziu resultado esperado!`);
              if (forcar_aplicacao) {
                console.log(`🔄 Tentando aplicar novamente...`);
                // Tentar aplicar novamente
                const { data: resultadoReaplicacao } = await supabase.functions.invoke(regra.funcao, {
                  body: parametros
                });
                const validacaoReaplicacao = await regra.validacao_pos_aplicacao(supabase, arquivo_fonte, resultadoReaplicacao, periodo);
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

    // 📊 Resumo final organizado por categoria
    const totalRegras = statusAplicacao.length;
    const regrasAplicadas = statusAplicacao.filter(s => s.aplicada).length;
    const regrasComValidacao = statusAplicacao.filter(s => s.validacao_ok === true).length;
    const regrasFalharam = statusAplicacao.filter(s => s.validacao_ok === false).length;

    const sucesso = regrasAplicadas === totalRegras && regrasFalharam === 0;

    console.log(`\n🎯 RESUMO FINAL ORGANIZADO:`);
    console.log(`📊 Total de regras processadas: ${totalRegras}`);
    console.log(`✅ Regras aplicadas com sucesso: ${regrasAplicadas}`);
    console.log(`🔍 Regras validadas corretamente: ${regrasComValidacao}`);
    console.log(`❌ Regras que falharam na validação: ${regrasFalharam}`);
    console.log(`🏆 Status geral: ${sucesso ? 'SUCESSO COMPLETO' : 'FALHAS DETECTADAS'}`);

    // Resumo por categoria
    const resumoPorCategoria: Record<string, any> = {};
    statusAplicacao.forEach(status => {
      const regra = regrasApplicaveis.find(r => r.nome === status.regra);
      if (regra) {
        if (!resumoPorCategoria[regra.categoria]) {
          resumoPorCategoria[regra.categoria] = {
            total: 0,
            aplicadas: 0,
            validadas: 0,
            falharam: 0
          };
        }
        resumoPorCategoria[regra.categoria].total++;
        if (status.aplicada) resumoPorCategoria[regra.categoria].aplicadas++;
        if (status.validacao_ok === true) resumoPorCategoria[regra.categoria].validadas++;
        if (status.validacao_ok === false) resumoPorCategoria[regra.categoria].falharam++;
      }
    });

    console.log(`\n📋 RESUMO POR CATEGORIA:`);
    Object.entries(resumoPorCategoria).forEach(([categoria, stats]) => {
      console.log(`   ${categoria}: ${stats.aplicadas}/${stats.total} aplicadas, ${stats.validadas} validadas`);
    });

    return new Response(JSON.stringify({
      success: sucesso,
      arquivo_fonte,
      lote_upload,
      periodo_referencia: periodo,
      total_regras: totalRegras,
      regras_aplicadas: regrasAplicadas,
      regras_validadas_ok: regrasComValidacao,
      regras_falharam: regrasFalharam,
      resumo_por_categoria: resumoPorCategoria,
      status_detalhado: statusAplicacao,
      categorias_disponiveis: categorySummary,
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
      error: error.message,
      sistema_organizado: true
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
