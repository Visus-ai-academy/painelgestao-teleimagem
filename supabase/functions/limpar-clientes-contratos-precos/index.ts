import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface LimpezaResult {
  clientes_removidos: number;
  contratos_removidos: number;
  precos_removidos: number;
  logs_criados: number;
  timestamp: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧹 Iniciando limpeza de clientes, contratos e preços...');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    let resultado: LimpezaResult = {
      clientes_removidos: 0,
      contratos_removidos: 0,
      precos_removidos: 0,
      logs_criados: 0,
      timestamp: new Date().toISOString()
    };

    // 1. Contar quantos registros existem
    const { count: totalClientes } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true });

    const { count: totalContratos } = await supabase
      .from('contratos_clientes')
      .select('*', { count: 'exact', head: true });

    const { count: totalPrecos } = await supabase
      .from('precos_servicos')
      .select('*', { count: 'exact', head: true });

    console.log(`📊 Registros encontrados - Clientes: ${totalClientes}, Contratos: ${totalContratos}, Preços: ${totalPrecos}`);

    // 2. Limpar tabela de contratos primeiro (devido às foreign keys)
    console.log('🗑️ Limpando tabela contratos_clientes...');
    const { error: errorContratos } = await supabase
      .from('contratos_clientes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (errorContratos) {
      console.error('❌ Erro ao limpar contratos:', errorContratos);
      throw new Error(`Erro ao limpar contratos: ${errorContratos.message}`);
    }

    resultado.contratos_removidos = totalContratos || 0;
    console.log(`✅ Contratos removidos: ${resultado.contratos_removidos}`);

    // 3. Limpar tabela de preços
    console.log('🗑️ Limpando tabela precos_servicos...');
    const { error: errorPrecos } = await supabase
      .from('precos_servicos')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (errorPrecos) {
      console.error('❌ Erro ao limpar preços:', errorPrecos);
      throw new Error(`Erro ao limpar preços: ${errorPrecos.message}`);
    }

    resultado.precos_removidos = totalPrecos || 0;
    console.log(`✅ Preços removidos: ${resultado.precos_removidos}`);

    // 4. Limpar tabela de clientes
    console.log('🗑️ Limpando tabela clientes...');
    const { error: errorClientes } = await supabase
      .from('clientes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (errorClientes) {
      console.error('❌ Erro ao limpar clientes:', errorClientes);
      throw new Error(`Erro ao limpar clientes: ${errorClientes.message}`);
    }

    resultado.clientes_removidos = totalClientes || 0;
    console.log(`✅ Clientes removidos: ${resultado.clientes_removidos}`);

    // 5. Criar logs de auditoria
    const logsParaInserir = [
      {
        table_name: 'contratos_clientes',
        operation: 'DELETE',
        record_id: 'bulk_delete',
        new_data: {
          acao: 'Limpeza completa da tabela contratos_clientes',
          registros_removidos: resultado.contratos_removidos,
          timestamp: resultado.timestamp,
          funcao: 'limpar-clientes-contratos-precos'
        },
        user_email: 'system',
        severity: 'info'
      },
      {
        table_name: 'precos_servicos',
        operation: 'DELETE',
        record_id: 'bulk_delete',
        new_data: {
          acao: 'Limpeza completa da tabela precos_servicos',
          registros_removidos: resultado.precos_removidos,
          timestamp: resultado.timestamp,
          funcao: 'limpar-clientes-contratos-precos'
        },
        user_email: 'system',
        severity: 'info'
      },
      {
        table_name: 'clientes',
        operation: 'DELETE',
        record_id: 'bulk_delete',
        new_data: {
          acao: 'Limpeza completa da tabela clientes',
          registros_removidos: resultado.clientes_removidos,
          timestamp: resultado.timestamp,
          funcao: 'limpar-clientes-contratos-precos'
        },
        user_email: 'system',
        severity: 'info'
      }
    ];

    console.log('📝 Criando logs de auditoria...');
    const { error: errorLogs } = await supabase
      .from('audit_logs')
      .insert(logsParaInserir);

    if (errorLogs) {
      console.error('⚠️ Erro ao criar logs (não crítico):', errorLogs);
    } else {
      resultado.logs_criados = logsParaInserir.length;
      console.log(`✅ Logs criados: ${resultado.logs_criados}`);
    }

    // 6. Verificar se as tabelas estão realmente vazias
    const { count: verificacaoClientes } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true });

    const { count: verificacaoContratos } = await supabase
      .from('contratos_clientes')
      .select('*', { count: 'exact', head: true });

    const { count: verificacaoPrecos } = await supabase
      .from('precos_servicos')
      .select('*', { count: 'exact', head: true });

    console.log(`🔍 Verificação pós-limpeza - Clientes: ${verificacaoClientes}, Contratos: ${verificacaoContratos}, Preços: ${verificacaoPrecos}`);

    const limpezaCompleta = verificacaoClientes === 0 && verificacaoContratos === 0 && verificacaoPrecos === 0;

    if (limpezaCompleta) {
      console.log('✅ Limpeza concluída com sucesso!');
    } else {
      console.warn('⚠️ Alguns registros podem não ter sido removidos');
    }

    return new Response(
      JSON.stringify({
        sucesso: true,
        resultado,
        verificacao: {
          clientes_restantes: verificacaoClientes,
          contratos_restantes: verificacaoContratos,
          precos_restantes: verificacaoPrecos
        },
        mensagem: 'Limpeza de clientes, contratos e preços concluída com sucesso'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('💥 Erro durante a limpeza:', error);
    
    return new Response(
      JSON.stringify({
        sucesso: false,
        erro: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});