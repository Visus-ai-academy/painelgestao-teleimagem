import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAutoRegras } from '@/hooks/useAutoRegras';
import { CheckCircle, XCircle, Clock, AlertTriangle, Settings, Play, Pause } from 'lucide-react';

interface StatusRegra {
  regra: string;
  arquivo: string;
  aplicada: boolean;
  validacao_ok?: boolean;
  erro?: string;
  timestamp?: string;
}

interface LogAplicacao {
  id: string;
  operation: string;
  record_id: string;
  new_data: any;
  timestamp: string;
  severity: string;
}

export function AutoRegrasDashboard() {
  const {
    autoAplicarAtivo,
    processandoRegras,
    toggleAutoAplicar,
    aplicarRegrasManual,
    validarRegras
  } = useAutoRegras();

  const [logsRecentes, setLogsRecentes] = useState<LogAplicacao[]>([]);
  const [statusRegras, setStatusRegras] = useState<StatusRegra[]>([]);

  const carregarLogs = async () => {
    try {
      // Query otimizada: selecionar apenas campos necessários e filtro mais eficiente
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, operation, record_id, new_data, timestamp, severity')
        .eq('operation', 'APLICACAO_AUTOMATICA_REGRAS')
        .order('timestamp', { ascending: false })
        .limit(20);

      if (error) throw error;
      setLogsRecentes(data || []);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
      // Em caso de erro, limpar logs para não travar a interface
      setLogsRecentes([]);
    }
  };

  const aplicarRegrasArquivo = async (arquivo: string) => {
    try {
      const resultado = await aplicarRegrasManual(arquivo);
      setStatusRegras(resultado.status_detalhado || []);
    } catch (error) {
      // Erro já tratado no hook
    }
  };

  const validarRegrasArquivo = async (arquivo: string) => {
    try {
      const resultado = await validarRegras(arquivo);
      setStatusRegras(resultado.status_detalhado || []);
    } catch (error) {
      // Erro já tratado no hook
    }
  };

  useEffect(() => {
    carregarLogs();
    const interval = setInterval(carregarLogs, 30000); // Atualizar a cada 30s
    return () => clearInterval(interval);
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'info': return 'default';
      case 'warning': return 'secondary';
      case 'error': return 'destructive';
      default: return 'outline';
    }
  };

  const getRegraIcon = (regra: StatusRegra) => {
    if (regra.aplicada && regra.validacao_ok) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (regra.aplicada && regra.validacao_ok === false) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    if (!regra.aplicada && regra.erro) return <XCircle className="h-4 w-4 text-red-500" />;
    return <Clock className="h-4 w-4 text-gray-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Header com Controles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Sistema Automático de Aplicação de Regras
          </CardTitle>
          <CardDescription>
            Gerenciar a aplicação automática de regras após uploads de arquivos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="auto-aplicar"
                checked={autoAplicarAtivo}
                onCheckedChange={toggleAutoAplicar}
              />
              <Label htmlFor="auto-aplicar">Aplicação Automática Habilitada</Label>
              {autoAplicarAtivo ? (
                <Badge variant="default" className="ml-2">
                  <Play className="h-3 w-3 mr-1" />
                  Ativo
                </Badge>
              ) : (
                <Badge variant="secondary" className="ml-2">
                  <Pause className="h-3 w-3 mr-1" />
                  Pausado
                </Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {['volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo'].map((arquivo) => (
              <div key={arquivo} className="space-y-2">
                <Label className="text-sm font-medium">{arquivo.replace('_', ' ').toUpperCase()}</Label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => validarRegrasArquivo(arquivo)}
                    disabled={processandoRegras}
                  >
                    Validar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => aplicarRegrasArquivo(arquivo)}
                    disabled={processandoRegras}
                  >
                    Aplicar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Status das Regras */}
      {statusRegras.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Status Detalhado das Regras</CardTitle>
            <CardDescription>
              Última verificação: {new Date().toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {statusRegras.map((regra, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getRegraIcon(regra)}
                    <div>
                      <p className="font-medium">{regra.regra.replace(/_/g, ' ')}</p>
                      <p className="text-sm text-muted-foreground">{regra.arquivo}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {regra.aplicada ? (
                      <Badge variant="default">Aplicada</Badge>
                    ) : (
                      <Badge variant="destructive">Não Aplicada</Badge>
                    )}
                    {regra.validacao_ok === true && (
                      <Badge variant="default">Validação OK</Badge>
                    )}
                    {regra.validacao_ok === false && (
                      <Badge variant="secondary">Falhou Validação</Badge>
                    )}
                    {regra.erro && (
                      <Badge variant="destructive">Erro</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logs de Aplicação Automática */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Aplicações Automáticas</CardTitle>
          <CardDescription>
            Últimas 10 execuções do sistema automático
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {logsRecentes.map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg">
                <Badge variant={getSeverityColor(log.severity)} className="mt-0.5">
                  {log.operation.replace('APLICACAO_AUTOMATICA_', '')}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">
                    {log.new_data?.arquivo_fonte || log.record_id}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {log.new_data?.lote_upload && `Lote: ${log.new_data.lote_upload}`}
                  </p>
                  {log.new_data?.erro && (
                    <p className="text-sm text-red-600 mt-1">{log.new_data.erro}</p>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {new Date(log.timestamp).toLocaleString()}
                </p>
              </div>
            ))}
            {logsRecentes.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                Nenhuma aplicação automática registrada ainda
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}