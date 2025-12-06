import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CadastroExame {
  id: string;
  nome: string;
  modalidade: string;
  especialidade: string;
  categoria: string | null;
  prioridade: string;
}

interface ValorReferencia {
  id: string;
  estudo_descricao: string;
  valores: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  cadastro_exame_id: string | null;
  cadastro_exame?: CadastroExame | null;
}

interface SugestaoExame {
  exame: CadastroExame;
  similaridade: number;
}

// Função para calcular similaridade entre duas strings (Jaccard + tokens)
function calcularSimilaridade(str1: string, str2: string): number {
  const normalizar = (s: string) => 
    s.toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9\s]/g, '')
      .trim();

  const s1 = normalizar(str1);
  const s2 = normalizar(str2);

  // Se são iguais (case-insensitive)
  if (s1 === s2) return 100;

  // Tokenizar
  const tokens1 = new Set(s1.split(/\s+/).filter(t => t.length > 1));
  const tokens2 = new Set(s2.split(/\s+/).filter(t => t.length > 1));

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  // Calcular interseção
  const intersecao = [...tokens1].filter(t => tokens2.has(t)).length;
  const uniao = new Set([...tokens1, ...tokens2]).size;

  // Jaccard similarity * 100
  const jaccard = (intersecao / uniao) * 100;

  // Bonus para correspondência de início
  const bonus = s1.startsWith(s2.substring(0, 3)) || s2.startsWith(s1.substring(0, 3)) ? 10 : 0;

  return Math.min(100, Math.round(jaccard + bonus));
}

export function useValoresReferencia() {
  const [data, setData] = useState<ValorReferencia[]>([]);
  const [cadastroExames, setCadastroExames] = useState<CadastroExame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchCadastroExames = async () => {
    const { data: exames, error } = await supabase
      .from('cadastro_exames')
      .select('id, nome, modalidade, especialidade, categoria, prioridade')
      .eq('ativo', true)
      .order('nome');

    if (error) {
      console.error('Erro ao buscar cadastro_exames:', error);
      return [];
    }

    return exames || [];
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Buscar valores de referência
      const { data: valores, error: fetchError } = await supabase
        .from('valores_referencia_de_para')
        .select('*')
        .order('estudo_descricao');

      if (fetchError) throw fetchError;

      // Buscar cadastro de exames para lookup
      const exames = await fetchCadastroExames();
      setCadastroExames(exames);

      // Criar mapa de exames para lookup rápido
      const exameMap = new Map(exames.map(e => [e.id, e]));

      // Limpar códigos X1-X9 e XE dos nomes dos exames e vincular cadastro
      const cleanedValores = valores?.map(valor => ({
        ...valor,
        estudo_descricao: valor.estudo_descricao.replace(/\b(X[1-9]|XE)\b/g, '').replace(/\s+/g, ' ').trim(),
        cadastro_exame: valor.cadastro_exame_id ? exameMap.get(valor.cadastro_exame_id) || null : null
      })) || [];

      setData(cleanedValores);
    } catch (err: any) {
      console.error('Erro ao buscar valores de referência:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Buscar sugestões de exames similares
  const buscarSugestoes = (estudoDescricao: string, limite: number = 5): SugestaoExame[] => {
    if (!estudoDescricao || cadastroExames.length === 0) return [];

    const sugestoes = cadastroExames
      .map(exame => ({
        exame,
        similaridade: calcularSimilaridade(estudoDescricao, exame.nome)
      }))
      .filter(s => s.similaridade >= 30) // Mínimo 30% de similaridade
      .sort((a, b) => b.similaridade - a.similaridade)
      .slice(0, limite);

    return sugestoes;
  };

  const addValor = async (estudo_descricao: string, valores: number, cadastro_exame_id?: string) => {
    try {
      const { error } = await supabase
        .from('valores_referencia_de_para')
        .insert([{ estudo_descricao, valores, ativo: true, cadastro_exame_id: cadastro_exame_id || null }]);

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

  const updateValor = async (id: string, estudo_descricao: string, valores: number, cadastro_exame_id?: string | null) => {
    try {
      const updateData: any = { 
        estudo_descricao, 
        valores, 
        updated_at: new Date().toISOString() 
      };

      // Sempre incluir cadastro_exame_id (pode ser null para desvincular)
      if (cadastro_exame_id !== undefined) {
        updateData.cadastro_exame_id = cadastro_exame_id;
      }

      const { error } = await supabase
        .from('valores_referencia_de_para')
        .update(updateData)
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

  // Vincular exame fora do padrão com cadastro_exames
  const vincularExame = async (valorReferenciaId: string, cadastroExameId: string) => {
    try {
      const { error } = await supabase
        .from('valores_referencia_de_para')
        .update({ 
          cadastro_exame_id: cadastroExameId,
          updated_at: new Date().toISOString() 
        })
        .eq('id', valorReferenciaId);

      if (error) throw error;

      toast({
        title: "Exame Vinculado",
        description: "Exame vinculado ao cadastro com sucesso. Categoria, modalidade e especialidade serão herdadas.",
      });

      await fetchData();
    } catch (err: any) {
      toast({
        title: "Erro ao Vincular",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  // Desvincular exame
  const desvincularExame = async (valorReferenciaId: string) => {
    try {
      const { error } = await supabase
        .from('valores_referencia_de_para')
        .update({ 
          cadastro_exame_id: null,
          updated_at: new Date().toISOString() 
        })
        .eq('id', valorReferenciaId);

      if (error) throw error;

      toast({
        title: "Exame Desvinculado",
        description: "Vinculação removida com sucesso",
      });

      await fetchData();
    } catch (err: any) {
      toast({
        title: "Erro ao Desvincular",
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
    cadastroExames,
    loading,
    error,
    refetch: fetchData,
    addValor,
    updateValor,
    deleteValor,
    toggleAtivo,
    buscarSugestoes,
    vincularExame,
    desvincularExame
  };
}
