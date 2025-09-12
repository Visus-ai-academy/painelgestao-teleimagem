import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function TestDemonstrativos() {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const { toast } = useToast();

  const testarDemonstrativos = async () => {
    setLoading(true);
    try {
      console.log('🧪 Testando geração de demonstrativos...');
      
      const { data, error } = await supabase.functions.invoke('gerar-demonstrativos-faturamento', {
        body: { periodo: '2025-06' }
      });

      if (error) {
        console.error('❌ Erro na edge function:', error);
        setResultado({ error: error.message });
        return;
      }

      console.log('✅ Demonstrativos gerados:', data);
      setResultado(data);

      // Procurar especificamente por AKCPALMAS e C.BITTENCOURT
      if (data?.demonstrativos) {
        const akcpalmas = data.demonstrativos.find((d: any) => d.cliente_nome === 'AKCPALMAS');
        const bittencourt = data.demonstrativos.find((d: any) => d.cliente_nome === 'C.BITTENCOURT');
        
        console.log('🔍 AKCPALMAS:', akcpalmas);
        console.log('🔍 C.BITTENCOURT:', bittencourt);
        
        if (akcpalmas?.detalhes_exames) {
          console.log('🔍 Detalhes exames AKCPALMAS:', akcpalmas.detalhes_exames);
        }
        if (bittencourt?.detalhes_exames) {
          console.log('🔍 Detalhes exames C.BITTENCOURT:', bittencourt.detalhes_exames);
        }
      }

      toast({
        title: "Teste concluído",
        description: `${data?.demonstrativos?.length || 0} demonstrativos gerados`,
      });

    } catch (error: any) {
      console.error('❌ Erro no teste:', error);
      setResultado({ error: error.message });
      toast({
        title: "Erro no teste",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <Button 
        onClick={testarDemonstrativos}
        disabled={loading}
      >
        {loading ? 'Testando...' : 'Testar Demonstrativos (2025-06)'}
      </Button>
      
      {resultado && (
        <div className="bg-gray-100 p-4 rounded">
          <h3 className="font-bold mb-2">Resultado do Teste:</h3>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(resultado, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}