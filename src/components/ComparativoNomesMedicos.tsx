import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle, Search, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface ComparativoData {
  medicos_cadastrados: Array<{
    id: string;
    nome: string;
    crm: string | null;
    nome_normalizado: string;
  }>;
  medicos_volumetria: Array<{
    nome_original: string;
    nome_normalizado: string;
    quantidade_exames: number;
    encontrado_cadastro: boolean;
    sugestoes_match: string[];
  }>;
  medicos_repasse: Array<{
    medico_id: string | null;
    medico_nome: string | null;
    nome_normalizado: string;
    quantidade_registros: number;
    encontrado_cadastro: boolean;
  }>;
  divergencias: Array<{
    tipo: string;
    origem: string;
    nome_origem: string;
    medico_id?: string;
    sugestoes: string[];
    detalhes: string;
  }>;
  estatisticas: {
    total_cadastrados: number;
    total_volumetria: number;
    total_repasse: number;
    divergencias_encontradas: number;
    sugestoes_normalizacao: number;
  };
}

export const ComparativoNomesMedicos = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ComparativoData | null>(null);

  const executarComparativo = async () => {
    try {
      setLoading(true);
      toast.info('Iniciando análise comparativa...');

      const { data: resultado, error } = await supabase.functions.invoke('comparar-nomes-medicos');

      if (error) throw error;

      setData(resultado);
      toast.success('Comparativo concluído!');
    } catch (error: any) {
      console.error('Erro ao executar comparativo:', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'volumetria_nao_cadastrado':
        return <Badge variant="destructive">Não Cadastrado</Badge>;
      case 'repasse_sem_medico':
        return <Badge variant="destructive">Sem Médico</Badge>;
      case 'possivel_match':
        return <Badge className="bg-yellow-500">Possível Match</Badge>;
      default:
        return <Badge variant="secondary">{tipo}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Comparativo de Nomes de Médicos
          </CardTitle>
          <CardDescription>
            Analisa e compara os nomes dos médicos entre Volumetria, Repasse e Cadastro para identificar divergências e sugerir normalizações.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={executarComparativo} disabled={loading}>
            {loading ? 'Analisando...' : 'Executar Comparativo'}
          </Button>
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {/* Estatísticas */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Cadastrados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.estatisticas.total_cadastrados}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Volumetria</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.estatisticas.total_volumetria}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Repasse</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.estatisticas.total_repasse}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Divergências</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {data.estatisticas.divergencias_encontradas}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Sugestões</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-500">
                  {data.estatisticas.sugestoes_normalizacao}
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="divergencias" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="divergencias">
                Divergências ({data.divergencias.length})
              </TabsTrigger>
              <TabsTrigger value="volumetria">
                Volumetria ({data.medicos_volumetria.length})
              </TabsTrigger>
              <TabsTrigger value="repasse">
                Repasse ({data.medicos_repasse.length})
              </TabsTrigger>
              <TabsTrigger value="cadastrados">
                Cadastrados ({data.medicos_cadastrados.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="divergencias">
              <Card>
                <CardHeader>
                  <CardTitle>Divergências Encontradas</CardTitle>
                  <CardDescription>
                    Médicos que precisam de atenção para normalização
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data.divergencias.length === 0 ? (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        Nenhuma divergência encontrada! Todos os nomes estão consistentes.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Origem</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Detalhes</TableHead>
                          <TableHead>Sugestões</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.divergencias.map((div, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{getTipoBadge(div.tipo)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{div.origem}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{div.nome_origem}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {div.detalhes}
                            </TableCell>
                            <TableCell>
                              {div.sugestoes.length > 0 ? (
                                <div className="space-y-1">
                                  {div.sugestoes.map((sug, sidx) => (
                                    <div key={sidx} className="text-sm text-blue-600">
                                      {sug}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="volumetria">
              <Card>
                <CardHeader>
                  <CardTitle>Médicos na Volumetria</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Qtd. Exames</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Sugestões</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.medicos_volumetria.map((med, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{med.nome_original}</TableCell>
                          <TableCell>{med.quantidade_exames}</TableCell>
                          <TableCell>
                            {med.encontrado_cadastro ? (
                              <Badge variant="default" className="bg-green-500">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Cadastrado
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Não Encontrado
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {med.sugestoes_match.length > 0 ? (
                              <div className="space-y-1">
                                {med.sugestoes_match.map((sug, sidx) => (
                                  <div key={sidx} className="text-sm text-blue-600">
                                    {sug}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="repasse">
              <Card>
                <CardHeader>
                  <CardTitle>Médicos no Repasse</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Qtd. Registros</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.medicos_repasse.map((med, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">
                            {med.medico_nome || 'SEM MÉDICO ASSOCIADO'}
                          </TableCell>
                          <TableCell>{med.quantidade_registros}</TableCell>
                          <TableCell>
                            {med.medico_id ? (
                              med.encontrado_cadastro ? (
                                <Badge variant="default" className="bg-green-500">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Cadastrado
                                </Badge>
                              ) : (
                                <Badge variant="destructive">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Não Encontrado
                                </Badge>
                              )
                            ) : (
                              <Badge variant="destructive">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Sem Médico
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cadastrados">
              <Card>
                <CardHeader>
                  <CardTitle>Médicos Cadastrados</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>CRM</TableHead>
                        <TableHead>Nome Normalizado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.medicos_cadastrados.map((med) => (
                        <TableRow key={med.id}>
                          <TableCell className="font-medium">{med.nome}</TableCell>
                          <TableCell>{med.crm || '-'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {med.nome_normalizado}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};
