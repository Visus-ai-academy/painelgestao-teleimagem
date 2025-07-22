import { supabase } from '@/integrations/supabase/client'

/**
 * Sincroniza automaticamente os mapeamentos de campos com as edge functions
 * Esta função é chamada automaticamente quando há mudanças nos mapeamentos,
 * mas também pode ser chamada manualmente quando necessário
 */
export async function syncFieldMappings(fileType: string): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    console.log(`🔄 Sincronizando mapeamentos para tipo: ${fileType}`);

    const { data, error } = await supabase.functions.invoke('sincronizar-mapeamentos', {
      body: { file_type: fileType }
    });

    if (error) {
      console.error('❌ Erro na sincronização:', error);
      throw new Error(`Erro na sincronização: ${error.message}`);
    }

    console.log('✅ Sincronização concluída:', data);

    return {
      success: true,
      message: data.message || 'Mapeamentos sincronizados com sucesso',
      details: data
    };

  } catch (error: any) {
    console.error('❌ Erro na sincronização completa:', error);
    return {
      success: false,
      message: error.message || 'Erro desconhecido na sincronização',
      details: error
    };
  }
}

/**
 * Sincroniza todos os tipos de arquivo disponíveis
 */
export async function syncAllFieldMappings(): Promise<{
  success: boolean;
  message: string;
  results: Array<{ fileType: string; success: boolean; message: string; }>;
}> {
  const fileTypes = ['clientes', 'contratos', 'exames', 'faturamento', 'escalas', 'financeiro'];
  const results: Array<{ fileType: string; success: boolean; message: string; }> = [];

  console.log('🔄 Sincronizando todos os mapeamentos...');

  for (const fileType of fileTypes) {
    try {
      const result = await syncFieldMappings(fileType);
      results.push({
        fileType,
        success: result.success,
        message: result.message
      });
    } catch (error: any) {
      results.push({
        fileType,
        success: false,
        message: error.message || 'Erro na sincronização'
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;

  return {
    success: successCount === totalCount,
    message: `Sincronização concluída: ${successCount}/${totalCount} tipos processados com sucesso`,
    results
  };
}

/**
 * Verifica se os mapeamentos estão sincronizados
 */
export async function checkMappingSync(fileType: string): Promise<{
  synchronized: boolean;
  lastSync?: Date;
  mappingsCount: number;
}> {
  try {
    // Buscar mapeamentos ativos
    const { data: mappings, error } = await supabase
      .from('field_mappings')
      .select('id, updated_at')
      .eq('file_type', fileType)
      .eq('active', true);

    if (error) {
      throw error;
    }

    // Buscar último log de sincronização
    const { data: syncLog } = await supabase
      .from('import_history')
      .select('created_at')
      .eq('file_type', fileType)
      .ilike('filename', 'sync_%')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const lastMappingUpdate = mappings?.reduce((latest, mapping) => {
      const updateDate = new Date(mapping.updated_at);
      return updateDate > latest ? updateDate : latest;
    }, new Date(0));

    const lastSync = syncLog ? new Date(syncLog.created_at) : null;

    const synchronized = lastSync ? (lastSync >= (lastMappingUpdate || new Date(0))) : false;

    return {
      synchronized,
      lastSync: lastSync || undefined,
      mappingsCount: mappings?.length || 0
    };

  } catch (error) {
    console.error('Erro ao verificar sincronização:', error);
    return {
      synchronized: false,
      mappingsCount: 0
    };
  }
}