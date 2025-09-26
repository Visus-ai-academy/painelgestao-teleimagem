import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2 } from 'lucide-react';

export function LimparPrecosCompleto() {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  const limparTodosPrecos = async () => {
    try {
      setLoading(true);
      console.log('🧹 Iniciando limpeza completa de preços...');
      
      // Chamar a edge function de limpeza
      const { data, error } = await supabase.functions.invoke('limpar-todos-precos');
      
      if (error) {
        console.error('❌ Erro na limpeza:', error);
        setResultado({ error: error.message });
        return;
      }
      
      console.log('✅ Resultado da limpeza:', data);
      
      // Verificar se realmente limpou tudo
      const { count } = await supabase
        .from('precos_servicos')
        .select('id', { count: 'exact', head: true });
        
      setResultado({
        ...data,
        verificacao_final: {
          registros_restantes: count || 0,
          limpeza_completa: (count === 0)
        }
      });
      
    } catch (error) {
      console.error('💥 Erro crítico:', error);
      setResultado({ error: (error as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const limparDiretoBanco = async () => {
    try {
      setLoading(true);
      console.log('🧹 Limpeza direta no banco usando RPC...');
      
      // Usar a função RPC do banco
      const { error } = await supabase.rpc('limpar_todos_precos');
      
      if (error) {
        console.error('❌ Erro na RPC:', error);
        setResultado({ error: error.message });
        return;
      }
      
      // Verificar limpeza
      const { count } = await supabase
        .from('precos_servicos')
        .select('id', { count: 'exact', head: true });
        
      setResultado({
        sucesso: true,
        metodo: 'RPC direta',
        registros_restantes: count || 0,
        limpeza_completa: (count === 0),
        timestamp: new Date().toISOString()
      });
      
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
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Limpeza Completa de Preços
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Esta funcionalidade irá remover TODOS os preços de serviços da base de dados.
            Use apenas quando necessário fazer nova importação completa.
          </p>
          
          <div className="flex gap-2">
            <Button 
              onClick={limparTodosPrecos} 
              disabled={loading}
              variant="destructive"
              size="sm"
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {loading ? 'Limpando...' : 'Limpar via Edge Function'}
            </Button>
            
            <Button 
              onClick={limparDiretoBanco} 
              disabled={loading}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {loading ? 'Limpando...' : 'Limpar via RPC Direta'}
            </Button>
          </div>
          
          {resultado && (
            <div className="mt-4 p-3 bg-muted rounded-md">
              <pre className="text-xs">{JSON.stringify(resultado, null, 2)}</pre>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}