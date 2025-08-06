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

          <Button 
            onClick={handleLimparPrecos}
            disabled={loading}
            variant="destructive"
            className="w-full"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Limpando...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar Todos os Preços
              </>
            )}
          </Button>

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