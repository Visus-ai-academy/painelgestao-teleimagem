import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token de autorização necessário' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verificar se o usuário é admin
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verificar permissões de admin
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = userRoles?.some(role => role.role === 'admin');
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Apenas administradores podem limpar parâmetros' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Iniciando limpeza de parâmetros de faturamento...');

    // Contar registros antes da limpeza
    const { count: totalAntes } = await supabase
      .from('parametros_faturamento')
      .select('*', { count: 'exact', head: true });

    console.log(`Total de registros a serem removidos: ${totalAntes}`);

    // Limpar todos os parâmetros de faturamento
    const { error: deleteError } = await supabase
      .from('parametros_faturamento')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Condição que sempre será verdadeira para deletar tudo

    if (deleteError) {
      console.error('Erro ao deletar parâmetros:', deleteError);
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao limpar parâmetros de faturamento',
          details: deleteError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Registrar a operação no audit_logs
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        table_name: 'parametros_faturamento',
        operation: 'LIMPEZA_COMPLETA',
        record_id: 'bulk_delete',
        new_data: {
          registros_removidos: totalAntes,
          data_limpeza: new Date().toISOString(),
          usuario: user.email,
          operacao: 'limpeza_parametros_faturamento'
        },
        user_email: user.email,
        severity: 'warning'
      });

    if (auditError) {
      console.error('Erro ao registrar audit log:', auditError);
    }

    // Também atualizar contratos para indicar que não têm parâmetros configurados
    const { error: updateError } = await supabase
      .from('contratos_clientes')
      .update({ tem_parametros_configurados: false })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (updateError) {
      console.warn('Aviso: Erro ao atualizar flag de parâmetros nos contratos:', updateError);
    }

    const resultado = {
      sucesso: true,
      registros_removidos: totalAntes || 0,
      data_limpeza: new Date().toISOString(),
      mensagem: 'Parâmetros de faturamento limpos com sucesso',
      observacao: 'Sistema pronto para novo upload de parâmetros'
    };

    console.log('Limpeza concluída:', resultado);

    return new Response(
      JSON.stringify(resultado),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erro inesperado na limpeza de parâmetros:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});