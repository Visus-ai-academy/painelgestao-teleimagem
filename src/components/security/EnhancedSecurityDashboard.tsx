import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SecurityMonitoringPanel } from './SecurityMonitoringPanel';
import { SecurityAlertsPanel } from './SecurityAlertsPanel';
import { AuditLogsPanel } from './AuditLogsPanel';
import { DataAccessLogsPanel } from './DataAccessLogsPanel';
import { EnhancedFileUpload } from './EnhancedFileUpload';
import { SecurityMetricsPanel } from './SecurityMetricsPanel';
import { Shield, AlertTriangle, FileText, Eye, Upload, BarChart3, Settings } from 'lucide-react';

export function EnhancedSecurityDashboard() {
  const handleMetricsUpdate = () => {
    console.log('Security metrics updated');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Painel de Segurança Avançado</h1>
        <p className="text-muted-foreground">
          Monitoramento abrangente e métricas avançadas de segurança do sistema
        </p>
      </div>

      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="metrics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Métricas
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Monitor
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alertas
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Auditoria
          </TabsTrigger>
          <TabsTrigger value="access" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Acesso
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="policies" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Políticas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          <SecurityMetricsPanel />
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <SecurityMonitoringPanel />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <SecurityAlertsPanel onMetricsUpdate={handleMetricsUpdate} />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <AuditLogsPanel />
        </TabsContent>

        <TabsContent value="access" className="space-y-4">
          <DataAccessLogsPanel />
        </TabsContent>

        <TabsContent value="upload" className="space-y-4">
          <EnhancedFileUpload 
            validateContent={true}
            onFileProcessed={(result) => {
              console.log('Arquivo processado:', result);
            }}
          />
        </TabsContent>

        <TabsContent value="policies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Políticas de Segurança Implementadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold text-green-700 mb-2">✅ Controle de Acesso</h4>
                    <ul className="text-sm space-y-1">
                      <li>• RLS habilitado em tabelas críticas</li>
                      <li>• Autenticação obrigatória</li>
                      <li>• Controle de roles (admin/manager/user)</li>
                    </ul>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold text-green-700 mb-2">✅ Funções Seguras</h4>
                    <ul className="text-sm space-y-1">
                      <li>• Search path fixo para funções</li>
                      <li>• Validação de entrada implementada</li>
                      <li>• Auditoria de execução</li>
                    </ul>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold text-green-700 mb-2">✅ Monitoramento</h4>
                    <ul className="text-sm space-y-1">
                      <li>• Logs de auditoria detalhados</li>
                      <li>• Alertas de segurança em tempo real</li>
                      <li>• Rastreamento de acesso a dados</li>
                    </ul>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold text-green-700 mb-2">✅ Validação</h4>
                    <ul className="text-sm space-y-1">
                      <li>• Upload de arquivos validado</li>
                      <li>• Prevenção XSS e SQL injection</li>
                      <li>• Sanitização de entrada</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}