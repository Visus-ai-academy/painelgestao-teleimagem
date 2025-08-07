import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Lock, Unlock, Calendar, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface FechamentoPeriodo {
  id: string;
  periodo_referencia: string;
  data_inicio: string;
  data_fim: string;
  status: string; // Alterado para string genérico
  data_fechamento?: string;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
  fechado_por?: string;
}

export const ControleFechamentoFaturamento = () => {
  const [periodos, setPeriodos] = useState<FechamentoPeriodo[]>([]);
  const [novoPeriodo, setNovoPeriodo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingLista, setLoadingLista] = useState(true);
  const { toast } = useToast();

  const buscarPeriodos = async () => {
    try {
      const { data, error } = await supabase
        .from('fechamento_faturamento')
        .select('*')
        .order('periodo_referencia', { ascending: false });

      if (error) throw error;
      setPeriodos(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar períodos:', error);
      toast({
        title: "Erro ao carregar períodos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingLista(false);
    }
  };

  useEffect(() => {
    buscarPeriodos();
  }, []);

  const fecharPeriodo = async () => {
    if (!novoPeriodo.trim()) {
      toast({
        title: "Período obrigatório",
        description: "Informe o período no formato jan/25, fev/25, etc.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase.rpc('fechar_periodo_faturamento', {
        p_periodo_referencia: novoPeriodo.trim(),
        p_observacoes: observacoes.trim() || null
      });

      if (error) throw error;

      const resultado = data as any;
      if (!resultado?.sucesso) {
        toast({
          title: "Erro ao fechar período",
          description: resultado?.erro || "Erro desconhecido",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "✅ Período fechado!",
        description: `Período ${novoPeriodo} foi fechado com sucesso`,
      });

      setNovoPeriodo("");
      setObservacoes("");
      buscarPeriodos();
      
    } catch (error: any) {
      console.error('Erro ao fechar período:', error);
      toast({
        title: "Erro ao fechar período",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const reabrirPeriodo = async (periodoRef: string) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.rpc('reabrir_periodo_faturamento', {
        p_periodo_referencia: periodoRef
      });

      if (error) throw error;

      const resultado = data as any;
      if (!resultado?.sucesso) {
        toast({
          title: "Erro ao reabrir período",
          description: resultado?.erro || "Erro desconhecido",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "✅ Período reaberto!",
        description: `Período ${periodoRef} foi reaberto`,
      });

      buscarPeriodos();
      
    } catch (error: any) {
      console.error('Erro ao reabrir período:', error);
      toast({
        title: "Erro ao reabrir período",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'fechado' 
      ? 'bg-red-100 text-red-800 border-red-200'
      : 'bg-green-100 text-green-800 border-green-200';
  };

  const formatarData = (dataStr: string) => {
    return new Date(dataStr).toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Controle de Fechamento de Faturamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Proteção Temporal Aprimorada:</strong> Após fechar um período, 
              nenhum novo dado de volumetria ou faturamento poderá ser inserido para 
              esse período. Esta ação garante a integridade dos dados já processados.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="periodo">Período (ex: jan/25, fev/25)</Label>
              <Input
                id="periodo"
                value={novoPeriodo}
                onChange={(e) => setNovoPeriodo(e.target.value)}
                placeholder="jan/25"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações (opcional)</Label>
              <Textarea
                id="observacoes"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Motivo do fechamento..."
                disabled={loading}
                rows={2}
              />
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                disabled={loading || !novoPeriodo.trim()}
                variant="destructive"
                className="w-full"
              >
                <Lock className="h-4 w-4 mr-2" />
                {loading ? "Fechando..." : "Fechar Período de Faturamento"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Fechamento</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja fechar o período <strong>{novoPeriodo}</strong>?
                  <br /><br />
                  <strong>Esta ação irá:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Bloquear novos uploads de volumetria para este período</li>
                    <li>Bloquear alterações nos dados de faturamento</li>
                    <li>Impedir edição de dados já processados</li>
                  </ul>
                  <br />
                  <strong className="text-red-600">Apenas administradores podem reabrir períodos fechados.</strong>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={fecharPeriodo} className="bg-red-600 hover:bg-red-700">
                  Confirmar Fechamento
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Histórico de Períodos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingLista ? (
            <div className="text-center py-4">Carregando períodos...</div>
          ) : periodos.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              Nenhum período foi fechado ainda
            </div>
          ) : (
            <div className="space-y-4">
              {periodos.map((periodo) => (
                <div key={periodo.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{periodo.periodo_referencia}</span>
                      <Badge className={getStatusColor(periodo.status)}>
                        {periodo.status === 'fechado' ? (
                          <>
                            <Lock className="h-3 w-3 mr-1" />
                            Fechado
                          </>
                        ) : (
                          <>
                            <Unlock className="h-3 w-3 mr-1" />
                            Aberto
                          </>
                        )}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Período: {formatarData(periodo.data_inicio)} a {formatarData(periodo.data_fim)}
                    </div>
                    {periodo.data_fechamento && (
                      <div className="text-sm text-muted-foreground">
                        Fechado em: {new Date(periodo.data_fechamento).toLocaleString('pt-BR')}
                      </div>
                    )}
                    {periodo.observacoes && (
                      <div className="text-sm italic">"{periodo.observacoes}"</div>
                    )}
                  </div>
                  
                  {periodo.status === 'fechado' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          disabled={loading}
                        >
                          <Unlock className="h-4 w-4 mr-1" />
                          Reabrir
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reabrir Período</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja reabrir o período <strong>{periodo.periodo_referencia}</strong>?
                            <br /><br />
                            Isso permitirá novamente:
                            <ul className="list-disc list-inside mt-2 space-y-1">
                              <li>Uploads de volumetria para este período</li>
                              <li>Alterações nos dados de faturamento</li>
                              <li>Edição de dados já processados</li>
                            </ul>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => reabrirPeriodo(periodo.periodo_referencia)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Confirmar Reabertura
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};