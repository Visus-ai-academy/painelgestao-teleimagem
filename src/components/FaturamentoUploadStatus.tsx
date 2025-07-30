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

export function FaturamentoUploadStatus({ refreshTrigger }: { refreshTrigger?: number }) {
  const [uploadStats, setUploadStats] = useState<UploadStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUploadStats();
  }, [refreshTrigger]);

  const fetchUploadStats = async () => {
    try {
      // Buscar apenas uploads específicos do faturamento (excluindo cadastros da página base)
      // Filtra EXCLUINDO os tipos da página "Cadastros Base - Cadastros"
      const { data, error } = await supabase
        .from('processamento_uploads')
        .select('*')
        .not('tipo_arquivo', 'in', '(cadastro_exames,categorias_exame,especialidades,modalidades,prioridades,quebra_exames,limpeza)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filtrar apenas o upload mais recente de cada tipo de arquivo
      const latestUploads = new Map<string, UploadStats>();
      
      (data || []).forEach(upload => {
        const currentLatest = latestUploads.get(upload.tipo_arquivo);
        if (!currentLatest || new Date(upload.created_at) > new Date(currentLatest.created_at)) {
          latestUploads.set(upload.tipo_arquivo, upload);
        }
      });

      // Se não há dados de processamento_uploads, buscar diretamente da volumetria_mobilemed
      if (latestUploads.size === 0) {
        const { data: volumetriaData, error: volumetriaError } = await supabase
          .from('volumetria_mobilemed')
          .select('arquivo_fonte, created_at')
          .order('created_at', { ascending: false })
          .limit(1000); // Limitar para evitar carregar muitos dados

        if (volumetriaError) throw volumetriaError;

        // Agrupar por arquivo_fonte e pegar o mais recente de cada tipo
        const volumetriaMap = new Map<string, any>();
        
        (volumetriaData || []).forEach(item => {
          const currentLatest = volumetriaMap.get(item.arquivo_fonte);
          if (!currentLatest || new Date(item.created_at) > new Date(currentLatest.created_at)) {
            volumetriaMap.set(item.arquivo_fonte, item);
          }
        });

        // Contar registros e somar valores por arquivo_fonte
        for (const [arquivo_fonte, latestItem] of volumetriaMap.entries()) {
          const { data: statsData, error: statsError } = await supabase
            .from('volumetria_mobilemed')
            .select('arquivo_fonte')
            .eq('arquivo_fonte', arquivo_fonte);
          
          const { data: sumData, error: sumError } = await supabase
            .rpc('get_volumetria_stats', { 
              p_empresa: null, 
              p_data_inicio: null, 
              p_data_fim: null 
            });

          if (!statsError && !sumError && statsData && sumData) {
            // Contar registros especificamente para este arquivo_fonte
            const totalRegistros = statsData.length;
            
            // Somar valores especificamente para este arquivo_fonte
            const { data: valorData, error: valorError } = await supabase
              .from('volumetria_mobilemed')
              .select('"VALORES"')
              .eq('arquivo_fonte', arquivo_fonte);
            
            const totalExames = valorData?.reduce((sum, item) => sum + (item.VALORES || 0), 0) || 0;

            const uploadStat: UploadStats = {
              tipo_arquivo: arquivo_fonte,
              arquivo_nome: `Upload ${arquivo_fonte}`,
              status: 'concluido',
              registros_processados: totalRegistros,
              registros_inseridos: totalExames, // Agora mostra o total de exames (soma dos valores)
              registros_atualizados: 0,
              registros_erro: 0,
              created_at: latestItem.created_at
            };
            latestUploads.set(arquivo_fonte, uploadStat);
          }
        }
      }

      // Ordenar os uploads conforme a ordem na página de faturamento
      const orderedTypes = [
        'volumetria_padrao', 
        'volumetria_fora_padrao', 
        'volumetria_padrao_retroativo', 
        'volumetria_fora_padrao_retroativo',
        'volumetria_onco_padrao',
        'faturamento',
        'faturamento_pdf'
      ];
      
      const sortedData = Array.from(latestUploads.values()).sort((a, b) => {
        const indexA = orderedTypes.indexOf(a.tipo_arquivo);
        const indexB = orderedTypes.indexOf(b.tipo_arquivo);
        
        // Se não encontrou na lista ordenada, colocar no final
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        
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
      'volumetria_padrao': 'Volumetria Padrão',
      'volumetria_fora_padrao': 'Volumetria Fora do Padrão',
      'volumetria_padrao_retroativo': 'Volumetria Padrão Retroativa',
      'volumetria_fora_padrao_retroativo': 'Volumetria Fora Padrão Retroativa',
      'volumetria_onco_padrao': 'Volumetria Oncológica',
      'faturamento': 'Dados de Faturamento',
      'faturamento_pdf': 'Faturamento PDF'
    };
    return labels[tipo as keyof typeof labels] || tipo;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Status dos Uploads de Faturamento</CardTitle>
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
        <CardTitle>Status dos Uploads de Faturamento</CardTitle>
      </CardHeader>
      <CardContent>
        {uploadStats.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            Nenhum upload de faturamento realizado ainda
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
                    <div className="text-muted-foreground">Registros</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-green-600">{stat.registros_inseridos}</div>
                    <div className="text-muted-foreground">Exames</div>
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