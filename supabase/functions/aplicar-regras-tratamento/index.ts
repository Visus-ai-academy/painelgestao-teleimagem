import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface RegrasTratamento {
  arquivo1: {
    // Volumetria Padrão - aplicar valores padrão para campos em branco
    preencherCamposObrigatorios: boolean;
    valorPadraoValores: number;
    modalidadePadrao: string;
  };
  arquivo2: {
    // Volumetria Fora Padrão - aplicar De-Para obrigatório
    aplicarDePara: boolean;
    zerarSemDePara: boolean;
  };
  arquivo3: {
    // Volumetria Padrão Retroativa - regras especiais para dados históricos  
    validarDataLimite: boolean;
    dataLimiteMinima: string;
    preencherEspecialidade: boolean;
  };
  arquivo4: {
    // Volumetria Fora Padrão Retroativa - combinar regras 2 e 3
    aplicarDePara: boolean;
    validarDataLimite: boolean;
    zerarSemDePara: boolean;
  };
  arquivo5: {
    // Volumetria Onco Padrão - regras específicas para oncologia
    aplicarCategoriaOnco: boolean;
    buscarValorDeParaQuebra: boolean;
  };
}

const REGRAS_PADRAO: RegrasTratamento = {
  arquivo1: {
    preencherCamposObrigatorios: true,
    valorPadraoValores: 1,
    modalidadePadrao: 'CR'
  },
  arquivo2: {
    aplicarDePara: true,
    zerarSemDePara: true
  },
  arquivo3: {
    validarDataLimite: true,
    dataLimiteMinima: '2023-01-01',
    preencherEspecialidade: true
  },
  arquivo4: {
    aplicarDePara: true,
    validarDataLimite: true,
    zerarSemDePara: true
  },
  arquivo5: {
    aplicarCategoriaOnco: true,
    buscarValorDeParaQuebra: true
  }
};

export default async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Inicializar cliente Supabase com service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse do corpo da requisição
    const { arquivo_fonte } = await req.json()

    if (!arquivo_fonte) {
      return new Response(
        JSON.stringify({ 
          error: 'arquivo_fonte é obrigatório' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Aplicando regras de tratamento para ${arquivo_fonte}`)

    let registrosAtualizados = 0;
    let mensagens: string[] = [];

    // Aplicar regras específicas baseadas no tipo de arquivo
    switch (arquivo_fonte) {
      case 'volumetria_padrao':
        // Arquivo 1: Aplicar De-Para automático para valores zerados
        const { data: deParaResult1, error: deParaError1 } = await supabase
          .rpc('aplicar_de_para_automatico', { 
            arquivo_fonte_param: arquivo_fonte 
          });
        
        if (deParaError1) {
          console.log(`⚠️ De-Para Arquivo 1 falhou: ${deParaError1.message}`);
          mensagens.push(`Arquivo 1: De-Para não aplicado - ${deParaError1.message}`);
        } else {
          registrosAtualizados += deParaResult1?.registros_atualizados || 0;
          mensagens.push(`Arquivo 1: De-Para aplicado em ${deParaResult1?.registros_atualizados || 0} registros com valores zerados`);
        }
        break;

      case 'volumetria_fora_padrao':
        // Arquivo 2: Aplicar De-Para obrigatório especificamente para este arquivo
        const { data: deParaResult, error: deParaError } = await supabase
          .rpc('aplicar_de_para_automatico', { 
            arquivo_fonte_param: arquivo_fonte 
          });
        
        if (deParaError) throw deParaError;
        registrosAtualizados += deParaResult?.registros_atualizados || 0;
        mensagens.push(`Arquivo 2: Aplicado De-Para específico em ${deParaResult?.registros_atualizados || 0} registros`);
        break;

      case 'volumetria_padrao_retroativo':
        // Arquivo 3: Aplicar De-Para automático para valores zerados
        const { data: deParaResult3, error: deParaError3 } = await supabase
          .rpc('aplicar_de_para_automatico', { 
            arquivo_fonte_param: arquivo_fonte 
          });
        
        if (deParaError3) {
          console.log(`⚠️ De-Para Arquivo 3 falhou: ${deParaError3.message}`);
          mensagens.push(`Arquivo 3: De-Para não aplicado - ${deParaError3.message}`);
        } else {
          registrosAtualizados += deParaResult3?.registros_atualizados || 0;
          mensagens.push(`Arquivo 3: De-Para aplicado em ${deParaResult3?.registros_atualizados || 0} registros com valores zerados`);
        }
        break;

      case 'volumetria_fora_padrao_retroativo':
        // Arquivo 4: Aplicar De-Para obrigatório específico para este arquivo
        const { data: deParaResult4, error: deParaError4 } = await supabase
          .rpc('aplicar_de_para_automatico', { 
            arquivo_fonte_param: arquivo_fonte 
          });
        
        if (deParaError4) throw deParaError4;
        registrosAtualizados += deParaResult4?.registros_atualizados || 0;
        mensagens.push(`Arquivo 4: Aplicado De-Para específico em ${deParaResult4?.registros_atualizados || 0} registros`);
        break;

      case 'volumetria_onco_padrao':
        // Arquivo 5: Aplicar categoria Onco e buscar valores
        console.log('🩺 Processando arquivo ONCO - Aplicando categoria e buscando valores...');
        
        // 1. Aplicar categoria "Onco" a todos os registros
        const { data: updateOncoCategoria, error: errorOncoCategoria } = await supabase
          .from('volumetria_mobilemed')
          .update({ 'CATEGORIA': 'Onco' })
          .eq('arquivo_fonte', arquivo_fonte)
          .select('id');
        
        if (errorOncoCategoria) {
          console.error('❌ Erro ao aplicar categoria Onco:', errorOncoCategoria);
          mensagens.push(`Arquivo 5: Erro ao aplicar categoria - ${errorOncoCategoria.message}`);
        } else {
          const categoriasAplicadas = updateOncoCategoria?.length || 0;
          mensagens.push(`Arquivo 5: Categoria "Onco" aplicada em ${categoriasAplicadas} registros`);
        }
        
        // 2. Aplicar De-Para específico para valores zerados
        const { data: deParaOnco, error: deParaOncoError } = await supabase
          .rpc('aplicar_de_para_automatico', { 
            arquivo_fonte_param: arquivo_fonte 
          });
        
        if (deParaOncoError) {
          console.log(`⚠️ De-Para ONCO falhou: ${deParaOncoError.message}`);
          mensagens.push(`Arquivo 5: De-Para não aplicado - ${deParaOncoError.message}`);
        } else {
          const valoresAtualizados = deParaOnco?.registros_atualizados || 0;
          registrosAtualizados += valoresAtualizados;
          mensagens.push(`Arquivo 5: De-Para ONCO aplicado em ${valoresAtualizados} registros`);
        }
        break;

      default:
        mensagens.push(`Nenhuma regra específica para ${arquivo_fonte}`);
    }

    console.log(`Regras de tratamento aplicadas: ${registrosAtualizados} registros atualizados`)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Regras de tratamento aplicadas com sucesso`,
        arquivo_fonte: arquivo_fonte,
        registros_atualizados: registrosAtualizados,
        detalhes: mensagens
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Erro geral:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}