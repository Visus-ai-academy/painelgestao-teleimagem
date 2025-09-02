import { supabase } from "@/integrations/supabase/client";

console.log('🔄 Executando edge function para finalizar uploads...');

supabase.functions.invoke('finalizar-uploads-concluidos', {
  body: {}
}).then(({ data, error }) => {
  if (error) {
    console.error('❌ Erro na edge function:', error);
  } else {
    console.log('✅ Edge function executada:', data);
    
    // Verificar resultado após a execução
    return supabase
      .from('processamento_uploads')
      .select('arquivo_nome, status, completed_at, registros_inseridos')
      .order('created_at', { ascending: false })
      .limit(5);
  }
}).then((result) => {
  if (result?.data) {
    console.log('📋 Status após edge function:', result.data);
  }
});

export {};