import { supabase } from '@/integrations/supabase/client';

/**
 * FUNÇÃO DESATIVADA - Não deve ser utilizada
 * 
 * Esta função foi desativada pois estava causando execuções duplicadas
 * das regras v002/v003, resultando em exclusão indevida de exames.
 * 
 * O processamento de regras agora é feito APENAS durante o upload,
 * via edge function processar-volumetria-otimizado.
 */
export async function corrigirRegrasV002V003Existentes(): Promise<{ success: boolean; message: string; detalhes: any }> {
  console.warn('⚠️ FUNÇÃO DESATIVADA: corrigirRegrasV002V003Existentes não deve ser utilizada');
  console.warn('📝 O processamento de regras é feito automaticamente durante o upload');
  
  return {
    success: false,
    message: 'FUNÇÃO DESATIVADA: Esta função foi desativada para evitar exclusões duplicadas. O processamento de regras é feito automaticamente durante o upload.',
    detalhes: {
      motivo: 'Execuções duplicadas causavam exclusão indevida de exames retroativos',
      solucao: 'Reprocessar o arquivo via upload normal'
    }
  };
}
