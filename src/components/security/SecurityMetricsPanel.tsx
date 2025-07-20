import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, TrendingUp, TrendingDown, Shield, Users, Eye, HardDrive } from 'lucide-react';

interface SecurityMetrics {
  total_alerts: number;
  critical_alerts: number;
  recent_logins: number;
  failed_logins: number;
  data_access_events: number;
  sensitive_access_events: number;
  backup_status: string;
  last_backup: string;
}

interface SecurityMetricsPanelProps {
  metrics: SecurityMetrics | null;
}

export function SecurityMetricsPanel({ metrics }: SecurityMetricsPanelProps) {
  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Métricas de Segurança</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Carregando métricas...</div>
        </CardContent>
      </Card>
    );
  }

  const securityScore = Math.max(0, 100 - (metrics.critical_alerts * 10) - 
    (metrics.failed_logins > 10 ? 15 : 0) - 
    (metrics.backup_status !== 'ok' ? 20 : 0));

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreDescription = (score: number) => {
    if (score >= 90) return 'Excelente - Sistema altamente seguro';
    if (score >= 80) return 'Bom - Segurança adequada com pequenos pontos de atenção';
    if (score >= 60) return 'Regular - Algumas vulnerabilidades precisam ser tratadas';
    return 'Crítico - Ação imediata necessária';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Métricas de Segurança
        </CardTitle>
        <CardDescription>
          Resumo das métricas de segurança dos últimos 30 dias
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Score Geral de Segurança */}
          <div className="text-center p-6 border rounded-lg">
            <div className={`text-6xl font-bold ${getScoreColor(securityScore)}`}>
              {securityScore}%
            </div>
            <p className="text-lg font-semibold mt-2">Score de Segurança</p>
            <p className="text-sm text-muted-foreground mt-1">
              {getScoreDescription(securityScore)}
            </p>
          </div>

          {/* Métricas Detalhadas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Alertas Totais</p>
                    <p className="text-2xl font-bold">{metrics.total_alerts}</p>
                    {metrics.critical_alerts > 0 && (
                      <p className="text-sm text-red-600">
                        {metrics.critical_alerts} críticos
                      </p>
                    )}
                  </div>
                  <Shield className={`h-8 w-8 ${metrics.critical_alerts > 0 ? 'text-red-500' : 'text-green-500'}`} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Tentativas de Login</p>
                    <p className="text-2xl font-bold">{metrics.recent_logins}</p>
                    {metrics.failed_logins > 0 && (
                      <p className="text-sm text-orange-600">
                        {metrics.failed_logins} falharam
                      </p>
                    )}
                  </div>
                  <Users className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Acessos a Dados</p>
                    <p className="text-2xl font-bold">{metrics.data_access_events}</p>
                    {metrics.sensitive_access_events > 0 && (
                      <p className="text-sm text-orange-600">
                        {metrics.sensitive_access_events} sensíveis
                      </p>
                    )}
                  </div>
                  <Eye className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Status do Backup</p>
                    <p className="text-sm font-bold">
                      {metrics.backup_status === 'ok' ? 'Operacional' : 'Atenção Necessária'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {metrics.last_backup !== 'Nunca' 
                        ? `Último: ${new Date(metrics.last_backup).toLocaleDateString('pt-BR')}`
                        : 'Nunca executado'
                      }
                    </p>
                  </div>
                  <HardDrive className={`h-8 w-8 ${metrics.backup_status === 'ok' ? 'text-green-500' : 'text-red-500'}`} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Indicadores de Tendência */}
          <div className="border rounded-lg p-4">
            <h4 className="font-semibold mb-4">Tendências de Segurança</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                <div>
                  <p className="text-sm font-medium">Logins Bem-sucedidos</p>
                  <p className="text-lg font-bold text-green-600">{metrics.recent_logins}</p>
                </div>
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>

              <div className="flex items-center justify-between p-3 bg-orange-50 rounded">
                <div>
                  <p className="text-sm font-medium">Tentativas Falhadas</p>
                  <p className="text-lg font-bold text-orange-600">{metrics.failed_logins}</p>
                </div>
                {metrics.failed_logins > 5 ? (
                  <TrendingUp className="h-5 w-5 text-orange-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-green-600" />
                )}
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
                <div>
                  <p className="text-sm font-medium">Acessos Monitorados</p>
                  <p className="text-lg font-bold text-blue-600">{metrics.data_access_events}</p>
                </div>
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Recomendações */}
          <div className="border rounded-lg p-4">
            <h4 className="font-semibold mb-4">Recomendações de Segurança</h4>
            <div className="space-y-2">
              {metrics.critical_alerts > 0 && (
                <div className="flex items-center gap-2 text-red-600">
                  <Shield className="h-4 w-4" />
                  <span className="text-sm">Resolver alertas críticos imediatamente</span>
                </div>
              )}
              {metrics.failed_logins > 10 && (
                <div className="flex items-center gap-2 text-orange-600">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">Investigar alto número de tentativas de login falhadas</span>
                </div>
              )}
              {metrics.backup_status !== 'ok' && (
                <div className="flex items-center gap-2 text-red-600">
                  <HardDrive className="h-4 w-4" />
                  <span className="text-sm">Verificar sistema de backup</span>
                </div>
              )}
              {securityScore >= 90 && (
                <div className="flex items-center gap-2 text-green-600">
                  <Shield className="h-4 w-4" />
                  <span className="text-sm">Sistema operando com alta segurança</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}