import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useVolumetriaSimple = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('🔍 Buscando dados de volumetria...');
      
      const { data: volumetriaData, error: volumetriaError } = await supabase
        .from('volumetria_mobilemed')
        .select(`
          "EMPRESA",
          "MODALIDADE",
          "ESPECIALIDADE", 
          "PRIORIDADE",
          "VALORES",
          data_referencia
        `);

      if (volumetriaError) throw volumetriaError;

      console.log('✅ Dados de volumetria carregados:', volumetriaData?.length || 0);
      
      setData(volumetriaData || []);
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