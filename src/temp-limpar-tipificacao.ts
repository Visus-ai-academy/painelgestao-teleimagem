import { supabase } from "@/integrations/supabase/client";

// Executar limpeza da tipificação automática incorreta
console.log('🧹 Executando limpeza da tipificação automática...');

supabase.functions.invoke('limpar-tipificacao-automatica', {
  body: {}
}).then(({ data, error }) => {
  if (error) {
    console.error('❌ Erro ao limpar tipificação:', error);
  } else {
    console.log('✅ Limpeza concluída:', data);
  }
});

export {};