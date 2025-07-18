import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";

interface DataItem {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
}

export const useMedicoData = () => {
  const [modalidades, setModalidades] = useState<DataItem[]>([]);
  const [especialidades, setEspecialidades] = useState<DataItem[]>([]);
  const [categoriasExame, setCategoriasExame] = useState<DataItem[]>([]);
  const [prioridades, setPrioridades] = useState<DataItem[]>([]);
  const [categoriasMedico, setCategoriasMedico] = useState<DataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Buscar todas as listas em paralelo
      const [
        modalidadesResult,
        especialidadesResult,
        categoriasExameResult,
        prioridadesResult,
        categoriasMedicoResult
      ] = await Promise.all([
        supabase.from('modalidades').select('*').eq('ativo', true).order('ordem'),
        supabase.from('especialidades').select('*').eq('ativo', true).order('ordem'),
        supabase.from('categorias_exame').select('*').eq('ativo', true).order('ordem'),
        supabase.from('prioridades').select('*').eq('ativo', true).order('ordem'),
        supabase.from('categorias_medico').select('*').eq('ativo', true).order('ordem')
      ]);

      // Verificar erros
      if (modalidadesResult.error) throw modalidadesResult.error;
      if (especialidadesResult.error) throw especialidadesResult.error;
      if (categoriasExameResult.error) throw categoriasExameResult.error;
      if (prioridadesResult.error) throw prioridadesResult.error;
      if (categoriasMedicoResult.error) throw categoriasMedicoResult.error;

      // Definir os dados
      setModalidades(modalidadesResult.data || []);
      setEspecialidades(especialidadesResult.data || []);
      setCategoriasExame(categoriasExameResult.data || []);
      setPrioridades(prioridadesResult.data || []);
      setCategoriasMedico(categoriasMedicoResult.data || []);

    } catch (err: any) {
      setError(err.message);
      console.error('Erro ao buscar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Funções helpers para obter apenas os nomes
  const getModalidadesNames = () => modalidades.map(item => item.nome);
  const getEspecialidadesNames = () => especialidades.map(item => item.nome);
  const getCategoriasExameNames = () => categoriasExame.map(item => item.nome);
  const getPrioridadesNames = () => prioridades.map(item => item.nome);
  const getCategoriasMedicoNames = () => categoriasMedico.map(item => item.nome);

  return {
    modalidades,
    especialidades,
    categoriasExame,
    prioridades,
    categoriasMedico,
    loading,
    error,
    refetch: fetchData,
    // Helpers para backward compatibility
    modalidadesDisponiveis: getModalidadesNames(),
    especialidadesDisponiveis: getEspecialidadesNames(),
    categoriasExameDisponiveis: getCategoriasExameNames(),
    prioridadesDisponiveis: getPrioridadesNames(),
    categoriasMedicoDisponiveis: getCategoriasMedicoNames(),
  };
};