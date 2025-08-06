import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.1'

const SUPABASE_URL = "https://atbvikgxdcohnznkmaus.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0YnZpa2d4ZGNvaG56bmttYXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTY1MzAsImV4cCI6MjA2ODI3MjUzMH0.P2eptjgahiMcUzE9b1eAVAW1HC9Ib52LYpRAO8S_9CE";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function limparPrecos() {
  try {
    console.log('🧹 Iniciando limpeza de preços...');
    
    const { data, error } = await supabase.functions.invoke('limpar-precos-base');

    if (error) {
      console.error('❌ Erro ao limpar preços:', error);
      return;
    }

    console.log('✅ Limpeza concluída:', data);
    
  } catch (error) {
    console.error('❌ Erro na limpeza:', error);
  }
}

// Executar limpeza
limparPrecos();