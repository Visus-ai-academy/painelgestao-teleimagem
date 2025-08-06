// Script para limpar base de preços
const SUPABASE_URL = "https://atbvikgxdcohnznkmaus.supabase.co";

async function limparPrecos() {
  try {
    console.log('🧹 Iniciando limpeza da base de preços...');
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/limpar-precos-base`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0YnZpa2d4ZGNvaG56bmttYXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTY1MzAsImV4cCI6MjA2ODI3MjUzMH0.P2eptjgahiMcUzE9b1eAVAW1HC9Ib52LYpRAO8S_9CE`,
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0YnZpa2d4ZGNvaG56bmttYXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTY1MzAsImV4cCI6MjA2ODI3MjUzMH0.P2eptjgahiMcUzE9b1eAVAW1HC9Ib52LYpRAO8S_9CE',
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Limpeza concluída com sucesso:', result);
      console.log(`📊 Registros restantes: ${result.registros_restantes}`);
    } else {
      console.error('❌ Erro na limpeza:', result);
    }
    
  } catch (error) {
    console.error('❌ Erro na requisição:', error);
  }
}

// Executar
limparPrecos();