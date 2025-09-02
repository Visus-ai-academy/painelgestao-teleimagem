import { supabase } from "@/integrations/supabase/client";

async function finalizarUploads() {
  console.log('🔄 Finalizando uploads travados...');
  
  const uploadsParaFinalizar = [
    { id: '4cf0b46d-511f-4361-89ff-0e1dc95de648', nome: 'retroativo_padrao', registros: 33239 },
    { id: '77cf10a2-a29b-4559-b427-35c4263f2406', nome: 'retroativo_fora_padrao', registros: 26 },
    { id: 'ff745221-04e0-4472-8b26-2b9698dbfacc', nome: 'fora_padrao', registros: 25 },
    { id: 'c521fcb9-7241-4aec-ace3-08b8bd9b12fd', nome: 'padrao', registros: 34221 }
  ];
  
  for (const upload of uploadsParaFinalizar) {
    console.log(`✅ Finalizando ${upload.nome}...`);
    
    const { error } = await supabase
      .from('processamento_uploads')
      .update({
        status: 'concluido',
        completed_at: new Date().toISOString()
      })
      .eq('id', upload.id);
    
    if (error) {
      console.error(`❌ Erro ao finalizar ${upload.nome}:`, error);
    } else {
      console.log(`✅ ${upload.nome} finalizado com ${upload.registros} registros`);
    }
  }
  
  // Verificar resultado
  const { data: statusFinal } = await supabase
    .from('processamento_uploads')
    .select('arquivo_nome, status, completed_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log('📋 Status final dos uploads:', statusFinal);
}

finalizarUploads();

export {};