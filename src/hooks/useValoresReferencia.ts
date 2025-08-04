import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ValorReferencia {
  id: string;
  estudo_descricao: string;
  valores: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export function useValoresReferencia() {
  const [data, setData] = useState<ValorReferencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: valores, error: fetchError } = await supabase
        .from('valores_referencia_de_para')
        .select('*')
        .order('estudo_descricao');

      if (fetchError) throw fetchError;

      setData(valores || []);
    } catch (err: any) {
      console.error('Erro ao buscar valores de referência:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addValor = async (estudo_descricao: string, valores: number) => {
    try {
      const { error } = await supabase
        .from('valores_referencia_de_para')
        .insert([{ estudo_descricao, valores, ativo: true }]);

      if (error) throw error;

      toast({
        title: "Valor Adicionado",
        description: "Novo valor de referência cadastrado com sucesso",
      });

      await fetchData();
    } catch (err: any) {
      toast({
        title: "Erro ao Adicionar",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const updateValor = async (id: string, estudo_descricao: string, valores: number) => {
    try {
      const { error } = await supabase
        .from('valores_referencia_de_para')
        .update({ estudo_descricao, valores, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Valor Atualizado",
        description: "Valor de referência atualizado com sucesso",
      });

      await fetchData();
    } catch (err: any) {
      toast({
        title: "Erro ao Atualizar",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const deleteValor = async (id: string) => {
    try {
      const { error } = await supabase
        .from('valores_referencia_de_para')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Valor Removido",
        description: "Valor de referência removido com sucesso",
      });

      await fetchData();
    } catch (err: any) {
      toast({
        title: "Erro ao Remover",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const toggleAtivo = async (id: string, ativo: boolean) => {
    try {
      const { error } = await supabase
        .from('valores_referencia_de_para')
        .update({ ativo, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: ativo ? "Valor Ativado" : "Valor Desativado",
        description: `Valor de referência ${ativo ? 'ativado' : 'desativado'} com sucesso`,
      });

      await fetchData();
    } catch (err: any) {
      toast({
        title: "Erro ao Alterar Status",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    addValor,
    updateValor,
    deleteValor,
    toggleAtivo
  };
}