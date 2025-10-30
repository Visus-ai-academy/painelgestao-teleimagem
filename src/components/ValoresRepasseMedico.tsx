import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface ValorRepasse {
  id: string;
  modalidade: string;
  especialidade: string;
  categoria: string;
  prioridade: string;
  valor: number;
  cliente_nome?: string;
  contratado?: string;
}

interface ValoresRepasseMedicoProps {
  medicoId: string;
}

export const ValoresRepasseMedico = ({ medicoId }: ValoresRepasseMedicoProps) => {
  const [valoresRepasse, setValoresRepasse] = useState<ValorRepasse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchValoresRepasse = async () => {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('medicos_valores_repasse')
          .select('*')
          .eq('medico_id', medicoId)
          .order('modalidade', { ascending: true })
          .order('especialidade', { ascending: true })
          .order('categoria', { ascending: true });

        if (error) throw error;

        setValoresRepasse(data || []);
      } catch (error: any) {
        console.error('Erro ao buscar valores de repasse:', error);
      } finally {
        setLoading(false);
      }
    };

    if (medicoId) {
      fetchValoresRepasse();
    }
  }, [medicoId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Valores de Repasse</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (valoresRepasse.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Valores de Repasse</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum valor de repasse cadastrado para este médico.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Valores de Repasse ({valoresRepasse.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Modalidade</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {valoresRepasse.map((valor) => (
                <TableRow key={valor.id}>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {valor.modalidade}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{valor.especialidade}</TableCell>
                  <TableCell className="text-sm">{valor.categoria}</TableCell>
                  <TableCell className="text-sm">{valor.prioridade}</TableCell>
                  <TableCell className="text-sm">
                    {valor.cliente_nome || 'Todos'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    R$ {Number(valor.valor).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {/* Resumo */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Total de Configurações:</span>
            <span className="text-sm font-semibold">{valoresRepasse.length}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
