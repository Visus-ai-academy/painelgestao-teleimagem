import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function DebugarPrecosSemCliente() {
  const [resultado, setResultado] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const executarValidacao = async () => {
    try {
      setLoading(true);
      console.log('🔍 Executando validação de clientes...');
      
      const { data, error } = await supabase.functions.invoke('aplicar-validacao-cliente', {
        body: { lote_upload: null }
      });

      if (error) {
        console.error('❌ Erro:', error);
        setResultado({ error: error.message });
      } else {
        console.log('✅ Resultado:', data);
        setResultado(data);
      }
    } catch (error) {
      console.error('💥 Erro crítico:', error);
      setResultado({ error: (error as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Debug - Preços Sem Cliente</CardTitle>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={executarValidacao} 
          disabled={loading}
          className="mb-4"
        >
          {loading ? 'Executando...' : 'Executar Validação'}
        </Button>
        
        {resultado && (
          <div className="bg-gray-100 p-4 rounded">
            <pre>{JSON.stringify(resultado, null, 2)}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}