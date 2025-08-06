import { useEffect } from 'react';
import { useVolumetria } from '@/contexts/VolumetriaContext';

export function TempDebugComponent() {
  const { refreshData, data } = useVolumetria();
  
  useEffect(() => {
    console.log('🔥 COMPONENTE DEBUG MONTADO - Forçando refresh...');
    setTimeout(() => {
      refreshData();
    }, 2000);
  }, [refreshData]);
  
  useEffect(() => {
    if (data.detailedData.length > 0) {
      const cediData = data.detailedData.filter(item => item.EMPRESA === 'CEDI_RJ');
      const cediLaudos = cediData.reduce((sum, item) => sum + (Number(item.VALORES) || 0), 0);
      console.log('🎯 [COMPONENTE DEBUG] CEDI_RJ encontrado:', {
        registros: cediData.length,
        laudos: cediLaudos,
        primeiros: cediData.slice(0, 3)
      });
    }
  }, [data.detailedData]);
  
  return null;
}