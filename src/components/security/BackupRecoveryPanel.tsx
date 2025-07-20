import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HardDrive } from 'lucide-react';

interface BackupRecoveryPanelProps {
  onMetricsUpdate: () => void;
}

export function BackupRecoveryPanel({ onMetricsUpdate }: BackupRecoveryPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Backup e Recovery
        </CardTitle>
        <CardDescription>
          Gestão de backups e recuperação de dados
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Painel de backup em desenvolvimento...</p>
      </CardContent>
    </Card>
  );
}