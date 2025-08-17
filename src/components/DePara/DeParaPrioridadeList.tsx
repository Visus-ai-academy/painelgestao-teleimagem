import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DeParaPrioridade {
  id: string;
  prioridade_original: string;
  nome_final: string;
  ativo: boolean;
  created_at: string;
}

export function DeParaPrioridadeList() {
  const [data, setData] = useState<DeParaPrioridade[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: result, error } = await supabase
        .from('valores_prioridade_de_para')
        .select('*')
        .order('prioridade_original');

      if (error) throw error;
      setData(result || []);
    } catch (error) {
      console.error('Erro ao carregar de-para prioridades:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os mapeamentos de prioridade.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const clearData = async () => {
    try {
      const { error } = await supabase
        .from('valores_prioridade_de_para')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;
      
      toast({
        title: "Dados limpos",
        description: "Todos os mapeamentos de prioridade foram removidos.",
      });
      
      loadData();
    } catch (error) {
      console.error('Erro ao limpar dados:', error);
      toast({
        title: "Erro ao limpar dados",
        description: "Não foi possível limpar os mapeamentos.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span className="ml-2">Carregando...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Mapeamentos de Prioridade Cadastrados</CardTitle>
            <CardDescription>
              {data.length} registro(s) encontrado(s)
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button variant="destructive" size="sm" onClick={clearData}>
              <Trash2 className="h-4 w-4 mr-2" />
              Limpar Tudo
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum mapeamento de prioridade encontrado.
            <br />
            Faça o upload de um arquivo CSV para começar.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prioridade Original</TableHead>
                <TableHead>Nome Final</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data Criação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono">{item.prioridade_original}</TableCell>
                  <TableCell className="font-semibold">{item.nome_final}</TableCell>
                  <TableCell>
                    <Badge variant={item.ativo ? "default" : "secondary"}>
                      {item.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}