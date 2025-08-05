import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useVolumetriaSimple = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('🔍 Buscando TODOS os dados de volumetria SEM LIMITAÇÃO...');
      
      // CARREGAMENTO DIRETO SEM PAGINAÇÃO - TODOS OS DADOS
      const { data: allData, error } = await supabase
        .from('volumetria_mobilemed')
        .select(`
          "EMPRESA",
          "MODALIDADE",
          "ESPECIALIDADE", 
          "PRIORIDADE",
          "VALORES",
          data_referencia
        `);
        // REMOVIDO COMPLETAMENTE: .range(), .order(), .limit() - SEM LIMITAÇÃO!

      if (error) throw error;

      console.log('✅ TODOS os dados de volumetria carregados SEM LIMITAÇÃO:', allData?.length || 0);
      console.log('📊 Total de valores:', (allData || []).reduce((sum, item) => sum + (Number(item.VALORES) || 0), 0));
      
      setData(allData || []);
    } catch (err: any) {
      console.error('❌ Erro ao carregar volumetria:', err);
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