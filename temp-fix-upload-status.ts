// Script temporário para corrigir status dos uploads
import { supabase } from '@/integrations/supabase/client';

const corrigirStatusUploads = async () => {
  console.log('🔧 Iniciando correção de status dos uploads...');
  
  try {
    const { data, error } = await supabase.functions.invoke('corrigir-status-uploads');
    
    if (error) {
      console.error('❌ Erro ao corrigir status:', error);
      return;
    }
    
    console.log('✅ Resultado da correção:', data);
    
  } catch (error) {
    console.error('💥 Erro inesperado:', error);
  }
};

// Executar a correção
corrigirStatusUploads();