import { supabase } from "@/integrations/supabase/client";

console.log('🔄 Executando finalização de uploads travados...');

supabase.functions.invoke('finalizar-uploads-concluidos', {
  body: {}
}).then(({ data, error }) => {
  if (error) {
    console.error('❌ Erro ao finalizar uploads:', error);
  } else {
    console.log('✅ Finalização concluída:', data);
  }
}).then(() => {
  // Verificar status após finalização
  return supabase
    .from('processamento_uploads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
}).then(({ data }) => {
  console.log('📋 Status dos uploads após finalização:', data);
});

export {};