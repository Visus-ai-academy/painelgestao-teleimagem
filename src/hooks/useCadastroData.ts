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
      
      // Buscar exames
      const { data: exames, error: examesError } = await supabase
        .from('cadastro_exames')
        .select('*')
        .order('created_at', { ascending: false });

      if (examesError) throw examesError;

      // Buscar regras de quebra com contagem
      const { data: quebras, error: quebrasError } = await supabase
        .from('regras_quebra_exames')
        .select('exame_original');

      if (quebrasError) throw quebrasError;

      // Criar mapa com contagem de quebras por exame
      const contagemQuebras = quebras?.reduce((acc, quebra) => {
        const exame = quebra.exame_original;
        acc[exame] = (acc[exame] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Criar set com exames que permitem quebra
      const examesComQuebra = new Set(quebras?.map(q => q.exame_original) || []);

      // Atualizar exames com a informação de permite_quebra e quantidade_quebras
      const examesAtualizados = exames?.map(exame => ({
        ...exame,
        permite_quebra: examesComQuebra.has(exame.nome),
        quantidade_quebras: contagemQuebras[exame.nome] || 0
      })) || [];
      
      console.log(`✅ Exames carregados: ${examesAtualizados.length} registros`);
      console.log(`✅ Exames com quebra: ${examesComQuebra.size} registros`);
      
      // Debug: verificar se exames com AVC estão sendo carregados
      const examesAVC = examesAtualizados.filter(exam => exam.nome.includes('AVC'));
      console.log('🔍 Exames com AVC carregados:', examesAVC.length);
      examesAVC.forEach(exam => console.log(`  - ${exam.nome}`));
      
      // Debug: forçar nova busca imediatamente para verificar se a query está funcionando
      console.log('🔄 Fazendo nova busca para debug...');
      const { data: debugExames } = await supabase
        .from('cadastro_exames')
        .select('nome')
        .ilike('nome', '%AVC%');
      
      console.log('🔍 Debug - Exames com AVC encontrados diretamente:', debugExames?.length || 0);
      debugExames?.forEach(exam => console.log(`  DEBUG - ${exam.nome}`));
      
      setData(examesAtualizados);
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
      
      const { data: quebras, error } = await supabase
        .from('regras_quebra_exames')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log(`✅ Quebra de exames carregadas: ${quebras?.length || 0} registros`);
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