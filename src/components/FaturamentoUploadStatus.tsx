import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, AlertCircle, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface UploadStats {
  tipo_arquivo: string;
  arquivo_nome: string;
  status: string;
  registros_processados: number;
  registros_inseridos: number;
  registros_atualizados: number;
  registros_erro: number;
  total_exames: number;
  zerados?: number;
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
      setLoading(true);
      console.log('Iniciando busca de estatísticas de upload...');

      // Buscar uploads da tabela processamento_uploads - apenas tipos não-volumetria
      const { data, error } = await supabase
        .from('processamento_uploads')
        .select('*')
        .not('tipo_arquivo', 'in', '(volumetria_padrao,volumetria_fora_padrao,volumetria_padrao_retroativo,volumetria_fora_padrao_retroativo,volumetria_onco_padrao)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar uploads:', error);
        throw error;
      }

      console.log('Dados de upload encontrados:', data?.length || 0);

      // Processar apenas os tipos de faturamento mais recentes
      const latestUploads = new Map<string, UploadStats>();
      
      // Processar uploads existentes na tabela processamento_uploads
      (data || []).forEach(upload => {
        const currentLatest = latestUploads.get(upload.tipo_arquivo);
        if (!currentLatest || new Date(upload.created_at) > new Date(currentLatest.created_at)) {
          latestUploads.set(upload.tipo_arquivo, {
            ...upload,
            total_exames: upload.registros_inseridos
          });
        }
      });

      // Buscar dados de volumetria APENAS se houver uploads reais
      const tiposVolumetria = [
        'volumetria_padrao', 
        'volumetria_fora_padrao', 
        'volumetria_padrao_retroativo', 
        'volumetria_fora_padrao_retroativo',
        'volumetria_onco_padrao'
      ];

      console.log('Verificando uploads de volumetria...');

      // Primeiro verificar se há uploads reais de volumetria
      const { data: uploadsVolumetria, error: uploadsError } = await supabase
        .from('processamento_uploads')
        .select('tipo_arquivo, created_at, arquivo_nome, status, registros_processados, registros_inseridos, registros_atualizados, registros_erro')
        .in('tipo_arquivo', tiposVolumetria)
        .order('created_at', { ascending: false });

      if (uploadsError) {
        console.error('Erro ao buscar uploads de volumetria:', uploadsError);
      }

      // Só processar dados de volumetria se houver uploads reais
      if (uploadsVolumetria && uploadsVolumetria.length > 0) {
        console.log('Encontrados uploads de volumetria:', uploadsVolumetria.length);
        
        // Processar uploads de volumetria
        const volumetriaLatest = new Map<string, any>();
        
        uploadsVolumetria.forEach(upload => {
          const current = volumetriaLatest.get(upload.tipo_arquivo);
          if (!current || new Date(upload.created_at) > new Date(current.created_at)) {
            volumetriaLatest.set(upload.tipo_arquivo, upload);
          }
        });

        // Para cada tipo com upload, buscar dados da tabela volumetria_mobilemed
        for (const [tipo, uploadInfo] of volumetriaLatest) {
          try {
            const { data: dadosCompletos, error: dadosError } = await supabase
              .from('volumetria_mobilemed')
              .select('created_at, "VALORES"')
              .eq('arquivo_fonte', tipo);

            if (!dadosError && dadosCompletos && dadosCompletos.length > 0) {
              const registros = dadosCompletos.length;
              const exames = dadosCompletos.reduce((sum, item) => sum + (Number(item.VALORES) || 0), 0);
              const zerados = dadosCompletos.filter(item => !item.VALORES || Number(item.VALORES) === 0).length;
              const comValor = dadosCompletos.filter(item => item.VALORES && Number(item.VALORES) > 0).length;

              latestUploads.set(tipo, {
                tipo_arquivo: tipo,
                arquivo_nome: uploadInfo.arquivo_nome || `Upload ${tipo}`,
                status: uploadInfo.status || 'concluido',
                registros_processados: registros,
                registros_inseridos: comValor,
                registros_atualizados: uploadInfo.registros_atualizados || 0,
                registros_erro: uploadInfo.registros_erro || 0,
                total_exames: exames,
                zerados,
                created_at: uploadInfo.created_at
              });

              console.log(`${tipo}: ${registros} registros, ${exames} exames, ${zerados} zerados`);
            }
          } catch (error) {
            console.error(`Erro ao processar dados de ${tipo}:`, error);
          }
        }
      } else {
        console.log('Nenhum upload de volumetria encontrado');
      }

      // Converter para array e ordenar
      const statsArray = Array.from(latestUploads.values());
      
      // Ordem desejada
      const tipoOrdem = [
        'faturamento',
        'clientes',
        'contratos',
        'volumetria_padrao',
        'volumetria_fora_padrao',
        'volumetria_padrao_retroativo',
        'volumetria_fora_padrao_retroativo',
        'volumetria_onco_padrao'
      ];

      statsArray.sort((a, b) => {
        const indexA = tipoOrdem.indexOf(a.tipo_arquivo);
        const indexB = tipoOrdem.indexOf(b.tipo_arquivo);
        
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        
        return indexA - indexB;
      });

      console.log('Estatísticas finais:', statsArray.length);
      setUploadStats(statsArray);

    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
      setUploadStats([]);
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
      'faturamento': 'Faturamento',
      'clientes': 'Clientes', 
      'contratos': 'Contratos',
      'volumetria_padrao': 'Volumetria Padrão',
      'volumetria_fora_padrao': 'Volumetria Fora do Padrão',
      'volumetria_padrao_retroativo': 'Volumetria Padrão Retroativa',
      'volumetria_fora_padrao_retroativo': 'Volumetria Fora Padrão Retroativa',
      'volumetria_onco_padrao': 'Volumetria Onco Padrão'
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

  // Calcular totais para volumetria
  const volumetriaStats = uploadStats.filter(stat => stat.tipo_arquivo.startsWith('volumetria_'));
  const totalVolumetriaRegistros = volumetriaStats.reduce((sum, stat) => sum + stat.registros_processados, 0);
  const totalVolumetriaExames = volumetriaStats.reduce((sum, stat) => sum + stat.total_exames, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status dos Uploads de Faturamento</CardTitle>
      </CardHeader>
      <CardContent>
        {uploadStats.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Nenhum upload de faturamento realizado ainda</p>
            <p className="text-sm">Faça upload dos seus dados para ver o status aqui</p>
          </div>
        ) : (
          <div className="space-y-4">
            {uploadStats.map((stat, index) => (
              <div
                key={`${stat.tipo_arquivo}-${index}`}
                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(stat.status)}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{getTypeLabel(stat.tipo_arquivo)}</h3>
                        <Badge className={`${getStatusColor(stat.status)} text-xs`}>
                          {stat.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {stat.arquivo_nome} • {new Date(stat.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-600">{stat.registros_processados}</div>
                    <div className="text-muted-foreground">Registros</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">{stat.total_exames}</div>
                    <div className="text-muted-foreground">Exames</div>
                  </div>
                  {stat.zerados !== undefined && stat.zerados > 0 && (
                    <div className="text-center">
                      <div className="text-lg font-bold text-orange-600">{stat.zerados}</div>
                      <div className="text-muted-foreground">Zerados</div>
                    </div>
                  )}
                  {stat.registros_erro > 0 && (
                    <div className="text-center">
                      <div className="text-lg font-bold text-red-600">{stat.registros_erro}</div>
                      <div className="text-muted-foreground">Erros</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Total de Volumetria */}
            {volumetriaStats.length > 0 && (
              <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
                <h3 className="font-semibold text-primary mb-3">Total Volumetria</h3>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-primary">{totalVolumetriaRegistros.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Total Registros</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-primary">{totalVolumetriaExames.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Total Exames</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}