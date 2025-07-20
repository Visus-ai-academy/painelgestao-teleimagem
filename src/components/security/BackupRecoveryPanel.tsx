import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { HardDrive, Play, Calendar, Clock, CheckCircle, AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BackupLog {
  id: string;
  backup_type: string;
  status: string;
  start_time: string;
  end_time: string | null;
  file_size_bytes: number | null;
  backup_location: string | null;
  error_message: string | null;
  checksum: string | null;
}

interface BackupRecoveryPanelProps {
  onMetricsUpdate: () => void;
}

export function BackupRecoveryPanel({ onMetricsUpdate }: BackupRecoveryPanelProps) {
  const [backupLogs, setBackupLogs] = useState<BackupLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Estados para novo backup
  const [backupType, setBackupType] = useState<'full' | 'incremental' | 'differential'>('full');
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [scheduleTime, setScheduleTime] = useState('');
  
  const { toast } = useToast();

  const availableTables = [
    'profiles', 'clientes', 'medicos', 'exames', 'faturamento',
    'escalas_medicas', 'user_roles', 'especialidades', 'modalidades',
    'categorias_exame', 'categorias_medico', 'prioridades',
    'audit_logs', 'data_access_logs', 'security_alerts'
  ];

  useEffect(() => {
    loadBackupLogs();
  }, []);

  const loadBackupLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('backup_logs')
        .select('*')
        .order('start_time', { ascending: false })
        .limit(50);

      if (error) throw error;
      setBackupLogs(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar logs de backup:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar logs de backup",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const startBackup = async () => {
    try {
      setProcessing(true);
      const { data, error } = await supabase.functions.invoke('backup-manager', {
        body: {
          type: backupType,
          tables: selectedTables.length > 0 ? selectedTables : undefined,
          schedule: scheduleTime || undefined
        }
      });

      if (error) throw error;

      toast({
        title: "Backup Iniciado",
        description: `Backup ${backupType} iniciado com sucesso`,
      });

      // Atualizar logs e métricas
      await loadBackupLogs();
      onMetricsUpdate();

    } catch (error: any) {
      console.error('Erro ao iniciar backup:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao iniciar backup",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleTableSelection = (table: string, checked: boolean) => {
    if (checked) {
      setSelectedTables([...selectedTables, table]);
    } else {
      setSelectedTables(selectedTables.filter(t => t !== table));
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">Concluído</Badge>;
      case 'failed':
        return <Badge variant="destructive">Falhou</Badge>;
      case 'running':
        return <Badge variant="secondary">Executando</Badge>;
      default:
        return <Badge variant="outline">Desconhecido</Badge>;
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDuration = (startTime: string, endTime: string | null) => {
    if (!endTime) return 'Em execução...';
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diff = end.getTime() - start.getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const getLastBackupStatus = () => {
    if (backupLogs.length === 0) return { status: 'never', message: 'Nenhum backup encontrado' };
    
    const lastBackup = backupLogs[0];
    const lastBackupDate = new Date(lastBackup.start_time);
    const now = new Date();
    const hoursSince = (now.getTime() - lastBackupDate.getTime()) / (1000 * 60 * 60);
    
    if (lastBackup.status === 'failed') {
      return { status: 'error', message: 'Último backup falhou' };
    }
    
    if (hoursSince > 24) {
      return { status: 'warning', message: 'Último backup há mais de 24h' };
    }
    
    return { status: 'ok', message: 'Backup recente disponível' };
  };

  const backupStatus = getLastBackupStatus();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Backup e Recovery
        </CardTitle>
        <CardDescription>
          Gestão de backups automáticos e recuperação de dados
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="status" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="create">Criar Backup</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
            <TabsTrigger value="recovery">Recovery</TabsTrigger>
          </TabsList>

          <TabsContent value="status" className="space-y-4">
            {/* Status Geral */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <HardDrive className={`h-6 w-6 ${
                  backupStatus.status === 'ok' ? 'text-green-500' : 
                  backupStatus.status === 'warning' ? 'text-yellow-500' : 'text-red-500'
                }`} />
                <div>
                  <h4 className="font-semibold">Status do Backup</h4>
                  <p className="text-sm text-muted-foreground">{backupStatus.message}</p>
                </div>
              </div>
              <Badge variant={
                backupStatus.status === 'ok' ? 'default' : 
                backupStatus.status === 'warning' ? 'secondary' : 'destructive'
              }>
                {backupStatus.status.toUpperCase()}
              </Badge>
            </div>

            {/* Estatísticas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{backupLogs.length}</div>
                    <p className="text-sm text-muted-foreground">Total de Backups</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {backupLogs.filter(b => b.status === 'completed').length}
                    </div>
                    <p className="text-sm text-muted-foreground">Bem-sucedidos</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {backupLogs.length > 0 ? formatFileSize(
                        backupLogs
                          .filter(b => b.file_size_bytes)
                          .reduce((sum, b) => sum + (b.file_size_bytes || 0), 0)
                      ) : '0 B'}
                    </div>
                    <p className="text-sm text-muted-foreground">Espaço Total</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Próximo Backup Programado */}
            <Alert>
              <Calendar className="h-4 w-4" />
              <AlertDescription>
                Backup automático configurado para executar diariamente às 02:00.
                Próximo backup programado: {new Date(Date.now() + 24*60*60*1000).toLocaleDateString('pt-BR')} às 02:00.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="create" className="space-y-4">
            <Alert>
              <Play className="h-4 w-4" />
              <AlertDescription>
                Configure e execute backups manuais do sistema. Backups automáticos são executados diariamente.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="backup-type">Tipo de Backup</Label>
                <Select value={backupType} onValueChange={(value: any) => setBackupType(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Completo - Todos os dados</SelectItem>
                    <SelectItem value="incremental">Incremental - Apenas alterações</SelectItem>
                    <SelectItem value="differential">Diferencial - Desde o último completo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tabelas a Incluir (deixe vazio para todas)</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {availableTables.map((table) => (
                    <div key={table} className="flex items-center space-x-2">
                      <Checkbox
                        id={`table-${table}`}
                        checked={selectedTables.includes(table)}
                        onCheckedChange={(checked) => handleTableSelection(table, !!checked)}
                      />
                      <Label htmlFor={`table-${table}`} className="text-sm">
                        {table}
                      </Label>
                    </div>
                  ))}
                </div>
                {selectedTables.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {selectedTables.length} tabelas selecionadas
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="schedule-time">Agendamento (opcional)</Label>
                <Input
                  id="schedule-time"
                  type="datetime-local"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Deixe vazio para executar imediatamente
                </p>
              </div>

              <Button onClick={startBackup} disabled={processing} className="w-full">
                <Play className="h-4 w-4 mr-2" />
                {processing ? 'Iniciando Backup...' : `Iniciar Backup ${backupType}`}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Histórico de Backups</h4>
              <Button variant="outline" size="sm" onClick={loadBackupLogs}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-8">Carregando histórico...</div>
            ) : backupLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum backup encontrado
              </div>
            ) : (
              <div className="space-y-4">
                {backupLogs.map((backup) => (
                  <div key={backup.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(backup.status)}
                        <div>
                          <h5 className="font-semibold">
                            Backup {backup.backup_type}
                          </h5>
                          <p className="text-sm text-muted-foreground">
                            {new Date(backup.start_time).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(backup.status)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <Label className="text-xs text-muted-foreground">Duração</Label>
                        <p>{formatDuration(backup.start_time, backup.end_time)}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Tamanho</Label>
                        <p>{formatFileSize(backup.file_size_bytes)}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Localização</Label>
                        <p className="truncate">{backup.backup_location || 'N/A'}</p>
                      </div>
                    </div>

                    {backup.error_message && (
                      <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
                        <p className="text-sm text-red-600">{backup.error_message}</p>
                      </div>
                    )}

                    {backup.checksum && (
                      <div className="mt-2">
                        <Label className="text-xs text-muted-foreground">Checksum</Label>
                        <p className="font-mono text-xs break-all">{backup.checksum}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="recovery" className="space-y-4">
            <Alert>
              <Download className="h-4 w-4" />
              <AlertDescription>
                Funcionalidades de recuperação de dados em desenvolvimento. 
                Para restaurar dados, entre em contato com o suporte técnico.
              </AlertDescription>
            </Alert>

            <div className="border rounded-lg p-4">
              <h4 className="font-semibold mb-2">Plano de Disaster Recovery</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Backups diários automáticos às 02:00</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Retenção de 30 dias para backups completos</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Verificação de integridade com checksums</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <span>RTO (Recovery Time Objective): 4 horas</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <span>RPO (Recovery Point Objective): 24 horas</span>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}