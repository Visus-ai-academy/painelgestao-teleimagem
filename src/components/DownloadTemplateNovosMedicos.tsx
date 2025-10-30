import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from 'xlsx';

export const DownloadTemplateNovosMedicos = () => {
  const handleDownload = async () => {
    try {
      toast.info("Gerando template...");

      // Buscar todos os médicos ativos
      const { data: medicos, error: medicosError } = await supabase
        .from('medicos')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');

      if (medicosError) throw medicosError;

      // Buscar médicos que já têm repasse
      const { data: repasses, error: repassesError } = await supabase
        .from('medicos_valores_repasse')
        .select('medico_id');

      if (repassesError) throw repassesError;

      // IDs dos médicos que já têm repasse
      const medicosComRepasse = new Set(repasses?.map(r => r.medico_id) || []);

      // Filtrar médicos sem repasse
      const medicosSemRepasse = medicos?.filter(m => !medicosComRepasse.has(m.id)) || [];

      if (medicosSemRepasse.length === 0) {
        toast.info("Todos os médicos ativos já possuem repasse cadastrado!");
        return;
      }

      // Criar dados para o Excel usando os nomes de colunas originais
      const dadosExcel = medicosSemRepasse.map(medico => ({
        'MEDICO': medico.nome,
        'MODALIDADE': '',
        'ESPECIALIDADE': '',
        'CATEGORIA': '',
        'PRIORIDADE': '',
        'VALOR': '',
        'CONTRATADO': '',
        'CLIENTE': ''
      }));

      // Criar workbook e worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dadosExcel);

      // Ajustar largura das colunas
      const colWidths = [
        { wch: 30 }, // MEDICO
        { wch: 15 }, // MODALIDADE
        { wch: 20 }, // ESPECIALIDADE
        { wch: 15 }, // CATEGORIA
        { wch: 15 }, // PRIORIDADE
        { wch: 15 }, // VALOR
        { wch: 15 }, // CONTRATADO
        { wch: 30 }, // CLIENTE
      ];
      ws['!cols'] = colWidths;

      // Adicionar worksheet ao workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Novos Médicos');

      // Gerar arquivo e fazer download
      const dataAtual = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `template_repasse_novos_medicos_${dataAtual}.xlsx`);

      toast.success(`Template gerado com ${medicosSemRepasse.length} médico(s) sem repasse cadastrado!`);
    } catch (error: any) {
      console.error('Erro ao gerar template:', error);
      toast.error(`Erro ao gerar template: ${error.message}`);
    }
  };

  return (
    <Button
      onClick={handleDownload}
      variant="outline"
      className="gap-2"
    >
      <Download className="h-4 w-4" />
      Baixar Template - Novos Médicos
    </Button>
  );
};
