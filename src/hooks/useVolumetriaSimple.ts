import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useVolumetriaSimple = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('🔍 Buscando TODOS os dados de volumetria com paginação...');
      
      // USAR PAGINAÇÃO FORÇADA PARA SUPERAR LIMITAÇÃO DO SUPABASE DE 1000 REGISTROS
      let allData: any[] = [];
      let offset = 0;
      const batchSize = 10000; // Lotes grandes para eficiência
      let hasMoreData = true;

      while (hasMoreData) {
        console.log(`📦 [useVolumetriaSimple] Carregando lote ${offset} - ${offset + batchSize}...`);
        
        const { data: batchData, error } = await supabase
          .from('volumetria_mobilemed')
          .select(`
            "EMPRESA",
            "MODALIDADE",
            "ESPECIALIDADE", 
            "PRIORIDADE",
            "VALORES",
            data_referencia
          `)
          .range(offset, offset + batchSize - 1);

        if (error) throw error;

        if (!batchData || batchData.length === 0) {
          hasMoreData = false;
          break;
        }

        allData = [...allData, ...batchData];
        console.log(`✅ [useVolumetriaSimple] Lote carregado: ${batchData.length} registros, total: ${allData.length}`);
        
        if (batchData.length < batchSize) {
          hasMoreData = false;
        } else {
          offset += batchSize;
        }
      }

      console.log('🎉 [useVolumetriaSimple] CARREGAMENTO COMPLETO:', allData.length, 'registros');
      console.log('📊 Total de valores:', allData.reduce((sum, item) => sum + (Number(item.VALORES) || 0), 0));
      
      setData(allData);
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