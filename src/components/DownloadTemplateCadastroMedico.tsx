import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from 'xlsx';

export const DownloadTemplateCadastroMedico = () => {
  const handleDownload = () => {
    try {
      // Criar planilha com as colunas esperadas
      const headers = [
        'nome', 'especialidade', 'categoria', 'celular_pessoal', 'celular_coorporativo',
        'cpf', 'data_nascimento', 'pis', 'cep', 'rua', 'numero', 'complemento',
        'bairro', 'cidade', 'estado', 'pix', 'tipo_pix', 'banco', 'agencia', 'conta',
        'tipo_conta', 'crm', 'uf_crm', 'rqe'
      ];
      
      // Criar exemplo de linha
      const exampleRow = [
        'Dr. João Silva', 'Cardiologia', 'Categoria A', '(11) 99999-9999', '(11) 88888-8888',
        '123.456.789-00', '01/01/1980', '12345678900', '12345-678', 'Rua Exemplo', '100', 'Apto 101',
        'Centro', 'São Paulo', 'SP', '11999999999', 'celular', 'Banco do Brasil', '1234', '12345-6',
        'Corrente', '123456', 'SP', '1234'
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
