import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, AlertCircle, Calendar as CalendarIcon, Zap, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

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

export function VolumetriaStatusPanel({ refreshTrigger }: { refreshTrigger?: number }) {
  const [uploadStats, setUploadStats] = useState<UploadStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    fetchUploadStats();
  }, [refreshTrigger, selectedDate]);

  const fetchUploadStats = async () => {
    try {
      // Limitar pela janela do mês selecionado
      const baseDate = selectedDate || new Date();
      const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
      const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0, 23, 59, 59, 999);

      // Buscar uploads de volumetria/mobilemed
      const { data, error } = await supabase
        .from('processamento_uploads')
        .select('*')
        .in('tipo_arquivo', [
          'volumetria_padrao', 
          'volumetria_fora_padrao', 
          'volumetria_padrao_retroativo', 
          'volumetria_fora_padrao_retroativo',
          'volumetria_onco_padrao'
        ])
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false })
        .limit(100000); // Removida limitação - volumes altos

      if (error) throw error;

      // Ordenar os uploads conforme a ordem dos arquivos
      const orderedTypes = [
        'volumetria_padrao', 
        'volumetria_fora_padrao', 
        'volumetria_padrao_retroativo', 
        'volumetria_fora_padrao_retroativo',
        'volumetria_onco_padrao'
      ];
      
      const sortedData = (data || []).sort((a, b) => {
        const indexA = orderedTypes.indexOf(a.tipo_arquivo);
        const indexB = orderedTypes.indexOf(b.tipo_arquivo);
        
        // Se os tipos são diferentes, ordenar pela ordem dos arquivos
        if (indexA !== indexB) {
          return indexA - indexB;
        }
        
        // Se são do mesmo tipo, ordenar pela data (mais recente primeiro)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
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
      'volumetria_padrao': 'Arquivo 1: Volumetria Padrão',
      'volumetria_fora_padrao': 'Arquivo 2: Volumetria Fora do Padrão',
      'volumetria_padrao_retroativo': 'Arquivo 3: Volumetria Padrão Retroativo',
      'volumetria_fora_padrao_retroativo': 'Arquivo 4: Volumetria Fora do Padrão Retroativo',
      'volumetria_onco_padrao': 'Arquivo 5: Volumetria Onco Padrão'
    };
    return labels[tipo as keyof typeof labels] || tipo;
  };

  const processarDadosPendentes = async () => {
    if (processing) return;
    
    try {
      setProcessing(true);
      toast.loading("Processando dados pendentes...", { id: "processar-pendentes" });

      const { data, error } = await supabase.functions.invoke('processar-dados-pendentes', {
        body: {}
      });

      if (error) {
        throw error;
      }

      toast.success(`Processamento concluído: ${data.totalProcessados} uploads processados`, { 
        id: "processar-pendentes" 
      });
      
      // Atualizar a lista
      await fetchUploadStats();
      
    } catch (error) {
      console.error('Erro ao processar dados pendentes:', error);
      toast.error(`Erro no processamento: ${error.message}`, { 
        id: "processar-pendentes" 
      });
    } finally {
      setProcessing(false);
    }
  };

  // Detectar uploads travados (processando com contadores zerados)
  const uploadsTravados = uploadStats.filter(stat => 
    stat.status === 'processando' && 
    stat.registros_inseridos === 0 && 
    stat.registros_processados === 0
  );

  const temUploadsTravados = uploadsTravados.length > 0;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Status dos Uploads Recentes - Dados MobileMed</CardTitle>
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
        <CardTitle>Status dos Uploads Recentes - Dados MobileMed</CardTitle>
        <div className="flex gap-2">
          {temUploadsTravados && (
            <Button 
              onClick={processarDadosPendentes}
              disabled={processing}
              variant="outline"
              size="sm"
              className="text-orange-600 border-orange-200 hover:bg-orange-50"
            >
              {processing ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4" />
              )}
              {processing ? 'Processando...' : 'Processar Pendentes'}
            </Button>
          )}
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
        </div>
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
                    <div className="text-muted-foreground">Regras</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-amber-600">{stat.registros_erro}</div>
                    <div className="text-muted-foreground">Excl.</div>
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