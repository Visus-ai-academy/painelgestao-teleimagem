
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Shield, RefreshCw, Activity, Lock, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SecurityHealthCheck {
  configuration: {
    rls_enabled_tables: number;
    secure_functions: number;
    permissive_policies: number;
    security_definer_views: number;
    security_score: number;
    critical_issues: string[];
    recommendations: string[];
  };
  activity_monitoring: {
    suspicious_logins: number;
    failed_uploads: number;
    unusual_access: number;
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  overall_status: 'EXCELLENT' | 'GOOD' | 'NEEDS_ATTENTION';
  last_check: string;
}

export function SecurityMonitoringPanel() {
  const [healthCheck, setHealthCheck] = useState<SecurityHealthCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const loadSecurityHealth = async () => {
    try {
      setRefreshing(true);
      
      const { data, error } = await supabase.rpc('run_security_health_check');
      
      if (error) throw error;
      setHealthCheck(data);
    } catch (error: any) {
      console.error('Erro ao carregar status de segurança:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar status de segurança",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSecurityHealth();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(loadSecurityHealth, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'EXCELLENT': return 'text-green-600 bg-green-100';
      case 'GOOD': return 'text-blue-600 bg-blue-100';
      case 'NEEDS_ATTENTION': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'LOW': return 'text-green-600 bg-green-100';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100';
      case 'HIGH': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Monitor de Segurança
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Carregando status de segurança...</div>
        </CardContent>
      </Card>
    );
  }

  if (!healthCheck) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Monitor de Segurança
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Não foi possível carregar o status de segurança
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Status Geral de Segurança
            </div>
            <Button 
              onClick={loadSecurityHealth} 
              disabled={refreshing}
              variant="outline" 
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </CardTitle>
          <CardDescription>
            Última verificação: {new Date(healthCheck.last_check).toLocaleString('pt-BR')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Badge className={getStatusColor(healthCheck.overall_status)}>
                {healthCheck.overall_status === 'EXCELLENT' ? 'EXCELENTE' :
                 healthCheck.overall_status === 'GOOD' ? 'BOM' : 'PRECISA ATENÇÃO'}
              </Badge>
              <div className="text-2xl font-bold">
                Pontuação: <span className={getScoreColor(healthCheck.configuration.security_score)}>
                  {healthCheck.configuration.security_score}/10
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <Lock className="h-6 w-6 mx-auto mb-2 text-blue-600" />
              <div className="text-2xl font-bold text-blue-600">
                {healthCheck.configuration.rls_enabled_tables}
              </div>
              <div className="text-sm text-blue-700">Tabelas com RLS</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <Shield className="h-6 w-6 mx-auto mb-2 text-green-600" />
              <div className="text-2xl font-bold text-green-600">
                {healthCheck.configuration.secure_functions}
              </div>
              <div className="text-sm text-green-700">Funções Seguras</div>
            </div>
            
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-orange-600" />
              <div className="text-2xl font-bold text-orange-600">
                {healthCheck.configuration.permissive_policies}
              </div>
              <div className="text-sm text-orange-700">Políticas Permissivas</div>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <Activity className="h-6 w-6 mx-auto mb-2 text-purple-600" />
              <div className="text-2xl font-bold text-purple-600">
                {healthCheck.activity_monitoring.suspicious_logins}
              </div>
              <div className="text-sm text-purple-700">Logins Suspeitos</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Monitoring */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Monitoramento de Atividade
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm font-medium">Nível de Risco:</span>
            <Badge className={getRiskLevelColor(healthCheck.activity_monitoring.risk_level)}>
              {healthCheck.activity_monitoring.risk_level === 'LOW' ? 'BAIXO' :
               healthCheck.activity_monitoring.risk_level === 'MEDIUM' ? 'MÉDIO' : 'ALTO'}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 border rounded-lg">
              <div className="text-xl font-bold text-red-600">
                {healthCheck.activity_monitoring.suspicious_logins}
              </div>
              <div className="text-xs text-muted-foreground">Logins Suspeitos (10min)</div>
            </div>
            
            <div className="text-center p-3 border rounded-lg">
              <div className="text-xl font-bold text-orange-600">
                {healthCheck.activity_monitoring.failed_uploads}
              </div>
              <div className="text-xs text-muted-foreground">Uploads Falharam (1h)</div>
            </div>
            
            <div className="text-center p-3 border rounded-lg">
              <div className="text-xl font-bold text-purple-600">
                {healthCheck.activity_monitoring.unusual_access}
              </div>
              <div className="text-xs text-muted-foreground">Acessos Sensíveis (1h)</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical Issues & Recommendations */}
      {(healthCheck.configuration.critical_issues.length > 0 || 
        healthCheck.configuration.recommendations.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Questões Críticas e Recomendações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {healthCheck.configuration.critical_issues.length > 0 && (
              <div>
                <h4 className="font-semibold text-red-600 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Questões Críticas:
                </h4>
                <ul className="space-y-1">
                  {healthCheck.configuration.critical_issues.map((issue, index) => (
                    <li key={index} className="text-sm bg-red-50 p-2 rounded border-l-4 border-red-500">
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {healthCheck.configuration.recommendations.length > 0 && (
              <div>
                <h4 className="font-semibold text-blue-600 mb-2">Recomendações:</h4>
                <ul className="space-y-1">
                  {healthCheck.configuration.recommendations.map((rec, index) => (
                    <li key={index} className="text-sm bg-blue-50 p-2 rounded border-l-4 border-blue-500">
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
