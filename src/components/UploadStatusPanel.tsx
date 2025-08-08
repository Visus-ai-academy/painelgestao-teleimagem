import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, AlertCircle, Calendar as CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    fetchUploadStats();
  }, [refreshTrigger, selectedDate]);

  const fetchUploadStats = async () => {
    try {
      // Calcular início e fim do mês selecionado
      const baseDate = selectedDate || new Date();
      const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
      const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0, 23, 59, 59, 999);

      // Buscar uploads de cadastros (excluir tipos específicos de volumetria e limpeza)
      const { data, error } = await supabase
        .from('processamento_uploads')
        .select('*')
        .not('tipo_arquivo', 'in', '(data_laudo,data_exame,volumetria_padrao,volumetria_fora_padrao,volumetria_padrao_retroativo,volumetria_fora_padrao_retroativo,limpeza)')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filtrar apenas uploads de cadastros válidos
      const validCadastroTypes = [
        'cadastro_exames', 'quebra_exames', 'precos_servicos', 
        'regras_exclusao', 'repasse_medico', 'modalidades', 
        'especialidades', 'categorias_exame', 'prioridades'
      ];

      const filteredData = (data || []).filter(upload => 
        validCadastroTypes.includes(upload.tipo_arquivo)
      );

      // Filtrar apenas o upload mais recente de cada tipo de arquivo
      const latestUploads = new Map<string, UploadStats>();
      
      filteredData.forEach(upload => {
        const currentLatest = latestUploads.get(upload.tipo_arquivo);
        if (!currentLatest || new Date(upload.created_at) > new Date(currentLatest.created_at)) {
          latestUploads.set(upload.tipo_arquivo, upload);
        }
      });

      // Ordenar os uploads conforme a ordem das abas em Gerenciar Cadastros
      const orderedTypes = ['cadastro_exames', 'quebra_exames', 'precos_servicos', 'regras_exclusao', 'repasse_medico', 'modalidades', 'especialidades', 'categorias_exame', 'prioridades'];
      
      const sortedData = Array.from(latestUploads.values()).sort((a, b) => {
        const indexA = orderedTypes.indexOf(a.tipo_arquivo);
        const indexB = orderedTypes.indexOf(b.tipo_arquivo);
        
        // Se não está na lista ordenada, vai para o final
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        
        // Ordenar pela ordem das abas
        return indexA - indexB;
      });
      
      setUploadStats(sortedData);
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
      'repasse_medico': 'Repasse Médico',
      'modalidades': 'Modalidades',
      'especialidades': 'Especialidades',
      'categorias_exame': 'Categorias de Exame',
      'categorias': 'Categorias de Exame', // Alternativa
      'prioridades': 'Prioridades'
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
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <CardTitle>Status dos Uploads Recentes</CardTitle>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-start min-w-[220px]">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate
                ? selectedDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
                : 'Período de referência'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </CardHeader>
      <CardContent>
        {uploadStats.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            Nenhum upload realizado ainda
          </div>
        ) : (
          <div className="space-y-2">
            {uploadStats.map((stat, index) => (
              <div
                key={`${stat.tipo_arquivo}-${stat.created_at}-${index}`}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {getStatusIcon(stat.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{getTypeLabel(stat.tipo_arquivo)}</span>
                      <Badge className={`${getStatusColor(stat.status)} text-xs`}>
                        {stat.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {stat.arquivo_nome} • {new Date(stat.created_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-3 text-xs">
                  <div className="text-center">
                    <div className="font-medium text-blue-600">{stat.registros_processados}</div>
                    <div className="text-muted-foreground">Proc.</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-green-600">{stat.registros_inseridos}</div>
                    <div className="text-muted-foreground">Ins.</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-orange-600">{stat.registros_atualizados}</div>
                    <div className="text-muted-foreground">Atual.</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-red-600">{stat.registros_erro}</div>
                    <div className="text-muted-foreground">Erro</div>
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