import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSystemTasks } from "@/hooks/useSystemTasks";
import { RefreshCw, Play, Trash2, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function MonitorTasks() {
  const { tasks, loading, buscarTasks, processarTasksPendentes, limparTasksAntigas } = useSystemTasks();
  const { toast } = useToast();

  const handleProcessarTasks = async () => {
    const resultado = await processarTasksPendentes();
    
    if (resultado.success) {
      toast({
        title: "✅ Sucesso",
        description: resultado.message || "Tasks processadas com sucesso",
      });
    } else {
      toast({
        title: "❌ Erro",
        description: resultado.error || "Erro ao processar tasks",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pendente': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'processando': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'concluido': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'erro': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'pendente': 'outline',
      'processando': 'default',
      'concluido': 'secondary',
      'erro': 'destructive'
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {getStatusIcon(status)}
        <span className="ml-1 capitalize">{status}</span>
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Monitor de Tasks do Sistema
            </CardTitle>
            <CardDescription>
              Acompanhe e gerencie tasks automáticas do sistema
            </CardDescription>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={buscarTasks}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Atualizar
            </Button>
            
            <Button 
              variant="default" 
              size="sm"
              onClick={handleProcessarTasks}
              disabled={loading}
            >
              <Play className="h-4 w-4 mr-1" />
              Processar Pendentes
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={limparTasksAntigas}
              disabled={loading}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Limpar Antigas
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhuma task encontrada</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div 
                key={task.id} 
                className="border rounded-lg p-4 bg-gray-50/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">
                    {task.task_type}
                  </div>
                  {getStatusBadge(task.status)}
                </div>
                
                <div className="text-sm text-gray-600 space-y-1">
                  <div>
                    <strong>Arquivo:</strong> {task.task_data?.arquivo_fonte || 'N/A'}
                  </div>
                  <div>
                    <strong>Criado:</strong> {new Date(task.created_at).toLocaleString()}
                  </div>
                  <div>
                    <strong>Tentativas:</strong> {task.attempts}/{task.max_attempts}
                  </div>
                  {task.error_message && (
                    <div className="text-red-600">
                      <strong>Erro:</strong> {task.error_message}
                    </div>
                  )}
                  {task.processed_at && (
                    <div>
                      <strong>Processado:</strong> {new Date(task.processed_at).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}