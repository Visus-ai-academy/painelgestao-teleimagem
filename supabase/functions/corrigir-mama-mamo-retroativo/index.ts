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
    
    console.log(`🔄 Iniciando correção MAMA → MAMO para exames de mamografia (modalidade MG)`);
    
    // Buscar registros com especialidade MAMA na modalidade MG
    // Esses são os exames de MAMOGRAFIA e TOMOSSINTESE que precisam virar MAMO
    let query = supabase
      .from('volumetria_mobilemed')
      .select('id, "ESTUDO_DESCRICAO", "MODALIDADE", "ESPECIALIDADE"')
      .eq('"ESPECIALIDADE"', 'MAMA')
      .eq('"MODALIDADE"', 'MG');
    
    if (arquivo_fonte) {
      query = query.eq('arquivo_fonte', arquivo_fonte);
    }

    const { data: registrosMG, error: selectError } = await query;
    
    if (selectError) {
      console.error('❌ Erro ao buscar registros:', selectError);
      throw selectError;
    }
    
    if (!registrosMG || registrosMG.length === 0) {
      console.log('✅ Nenhum registro com MAMA/MG encontrado para corrigir');
      return new Response(
        JSON.stringify({
          sucesso: true,
          total_corrigidos: 0,
          arquivo_fonte: arquivo_fonte || 'TODOS',
          mensagem: 'Nenhum registro encontrado para correção'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`📊 Encontrados ${registrosMG.length} registros MAMA/MG para corrigir para MAMO`);
    
    let totalCorrigidos = 0;
    const exemplosCorrecoes: any[] = [];
    
    // Corrigir MAMA → MAMO para modalidade MG (MAMOGRAFIA e TOMOSSINTESE)
    const idsParaCorrigir = registrosMG.map(r => r.id);
    
    const { error: updateError } = await supabase
      .from('volumetria_mobilemed')
      .update({
        ESPECIALIDADE: 'MAMO',
        updated_at: new Date().toISOString()
      })
      .in('id', idsParaCorrigir);
    
    if (updateError) {
      console.error('❌ Erro ao atualizar registros:', updateError);
      throw updateError;
    }
    
    totalCorrigidos = registrosMG.length;
    
    // Coletar exemplos para o log
    for (const registro of registrosMG.slice(0, 10)) {
      exemplosCorrecoes.push({
        exame: registro.ESTUDO_DESCRICAO,
        modalidade: registro.MODALIDADE,
        especialidade_antiga: 'MAMA',
        especialidade_nova: 'MAMO'
      });
    }
    
    console.log(`✅ Corrigidos ${totalCorrigidos} registros: MAMA → MAMO (modalidade MG)`);
    
    // Log da operação no audit_logs
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'CORRIGIR_MAMA_MAMO_RETROATIVO',
        record_id: arquivo_fonte || 'TODOS',
        new_data: {
          total_corrigidos: totalCorrigidos,
          exemplos_correcoes: exemplosCorrecoes,
          regra: 'Corrigir MAMA → MAMO para exames de mamografia (MG)',
          observacao: 'RM MAMAS (MR) mantém especialidade MAMA'
        },
        user_email: 'system',
        severity: 'info'
      });
    
    const resultado = {
      sucesso: true,
      total_corrigidos: totalCorrigidos,
      exemplos_correcoes: exemplosCorrecoes,
      arquivo_fonte: arquivo_fonte || 'TODOS',
      mensagem: `Correção retroativa aplicada: ${totalCorrigidos} registros MAMA → MAMO (modalidade MG)`
    };
    
    console.log('✅ Correção MAMA → MAMO concluída:', resultado);
    
    return new Response(
      JSON.stringify(resultado),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('❌ Erro na correção MAMA → MAMO:', error);
    
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
