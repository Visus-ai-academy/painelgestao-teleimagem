import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Search, Trash2, FileText, Clock, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AnaliseRegistros {
  total_sem_data_laudo: number;
  por_arquivo_fonte: Record<string, number>;
  por_cliente: Record<string, number>;
  com_data_realizacao: number;
  sem_data_realizacao: number;
  com_accession_number: number;
  sem_accession_number: number;
  registros_com_pares_com_laudo: number;
  registros_com_pares_sem_laudo: number;
  registros_similares_com_laudo: number;
  detalhes_amostra: any[];
}

interface ResultadoVerificacao {
  sucesso: boolean;
  periodo_referencia: string;
  analise: AnaliseRegistros;
  recomendacoes: string[];
  timestamp: string;
}

export default function VerificarRegistrosSemDataLaudo() {
  const [verificando, setVerificando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [resultado, setResultado] = useState<ResultadoVerificacao | null>(null);
  const [periodoReferencia, setPeriodoReferencia] = useState('');
  const { toast } = useToast();

  const verificarRegistros = async () => {
    setVerificando(true);
    try {
      const { data, error } = await supabase.functions.invoke('verificar-registros-sem-data-laudo', {
        body: { 
          periodo_referencia: periodoReferencia,
          acao: 'verificar'
        }
      });

      if (error) throw error;

      setResultado(data);
      
      if (data.analise.total_sem_data_laudo === 0) {
        toast({
          title: "✅ Verificação concluída",
          description: "Todos os registros possuem DATA_LAUDO válida.",
        });
      } else {
        toast({
          title: "⚠️ Registros sem DATA_LAUDO encontrados",
          description: `${data.analise.total_sem_data_laudo} registros precisam de atenção.`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao verificar registros:', error);
      toast({
        title: "Erro na verificação",
        description: "Falha ao verificar registros sem DATA_LAUDO.",
        variant: "destructive"
      });
    } finally {
      setVerificando(false);
    }
  };

  const excluirRegistros = async () => {
    if (!resultado || resultado.analise.total_sem_data_laudo === 0) return;

    const confirmacao = window.confirm(
      `⚠️ ATENÇÃO: Você está prestes a EXCLUIR ${resultado.analise.total_sem_data_laudo} registros sem DATA_LAUDO do período ${periodoReferencia}.\n\nEsta ação é IRREVERSÍVEL!\n\nDeseja continuar?`
    );

    if (!confirmacao) return;

    setExcluindo(true);
    try {
      const { data, error } = await supabase.functions.invoke('verificar-registros-sem-data-laudo', {
        body: { 
          periodo_referencia: periodoReferencia,
          acao: 'excluir'
        }
      });

      if (error) throw error;

      setResultado(data);
      
      toast({
        title: "✅ Exclusão concluída",
        description: `${resultado.analise.total_sem_data_laudo} registros foram excluídos com sucesso.`,
      });

      // Verificar novamente após exclusão
      setTimeout(() => verificarRegistros(), 1000);
      
    } catch (error) {
      console.error('Erro ao excluir registros:', error);
      toast({
        title: "Erro na exclusão",
        description: "Falha ao excluir registros sem DATA_LAUDO.",
        variant: "destructive"
      });
    } finally {
      setExcluindo(false);  
    }
  };

  const renderResumoAnalise = () => {
    if (!resultado) return null;

    const { analise } = resultado;

    return (
      <div className="space-y-4">
        {/* Cards de métricas principais */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-sm font-medium">Sem DATA_LAUDO</p>
                  <p className="text-2xl font-bold text-red-600">{analise.total_sem_data_laudo}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">Com DATA_REALIZACAO</p>
                  <p className="text-2xl font-bold text-blue-600">{analise.com_data_realizacao}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium">Com ACCESSION</p>
                  <p className="text-2xl font-bold text-green-600">{analise.com_accession_number}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Análise de duplicatas */}
        {(analise.registros_com_pares_com_laudo > 0 || analise.registros_similares_com_laudo > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Análise de Duplicatas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {analise.registros_com_pares_com_laudo > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm">Registros com pares válidos:</span>
                  <Badge variant="secondary">{analise.registros_com_pares_com_laudo}</Badge>
                </div>
              )}
              {analise.registros_similares_com_laudo > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm">Registros similares com laudo:</span>
                  <Badge variant="secondary">{analise.registros_similares_com_laudo}</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Distribuição por arquivo fonte */}
        {Object.keys(analise.por_arquivo_fonte).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Por Arquivo Fonte</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(analise.por_arquivo_fonte).map(([arquivo, quantidade]) => (
                  <div key={arquivo} className="flex justify-between">
                    <span className="text-sm">{arquivo}</span>
                    <Badge variant="outline">{quantidade}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Distribuição por cliente (top 10) */}
        {Object.keys(analise.por_cliente).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center">
                <Users className="h-4 w-4 mr-2" />
                Por Cliente (Top 10)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(analise.por_cliente)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 10)
                  .map(([cliente, quantidade]) => (
                    <div key={cliente} className="flex justify-between">
                      <span className="text-sm truncate">{cliente}</span>
                      <Badge variant="outline">{quantidade}</Badge>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Amostra de registros */}
        {analise.detalhes_amostra.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Amostra dos Registros (10 primeiros)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {analise.detalhes_amostra.map((registro, index) => (
                  <div key={index} className="p-2 border rounded text-xs space-y-1">
                    <div><strong>Cliente:</strong> {registro.empresa}</div>
                    <div><strong>Paciente:</strong> {registro.paciente}</div>
                    <div><strong>Exame:</strong> {registro.exame}</div>
                    <div><strong>Accession:</strong> {registro.accession || 'N/A'}</div>
                    <div><strong>Data Realização:</strong> {registro.data_realizacao || 'N/A'}</div>
                    <div><strong>Arquivo:</strong> {registro.arquivo_fonte}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Search className="h-5 w-5 mr-2" />
          Verificar Registros sem DATA_LAUDO
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Identifica e permite corrigir registros que aparecem no comparativo sem data de laudo válida.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controles */}
        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <label className="text-sm font-medium">Período de Referência:</label>
            <select 
              value={periodoReferencia}
              onChange={(e) => setPeriodoReferencia(e.target.value)}
              className="ml-2 border rounded px-2 py-1"
            >
              <option value="">Selecione o período</option>
              <option value="10/2025">Outubro/2025</option>
              <option value="11/2025">Novembro/2025</option>
              <option value="12/2025">Dezembro/2025</option>
              <option value="09/2025">Setembro/2025</option>
              <option value="08/2025">Agosto/2025</option>
              <option value="07/2025">Julho/2025</option>
              <option value="06/2025">Junho/2025</option>
              <option value="05/2025">Maio/2025</option>
              <option value="04/2025">Abril/2025</option>
              <option value="03/2025">Março/2025</option>
            </select>
          </div>
          
          <Button 
            onClick={verificarRegistros}
            disabled={verificando}
            className="flex items-center"
          >
            <Search className="h-4 w-4 mr-2" />
            {verificando ? 'Verificando...' : 'Verificar'}
          </Button>
        </div>

        <Separator />

        {/* Recomendações */}
        {resultado && resultado.recomendacoes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recomendações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {resultado.recomendacoes.map((recomendacao, index) => (
                  <div key={index} className="text-sm p-2 bg-blue-50 rounded">
                    {recomendacao}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resumo da análise */}
        {renderResumoAnalise()}

        {/* Ação de exclusão */}
        {resultado && resultado.analise.total_sem_data_laudo > 0 && (
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-sm text-red-600 flex items-center">
                <Trash2 className="h-4 w-4 mr-2" />
                Ação Corretiva
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Os registros sem DATA_LAUDO identificados podem ser excluídos do sistema, 
                pois exames sem data de laudo não são válidos para faturamento e análises.
              </p>
              <Button 
                onClick={excluirRegistros}
                disabled={excluindo}
                variant="destructive"
                className="flex items-center"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {excluindo ? 'Excluindo...' : `Excluir ${resultado.analise.total_sem_data_laudo} registros`}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Informações de última verificação */}
        {resultado && (
          <div className="text-xs text-muted-foreground">
            Última verificação: {new Date(resultado.timestamp).toLocaleString('pt-BR')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}