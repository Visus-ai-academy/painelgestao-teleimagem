// Script para executar limpeza de preços via edge function
async function executarLimpeza() {
    try {
        console.log('🧹 Iniciando limpeza da base de preços...');
        
        const response = await fetch('https://atbvikgxdcohnznkmaus.supabase.co/functions/v1/limpar-precos-base', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0YnZpa2d4ZGNvaG56bmttYXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTY1MzAsImV4cCI6MjA2ODI3MjUzMH0.P2eptjgahiMcUzE9b1eAVAW1HC9Ib52LYpRAO8S_9CE',
                'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0YnZpa2d4ZGNvaG56bmttYXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTY1MzAsImV4cCI6MjA2ODI3MjUzMH0.P2eptjgahiMcUzE9b1eAVAW1HC9Ib52LYpRAO8S_9CE',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });

        const result = await response.json();
        
        if (response.ok) {
            console.log('✅ SUCESSO! Base de preços limpa:', result);
            console.log(`📊 Registros restantes: ${result.registros_restantes || 0}`);
            console.log(`📅 Timestamp: ${result.timestamp}`);
        } else {
            console.error('❌ ERRO na limpeza:', result);
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ ERRO na requisição:', error);
        return { error: error.message };
    }
}

// Executar e retornar resultado
executarLimpeza().then(result => {
    console.log('🎯 RESULTADO FINAL:', result);
});