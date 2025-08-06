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
      
      // Buscar TODOS os exames usando paginação para superar limite do Supabase
      let allExames: any[] = [];
      let rangeStart = 0;
      const rangeSize = 10000; // Aumentado para processar grandes volumes
      let hasMore = true;

      while (hasMore) {
        const { data: examesBatch, error: examesError } = await supabase
          .from('cadastro_exames')
          .select('*')
          .order('nome', { ascending: true })
          .range(rangeStart, rangeStart + rangeSize - 1);

        if (examesError) throw examesError;

        if (examesBatch && examesBatch.length > 0) {
          allExames = [...allExames, ...examesBatch];
          rangeStart += rangeSize;
          hasMore = examesBatch.length === rangeSize; // Se retornou menos que o tamanho da página, não há mais dados
        } else {
          hasMore = false;
        }
      }

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
      const examesAtualizados = allExames?.map(exame => ({
        ...exame,
        permite_quebra: examesComQuebra.has(exame.nome),
        quantidade_quebras: contagemQuebras[exame.nome] || 0
      })) || [];
      
      console.log(`✅ Exames carregados: ${examesAtualizados.length} registros`);
      console.log(`✅ Exames com quebra: ${examesComQuebra.size} registros`);
      
      // Debug: verificar se o exame específico foi carregado
      const urotomoExame = examesAtualizados.find(exam => exam.nome.includes('UROTOMOGRAFIA') && exam.nome.includes('ONCO'));
      if (urotomoExame) {
        console.log('🎯 Exame UROTOMOGRAFIA - ONCO encontrado:', urotomoExame.nome);
      } else {
        console.log('❌ Exame UROTOMOGRAFIA - ONCO NÃO encontrado');
      }
      
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
      
      // Buscar TODOS os registros usando paginação
      let allData: any[] = [];
      let rangeStart = 0;
      const rangeSize = 10000;
      let hasMore = true;

      while (hasMore) {
        const { data: dataBatch, error } = await supabase
          .from('regras_quebra_exames')
          .select('*')
          .order('created_at', { ascending: false })
          .range(rangeStart, rangeStart + rangeSize - 1);

        if (error) throw error;

        if (dataBatch && dataBatch.length > 0) {
          allData = [...allData, ...dataBatch];
          rangeStart += rangeSize;
          hasMore = dataBatch.length === rangeSize;
        } else {
          hasMore = false;
        }
      }
      
      console.log(`✅ Quebra de exames carregadas: ${allData.length} registros`);
      setData(allData);
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
      
      // Buscar TODOS os registros usando paginação otimizada
      let allData: any[] = [];
      let rangeStart = 0;
      const rangeSize = 5000; // Reduzir tamanho do lote para melhor performance
      let hasMore = true;

      console.log('🔍 Iniciando busca de preços de serviços...');

      while (hasMore) {
        console.log(`📥 Buscando lote: ${rangeStart} a ${rangeStart + rangeSize - 1}`);
        
        const { data: dataBatch, error, count } = await supabase
          .from('precos_servicos')
          .select(`
            *,
            clientes:cliente_id (
              id,
              nome
            )
          `, { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(rangeStart, rangeStart + rangeSize - 1);

        if (error) {
          console.error('❌ Erro ao buscar preços:', error);
          throw error;
        }

        if (dataBatch && dataBatch.length > 0) {
          allData = [...allData, ...dataBatch];
          rangeStart += rangeSize;
          hasMore = dataBatch.length === rangeSize;
          console.log(`✅ Lote carregado: ${dataBatch.length} registros. Total acumulado: ${allData.length}`);
          
          if (count !== null) {
            console.log(`📊 Total no banco: ${count} registros`);
          }
        } else {
          hasMore = false;
          console.log('🏁 Busca finalizada - nenhum registro restante');
        }
      }
      
      console.log(`🎉 Busca completa: ${allData.length} preços carregados`);
      
      // Filtrar apenas preços com valor > 0 se necessário
      const precosValidos = allData.filter(preco => preco.valor_base > 0);
      console.log(`💰 Preços válidos (valor > 0): ${precosValidos.length}`);
      
      setData(allData); // Manter todos os dados, deixar filtro para o usuário
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
      
      // Buscar TODOS os registros usando paginação
      let allData: any[] = [];
      let rangeStart = 0;
      const rangeSize = 10000;
      let hasMore = true;

      while (hasMore) {
        const { data: dataBatch, error } = await supabase
          .from('regras_exclusao_faturamento')
          .select('*')
          .order('created_at', { ascending: false })
          .range(rangeStart, rangeStart + rangeSize - 1);

        if (error) throw error;

        if (dataBatch && dataBatch.length > 0) {
          allData = [...allData, ...dataBatch];
          rangeStart += rangeSize;
          hasMore = dataBatch.length === rangeSize;
        } else {
          hasMore = false;
        }
      }
      
      setData(allData);
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
      
      // Buscar TODOS os registros usando paginação
      let allData: any[] = [];
      let rangeStart = 0;
      const rangeSize = 10000;
      let hasMore = true;

      while (hasMore) {
        const { data: dataBatch, error } = await supabase
          .from('medicos_valores_repasse')
          .select(`
            *,
            medicos(nome, crm)
          `)
          .order('created_at', { ascending: false })
          .range(rangeStart, rangeStart + rangeSize - 1);

        if (error) throw error;

        if (dataBatch && dataBatch.length > 0) {
          allData = [...allData, ...dataBatch];
          rangeStart += rangeSize;
          hasMore = dataBatch.length === rangeSize;
        } else {
          hasMore = false;
        }
      }
      
      setData(allData);
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
      
      // Buscar TODOS os registros usando paginação
      let allData: any[] = [];
      let rangeStart = 0;
      const rangeSize = 10000;
      let hasMore = true;

      while (hasMore) {
        const { data: dataBatch, error } = await supabase
          .from('modalidades')
          .select('*')
          .order('ordem', { ascending: true })
          .range(rangeStart, rangeStart + rangeSize - 1);

        if (error) throw error;

        if (dataBatch && dataBatch.length > 0) {
          allData = [...allData, ...dataBatch];
          rangeStart += rangeSize;
          hasMore = dataBatch.length === rangeSize;
        } else {
          hasMore = false;
        }
      }
      
      setData(allData);
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
      
      // Buscar TODOS os registros usando paginação
      let allData: any[] = [];
      let rangeStart = 0;
      const rangeSize = 10000;
      let hasMore = true;

      while (hasMore) {
        const { data: dataBatch, error } = await supabase
          .from('especialidades')
          .select('*')
          .order('ordem', { ascending: true })
          .range(rangeStart, rangeStart + rangeSize - 1);

        if (error) throw error;

        if (dataBatch && dataBatch.length > 0) {
          allData = [...allData, ...dataBatch];
          rangeStart += rangeSize;
          hasMore = dataBatch.length === rangeSize;
        } else {
          hasMore = false;
        }
      }
      
      setData(allData);
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
      
      // Buscar TODOS os registros usando paginação
      let allData: any[] = [];
      let rangeStart = 0;
      const rangeSize = 10000;
      let hasMore = true;

      while (hasMore) {
        const { data: dataBatch, error } = await supabase
          .from('categorias_exame')
          .select('*')
          .order('ordem', { ascending: true })
          .range(rangeStart, rangeStart + rangeSize - 1);

        if (error) throw error;

        if (dataBatch && dataBatch.length > 0) {
          allData = [...allData, ...dataBatch];
          rangeStart += rangeSize;
          hasMore = dataBatch.length === rangeSize;
        } else {
          hasMore = false;
        }
      }
      
      setData(allData);
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
      
      // Buscar TODOS os registros usando paginação
      let allData: any[] = [];
      let rangeStart = 0;
      const rangeSize = 10000;
      let hasMore = true;

      while (hasMore) {
        const { data: dataBatch, error } = await supabase
          .from('prioridades')
          .select('*')
          .order('ordem', { ascending: true })
          .range(rangeStart, rangeStart + rangeSize - 1);

        if (error) throw error;

        if (dataBatch && dataBatch.length > 0) {
          allData = [...allData, ...dataBatch];
          rangeStart += rangeSize;
          hasMore = dataBatch.length === rangeSize;
        } else {
          hasMore = false;
        }
      }
      
      setData(allData);
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