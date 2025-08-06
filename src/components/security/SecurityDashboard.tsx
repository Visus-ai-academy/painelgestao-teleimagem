
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SecurityMonitoringPanel } from './SecurityMonitoringPanel';
import { SecurityAlertsPanel } from './SecurityAlertsPanel';
import { AuditLogsPanel } from './AuditLogsPanel';
import { DataAccessLogsPanel } from './DataAccessLogsPanel';
import { EnhancedFileUpload } from './EnhancedFileUpload';
import { Shield, AlertTriangle, FileText, Eye, Upload } from 'lucide-react';

export function SecurityDashboard() {
  const handleMetricsUpdate = () => {
    // Callback for when security metrics are updated
    console.log('Security metrics updated');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Painel de Segurança</h1>
        <p className="text-muted-foreground">
          Monitoramento abrangente da segurança do sistema
        </p>
      </div>

      <Tabs defaultValue="monitoring" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
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
        </TabsList>

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
      </Tabs>
    </div>
  );
}
