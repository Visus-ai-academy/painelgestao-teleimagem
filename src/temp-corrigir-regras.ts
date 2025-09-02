import { supabase } from '@/integrations/supabase/client';

// Simplesmente executa a função existente que já faz tudo
async function executarCorrecao() {
  console.log('🔥 Executando função existente: corrigir-todos-dados-existentes');
  
  const { data, error } = await supabase.functions.invoke('corrigir-todos-dados-existentes');
  
  if (error) {
    console.error('❌ Erro:', error);
  } else {
    console.log('✅ Correção concluída:', data);
  }
}

executarCorrecao();