import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from 'xlsx';

export const DownloadTemplateCadastroMedico = () => {
  const handleDownload = () => {
    try {
      // Criar planilha com as colunas corretas para cadastro médico
      const headers = [
        'Nome_Médico',
        'CRM',
        'CPF',
        'Status_Ativo_Médico',
        'Sócio?',
        'Função',
        'Especialidadede Atuação',
        'Equipe',
        'Acrescimo sem digitador',
        'Adicional de Valor sem utilizar digitador',
        'Nome_empresa',
        'CNPJ',
        'Telefone',
        'E-MAIL',
        'Optante pelo simples',
        'Contas a Pagar'
      ];
      
      // Criar exemplo de linha
      const exampleRow = [
        'Dr. João Silva',
        '123456',
        '123.456.789-00',
        'Ativo',
        'Sim',
        'Médico',
        'Cardiologia',
        'Equipe A',
        '100',
        '50',
        'Clínica Exemplo LTDA',
        '12.345.678/0001-90',
        '(11) 99999-9999',
        'joao.silva@exemplo.com',
        'Sim',
        'Conta Exemplo'
      ];
      
      // Criar workbook e worksheet
      const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Médicos');
      
      // Gerar arquivo
      XLSX.writeFile(wb, 'template_cadastro_medicos.xlsx');
      
      toast.success("Template de cadastro baixado com sucesso!");
    } catch (error: any) {
      console.error('Erro ao baixar template:', error);
      toast.error(`Erro ao baixar template: ${error.message}`);
    }
  };

  return (
    <Button
      onClick={handleDownload}
      className="gap-2 w-full"
    >
      <Download className="h-4 w-4" />
      Baixar Template - Cadastro Médico
    </Button>
  );
};
