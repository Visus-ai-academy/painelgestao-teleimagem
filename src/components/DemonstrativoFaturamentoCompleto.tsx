import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Download, DollarSign, FileText, Wifi, Building } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface DemonstrativoCliente {
  cliente_id: string;
  cliente_nome: string;
  periodo: string;
  total_exames: number;
  valor_exames: number;
  valor_franquia: number;
  valor_portal_laudos: number;
  valor_integracao: number;
  valor_total: number;
  detalhes_franquia: any;
  detalhes_exames: any[];
}

interface Resumo {
  total_clientes: number;
  clientes_processados: number;
  valor_total_geral: number;
  valor_exames_geral: number;
  valor_franquias_geral: number;
  valor_portal_geral: number;
  valor_integracao_geral: number;
}

export function DemonstrativoFaturamentoCompleto() {
  const [periodo, setPeriodo] = useState('');
  const [loading, setLoading] = useState(false);
  const [demonstrativos, setDemonstrativos] = useState<DemonstrativoCliente[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const handleGerarDemonstrativos = async () => {
    if (!periodo) {
      toast({
        title: "Período obrigatório",
        description: "Por favor, informe o período no formato YYYY-MM",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('gerar-demonstrativos-faturamento', {
        body: { periodo }
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        setDemonstrativos(data.demonstrativos);
        setResumo(data.resumo);
        toast({
          title: "Demonstrativos gerados",
          description: `${data.resumo.clientes_processados} clientes processados com sucesso`
        });
      } else {
        throw new Error(data.message || 'Erro desconhecido');
      }
    } catch (error: any) {
      toast({
        title: "Erro ao gerar demonstrativos",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleClientExpansion = (clienteId: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clienteId)) {
      newExpanded.delete(clienteId);
    } else {
      newExpanded.add(clienteId);
    }
    setExpandedClients(newExpanded);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusBadge = (detalhes: any) => {
    if (!detalhes || detalhes.tipo === 'nao_aplica') {
      return <Badge variant="secondary">Não Aplica</Badge>;
    }
    if (detalhes.tipo === 'sem_volume') {
      return <Badge variant="outline">Sem Volume</Badge>;
    }
    return <Badge variant="default">Aplicada</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Demonstrativos de Faturamento Completo
          </CardTitle>
          <CardDescription>
            Gere demonstrativos incluindo valores de exames, franquias, portal de laudos e integração
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="periodo">Período (YYYY-MM)</Label>
              <Input
                id="periodo"
                placeholder="2024-01"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
              />
            </div>
            <Button 
              onClick={handleGerarDemonstrativos}
              disabled={loading}
              className="mt-6"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Gerar Demonstrativos
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {resumo && (
        <Card>
          <CardHeader>
            <CardTitle>Resumo Geral - {periodo}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {resumo.clientes_processados}
                </div>
                <div className="text-sm text-muted-foreground">Clientes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(resumo.valor_exames_geral)}
                </div>
                <div className="text-sm text-muted-foreground">Exames</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(resumo.valor_franquias_geral + resumo.valor_portal_geral + resumo.valor_integracao_geral)}
                </div>
                <div className="text-sm text-muted-foreground">Adicionais</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(resumo.valor_total_geral)}
                </div>
                <div className="text-sm text-muted-foreground">Total Geral</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {demonstrativos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Demonstrativos por Cliente</CardTitle>
            <CardDescription>
              Clique em um cliente para ver os detalhes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {demonstrativos.map((demo) => (
                <Collapsible key={demo.cliente_id}>
                  <CollapsibleTrigger 
                    className="w-full"
                    onClick={() => toggleClientExpansion(demo.cliente_id)}
                  >
                    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        {expandedClients.has(demo.cliente_id) ? 
                          <ChevronDown className="h-4 w-4" /> : 
                          <ChevronRight className="h-4 w-4" />
                        }
                        <Building className="h-4 w-4" />
                        <span className="font-medium">{demo.cliente_nome}</span>
                      </div>
                      
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <div className="font-medium">{demo.total_exames}</div>
                          <div className="text-muted-foreground">Exames</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-green-600">
                            {formatCurrency(demo.valor_exames)}
                          </div>
                          <div className="text-muted-foreground">Valor Exames</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-blue-600">
                            {formatCurrency(demo.valor_franquia)}
                          </div>
                          <div className="text-muted-foreground">Franquia</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-purple-600">
                            {formatCurrency(demo.valor_portal_laudos)}
                          </div>
                          <div className="text-muted-foreground">Portal</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-orange-600">
                            {formatCurrency(demo.valor_integracao)}
                          </div>
                          <div className="text-muted-foreground">Integração</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-lg">
                            {formatCurrency(demo.valor_total)}
                          </div>
                          <div className="text-muted-foreground">Total</div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="p-4 border-l border-r border-b rounded-b-lg bg-muted/25 space-y-4">
                      {/* Detalhes da Franquia */}
                      {demo.valor_franquia > 0 && demo.detalhes_franquia && (
                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Detalhes da Franquia
                          </h4>
                          <div className="bg-background p-3 rounded border">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">Status:</span>
                              {getStatusBadge(demo.detalhes_franquia)}
                            </div>
                            <div className="text-sm">
                              <strong>Motivo:</strong> {demo.detalhes_franquia.motivo || 'N/A'}
                            </div>
                            {demo.detalhes_franquia.volume_atual !== undefined && (
                              <div className="text-sm">
                                <strong>Volume:</strong> {demo.detalhes_franquia.volume_atual} exames
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Detalhes dos Exames */}
                      {demo.detalhes_exames.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Detalhamento por Modalidade/Especialidade
                          </h4>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Modalidade</TableHead>
                                <TableHead>Especialidade</TableHead>
                                <TableHead>Categoria</TableHead>
                                <TableHead>Prioridade</TableHead>
                                <TableHead className="text-right">Qtd</TableHead>
                                <TableHead className="text-right">Valor Unit.</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {demo.detalhes_exames.map((item, index) => (
                                <TableRow key={index}>
                                  <TableCell>{item.modalidade}</TableCell>
                                  <TableCell>{item.especialidade}</TableCell>
                                  <TableCell>{item.categoria}</TableCell>
                                  <TableCell>{item.prioridade}</TableCell>
                                  <TableCell className="text-right">{item.quantidade}</TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(item.valor_unitario)}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {formatCurrency(item.valor_total)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}