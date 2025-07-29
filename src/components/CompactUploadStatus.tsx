import { useEffect, useState } from 'react';
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

interface CompactUploadStatusProps {
  fileType: string;
  refreshTrigger?: number;
}

export function CompactUploadStatus({ fileType, refreshTrigger }: CompactUploadStatusProps) {
  const [uploadStat, setUploadStat] = useState<UploadStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUploadStat();
  }, [refreshTrigger, fileType]);

  const fetchUploadStat = async () => {
    try {
      const { data, error } = await supabase
        .from('processamento_uploads')
        .select('*')
        .eq('tipo_arquivo', fileType)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Erro ao buscar estatística:', error);
      }

      // Se não há dados no log, buscar informações da tabela correspondente
      if (!data || data.length === 0) {
        await fetchTableStats();
        return;
      }

      setUploadStat(data[0]);
    } catch (error) {
      console.error('Erro ao buscar estatística:', error);
      await fetchTableStats();
    } finally {
      setLoading(false);
    }
  };

  // Buscar estatísticas diretamente das tabelas quando não há log
  const fetchTableStats = async () => {
    try {
      let count = 0;
      let lastCreated = '';

      switch (fileType) {
        case 'modalidades': {
          const { count: modalidadesCount } = await supabase.from('modalidades').select('*', { count: 'exact', head: true });
          const { data: lastRecord } = await supabase.from('modalidades').select('created_at').order('created_at', { ascending: false }).limit(1);
          count = modalidadesCount || 0;
          lastCreated = lastRecord?.[0]?.created_at || new Date().toISOString();
          break;
        }
        case 'especialidades': {
          const { count: especialidadesCount } = await supabase.from('especialidades').select('*', { count: 'exact', head: true });
          const { data: lastRecord } = await supabase.from('especialidades').select('created_at').order('created_at', { ascending: false }).limit(1);
          count = especialidadesCount || 0;
          lastCreated = lastRecord?.[0]?.created_at || new Date().toISOString();
          break;
        }
        case 'categorias_exame': {
          const { count: categoriasCount } = await supabase.from('categorias_exame').select('*', { count: 'exact', head: true });
          const { data: lastRecord } = await supabase.from('categorias_exame').select('created_at').order('created_at', { ascending: false }).limit(1);
          count = categoriasCount || 0;
          lastCreated = lastRecord?.[0]?.created_at || new Date().toISOString();
          break;
        }
        case 'prioridades': {
          const { count: prioridadesCount } = await supabase.from('prioridades').select('*', { count: 'exact', head: true });
          const { data: lastRecord } = await supabase.from('prioridades').select('created_at').order('created_at', { ascending: false }).limit(1);
          count = prioridadesCount || 0;
          lastCreated = lastRecord?.[0]?.created_at || new Date().toISOString();
          break;
        }
        default: 
          setUploadStat(null);
          return;
      }

      if (count > 0) {
        // Criar um status simulado baseado nos dados da tabela
        setUploadStat({
          tipo_arquivo: fileType,
          arquivo_nome: 'Upload anterior (dados existentes)',
          status: 'concluido',
          registros_processados: count,
          registros_inseridos: count,
          registros_atualizados: 0,
          registros_erro: 0,
          created_at: lastCreated
        });
      } else {
        setUploadStat(null);
      }
      
    } catch (error) {
      console.error('Erro ao buscar dados da tabela:', error);
      setUploadStat(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'concluido':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'erro':
        return <XCircle className="h-3 w-3 text-red-500" />;
      case 'processando':
        return <Clock className="h-3 w-3 text-yellow-500" />;
      default:
        return <AlertCircle className="h-3 w-3 text-gray-500" />;
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

  if (loading) {
    return (
      <div className="text-xs text-muted-foreground">
        Carregando status...
      </div>
    );
  }

  if (!uploadStat) {
    return (
      <div className="text-xs text-muted-foreground">
        Nenhum upload realizado
      </div>
    );
  }

  return (
    <div className="space-y-2 mt-4 p-3 bg-muted/30 rounded-lg border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon(uploadStat.status)}
          <span className="text-sm font-medium">Último Upload</span>
          <Badge className={`text-xs ${getStatusColor(uploadStat.status)}`}>
            {uploadStat.status}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          {new Date(uploadStat.created_at).toLocaleDateString('pt-BR')} {new Date(uploadStat.created_at).toLocaleTimeString('pt-BR')}
        </div>
      </div>
      
      <div className="text-xs text-muted-foreground truncate">
        <strong>Arquivo:</strong> {uploadStat.arquivo_nome}
      </div>
      
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="text-center">
          <div className="font-medium text-blue-600">{uploadStat.registros_processados}</div>
          <div className="text-muted-foreground">Processados</div>
        </div>
        <div className="text-center">
          <div className="font-medium text-green-600">{uploadStat.registros_inseridos}</div>
          <div className="text-muted-foreground">Inseridos</div>
        </div>
        <div className="text-center">
          <div className="font-medium text-orange-600">{uploadStat.registros_atualizados}</div>
          <div className="text-muted-foreground">Atualizados</div>
        </div>
        <div className="text-center">
          <div className="font-medium text-red-600">{uploadStat.registros_erro}</div>
          <div className="text-muted-foreground">Erros</div>
        </div>
      </div>
    </div>
  );
}