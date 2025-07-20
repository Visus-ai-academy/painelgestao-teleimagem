import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  AlertTriangle, 
  Eye, 
  Lock, 
  Key, 
  Database, 
  FileText,
  Settings,
  Users,
  Activity,
  HardDrive
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SecurityAlertsPanel } from '@/components/security/SecurityAlertsPanel';
import { AuditLogsPanel } from '@/components/security/AuditLogsPanel';
import { DataAccessLogsPanel } from '@/components/security/DataAccessLogsPanel';
import { SecurityMetricsPanel } from '@/components/security/SecurityMetricsPanel';
import { TwoFactorAuthPanel } from '@/components/security/TwoFactorAuthPanel';
import { PasswordPolicyPanel } from '@/components/security/PasswordPolicyPanel';
import { EncryptionPanel } from '@/components/security/EncryptionPanel';
import { LGPDCompliancePanel } from '@/components/security/LGPDCompliancePanel';
import { BackupRecoveryPanel } from '@/components/security/BackupRecoveryPanel';

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

export default function Seguranca() {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadSecurityMetrics();
  }, []);

  const loadSecurityMetrics = async () => {
    try {
      setLoading(true);

      // Buscar métricas de segurança
      const [
        { data: alerts },
        { data: criticalAlerts },
        { data: recentLogins },
        { data: failedLogins },
        { data: dataAccess },
        { data: sensitiveAccess },
        { data: lastBackup }
      ] = await Promise.all([
        supabase.from('security_alerts').select('id').eq('status', 'active'),
        supabase.from('security_alerts').select('id').eq('severity', 'critical').eq('status', 'active'),
        supabase.from('login_attempts').select('id').eq('success', true).gte('timestamp', new Date(Date.now() - 24*60*60*1000).toISOString()),
        supabase.from('login_attempts').select('id').eq('success', false).gte('timestamp', new Date(Date.now() - 24*60*60*1000).toISOString()),
        supabase.from('data_access_logs').select('id').gte('timestamp', new Date(Date.now() - 24*60*60*1000).toISOString()),
        supabase.from('data_access_logs').select('id').eq('sensitive_data_accessed', true).gte('timestamp', new Date(Date.now() - 24*60*60*1000).toISOString()),
        supabase.from('backup_logs').select('*').eq('status', 'completed').order('start_time', { ascending: false }).limit(1).single()
      ]);

      setMetrics({
        total_alerts: alerts?.length || 0,
        critical_alerts: criticalAlerts?.length || 0,
        recent_logins: recentLogins?.length || 0,
        failed_logins: failedLogins?.length || 0,
        data_access_events: dataAccess?.length || 0,
        sensitive_access_events: sensitiveAccess?.length || 0,
        backup_status: lastBackup ? 'ok' : 'warning',
        last_backup: lastBackup?.start_time || 'Nunca'
      });

    } catch (error: any) {
      console.error('Erro ao carregar métricas:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar métricas de segurança",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getSecurityScore = () => {
    if (!metrics) return 0;
    
    let score = 100;
    
    // Penalizar por alertas críticos
    score -= metrics.critical_alerts * 10;
    
    // Penalizar por muitas tentativas de login falhadas
    if (metrics.failed_logins > 10) score -= 15;
    
    // Penalizar se não há backup recente
    if (metrics.backup_status !== 'ok') score -= 20;
    
    return Math.max(0, score);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Central de Segurança
          </h1>
          <p className="text-muted-foreground mt-2">
            Monitoramento e gestão da segurança do sistema
          </p>
        </div>
        
        {metrics && (
          <Card className="w-64">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className={`text-4xl font-bold ${getScoreColor(getSecurityScore())}`}>
                  {getSecurityScore()}%
                </div>
                <p className="text-sm text-muted-foreground">Score de Segurança</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Métricas Rápidas */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Alertas Ativos</p>
                  <p className="text-2xl font-bold">{metrics.total_alerts}</p>
                </div>
                <AlertTriangle className={`h-8 w-8 ${metrics.critical_alerts > 0 ? 'text-red-500' : 'text-yellow-500'}`} />
              </div>
              {metrics.critical_alerts > 0 && (
                <Badge variant="destructive" className="mt-2">
                  {metrics.critical_alerts} críticos
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Logins (24h)</p>
                  <p className="text-2xl font-bold">{metrics.recent_logins}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
              {metrics.failed_logins > 0 && (
                <Badge variant="outline" className="mt-2">
                  {metrics.failed_logins} falharam
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Acesso a Dados</p>
                  <p className="text-2xl font-bold">{metrics.data_access_events}</p>
                </div>
                <Eye className="h-8 w-8 text-green-500" />
              </div>
              {metrics.sensitive_access_events > 0 && (
                <Badge variant="secondary" className="mt-2">
                  {metrics.sensitive_access_events} sensíveis
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Último Backup</p>
                  <p className="text-sm font-bold">
                    {metrics.last_backup !== 'Nunca' 
                      ? new Date(metrics.last_backup).toLocaleDateString('pt-BR')
                      : 'Nunca'
                    }
                  </p>
                </div>
                <HardDrive className={`h-8 w-8 ${metrics.backup_status === 'ok' ? 'text-green-500' : 'text-red-500'}`} />
              </div>
              <Badge variant={metrics.backup_status === 'ok' ? 'default' : 'destructive'} className="mt-2">
                {metrics.backup_status === 'ok' ? 'OK' : 'Atenção'}
              </Badge>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Abas de Segurança */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:grid-cols-9">
          <TabsTrigger value="alerts" className="flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Alertas</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Auditoria</span>
          </TabsTrigger>
          <TabsTrigger value="access" className="flex items-center gap-1">
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">Acesso</span>
          </TabsTrigger>
          <TabsTrigger value="metrics" className="flex items-center gap-1">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Métricas</span>
          </TabsTrigger>
          <TabsTrigger value="2fa" className="flex items-center gap-1">
            <Key className="h-4 w-4" />
            <span className="hidden sm:inline">2FA</span>
          </TabsTrigger>
          <TabsTrigger value="password" className="flex items-center gap-1">
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">Senhas</span>
          </TabsTrigger>
          <TabsTrigger value="encryption" className="flex items-center gap-1">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Criptografia</span>
          </TabsTrigger>
          <TabsTrigger value="lgpd" className="flex items-center gap-1">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">LGPD</span>
          </TabsTrigger>
          <TabsTrigger value="backup" className="flex items-center gap-1">
            <HardDrive className="h-4 w-4" />
            <span className="hidden sm:inline">Backup</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alerts">
          <SecurityAlertsPanel onMetricsUpdate={loadSecurityMetrics} />
        </TabsContent>

        <TabsContent value="audit">
          <AuditLogsPanel />
        </TabsContent>

        <TabsContent value="access">
          <DataAccessLogsPanel />
        </TabsContent>

        <TabsContent value="metrics">
          <SecurityMetricsPanel metrics={metrics} />
        </TabsContent>

        <TabsContent value="2fa">
          <TwoFactorAuthPanel />
        </TabsContent>

        <TabsContent value="password">
          <PasswordPolicyPanel />
        </TabsContent>

        <TabsContent value="encryption">
          <EncryptionPanel />
        </TabsContent>

        <TabsContent value="lgpd">
          <LGPDCompliancePanel />
        </TabsContent>

        <TabsContent value="backup">
          <BackupRecoveryPanel onMetricsUpdate={loadSecurityMetrics} />
        </TabsContent>
      </Tabs>
    </div>
  );
}