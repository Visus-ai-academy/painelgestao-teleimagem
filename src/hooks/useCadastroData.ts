import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useCadastroExames = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('🔍 Buscando exames...');
      
      const { data: exames, error, count } = await supabase
        .from('cadastro_exames')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log(`✅ Exames carregados: ${exames?.length || 0} registros (total: ${count})`);
      setData(exames || []);
    } catch (err: any) {
      console.error('❌ Erro ao carregar exames:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refetch: fetchData };
};

export const useQuebraExames = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('🔍 Buscando quebra de exames...');
      
      const { data: quebras, error, count } = await supabase
        .from('regras_quebra_exames')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log(`✅ Quebra de exames carregadas: ${quebras?.length || 0} registros (total: ${count})`);
      setData(quebras || []);
    } catch (err: any) {
      console.error('❌ Erro ao carregar quebra de exames:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refetch: fetchData };
};

export const usePrecosServicos = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: precos, error } = await supabase
        .from('precos_servicos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setData(precos || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refetch: fetchData };
};

export const useRegrasExclusao = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: regras, error } = await supabase
        .from('regras_exclusao_faturamento')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setData(regras || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refetch: fetchData };
};

export const useRepasseMedico = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: repasses, error } = await supabase
        .from('medicos_valores_repasse')
        .select(`
          *,
          medicos(nome, crm)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setData(repasses || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refetch: fetchData };
};

export const useModalidades = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: modalidades, error } = await supabase
        .from('modalidades')
        .select('*')
        .order('ordem', { ascending: true });

      if (error) throw error;
      setData(modalidades || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refetch: fetchData };
};

export const useEspecialidades = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: especialidades, error } = await supabase
        .from('especialidades')
        .select('*')
        .order('ordem', { ascending: true });

      if (error) throw error;
      setData(especialidades || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refetch: fetchData };
};

export const useCategoriasExame = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: categorias, error } = await supabase
        .from('categorias_exame')
        .select('*')
        .order('ordem', { ascending: true });

      if (error) throw error;
      setData(categorias || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refetch: fetchData };
};

export const usePrioridades = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: prioridades, error } = await supabase
        .from('prioridades')
        .select('*')
        .order('ordem', { ascending: true });

      if (error) throw error;
      setData(prioridades || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refetch: fetchData };
};