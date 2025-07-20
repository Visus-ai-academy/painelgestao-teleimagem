import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, Search, Filter, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DataAccessLog {
  id: string;
  user_email: string;
  resource_type: string;
  resource_id: string;
  action: string;
  timestamp: string;
  sensitive_data_accessed: boolean;
  data_classification: string;
}

export function DataAccessLogsPanel() {
  const [logs, setLogs] = useState<DataAccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [classificationFilter, setClassificationFilter] = useState('all');
  const [sensitiveOnly, setSensitiveOnly] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadDataAccessLogs();
  }, []);

  const loadDataAccessLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('data_access_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar logs de acesso:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar logs de acesso a dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resource_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.resource_id && log.resource_id.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesClassification = classificationFilter === 'all' || log.data_classification === classificationFilter;
    const matchesSensitive = !sensitiveOnly || log.sensitive_data_accessed;
    
    return matchesSearch && matchesClassification && matchesSensitive;
  });

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'restricted': return 'bg-red-500';
      case 'confidential': return 'bg-orange-500';
      case 'internal': return 'bg-yellow-500';
      case 'public': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getClassificationVariant = (classification: string) => {
    switch (classification) {
      case 'restricted': return 'destructive';
      case 'confidential': return 'destructive';
      case 'internal': return 'secondary';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Logs de Acesso a Dados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Carregando logs...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Logs de Acesso a Dados
        </CardTitle>
        <CardDescription>
          Monitoramento de acesso a informações sensíveis
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por usuário, recurso ou ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={classificationFilter} onValueChange={setClassificationFilter}>
            <SelectTrigger className="w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Classificação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as classificações</SelectItem>
              <SelectItem value="public">Público</SelectItem>
              <SelectItem value="internal">Interno</SelectItem>
              <SelectItem value="confidential">Confidencial</SelectItem>
              <SelectItem value="restricted">Restrito</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sensitiveOnly ? 'true' : 'false'} onValueChange={(value) => setSensitiveOnly(value === 'true')}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Tipo de dado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="false">Todos os dados</SelectItem>
              <SelectItem value="true">Apenas sensíveis</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lista de Logs */}
        <div className="space-y-4">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {logs.length === 0 ? 'Nenhum log de acesso encontrado' : 'Nenhum log corresponde aos filtros'}
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className={`border rounded-lg p-4 space-y-3 ${
                  log.sensitive_data_accessed ? 'border-orange-200 bg-orange-50/50' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {log.sensitive_data_accessed && (
                      <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{log.resource_type}</h4>
                        <Badge variant={getClassificationVariant(log.data_classification)}>
                          {log.data_classification.toUpperCase()}
                        </Badge>
                        {log.sensitive_data_accessed && (
                          <Badge variant="destructive">
                            SENSÍVEL
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Usuário: {log.user_email}</span>
                        <span>Ação: {log.action}</span>
                        {log.resource_id && (
                          <span>ID: {log.resource_id}</span>
                        )}
                        <span>{new Date(log.timestamp).toLocaleString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {log.sensitive_data_accessed && (
                  <div className="bg-orange-100 border border-orange-200 rounded p-3">
                    <div className="flex items-center gap-2 text-orange-800">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm font-medium">Acesso a Dados Sensíveis Detectado</span>
                    </div>
                    <p className="text-sm text-orange-700 mt-1">
                      Este acesso foi registrado para auditoria e compliance com LGPD.
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}