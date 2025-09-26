import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function LimparPrecos() {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const { toast } = useToast();

  const handleLimparPrecos = async () => {
    setLoading(true);
    setResultado(null);

    try {
      const { data, error } = await supabase.functions.invoke('limpar-precos-base');

      if (error) {
        throw error;
      }

      setResultado(data);
      toast({
        title: "Sucesso",
        description: "Base de preços limpa com sucesso!",
        variant: "default",
      });

    } catch (error: any) {
      console.error('Erro ao limpar preços:', error);
      toast({
        title: "Erro",
        description: "Erro ao limpar a base de preços: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLimparRPC = async () => {
    setLoading(true);
    setResultado(null);

    try {
      const { error } = await supabase.rpc('limpar_todos_precos');
      
      if (error) {
        throw error;
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

      toast({
        title: "Sucesso",
        description: "Limpeza RPC concluída com sucesso!",
        variant: "default",
      });

    } catch (error: any) {
      console.error('Erro na RPC:', error);
      toast({
        title: "Erro",
        description: "Erro na limpeza RPC: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Limpar Base de Preços
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Atenção:</strong> Esta ação irá remover TODOS os preços configurados 
              na tabela precos_servicos e marcar todos os contratos como sem preços configurados.
              Esta operação não pode ser desfeita.
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button 
              onClick={handleLimparPrecos}
              disabled={loading}
              variant="destructive"
              className="flex-1"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Limpando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpar via Edge Function
                </>
              )}
            </Button>

            <Button 
              onClick={handleLimparRPC}
              disabled={loading}
              variant="outline"
              className="flex-1"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                  Limpando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpar via RPC Direta
                </>
              )}
            </Button>
          </div>

          {resultado && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p><strong>Resultado:</strong> {resultado.mensagem}</p>
                  <p><strong>Registros restantes:</strong> {resultado.registros_restantes}</p>
                  <p><strong>Data/Hora:</strong> {new Date(resultado.timestamp).toLocaleString()}</p>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}