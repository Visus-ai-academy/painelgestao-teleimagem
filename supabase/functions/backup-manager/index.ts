import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackupRequest {
  type: 'full' | 'incremental' | 'differential';
  tables?: string[];
  schedule?: string; // cron format
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { type, tables, schedule }: BackupRequest = await req.json();

    console.log(`Iniciando backup ${type}`, { tables, schedule });

    // Registrar início do backup
    const { data: backupLog, error: logError } = await supabase
      .from('backup_logs')
      .insert({
        backup_type: type,
        status: 'running',
        start_time: new Date().toISOString()
      })
      .select()
      .single();

    if (logError) {
      throw new Error(`Erro ao registrar backup: ${logError.message}`);
    }

    try {
      // Simulação de backup - em produção, aqui seria a lógica real de backup
      const backupData = await performBackup(supabase, type, tables);
      
      // Calcular checksum do backup
      const checksum = await calculateChecksum(JSON.stringify(backupData));
      
      // Simular upload para storage (em produção seria para S3, GCS, etc.)
      const backupLocation = `backup-${type}-${Date.now()}.json`;
      
      // Atualizar log de backup como concluído
      const { error: updateError } = await supabase
        .from('backup_logs')
        .update({
          status: 'completed',
          end_time: new Date().toISOString(),
          file_size_bytes: JSON.stringify(backupData).length,
          backup_location: backupLocation,
          checksum: checksum
        })
        .eq('id', backupLog.id);

      if (updateError) {
        console.error('Erro ao atualizar log de backup:', updateError);
      }

      // Verificar e aplicar políticas de retenção
      await applyRetentionPolicies(supabase);

      return new Response(
        JSON.stringify({ 
          success: true, 
          backup_id: backupLog.id,
          backup_location: backupLocation,
          file_size: JSON.stringify(backupData).length,
          checksum: checksum
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );

    } catch (backupError: any) {
      // Registrar falha no backup
      await supabase
        .from('backup_logs')
        .update({
          status: 'failed',
          end_time: new Date().toISOString(),
          error_message: backupError.message
        })
        .eq('id', backupLog.id);

      throw backupError;
    }

  } catch (error: any) {
    console.error('Erro no gerenciador de backup:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

async function performBackup(supabase: any, type: string, tables?: string[]): Promise<any> {
  const backupData: Record<string, any> = {
    timestamp: new Date().toISOString(),
    type: type,
    version: '1.0'
  };

  // Tabelas padrão para backup se não especificadas
  const defaultTables = [
    'profiles', 'clientes', 'medicos', 'exames', 'faturamento',
    'escalas_medicas', 'user_roles', 'especialidades', 'modalidades',
    'categorias_exame', 'categorias_medico', 'prioridades'
  ];

  const tablesToBackup = tables || defaultTables;

  for (const table of tablesToBackup) {
    try {
      console.log(`Fazendo backup da tabela: ${table}`);
      
      let query = supabase.from(table).select('*');
      
      // Para backup incremental, pegar apenas dados modificados recentemente
      if (type === 'incremental') {
        const lastBackup = await getLastSuccessfulBackup(supabase);
        if (lastBackup) {
          query = query.gte('updated_at', lastBackup.start_time);
        }
      }

      const { data, error } = await query;
      
      if (error) {
        console.error(`Erro ao fazer backup da tabela ${table}:`, error);
        continue;
      }
      
      backupData[table] = data || [];
      console.log(`Backup da tabela ${table}: ${(data || []).length} registros`);
      
    } catch (tableError: any) {
      console.error(`Erro no backup da tabela ${table}:`, tableError);
      backupData[table] = { error: tableError.message };
    }
  }

  return backupData;
}

async function getLastSuccessfulBackup(supabase: any): Promise<any> {
  const { data } = await supabase
    .from('backup_logs')
    .select('*')
    .eq('status', 'completed')
    .order('start_time', { ascending: false })
    .limit(1)
    .single();

  return data;
}

async function calculateChecksum(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function applyRetentionPolicies(supabase: any): Promise<void> {
  try {
    console.log('Aplicando políticas de retenção...');

    // Buscar políticas de retenção
    const { data: policies } = await supabase
      .from('data_retention_policies')
      .select('*')
      .eq('auto_delete', true);

    for (const policy of policies || []) {
      if (policy.legal_hold) {
        console.log(`Tabela ${policy.table_name} em retenção legal - pulando`);
        continue;
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retention_period_days);

      console.log(`Aplicando retenção para ${policy.table_name}: deletando dados anteriores a ${cutoffDate.toISOString()}`);

      // Determinar campo de data baseado na tabela
      let dateField = 'created_at';
      if (policy.table_name === 'audit_logs' || policy.table_name === 'data_access_logs') {
        dateField = 'timestamp';
      }

      const { error: deleteError } = await supabase
        .from(policy.table_name)
        .delete()
        .lt(dateField, cutoffDate.toISOString());

      if (deleteError) {
        console.error(`Erro ao aplicar retenção para ${policy.table_name}:`, deleteError);
      } else {
        console.log(`Retenção aplicada com sucesso para ${policy.table_name}`);
      }
    }

  } catch (error) {
    console.error('Erro ao aplicar políticas de retenção:', error);
  }
}