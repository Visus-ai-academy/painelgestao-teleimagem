import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { preco_id } = await req.json();
    
    if (!preco_id) {
      throw new Error('preco_id é obrigatório');
    }

    console.log('🗑️ Excluindo preço:', preco_id);
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Buscar informações do preço antes de deletar
    const { data: preco, error: erroConsulta } = await supabase
      .from('precos_servicos')
      .select('*, clientes(nome_fantasia)')
      .eq('id', preco_id)
      .single();

    if (erroConsulta) {
      throw new Error(`Erro ao consultar preço: ${erroConsulta.message}`);
    }

    if (!preco) {
      throw new Error('Preço não encontrado');
    }

    // Deletar o preço
    const { error: erroDelete } = await supabase
      .from('precos_servicos')
      .delete()
      .eq('id', preco_id);

    if (erroDelete) {
      throw new Error(`Erro ao deletar preço: ${erroDelete.message}`);
    }

    // Registrar no log de auditoria
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'precos_servicos',
        operation: 'DELETE',
        record_id: preco_id,
        old_data: preco,
        user_email: 'system',
        severity: 'info'
      });

    console.log('✅ Preço excluído com sucesso');

    return new Response(
      JSON.stringify({
        sucesso: true,
        mensagem: 'Preço excluído com sucesso',
        preco_excluido: {
          id: preco.id,
          cliente: preco.clientes?.nome_fantasia,
          modalidade: preco.modalidade,
          especialidade: preco.especialidade,
          categoria: preco.categoria,
          prioridade: preco.prioridade,
          valor: preco.valor_base
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('💥 Erro:', error);
    
    return new Response(
      JSON.stringify({
        sucesso: false,
        erro: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
