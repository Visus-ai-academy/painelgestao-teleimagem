import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

export const ExcluirPrecoEspecifico = () => {
  const [processando, setProcessando] = useState(false);

  const excluirPrecoCemvalenca = async () => {
    setProcessando(true);
    try {
      const { data, error } = await supabase.functions.invoke('excluir-preco-especifico', {
        body: { preco_id: 'd362a497-d9c9-4706-98fc-fc154220ef74' }
      });

      if (error) throw error;

      if (data?.sucesso) {
        toast.success(`Preço excluído com sucesso!`, {
          description: `Cliente: ${data.preco_excluido.cliente} - ${data.preco_excluido.modalidade}/${data.preco_excluido.especialidade} - R$ ${data.preco_excluido.valor}`
        });
      } else {
        throw new Error(data?.erro || 'Erro ao excluir preço');
      }
    } catch (error: any) {
      console.error('Erro:', error);
      toast.error('Erro ao excluir preço', {
        description: error.message
      });
    } finally {
      setProcessando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="h-5 w-5" />
          Excluir Preço Específico
        </CardTitle>
        <CardDescription>
          Excluir preço de R$ 34,00 do cliente CEMVALENCA (MG/MAMO/SC/ROTINA)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={excluirPrecoCemvalenca}
          disabled={processando}
          variant="destructive"
          className="w-full"
        >
          {processando ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Excluindo...
            </>
          ) : (
            <>
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir Preço R$ 34,00
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
