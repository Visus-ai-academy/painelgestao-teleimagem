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
        // Arquivo 1: Preencher campos obrigatórios
        const { data: updateResult1, error: error1 } = await supabase
          .from('volumetria_mobilemed')
          .update({
            'VALORES': REGRAS_PADRAO.arquivo1.valorPadraoValores,
            'MODALIDADE': REGRAS_PADRAO.arquivo1.modalidadePadrao
          })
          .eq('arquivo_fonte', arquivo_fonte)
          .or('VALORES.is.null,VALORES.eq.0')
          .select('id');
        
        if (error1) throw error1;
        registrosAtualizados += updateResult1?.length || 0;
        mensagens.push(`Arquivo 1: ${updateResult1?.length || 0} registros com valores zerados corrigidos`);
        break;

      case 'volumetria_fora_padrao':
        // Arquivo 2: Aplicar De-Para obrigatório
        const { data: deParaResult, error: deParaError } = await supabase
          .rpc('aplicar_valores_de_para');
        
        if (deParaError) throw deParaError;
        registrosAtualizados += deParaResult?.registros_atualizados || 0;
        mensagens.push(`Arquivo 2: Aplicado De-Para em ${deParaResult?.registros_atualizados || 0} registros`);
        break;

      case 'volumetria_padrao_retroativo':
        // Arquivo 3: Validar data limite e preencher especialidade
        const dataLimite = new Date(REGRAS_PADRAO.arquivo3.dataLimiteMinima);
        
        // Remover registros muito antigos
        const { error: deleteError } = await supabase
          .from('volumetria_mobilemed')
          .delete()
          .eq('arquivo_fonte', arquivo_fonte)
          .lt('data_referencia', dataLimite.toISOString());
        
        if (deleteError) throw deleteError;

        // Preencher especialidade padrão
        const { data: updateResult3, error: error3 } = await supabase
          .from('volumetria_mobilemed')
          .update({
            'ESPECIALIDADE': 'RADIOLOGIA'
          })
          .eq('arquivo_fonte', arquivo_fonte)
          .is('ESPECIALIDADE', null)
          .select('id');
        
        if (error3) throw error3;
        registrosAtualizados += updateResult3?.length || 0;
        mensagens.push(`Arquivo 3: ${updateResult3?.length || 0} registros com especialidade preenchida`);
        break;

      case 'volumetria_fora_padrao_retroativo':
        // Arquivo 4: Combinar regras 2 e 3
        const dataLimite4 = new Date(REGRAS_PADRAO.arquivo3.dataLimiteMinima);
        
        // Remover registros muito antigos
        const { error: deleteError4 } = await supabase
          .from('volumetria_mobilemed')
          .delete()
          .eq('arquivo_fonte', arquivo_fonte)
          .lt('data_referencia', dataLimite4.toISOString());
        
        if (deleteError4) throw deleteError4;

        // Aplicar De-Para
        const { data: deParaResult4, error: deParaError4 } = await supabase
          .rpc('aplicar_valores_de_para');
        
        if (deParaError4) throw deParaError4;
        registrosAtualizados += deParaResult4?.registros_atualizados || 0;
        mensagens.push(`Arquivo 4: Aplicado De-Para em ${deParaResult4?.registros_atualizados || 0} registros`);
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