import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface LimparUploadTravadoProps {
  uploadId: string;
  fileName: string;
  onSuccess?: () => void;
}

export function LimparUploadTravado({ uploadId, fileName, onSuccess }: LimparUploadTravadoProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleLimparUpload = async () => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('limpar-upload-travado', {
        body: { uploadId }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Upload Resetado",
        description: data.message,
      });

      if (onSuccess) {
        onSuccess();
      }

    } catch (error) {
      console.error('Erro ao limpar upload:', error);
      toast({
        title: "Erro",
        description: "Erro ao resetar o upload. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-destructive/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Upload Travado Detectado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          O processamento do arquivo <strong>{fileName}</strong> está travado. 
          Este problema geralmente ocorre devido a timeouts ou dados inválidos no arquivo.
        </p>
        
        <div className="bg-muted p-3 rounded-lg">
          <p className="text-sm">
            <strong>Solução:</strong> Resetar o upload permitirá reprocessar o arquivo desde o início.
            Todos os dados parciais serão removidos.
          </p>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={handleLimparUpload}
            disabled={isLoading}
            variant="destructive"
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {isLoading ? 'Resetando...' : 'Resetar Upload'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}