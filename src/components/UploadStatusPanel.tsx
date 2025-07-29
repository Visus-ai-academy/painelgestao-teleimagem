import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface UploadStats {
  tipo_arquivo: string;
  arquivo_nome: string;
  status: string;
  registros_processados: number;
  registros_inseridos: number;
  registros_atualizados: number;
  registros_erro: number;
  created_at: string;
}

export function UploadStatusPanel({ refreshTrigger }: { refreshTrigger?: number }) {
  const [uploadStats, setUploadStats] = useState<UploadStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUploadStats();
  }, [refreshTrigger]);

  const fetchUploadStats = async () => {
    try {
      // Buscar os uploads mais recentes por tipo
      const { data, error } = await supabase
        .from('processamento_uploads')
        .select('*')
        .in('tipo_arquivo', ['cadastro_exames', 'quebra_exames', 'precos_servicos', 'regras_exclusao', 'repasse_medico'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Agrupar por tipo e pegar o mais recente de cada
      const latestByType = data.reduce((acc: Record<string, UploadStats>, current: UploadStats) => {
        if (!acc[current.tipo_arquivo] || new Date(current.created_at) > new Date(acc[current.tipo_arquivo].created_at)) {
          acc[current.tipo_arquivo] = current;
        }
        return acc;
      }, {});

      setUploadStats(Object.values(latestByType));
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'concluido':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'erro':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processando':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'concluido':
        return 'bg-green-100 text-green-800';
      case 'erro':
        return 'bg-red-100 text-red-800';
      case 'processando':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeLabel = (tipo: string) => {
    const labels = {
      'cadastro_exames': 'Cadastro de Exames',
      'quebra_exames': 'Quebra de Exames',
      'precos_servicos': 'Preços de Serviços',
      'regras_exclusao': 'Regras de Exclusão',
      'repasse_medico': 'Repasse Médico'
    };
    return labels[tipo as keyof typeof labels] || tipo;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Status dos Uploads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">Carregando...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status dos Uploads Recentes</CardTitle>
      </CardHeader>
      <CardContent>
        {uploadStats.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            Nenhum upload realizado ainda
          </div>
        ) : (
          <div className="space-y-4">
            {uploadStats.map((stat) => (
              <div
                key={stat.tipo_arquivo}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(stat.status)}
                    <span className="font-medium">{getTypeLabel(stat.tipo_arquivo)}</span>
                    <Badge className={getStatusColor(stat.status)}>
                      {stat.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {stat.arquivo_nome} • {new Date(stat.created_at).toLocaleString('pt-BR')}
                  </div>
                </div>
                
                <div className="flex gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-medium text-blue-600">{stat.registros_processados}</div>
                    <div className="text-muted-foreground">Processados</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-green-600">{stat.registros_inseridos}</div>
                    <div className="text-muted-foreground">Inseridos</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-orange-600">{stat.registros_atualizados}</div>
                    <div className="text-muted-foreground">Atualizados</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-red-600">{stat.registros_erro}</div>
                    <div className="text-muted-foreground">Erros</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}