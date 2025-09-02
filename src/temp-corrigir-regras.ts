import { supabase } from '@/integrations/supabase/client';

// USAR A NOVA FUNÇÃO UNIFICADA: aplicar-27-regras-completas
async function aplicarRegrasUnificadas() {
  console.log('🚀 Aplicando 27 regras com função unificada...');
  
  const { data, error } = await supabase.functions.invoke('aplicar-27-regras-completas', {
    body: {
      aplicar_todos_arquivos: true,
      periodo_referencia: '06/2025'
    }
  });
  
  if (error) {
    console.error('❌ Erro:', error);
  } else {
    console.log('✅ 27 regras aplicadas:', data);
  }
}

aplicarRegrasUnificadas();