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
      console.log('Iniciando busca de estatísticas de upload de faturamento...');

      // Buscar uploads de faturamento e dados financeiros
      const { data: uploadsFaturamento, error: uploadsError } = await supabase
        .from('processamento_uploads')
        .select('tipo_arquivo, created_at, arquivo_nome, status, registros_processados, registros_inseridos, registros_atualizados, registros_erro')
        .in('tipo_arquivo', ['faturamento', 'financeiro', 'dados_legado', 'exames'])
        .order('created_at', { ascending: false });

      if (uploadsError) {
        console.error('Erro ao buscar uploads de faturamento:', uploadsError);
        throw uploadsError;
      }

      console.log('Uploads de faturamento encontrados:', uploadsFaturamento?.length || 0);

      const latestUploads = new Map<string, UploadStats>();

      // Processar uploads de faturamento
      if (uploadsFaturamento && uploadsFaturamento.length > 0) {
        const faturamentoLatest = new Map<string, any>();
        
        uploadsFaturamento.forEach(upload => {
          const current = faturamentoLatest.get(upload.tipo_arquivo);
          if (!current || new Date(upload.created_at) > new Date(current.created_at)) {
            faturamentoLatest.set(upload.tipo_arquivo, upload);
          }
        });

        // Para cada tipo com upload, buscar dados das tabelas correspondentes
        for (const [tipo, uploadInfo] of faturamentoLatest) {
          try {
            let dadosCompletos: any[] = [];
            let tabelaQuery = '';
            
            switch (tipo) {
              case 'faturamento':
                const { data: dadosFaturamento } = await supabase
                  .from('faturamento')
                  .select('valor, quantidade')
                  .limit(10000);
                dadosCompletos = dadosFaturamento || [];
                break;
                
              case 'exames':
                const { data: dadosExames } = await supabase
                  .from('exames')
                  .select('valor_total, quantidade')
                  .limit(10000);
                dadosCompletos = dadosExames || [];
                break;
                
              default:
                // Para outros tipos, usar dados do upload
                dadosCompletos = [];
            }

            if (dadosCompletos.length > 0) {
              const registros = dadosCompletos.length;
              const valores = dadosCompletos.map(item => 
                Number(item.valor || item.valor_total || 0) * Number(item.quantidade || 1)
              );
              const totalExames = valores.reduce((sum, val) => sum + val, 0);
              const zerados = valores.filter(val => val === 0).length;
              const comValor = valores.filter(val => val > 0).length;

              latestUploads.set(tipo, {
                tipo_arquivo: tipo,
                arquivo_nome: uploadInfo.arquivo_nome || `Upload ${tipo}`,
                status: uploadInfo.status || 'concluido',
                registros_processados: registros,
                registros_inseridos: comValor,
                registros_atualizados: uploadInfo.registros_atualizados || 0,
                registros_erro: zerados,
                total_exames: Math.round(totalExames),
                zerados,
                created_at: uploadInfo.created_at
              });

              console.log(`${tipo}: ${registros} registros, R$ ${totalExames.toFixed(2)}, ${zerados} zerados`);
            } else {
              // Se não há dados na tabela, usar dados do upload
              latestUploads.set(tipo, {
                tipo_arquivo: tipo,
                arquivo_nome: uploadInfo.arquivo_nome || `Upload ${tipo}`,
                status: uploadInfo.status || 'concluido',
                registros_processados: uploadInfo.registros_processados || 0,
                registros_inseridos: uploadInfo.registros_inseridos || 0,
                registros_atualizados: uploadInfo.registros_atualizados || 0,
                registros_erro: uploadInfo.registros_erro || 0,
                total_exames: 0,
                zerados: uploadInfo.registros_erro || 0,
                created_at: uploadInfo.created_at
              });
            }
          } catch (error) {
            console.error(`Erro ao processar dados de ${tipo}:`, error);
          }
        }
      }

      // Converter para array e ordenar
      const statsArray = Array.from(latestUploads.values());
      
      // Ordem desejada para dados de faturamento
      const tipoOrdem = [
        'faturamento',
        'financeiro',
        'exames',
        'dados_legado'
      ];

      statsArray.sort((a, b) => {
        const indexA = tipoOrdem.indexOf(a.tipo_arquivo);
        const indexB = tipoOrdem.indexOf(b.tipo_arquivo);
        
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        
        return indexA - indexB;
      });

      console.log('Estatísticas finais de faturamento:', statsArray.length);
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
      'faturamento': 'Dados de Faturamento',
      'financeiro': 'Dados Financeiros',
      'exames': 'Dados de Exames',
      'dados_legado': 'Dados Legado'
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

  // Calcular totais para dados de faturamento
  const totalRegistros = uploadStats.reduce((sum, stat) => sum + stat.registros_processados, 0);
  const totalValor = uploadStats.reduce((sum, stat) => sum + stat.total_exames, 0);
  const totalZerados = uploadStats.reduce((sum, stat) => sum + (stat.zerados || 0), 0);

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
                    <div className="text-lg font-bold text-green-600">R$ {stat.total_exames.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div className="text-muted-foreground">Valor Total</div>
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
            
            {/* Total de Faturamento */}
            {uploadStats.length > 0 && (
              <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
                <h3 className="font-semibold text-primary mb-3">Total Faturamento</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-primary">{totalRegistros.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Total Registros</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-primary">R$ {totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div className="text-sm text-muted-foreground">Valor Total</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-600">{totalZerados.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Zerados</div>
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