import { supabase } from '@/integrations/supabase/client';

// Usar as funções que realmente existem (conforme config.toml):
async function aplicarRegrasExistentes() {
  console.log('🔥 Aplicando regras com funções que existem...');
  
  // 1. Regras v002/v003
  console.log('1️⃣ Aplicando exclusões período (v002/v003)...');
  const { data: v002v003, error: errorV002 } = await supabase.functions.invoke('aplicar-exclusoes-periodo');
  if (errorV002) console.error('❌ Erro v002/v003:', errorV002);
  else console.log('✅ v002/v003 aplicadas:', v002v003);
  
  // 2. Prioridades
  console.log('2️⃣ Aplicando de-para prioridades...');
  const { data: prioridades, error: errorPrio } = await supabase.functions.invoke('aplicar-de-para-prioridades');
  if (errorPrio) console.error('❌ Erro prioridades:', errorPrio);
  else console.log('✅ Prioridades aplicadas:', prioridades);
  
  // 3. Modalidades
  console.log('3️⃣ Corrigindo modalidades...');
  const { data: modalidades, error: errorMod } = await supabase.functions.invoke('aplicar-correcao-modalidade-rx');
  if (errorMod) console.error('❌ Erro modalidades:', errorMod);
  else console.log('✅ Modalidades corrigidas:', modalidades);
}

aplicarRegrasExistentes();