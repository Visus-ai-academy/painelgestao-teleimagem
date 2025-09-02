import { supabase } from "@/integrations/supabase/client";

console.log('🧹 Limpando tipificação automática restante...');

supabase.functions.invoke('limpar-tipificacao-automatica', {
  body: {}
}).then(({ data, error }) => {
  if (error) {
    console.error('❌ Erro na limpeza:', error);
  } else {
    console.log('✅ Limpeza executada:', data);
  }
}).finally(() => {
  // Verificar resultado final após todas as operações
  setTimeout(() => {
    supabase
      .from('processamento_uploads')
      .select('arquivo_nome, status, completed_at, registros_inseridos')
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        console.log('📋 STATUS FINAL DOS UPLOADS:', data);
      });
      
    supabase
      .from('volumetria_mobilemed')
      .select('COUNT(*) as total, COUNT(CASE WHEN tipo_faturamento IS NULL THEN 1 END) as sem_tipificacao')
      .gte('created_at', '2025-09-02 21:50:00')
      .single()
      .then(({ data }) => {
        console.log('📊 LIMPEZA DE TIPIFICAÇÃO:', data);
      });
  }, 3000);
});

export {};