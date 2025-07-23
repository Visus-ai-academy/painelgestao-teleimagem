import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, AlertTriangle, Clock, CheckCircle, XCircle, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Pendencia {
  id: string;
  titulo: string;
  descricao: string;
  categoria: string;
  prioridade: string;
  status: string;
  modulo: string;
  data_limite: string;
  resolucao: string;
  metadata: any;
  created_at: string;
  updated_at: string;
  resolved_at: string;
  created_by: string;
  resolved_by: string;
  responsavel_id: string;
}

export const PendenciasPanel = () => {
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPendencia, setSelectedPendencia] = useState<Pendencia | null>(null);
  const [showNewPendencia, setShowNewPendencia] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<string>('todas');
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>('todas');
  const { toast } = useToast();

  // Formulário nova pendência
  const [novaPendencia, setNovaPendencia] = useState({
    titulo: '',
    descricao: '',
    categoria: 'geral',
    prioridade: 'media',
    modulo: '',
    data_limite: ''
  });

  const carregarPendencias = async () => {
    try {
      let query = supabase
        .from('pendencias')
        .select('*')
        .order('created_at', { ascending: false });

      if (filtroStatus !== 'todas') {
        query = query.eq('status', filtroStatus);
      }

      if (filtroPrioridade !== 'todas') {
        query = query.eq('prioridade', filtroPrioridade);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao carregar pendências:', error);
        toast({
          title: 'Erro',
          description: 'Erro ao carregar pendências',
          variant: 'destructive'
        });
        return;
      }

      setPendencias(data || []);
    } catch (error) {
      console.error('Erro ao carregar pendências:', error);
    } finally {
      setLoading(false);
    }
  };

  const criarPendencia = async () => {
    try {
      const { error } = await supabase
        .from('pendencias')
        .insert([novaPendencia]);

      if (error) {
        console.error('Erro ao criar pendência:', error);
        toast({
          title: 'Erro',
          description: 'Erro ao criar pendência',
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: 'Sucesso',
        description: 'Pendência criada com sucesso'
      });

      setShowNewPendencia(false);
      setNovaPendencia({
        titulo: '',
        descricao: '',
        categoria: 'geral',
        prioridade: 'media',
        modulo: '',
        data_limite: ''
      });
      carregarPendencias();
    } catch (error) {
      console.error('Erro ao criar pendência:', error);
    }
  };

  const atualizarStatus = async (id: string, novoStatus: string, resolucao?: string) => {
    try {
      const updateData: any = { 
        status: novoStatus,
        updated_at: new Date().toISOString()
      };

      if (novoStatus === 'resolvida' && resolucao) {
        updateData.resolucao = resolucao;
        updateData.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('pendencias')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('Erro ao atualizar pendência:', error);
        toast({
          title: 'Erro',
          description: 'Erro ao atualizar pendência',
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: 'Sucesso',
        description: 'Pendência atualizada com sucesso'
      });

      carregarPendencias();
    } catch (error) {
      console.error('Erro ao atualizar pendência:', error);
    }
  };

  useEffect(() => {
    carregarPendencias();
  }, [filtroStatus, filtroPrioridade]);

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case 'critica': return 'destructive';
      case 'alta': return 'destructive';
      case 'media': return 'default';
      case 'baixa': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'aberta': return <AlertTriangle className="h-4 w-4" />;
      case 'em_andamento': return <Clock className="h-4 w-4" />;
      case 'resolvida': return <CheckCircle className="h-4 w-4" />;
      case 'cancelada': return <XCircle className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aberta': return 'destructive';
      case 'em_andamento': return 'default';
      case 'resolvida': return 'default';
      case 'cancelada': return 'secondary';
      default: return 'default';
    }
  };

  if (loading) {
    return <div className="p-4">Carregando pendências...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gerenciamento de Pendências</h2>
          <p className="text-muted-foreground">Controle e resolva pendências do sistema</p>
        </div>
        
        <Dialog open={showNewPendencia} onOpenChange={setShowNewPendencia}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Pendência
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nova Pendência</DialogTitle>
              <DialogDescription>
                Criar uma nova pendência para acompanhamento
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="titulo">Título</Label>
                <Input
                  id="titulo"
                  value={novaPendencia.titulo}
                  onChange={(e) => setNovaPendencia({ ...novaPendencia, titulo: e.target.value })}
                  placeholder="Título da pendência"
                />
              </div>
              
              <div>
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={novaPendencia.descricao}
                  onChange={(e) => setNovaPendencia({ ...novaPendencia, descricao: e.target.value })}
                  placeholder="Descrição detalhada"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="categoria">Categoria</Label>
                  <Select value={novaPendencia.categoria} onValueChange={(value) => setNovaPendencia({ ...novaPendencia, categoria: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="geral">Geral</SelectItem>
                      <SelectItem value="dados">Dados</SelectItem>
                      <SelectItem value="sistema">Sistema</SelectItem>
                      <SelectItem value="configuracao">Configuração</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="prioridade">Prioridade</Label>
                  <Select value={novaPendencia.prioridade} onValueChange={(value) => setNovaPendencia({ ...novaPendencia, prioridade: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="critica">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="modulo">Módulo</Label>
                <Input
                  id="modulo"
                  value={novaPendencia.modulo}
                  onChange={(e) => setNovaPendencia({ ...novaPendencia, modulo: e.target.value })}
                  placeholder="Ex: volumetria, faturamento"
                />
              </div>

              <div>
                <Label htmlFor="data_limite">Data Limite</Label>
                <Input
                  id="data_limite"
                  type="date"
                  value={novaPendencia.data_limite}
                  onChange={(e) => setNovaPendencia({ ...novaPendencia, data_limite: e.target.value })}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={criarPendencia} className="flex-1">
                  Criar Pendência
                </Button>
                <Button variant="outline" onClick={() => setShowNewPendencia(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <div className="flex gap-4">
        <div>
          <Label htmlFor="filtro-status">Status</Label>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="aberta">Aberta</SelectItem>
              <SelectItem value="em_andamento">Em Andamento</SelectItem>
              <SelectItem value="resolvida">Resolvida</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="filtro-prioridade">Prioridade</Label>
          <Select value={filtroPrioridade} onValueChange={setFiltroPrioridade}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="critica">Crítica</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista de Pendências */}
      <div className="space-y-4">
        {pendencias.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">Nenhuma pendência encontrada</p>
            </CardContent>
          </Card>
        ) : (
          pendencias.map((pendencia) => (
            <Card key={pendencia.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{pendencia.titulo}</CardTitle>
                    <CardDescription className="mt-1">
                      {pendencia.descricao?.substring(0, 100)}
                      {pendencia.descricao && pendencia.descricao.length > 100 && '...'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Badge variant={getPrioridadeColor(pendencia.prioridade)}>
                      {pendencia.prioridade.toUpperCase()}
                    </Badge>
                    <Badge variant={getStatusColor(pendencia.status)} className="flex items-center gap-1">
                      {getStatusIcon(pendencia.status)}
                      {pendencia.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <div className="flex gap-4">
                    <span>Módulo: {pendencia.modulo || 'N/A'}</span>
                    <span>Categoria: {pendencia.categoria}</span>
                    <span>Criado: {format(new Date(pendencia.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                  </div>
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setSelectedPendencia(pendencia)}>
                          <Eye className="h-4 w-4 mr-1" />
                          Ver Detalhes
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>{pendencia.titulo}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>Descrição</Label>
                            <p className="mt-1 text-sm">{pendencia.descricao}</p>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Status</Label>
                              <p className="mt-1 text-sm">{pendencia.status.replace('_', ' ')}</p>
                            </div>
                            <div>
                              <Label>Prioridade</Label>
                              <p className="mt-1 text-sm">{pendencia.prioridade}</p>
                            </div>
                          </div>

                          {pendencia.metadata && Object.keys(pendencia.metadata).length > 0 && (
                            <div>
                              <Label>Metadados</Label>
                              <pre className="mt-1 text-xs bg-muted p-2 rounded">
                                {JSON.stringify(pendencia.metadata, null, 2)}
                              </pre>
                            </div>
                          )}

                          {pendencia.resolucao && (
                            <div>
                              <Label>Resolução</Label>
                              <p className="mt-1 text-sm">{pendencia.resolucao}</p>
                            </div>
                          )}

                          {pendencia.status !== 'resolvida' && pendencia.status !== 'cancelada' && (
                            <div className="space-y-2">
                              <Label>Atualizar Status</Label>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => atualizarStatus(pendencia.id, 'em_andamento')}
                                >
                                  Em Andamento
                                </Button>
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => {
                                    const resolucao = prompt('Descrição da resolução:');
                                    if (resolucao) {
                                      atualizarStatus(pendencia.id, 'resolvida', resolucao);
                                    }
                                  }}
                                >
                                  Resolver
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => atualizarStatus(pendencia.id, 'cancelada')}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};