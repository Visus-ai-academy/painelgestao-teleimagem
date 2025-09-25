import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { estudo_descricao } = await req.json();
    
    console.log(`🔍 Buscando valor para: "${estudo_descricao}"`);
    
    if (!estudo_descricao) {
      return new Response(JSON.stringify({
        success: false,
        error: 'estudo_descricao é obrigatório'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let valorEncontrado = null;
    let fonteEncontrada = null;

    console.log('🔎 Etapa 1: Buscando no De-Para (valores_referencia_de_para)...');
    
    // 1. PRIMEIRO: Buscar na tabela de valores de referência (De-Para)
    const { data: valoresDePara, error: errorDePara } = await supabaseClient
      .from('valores_referencia_de_para')
      .select('valores, estudo_descricao')
      .eq('estudo_descricao', estudo_descricao)
      .eq('ativo', true)
      .limit(1);

    if (errorDePara) {
      console.error('❌ Erro ao buscar no De-Para:', errorDePara);
    } else if (valoresDePara && valoresDePara.length > 0) {
      valorEncontrado = valoresDePara[0].valores;
      fonteEncontrada = 'de_para';
      console.log(`✅ Encontrado no De-Para: ${valorEncontrado}`);
    } else {
      console.log('ℹ️ Não encontrado no De-Para');
    }

    // 2. SEGUNDO: Se não encontrou, buscar na quebra de exames
    if (!valorEncontrado) {
      console.log('🔎 Etapa 2: Buscando na Quebra de Exames...');
      
      // Buscar tanto como exame original quanto como exame quebrado
      const { data: regrasQuebra, error: errorQuebra } = await supabaseClient
        .from('regras_quebra_exames')
        .select('exame_original, exame_quebrado, categoria_quebrada')
        .or(`exame_original.eq.${estudo_descricao},exame_quebrado.eq.${estudo_descricao}`)
        .eq('ativo', true);

      if (errorQuebra) {
        console.error('❌ Erro ao buscar na Quebra:', errorQuebra);
      } else if (regrasQuebra && regrasQuebra.length > 0) {
        // Se encontrou na quebra, buscar o valor do exame original no De-Para
        const regraEncontrada = regrasQuebra[0];
        const exameParaBuscar = regraEncontrada.exame_original;
        
        console.log(`🔍 Encontrado na quebra, buscando valor do exame original: "${exameParaBuscar}"`);
        
        const { data: valorOriginal, error: errorOriginal } = await supabaseClient
          .from('valores_referencia_de_para')
          .select('valores')
          .eq('estudo_descricao', exameParaBuscar)
          .eq('ativo', true)
          .limit(1);

        if (!errorOriginal && valorOriginal && valorOriginal.length > 0) {
          valorEncontrado = valorOriginal[0].valores;
          fonteEncontrada = 'quebra_exames';
          console.log(`✅ Valor encontrado via quebra: ${valorEncontrado}`);
        } else {
          console.log('⚠️ Exame encontrado na quebra, mas sem valor no De-Para');
        }
      } else {
        console.log('ℹ️ Não encontrado na Quebra de Exames');
      }
    }

    const resultado = {
      estudo_descricao,
      valor_encontrado: valorEncontrado,
      fonte: fonteEncontrada,
      encontrado: valorEncontrado !== null
    };

    console.log(`📊 Resultado final:`, resultado);

    return new Response(JSON.stringify({
      success: true,
      resultado
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Erro na busca:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}