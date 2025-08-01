import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";

export interface MedicoEscala {
  id: string;
  nome: string;
  crm: string;
  email?: string;
  telefone?: string;
  modalidades: string[];
  especialidades: string[];
  categoria?: string;
  ativo: boolean;
}

export const useMedicosEscala = () => {
  const [medicos, setMedicos] = useState<MedicoEscala[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMedicos = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('medicos')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;

      setMedicos(data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Erro ao buscar médicos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedicos();
  }, []);

  const getMedicoById = (id: string): MedicoEscala | undefined => {
    return medicos.find(medico => medico.id === id);
  };

  const getMedicoModalidades = (id: string): string[] => {
    const medico = getMedicoById(id);
    return medico?.modalidades || [];
  };

  const getMedicoEspecialidades = (id: string): string[] => {
    const medico = getMedicoById(id);
    return medico?.especialidades || [];
  };

  const getMedicoCategoria = (id: string): string | undefined => {
    const medico = getMedicoById(id);
    return medico?.categoria;
  };

  return {
    medicos,
    loading,
    error,
    refetch: fetchMedicos,
    getMedicoById,
    getMedicoModalidades,
    getMedicoEspecialidades,
    getMedicoCategoria,
  };
};