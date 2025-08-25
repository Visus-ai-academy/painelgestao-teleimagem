import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { useMonitoramentoExclusoes } from '@/hooks/useMonitoramentoExclusoes';
import { 
  AlertTriangle, 
  Download, 
  RefreshCw, 
  TrendingUp, 
  FileX, 
  Clock, 
  Filter,
  CheckCircle
} from 'lucide-react';

interface MonitoramentoExclusoesProps {
  loteUpload?: string;
  titulo?: string;
}

export function MonitoramentoExclusoes({ loteUpload, titulo = "Monitoramento de Exclusões" }: MonitoramentoExclusoesProps) {
  const { status, loading, atualizarStatus, exportarExclusoes } = useMonitoramentoExclusoes(loteUpload);
  const [filtroMotivo, setFiltroMotivo] = useState('');

  // Filtrar registros por motivo
  const registrosFiltrados = status.registros_recentes.filter(registro =>
    !filtroMotivo || registro.motivo_rejeicao?.toLowerCase().includes(filtroMotivo.toLowerCase())
  );

  // Formatador de motivos de exclusão para exibição amigável
  const formatarMotivo = (motivo: string) => {
    const mapeamento: { [key: string]: { label: string; color: string } } = {
      'v002_REALIZACAO_PERIODO_ATUAL': { 
        label: 'v002: Data Realização no Período Atual', 
        color: 'destructive' 
      },
      'v003_LAUDO_FORA_JANELA_FATURAMENTO': { 
        label: 'v003: Data Laudo Fora da Janela', 
        color: 'destructive' 
      },
      'v031_LAUDO_APOS_LIMITE': { 
        label: 'v031: Data Laudo Após Limite', 
        color: 'destructive' 
      },
      'QUEBRA_AUTOMATICA': { 
        label: 'Quebra Automática de Exame', 
        color: 'secondary' 
      },
      'REGISTRO_EXCLUIDO_LIMPEZA': { 
        label: 'Limpeza Manual', 
        color: 'outline' 
      }
    };

    return mapeamento[motivo] || { label: motivo, color: 'outline' };
  };

  return (
    <div className="space-y-6">
      {/* Header com métricas principais */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">{titulo}</h2>
          <p className="text-muted-foreground">
            {loteUpload ? `Lote: ${loteUpload}` : 'Monitoramento das últimas 24 horas'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={atualizarStatus} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button onClick={exportarExclusoes} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inseridos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {status.total_inseridos.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Registros processados com sucesso
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Excluídos</CardTitle>
            <FileX className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {status.total_excluidos.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Registros rejeitados pelas regras
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Exclusão</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {status.taxa_exclusao}%
            </div>
            <p className="text-xs text-muted-foreground">
              Percentual de registros excluídos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Motivos Únicos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {Object.keys(status.por_motivo).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Tipos diferentes de exclusão
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerta se houver exclusões */}
      {status.total_excluidos > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {status.total_excluidos} registros foram excluídos automaticamente pelas regras v002, v003 e v031. 
            Todos os motivos e dados originais estão registrados abaixo.
          </AlertDescription>
        </Alert>
      )}

      {/* Abas de análise */}
      <Tabs defaultValue="resumo" className="w-full">
        <TabsList>
          <TabsTrigger value="resumo">Resumo por Motivo</TabsTrigger>
          <TabsTrigger value="detalhes">Registros Detalhados</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Exclusões por Motivo</CardTitle>
              <CardDescription>
                Distribuição dos registros excluídos por regra aplicada
              </CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(status.por_motivo).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="mx-auto h-12 w-12 mb-4 text-green-600" />
                  <p>Nenhuma exclusão detectada</p>
                  <p className="text-sm">Todos os registros foram processados com sucesso</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(status.por_motivo)
                    .sort(([,a], [,b]) => b - a)
                    .map(([motivo, quantidade]) => {
                      const { label, color } = formatarMotivo(motivo);
                      const percentual = Math.round((quantidade / status.total_excluidos) * 100);
                      
                      return (
                        <div key={motivo} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge variant={color as any}>{label}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {percentual}% das exclusões
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold">{quantidade}</div>
                            <div className="text-xs text-muted-foreground">registros</div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detalhes" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Registros Excluídos</CardTitle>
                  <CardDescription>
                    Detalhes completos dos registros rejeitados (últimos 20)
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <Input
                    placeholder="Filtrar por motivo..."
                    value={filtroMotivo}
                    onChange={(e) => setFiltroMotivo(e.target.value)}
                    className="w-48"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {registrosFiltrados.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileX className="mx-auto h-12 w-12 mb-4" />
                  <p>Nenhum registro encontrado</p>
                  {filtroMotivo && (
                    <Button 
                      variant="link" 
                      size="sm" 
                      onClick={() => setFiltroMotivo('')}
                      className="text-xs"
                    >
                      Limpar filtro
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-auto max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Exame</TableHead>
                        <TableHead>Data Realização</TableHead>
                        <TableHead>Data Laudo</TableHead>
                        <TableHead>Detalhes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {registrosFiltrados.map((registro) => {
                        const dados = registro.dados_originais as any || {};
                        const { label, color } = formatarMotivo(registro.motivo_rejeicao);
                        
                        return (
                          <TableRow key={registro.id}>
                            <TableCell className="font-mono text-xs">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(registro.created_at).toLocaleString('pt-BR')}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={color as any} className="text-xs">
                                {label}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {dados.EMPRESA || '-'}
                            </TableCell>
                            <TableCell>{dados.ESTUDO_DESCRICAO || '-'}</TableCell>
                            <TableCell>{dados.DATA_REALIZACAO || '-'}</TableCell>
                            <TableCell>{dados.DATA_LAUDO || '-'}</TableCell>
                            <TableCell className="max-w-xs">
                              <div className="text-xs text-muted-foreground truncate">
                                {registro.detalhes_erro}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}