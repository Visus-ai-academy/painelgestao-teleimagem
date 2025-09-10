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
  valor_bruto: number;
  valor_impostos: number;
  valor_total: number;
  detalhes_franquia: any;
  detalhes_exames: any[];
  detalhes_tributacao: {
    simples_nacional: boolean;
    percentual_iss?: number;
    valor_iss?: number;
    base_calculo?: number;
  };
}

interface Resumo {
  total_clientes: number;
  clientes_processados: number;
  valor_bruto_geral: number;
  valor_impostos_geral: number;
  valor_total_geral: number;
  valor_exames_geral: number;
  valor_franquias_geral: number;
  valor_portal_geral: number;
  valor_integracao_geral: number;
  clientes_simples_nacional: number;
  clientes_regime_normal: number;
}

interface DemonstrativoFaturamentoCompletoProps {
  periodo: string;
  onDemonstrativosGerados?: (dados: { demonstrativos: DemonstrativoCliente[], resumo: Resumo }) => void;
}

export function DemonstrativoFaturamentoCompleto({ periodo, onDemonstrativosGerados }: DemonstrativoFaturamentoCompletoProps) {
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
        
        // Chamar callback se fornecido
        if (onDemonstrativosGerados) {
          onDemonstrativosGerados({ 
            demonstrativos: data.demonstrativos, 
            resumo: data.resumo 
          });
        }
        
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
              <div className="text-sm text-muted-foreground">
                Período selecionado: <strong>{periodo || 'Nenhum período selecionado'}</strong>
              </div>
            </div>
            <Button 
              onClick={handleGerarDemonstrativos}
              disabled={loading || !periodo}
              className="bg-blue-600 hover:bg-blue-700"
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(resumo.valor_impostos_geral)}
                </div>
                <div className="text-sm text-muted-foreground">Impostos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(resumo.valor_total_geral)}
                </div>
                <div className="text-sm text-muted-foreground">Líquido</div>
              </div>
            </div>
            
            {/* Informação sobre regime tributário */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-center gap-6 text-sm">
                <div className="text-center">
                  <div className="font-medium text-blue-600">{resumo.clientes_simples_nacional}</div>
                  <div className="text-muted-foreground">Simples Nacional</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-gray-600">{resumo.clientes_regime_normal}</div>
                  <div className="text-muted-foreground">Regime Normal</div>
                </div>
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
                        {demo.valor_impostos > 0 && (
                          <div className="text-center">
                            <div className="font-medium text-red-600">
                              -{formatCurrency(demo.valor_impostos)}
                            </div>
                            <div className="text-muted-foreground">Impostos</div>
                          </div>
                        )}
                        <div className="text-center">
                          <div className="font-bold text-lg">
                            {formatCurrency(demo.valor_total)}
                          </div>
                          <div className="text-muted-foreground">Líquido</div>
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
                      
                      {/* Detalhes da Tributação */}
                      {demo.detalhes_tributacao && (
                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Informações Tributárias
                          </h4>
                          <div className="bg-background p-3 rounded border space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Regime Tributário:</span>
                              <Badge variant={demo.detalhes_tributacao.simples_nacional ? "default" : "secondary"}>
                                {demo.detalhes_tributacao.simples_nacional ? "Simples Nacional" : "Regime Normal"}
                              </Badge>
                            </div>
                            
                            {!demo.detalhes_tributacao.simples_nacional && demo.detalhes_tributacao.percentual_iss && (
                              <>
                                <div className="text-sm">
                                  <strong>Base de Cálculo:</strong> {formatCurrency(demo.detalhes_tributacao.base_calculo || 0)}
                                </div>
                                <div className="text-sm">
                                  <strong>ISS ({demo.detalhes_tributacao.percentual_iss}%):</strong> {formatCurrency(demo.detalhes_tributacao.valor_iss || 0)}
                                </div>
                                <div className="text-sm font-medium text-green-600">
                                  <strong>Valor Líquido:</strong> {formatCurrency(demo.valor_total)}
                                </div>
                              </>
                            )}
                            
                            {demo.detalhes_tributacao.simples_nacional && (
                              <div className="text-sm text-blue-600">
                                <strong>Obs:</strong> Empresa enquadrada no Simples Nacional - sem retenção de ISS
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