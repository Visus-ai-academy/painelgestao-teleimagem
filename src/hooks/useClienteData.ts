import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useClienteData = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    comCnpj: 0,
    cnpjsUnicos: 0,
    nomesUnicos: 0
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('🔍 Buscando clientes...');
      
      // Buscar TODOS os clientes usando paginação
      let allClientes: any[] = [];
      let rangeStart = 0;
      const rangeSize = 10000;
      let hasMore = true;

      while (hasMore) {
        const { data: clientesBatch, error: clientesError } = await supabase
          .from('clientes')
          .select('*')
          .order('nome', { ascending: true })
          .range(rangeStart, rangeStart + rangeSize - 1);

        if (clientesError) throw clientesError;

        if (clientesBatch && clientesBatch.length > 0) {
          allClientes = [...allClientes, ...clientesBatch];
          rangeStart += rangeSize;
          hasMore = clientesBatch.length === rangeSize;
        } else {
          hasMore = false;
        }
      }

      // Calcular estatísticas
      const clientesAtivos = allClientes.filter(c => c.ativo);
      const clientesComCnpj = clientesAtivos.filter(c => c.cnpj && c.cnpj.trim() !== '');
      const cnpjsUnicos = new Set(clientesComCnpj.map(c => c.cnpj)).size;
      const nomesUnicos = new Set(clientesAtivos.map(c => c.nome)).size;

      const estatisticas = {
        total: clientesAtivos.length,
        comCnpj: clientesComCnpj.length,
        cnpjsUnicos: cnpjsUnicos,
        nomesUnicos: nomesUnicos
      };

      console.log('📊 Estatísticas de clientes:', estatisticas);
      console.log(`✅ Clientes carregados: ${allClientes.length} total, ${clientesAtivos.length} ativos`);
      
      setData(clientesAtivos);
      setStats(estatisticas);
    } catch (err: any) {
      console.error('❌ Erro ao carregar clientes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, stats, refetch: fetchData };
};