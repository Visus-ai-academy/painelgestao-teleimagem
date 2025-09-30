import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Trash2, AlertTriangle } from 'lucide-react';

interface DuplicadoRepasse {
  id: string;
  medico_nome: string;
  modalidade: string;
  especialidade: string;
  prioridade: string;
  categoria: string | null;
  cliente_nome: string | null;
  valores_diferentes: number[];
  quantidade_duplicados: number;
}

interface DuplicadosRepasseDialogProps {
  medicoId: string;
  medicoNome: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DuplicadosRepasseDialog({ medicoId, medicoNome, open, onOpenChange }: DuplicadosRepasseDialogProps) {
  const [duplicados, setDuplicados] = useState<DuplicadoRepasse[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchDuplicados = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('duplicados_repasse_medico')
        .select('*')
        .eq('medico_id', medicoId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Converter valores_diferentes de Json[] para number[]
      const duplicadosFormatados = (data || []).map(item => ({
        ...item,
        valores_diferentes: (item.valores_diferentes as any[])?.map(v => Number(v)) || []
      })) as DuplicadoRepasse[];
      
      setDuplicados(duplicadosFormatados);
    } catch (error: any) {
      console.error('Erro ao buscar duplicados:', error);
      toast({
        title: "Erro ao carregar duplicados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveDuplicado = async (duplicadoId: string) => {
    if (!confirm('Tem certeza que deseja remover este registro de duplicados?')) return;

    try {
      const { error } = await supabase
        .from('duplicados_repasse_medico')
        .delete()
        .eq('id', duplicadoId);

      if (error) throw error;

      toast({
        title: "Duplicado removido",
        description: "Registro removido com sucesso",
      });

      await fetchDuplicados();
    } catch (error: any) {
      console.error('Erro ao remover duplicado:', error);
      toast({
        title: "Erro ao remover",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (open) {
      fetchDuplicados();
    }
  }, [open, medicoId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Registros Duplicados com Valores Diferentes - {medicoNome}
          </DialogTitle>
          <DialogDescription>
            Estes registros possuem as mesmas características (modalidade, especialidade, prioridade, categoria, cliente) 
            mas valores diferentes. Revise e decida se deseja manter ou excluir.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : duplicados.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground">
            Nenhum registro duplicado encontrado para este médico.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Modalidade</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Valores Diferentes</TableHead>
                <TableHead>Qtd</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {duplicados.map((dup) => (
                <TableRow key={dup.id}>
                  <TableCell>
                    <Badge variant="outline">{dup.modalidade}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{dup.especialidade}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{dup.prioridade}</Badge>
                  </TableCell>
                  <TableCell>{dup.categoria || '-'}</TableCell>
                  <TableCell className="max-w-[150px] truncate">{dup.cliente_nome || 'Todos'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {dup.valores_diferentes?.map((valor, idx) => (
                        <Badge key={idx} variant="secondary">
                          R$ {valor.toFixed(2)}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="destructive">{dup.quantidade_duplicados}x</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveDuplicado(dup.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
