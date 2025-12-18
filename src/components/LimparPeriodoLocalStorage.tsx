import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, CheckCircle, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const PERIODO_STORAGE_KEY = 'volumetria_periodo_selecionado';

export function LimparPeriodoLocalStorage() {
  const [periodoAtual, setPeriodoAtual] = useState<string | null>(() => {
    return localStorage.getItem(PERIODO_STORAGE_KEY);
  });
  const [limpo, setLimpo] = useState(false);
  const { toast } = useToast();

  const handleLimpar = () => {
    const valorAnterior = localStorage.getItem(PERIODO_STORAGE_KEY);
    console.log('🗑️ LIMPANDO período do localStorage:', valorAnterior);
    
    localStorage.removeItem(PERIODO_STORAGE_KEY);
    
    setPeriodoAtual(null);
    setLimpo(true);
    
    toast({
      title: "Período limpo com sucesso!",
      description: "Agora você deve selecionar o período correto antes de fazer novos uploads.",
    });
    
    // Forçar recarregar a página após 2 segundos
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  };

  const formatarPeriodo = (json: string | null) => {
    if (!json) return 'Nenhum período salvo';
    try {
      const parsed = JSON.parse(json);
      const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      return `${meses[parsed.mes - 1]}/${parsed.ano} (${parsed.ano}-${parsed.mes.toString().padStart(2, '0')})`;
    } catch {
      return json;
    }
  };

  return (
    <Card className="border-orange-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-orange-600" />
          Limpar Período de Volumetria (LocalStorage)
        </CardTitle>
        <CardDescription>
          Limpa o período de faturamento salvo no navegador para forçar nova seleção
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className={periodoAtual ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}>
          <AlertDescription>
            <strong>Período atual no localStorage:</strong>
            <div className="mt-1 font-mono text-lg">
              {formatarPeriodo(periodoAtual)}
            </div>
          </AlertDescription>
        </Alert>

        {limpo ? (
          <div className="flex items-center gap-2 text-green-600 p-3 bg-green-50 rounded-lg">
            <CheckCircle className="h-5 w-5" />
            <span>Período limpo! A página será recarregada...</span>
          </div>
        ) : (
          <Button 
            onClick={handleLimpar}
            variant="destructive"
            className="w-full"
            disabled={!periodoAtual}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {periodoAtual ? 'Limpar Período do LocalStorage' : 'Nenhum período para limpar'}
          </Button>
        )}

        <p className="text-xs text-muted-foreground">
          Após limpar, você precisará selecionar o período novamente na página de Volumetria antes de fazer uploads.
        </p>
      </CardContent>
    </Card>
  );
}
