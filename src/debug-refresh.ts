// Debug temporário para verificar dados MEDICINA INTERNA
import { supabase } from "@/integrations/supabase/client";

console.log('🔍 [DEBUG] Testando dados MEDICINA INTERNA para CEDI_RJ...');

// Buscar dados diretamente
supabase.rpc('get_volumetria_complete_data').then(({ data, error }) => {
  if (error) {
    console.error('❌ [DEBUG] Erro:', error);
    return;
  }
  
  // Filtrar CEDI_RJ + MEDICINA INTERNA
  const medInternaData = data?.filter((item: any) => 
    item.EMPRESA === 'CEDI_RJ' && item.ESPECIALIDADE === 'MEDICINA INTERNA'
  ) || [];
  
  console.log(`📊 [DEBUG] MEDICINA INTERNA CEDI_RJ: ${medInternaData.length} registros`);
  
  let totalLaudos = 0;
  let atrasados = 0;
  
  medInternaData.forEach((registro: any) => {
    const valores = Number(registro.VALORES) || 1;
    totalLaudos += valores;
    
    if (registro.DATA_LAUDO && registro.DATA_PRAZO && registro.HORA_LAUDO && registro.HORA_PRAZO) {
      const dataLaudo = new Date(`${registro.DATA_LAUDO}T${registro.HORA_LAUDO}`);
      const dataPrazo = new Date(`${registro.DATA_PRAZO}T${registro.HORA_PRAZO}`);
      if (dataLaudo > dataPrazo) {
        atrasados += valores;
      }
    }
    
    console.log(`   📝 VALORES: ${valores}, Total: ${totalLaudos}`);
  });
  
  console.log(`🎯 [DEBUG] RESULTADO CORRETO: ${atrasados} de ${totalLaudos} laudos`);
  console.log(`🎯 [DEBUG] Percentual: ${((atrasados / totalLaudos) * 100).toFixed(1)}%`);
});

export {};