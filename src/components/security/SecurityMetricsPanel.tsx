import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SecurityMetrics {
  timestamp: string;
  rls_enabled_tables: number;
  total_policies: number;
  recent_critical_alerts: number;
  insecure_functions: number;
  security_score: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendations: string[];
}

export function SecurityMetricsPanel() {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  const runSecurityAudit = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('enhanced_security_audit');
      
      if (error) {
        console.error('Security audit error:', error);
        toast.error('Erro ao executar auditoria de segurança');
        return;
      }

      setMetrics(data as unknown as SecurityMetrics);
      toast.success('Auditoria de segurança concluída');
    } catch (error) {
      console.error('Security audit failed:', error);
      toast.error('Falha na auditoria de segurança');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runSecurityAudit();
  }, []);

  const getScoreColor = (score: string) => {
    switch (score) {
      case 'HIGH': return 'text-green-600';
      case 'MEDIUM': return 'text-yellow-600';
      case 'LOW': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getScoreIcon = (score: string) => {
    switch (score) {
      case 'HIGH': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'MEDIUM': return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'LOW': return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default: return <Shield className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Métricas de Segurança</h2>
        <Button onClick={runSecurityAudit} disabled={loading}>
          {loading ? 'Auditando...' : 'Executar Auditoria'}
        </Button>
      </div>

      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Score de Segurança</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {getScoreIcon(metrics.security_score)}
                <span className={`text-2xl font-bold ${getScoreColor(metrics.security_score)}`}>
                  {metrics.security_score}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Tabelas com RLS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.rls_enabled_tables}</div>
              <Progress value={(metrics.rls_enabled_tables / 20) * 100} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Políticas Ativas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.total_policies}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Alertas Críticos (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{metrics.recent_critical_alerts}</span>
                {metrics.recent_critical_alerts > 0 && (
                  <Badge variant="destructive">Atenção</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {metrics && metrics.insecure_functions > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Detectadas {metrics.insecure_functions} funções com problemas de segurança. 
            Recomenda-se revisar e corrigir imediatamente.
          </AlertDescription>
        </Alert>
      )}

      {metrics && metrics.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recomendações de Segurança</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {metrics.recommendations.map((recommendation, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Shield className="h-4 w-4 mt-1 text-blue-600" />
                  <span className="text-sm">{recommendation}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {metrics && (
        <Card>
          <CardHeader>
            <CardTitle>Última Auditoria</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {new Date(metrics.timestamp).toLocaleString('pt-BR')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}