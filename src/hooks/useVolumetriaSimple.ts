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
      
      // Carregar todos os dados com paginação para garantir que não perca nenhum registro
      let allData: any[] = [];
      let offset = 0;
      const limit = 50000; // Aumentado para volumes altos
      let hasMoreData = true;

      while (hasMoreData) {
        console.log(`📦 Carregando lote offset ${offset}...`);
        
        const { data: batchData, error: batchError } = await supabase
          .from('volumetria_mobilemed')
          .select(`
            "EMPRESA",
            "MODALIDADE",
            "ESPECIALIDADE", 
            "PRIORIDADE",
            "VALORES",
            data_referencia
          `)
          .range(offset, offset + limit - 1)
          .order('created_at', { ascending: true });

        if (batchError) throw batchError;

        if (!batchData || batchData.length === 0) {
          hasMoreData = false;
          break;
        }

        allData = [...allData, ...batchData];
        console.log(`✅ Lote carregado: ${batchData.length} registros, total acumulado: ${allData.length}`);
        
        if (batchData.length < limit) {
          hasMoreData = false;
        } else {
          offset += limit;
        }

        // Limite de segurança para evitar loops infinitos
        if (offset > 1000000) {
          console.log('⚠️ Limite de segurança atingido - finalizando...');
          hasMoreData = false;
        }
      }

      console.log('✅ Dados de volumetria carregados:', allData.length);
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