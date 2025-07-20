import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, Clock, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SecurityAlert {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  description: string;
  timestamp: string;
  status: string;
  metadata: any;
}

interface SecurityAlertsPanelProps {
  onMetricsUpdate: () => void;
}

export function SecurityAlertsPanel({ onMetricsUpdate }: SecurityAlertsPanelProps) {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('security_alerts')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;
      setAlerts(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar alertas:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar alertas de segurança",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateAlertStatus = async (alertId: string, status: 'acknowledged' | 'resolved') => {
    try {
      const { error } = await supabase
        .from('security_alerts')
        .update({ status })
        .eq('id', alertId);

      if (error) throw error;

      setAlerts(prev => prev.map(alert => 
        alert.id === alertId ? { ...alert, status } : alert
      ));

      onMetricsUpdate();

      toast({
        title: "Sucesso",
        description: `Alerta ${status === 'acknowledged' ? 'reconhecido' : 'resolvido'} com sucesso`,
      });
    } catch (error: any) {
      console.error('Erro ao atualizar alerta:', error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar status do alerta",
        variant: "destructive",
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'acknowledged':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Alertas de Segurança</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Carregando alertas...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Alertas de Segurança
        </CardTitle>
        <CardDescription>
          Monitoramento em tempo real de eventos de segurança
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
              Nenhum alerta de segurança ativo
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${getSeverityColor(alert.severity)}`}>
                      {getSeverityIcon(alert.severity)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{alert.title}</h4>
                        <Badge variant="outline">
                          {alert.severity.toUpperCase()}
                        </Badge>
                        {getStatusIcon(alert.status)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {alert.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Tipo: {alert.alert_type}</span>
                        <span>
                          {new Date(alert.timestamp).toLocaleString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {alert.status === 'active' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateAlertStatus(alert.id, 'acknowledged')}
                      >
                        Reconhecer
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => updateAlertStatus(alert.id, 'resolved')}
                      >
                        Resolver
                      </Button>
                    </div>
                  )}
                </div>

                {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                  <details className="mt-2">
                    <summary className="text-sm cursor-pointer text-muted-foreground hover:text-foreground">
                      Ver detalhes técnicos
                    </summary>
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                      {JSON.stringify(alert.metadata, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}