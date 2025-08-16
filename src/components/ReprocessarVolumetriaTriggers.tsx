import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Database, CheckCircle, AlertCircle } from 'lucide-react';

export function ReprocessarVolumetriaTriggers() {
  const [arquivoSelecionado, setArquivoSelecionado] = useState<string>('');
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const { toast } = useToast();

  const arquivosDisponiveis = [
    { value: '', label: 'Todos os arquivos' },
    { value: 'volumetria_padrao', label: 'Volumetria Padrão' },
    { value: 'volumetria_fora_padrao', label: 'Volumetria Fora do Padrão' },
    { value: 'volumetria_padrao_retroativo', label: 'Volumetria Padrão Retroativo' },
    { value: 'volumetria_fora_padrao_retroativo', label: 'Volumetria Fora do Padrão Retroativo' },
    { value: 'volumetria_onco_padrao', label: 'Volumetria Onco Padrão' },
  ];

  const handleReprocessar = async () => {
    setProcessando(true);
    setResultado(null);
    
    try {
      console.log('🔄 Iniciando reprocessamento com database triggers...');
      
      const { data, error } = await supabase.rpc('reprocessar_volumetria_existente', {
        arquivo_fonte_param: arquivoSelecionado || null
      });
      
      if (error) {
        throw error;
      }
      
      setResultado(data);
      
      toast({
        title: "Reprocessamento Concluído",
        description: `${(data as any).total_processados} registros reprocessados, ${(data as any).total_rejeitados} rejeitados pelas regras.`,
        duration: 5000,
      });
      
    } catch (error) {
      console.error('❌ Erro no reprocessamento:', error);
      toast({
        title: "Erro no Reprocessamento", 
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive",
      });
    } finally {
      setProcessando(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Reprocessar Volumetria com Database Triggers
        </CardTitle>
        <CardDescription>
          Aplica automaticamente todas as regras de negócio (v002, v003, v031, de-para, categorias, prioridades, tipificação) 
          nos dados existentes usando o novo sistema de triggers do banco de dados.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">Arquivo para Reprocessar</label>
          <Select 
            value={arquivoSelecionado} 
            onValueChange={setArquivoSelecionado}
            disabled={processando}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o arquivo ou todos" />
            </SelectTrigger>
            <SelectContent>
              {arquivosDisponiveis.map((arquivo) => (
                <SelectItem key={arquivo.value} value={arquivo.value}>
                  {arquivo.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 rounded-lg border">
          <h4 className="font-medium text-blue-900 mb-2">Regras Aplicadas Automaticamente:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>v002:</strong> Exclusão por DATA_LAUDO fora do período (retroativos)</li>
            <li>• <strong>v003:</strong> Exclusão por DATA_REALIZACAO (retroativos)</li>
            <li>• <strong>v031:</strong> Filtro período atual (não-retroativos)</li>
            <li>• <strong>v030:</strong> Correção de modalidades CR/DX → RX/MG</li>
            <li>• <strong>De-Para:</strong> Aplicação automática de valores e prioridades</li>
            <li>• <strong>Categorias:</strong> Aplicação baseada no cadastro de exames</li>
            <li>• <strong>Normalização:</strong> Limpeza de nomes de clientes</li>
            <li>• <strong>Tipificação:</strong> Classificação automática de faturamento</li>
          </ul>
        </div>

        {processando && (
          <div className="space-y-2">
            <Progress value={50} className="w-full" />
            <p className="text-sm text-center text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reprocessando dados com database triggers...
            </p>
          </div>
        )}

        {resultado && (
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h4 className="font-medium text-green-900">Reprocessamento Concluído</h4>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Processados:</span> {(resultado as any).total_processados}
              </div>
              <div>
                <span className="font-medium">Rejeitados:</span> {(resultado as any).total_rejeitados}
              </div>
              <div className="col-span-2">
                <span className="font-medium">Arquivo:</span> {(resultado as any).arquivo_fonte}
              </div>
              <div className="col-span-2">
                <span className="font-medium">Data:</span> {new Date((resultado as any).data_processamento).toLocaleString()}
              </div>
            </div>
          </div>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              className="w-full" 
              disabled={processando}
              variant="default"
            >
              {processando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reprocessando...
                </>
              ) : (
                'Reprocessar com Database Triggers'
              )}
            </Button>
          </AlertDialogTrigger>
          
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Confirmar Reprocessamento
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>
                  Esta operação irá reprocessar {arquivoSelecionado || 'todos os arquivos'} aplicando 
                  automaticamente todas as regras de negócio via database triggers.
                </p>
                <p className="font-medium text-amber-700">
                  ⚠️ Os dados serão temporariamente removidos e reinseridos com as regras aplicadas.
                </p>
                <p>
                  Deseja continuar?
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleReprocessar}>
                Confirmar Reprocessamento
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}