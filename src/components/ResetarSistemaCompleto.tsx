import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RotateCcw, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const ResetarSistemaCompleto = () => {
  const [isResetting, setIsResetting] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  const resetarSistema = async () => {
    try {
      setIsResetting(true);
      setResultado(null);
      
      console.log('🔄 Iniciando reset completo do sistema...');
      
      // Chamar função para resetar sistema completo
      const { data, error } = await supabase.functions.invoke('resetar-uploads-completo');
      
      if (error) {
        throw error;
      }
      
      console.log('✅ Reset completo realizado:', data);
      setResultado(data);
      
      toast.success('✅ Sistema resetado com sucesso! Você pode tentar fazer upload novamente.');
      
      // Recarregar a página após 2 segundos
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error: any) {
      console.error('❌ Erro no reset:', error);
      toast.error(`Erro no reset: ${error.message}`);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Reset Completo do Sistema de Uploads
        </CardTitle>
        <CardDescription>
          Esta função irá resetar todos os uploads travados e limpar dados temporários
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>ATENÇÃO:</strong> Esta operação irá:
            <ul className="mt-2 ml-4 list-disc space-y-1">
              <li>Cancelar todos os uploads que estão travados há mais de 5 minutos</li>
              <li>Limpar dados temporários do staging</li>
              <li>Remover logs de upload antigos</li>
              <li>Permitir que você faça novos uploads</li>
            </ul>
          </AlertDescription>
        </Alert>

        {resultado && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              <strong>Reset realizado com sucesso:</strong>
              <ul className="mt-2 ml-4 list-disc space-y-1">
                <li>{resultado.uploads_resetados} uploads resetados</li>
                <li>{resultado.staging_limpo} registros removidos do staging</li>
                <li>{resultado.upload_logs_limpos} logs de upload limpos</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}
        
        <Button 
          onClick={resetarSistema}
          disabled={isResetting}
          className="w-full"
          variant="destructive"
        >
          {isResetting ? (
            <>
              <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
              Resetando Sistema...
            </>
          ) : (
            <>
              <RotateCcw className="h-4 w-4 mr-2" />
              Resetar Sistema Completo
            </>
          )}
        </Button>
        
        <p className="text-sm text-muted-foreground">
          Após o reset, aguarde alguns segundos e tente fazer o upload novamente.
        </p>
      </CardContent>
    </Card>
  );
};