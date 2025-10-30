import { supabase } from "@/integrations/supabase/client";

export async function inativarMedicosLote() {
  const medicosParaInativar = [
    'Dr. Alvaro Dias Simoes',
    'Dr. Andre Campanha Minikowski',
    'Dr. Carlos Henrique Viana Filho',
    'Dr. Gustavo Corrêa de Almeida Teixeira',
    'Dr. Jeferson Luis Castellano',
    'Dr. Murilo Bambini Mandola',
    'Dr. Murilo Rebechi',
    'Dr. Paulo Monteiro Saldanha Altenfelder Santos',
    'Dr. Rafael José de Oliveira',
    'Dr. Rafael Lopes Srebro',
    'Dr. Tiago Fernando Battazza Iasbech',
    'Dra. Ananda Peixoto de Araujo',
    'Dra. Carol Saito Leopoldo e Silva',
    'Dra. Lourdes Judith Medeiros Max',
    'Dra. Marina Guareschi Berigo',
    'Dra. Marina Lumi Sato',
    'Dra. Rosacelia Coelho Brito'
  ];

  console.log('🔄 Inativando médicos em lote...');

  const { data, error } = await supabase.functions.invoke('inativar-medicos-lote', {
    body: { medicos_nomes: medicosParaInativar }
  });

  if (error) {
    console.error('❌ Erro ao inativar médicos:', error);
    throw error;
  }

  console.log('✅ Médicos inativados com sucesso:', data);
  return data;
}
