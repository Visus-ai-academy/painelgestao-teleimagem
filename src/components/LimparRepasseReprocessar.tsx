import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Trash2, Upload } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const LimparRepasseReprocessar = () => {
  const [loading, setLoading] = useState(false);
  const [lastUploadId, setLastUploadId] = useState<string | null>(null);
  const { toast } = useToast();

  const buscarUltimoUpload = async () => {
    const { data, error } = await supabase
      .from('processamento_uploads')
      .select('id, arquivo_nome, status, registros_processados, registros_inseridos')
      .eq('tipo_arquivo', 'repasse_medico')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar último upload:', error);
      return null;
    }

    return data;
  };

  const handleLimparReprocessar = async () => {
    try {
      setLoading(true);

      // Buscar último upload
      const ultimoUpload = await buscarUltimoUpload();
      
      if (!ultimoUpload) {
        toast({
          title: "Nenhum upload encontrado",
          description: "Não há uploads de repasse para limpar",
          variant: "destructive"
        });
        return;
      }

      setLastUploadId(ultimoUpload.id);

      toast({
        title: "Limpando dados...",
        description: `Removendo ${ultimoUpload.registros_inseridos || 0} registros do upload anterior`
      });

      // Chamar edge function para limpar
      const { data, error } = await supabase.functions.invoke('limpar-repasse-para-reprocessar', {
        body: { uploadId: ultimoUpload.id }
      });

      if (error) throw error;

      toast({
        title: "✅ Limpeza concluída",
        description: `${data.registros_deletados} registros foram removidos. Agora você pode fazer o upload novamente.`,
      });

    } catch (error: any) {
      console.error('Erro ao limpar repasse:', error);
      toast({
        title: "Erro ao limpar",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="h-5 w-5" />
          Limpar e Reprocessar Repasse
        </CardTitle>
        <CardDescription>
          Remove os dados do último upload de repasse para permitir reprocessamento sem deduplicação
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Atenção:</strong> Esta ação vai remover TODOS os registros do último upload de repasse médico.
            A função de importação foi modificada para inserir <strong>todos os registros</strong> sem deduplicação automática.
          </AlertDescription>
        </Alert>

        <div className="flex flex-col gap-4">
          <Button 
            onClick={handleLimparReprocessar}
            disabled={loading}
            variant="destructive"
            className="w-full"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {loading ? 'Limpando...' : 'Limpar Dados do Último Upload'}
          </Button>

          <div className="text-sm text-muted-foreground">
            <p className="font-semibold mb-2">Após limpar:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Acesse a página "Gerenciar Cadastros"</li>
              <li>Faça o upload do arquivo de repasse novamente</li>
              <li>Todos os {' '}
                <strong className="text-primary">26.487 registros</strong> 
                {' '} serão inseridos (sem deduplicação)
              </li>
            </ol>
          </div>
        </div>

        {lastUploadId && (
          <Alert>
            <Upload className="h-4 w-4" />
            <AlertDescription>
              <strong>Upload ID:</strong> {lastUploadId}
              <br />
              Pronto para reprocessar!
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
