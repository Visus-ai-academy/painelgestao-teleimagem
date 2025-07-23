import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, ArrowLeftRight, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ClienteComparison {
  cliente: string;
  arquivo_padrão: boolean;
  arquivo_fora_padrão: boolean;
  arquivo_padrão_retroativo: boolean;
  arquivo_fora_padrão_retroativo: boolean;
  total_registros: number;
  total_exames: number;
}

export function VolumetriaClientesComparison() {
  const [clientes, setClientes] = useState<ClienteComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'todos' | 'divergencias' | 'comuns'>('todos');
  const { toast } = useToast();

  useEffect(() => {
    loadClientesComparison();
  }, []);

  const loadClientesComparison = async () => {
    setLoading(true);
    try {
      // Buscar todos os clientes distintos
      const { data, error } = await supabase
        .from('volumetria_mobilemed')
        .select('EMPRESA, arquivo_fonte, VALORES')
        .order('EMPRESA');

      if (error) throw error;

      // Agrupar por cliente e arquivo
      const clienteMap = new Map<string, ClienteComparison>();

      data?.forEach(item => {
        const cliente = item.EMPRESA || 'Não Informado';
        const exames = Number(item.VALORES) || 0;
        
        if (!clienteMap.has(cliente)) {
          clienteMap.set(cliente, {
            cliente,
            arquivo_padrão: false,
            arquivo_fora_padrão: false,
            arquivo_padrão_retroativo: false,
            arquivo_fora_padrão_retroativo: false,
            total_registros: 0,
            total_exames: 0
          });
        }

        const clienteData = clienteMap.get(cliente)!;
        clienteData.total_registros += 1;
        clienteData.total_exames += exames;

        // Marcar presença nos arquivos baseado no arquivo_fonte
        switch (item.arquivo_fonte) {
          case 'data_laudo':
            clienteData.arquivo_padrão = true;
            break;
          case 'data_exame':
            clienteData.arquivo_fora_padrão = true;
            break;
          case 'data_laudo_retroativo':
            clienteData.arquivo_padrão_retroativo = true;
            break;
          case 'data_exame_retroativo':
            clienteData.arquivo_fora_padrão_retroativo = true;
            break;
        }
      });

      setClientes(Array.from(clienteMap.values()).sort((a, b) => a.cliente.localeCompare(b.cliente)));
    } catch (error) {
      console.error('Erro ao carregar comparação de clientes:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar comparação de clientes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const clientesFiltrados = clientes.filter(cliente => {
    if (filtro === 'todos') return true;
    
    const temPadrao = cliente.arquivo_padrão || cliente.arquivo_padrão_retroativo;
    const temForaPadrao = cliente.arquivo_fora_padrão || cliente.arquivo_fora_padrão_retroativo;
    
    if (filtro === 'divergencias') {
      return (temPadrao && !temForaPadrao) || (!temPadrao && temForaPadrao);
    }
    
    if (filtro === 'comuns') {
      return temPadrao && temForaPadrao;
    }
    
    return true;
  });

  const stats = {
    total: clientes.length,
    apenas_padrão: clientes.filter(c => 
      (c.arquivo_padrão || c.arquivo_padrão_retroativo) && 
      !c.arquivo_fora_padrão && !c.arquivo_fora_padrão_retroativo
    ).length,
    apenas_fora_padrão: clientes.filter(c => 
      (c.arquivo_fora_padrão || c.arquivo_fora_padrão_retroativo) && 
      !c.arquivo_padrão && !c.arquivo_padrão_retroativo
    ).length,
    em_ambos: clientes.filter(c => 
      (c.arquivo_padrão || c.arquivo_padrão_retroativo) && 
      (c.arquivo_fora_padrão || c.arquivo_fora_padrão_retroativo)
    ).length
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Comparação de Clientes por Arquivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Carregando comparação...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Comparação de Clientes por Arquivo
        </CardTitle>
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Clientes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.apenas_padrão}</div>
            <div className="text-sm text-muted-foreground">Apenas Padrão</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.apenas_fora_padrão}</div>
            <div className="text-sm text-muted-foreground">Apenas Fora Padrão</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.em_ambos}</div>
            <div className="text-sm text-muted-foreground">Em Ambos</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Button
            variant={filtro === 'todos' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltro('todos')}
          >
            Todos ({clientes.length})
          </Button>
          <Button
            variant={filtro === 'divergencias' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltro('divergencias')}
          >
            <ArrowLeftRight className="h-4 w-4 mr-1" />
            Divergências ({stats.apenas_padrão + stats.apenas_fora_padrão})
          </Button>
          <Button
            variant={filtro === 'comuns' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltro('comuns')}
          >
            <Filter className="h-4 w-4 mr-1" />
            Comuns ({stats.em_ambos})
          </Button>
        </div>

        <div className="space-y-2 max-h-96 overflow-auto">
          {clientesFiltrados.map((cliente, index) => (
            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex-1">
                <div className="font-medium">{cliente.cliente}</div>
                <div className="text-sm text-muted-foreground">
                  {cliente.total_registros.toLocaleString()} registros | {cliente.total_exames.toLocaleString()} exames
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant={cliente.arquivo_padrão ? "default" : "outline"} className="text-xs">
                  Padrão
                </Badge>
                <Badge variant={cliente.arquivo_fora_padrão ? "default" : "outline"} className="text-xs">
                  Fora Padrão
                </Badge>
                <Badge variant={cliente.arquivo_padrão_retroativo ? "secondary" : "outline"} className="text-xs">
                  Retro Padrão
                </Badge>
                <Badge variant={cliente.arquivo_fora_padrão_retroativo ? "secondary" : "outline"} className="text-xs">
                  Retro Fora
                </Badge>
              </div>
            </div>
          ))}
        </div>

        {clientesFiltrados.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum cliente encontrado com os filtros aplicados.
          </div>
        )}
      </CardContent>
    </Card>
  );
}