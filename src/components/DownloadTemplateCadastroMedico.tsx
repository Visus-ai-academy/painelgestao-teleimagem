import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

export const DownloadTemplateCadastroMedico = () => {
  const handleDownload = () => {
    try {
      // Link para o template existente na pasta public
      const link = document.createElement('a');
      link.href = '/templates/template_medicos.xlsx';
      link.download = 'template_cadastro_medicos.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Template de cadastro baixado com sucesso!");
    } catch (error: any) {
      console.error('Erro ao baixar template:', error);
      toast.error(`Erro ao baixar template: ${error.message}`);
    }
  };

  return (
    <Button
      onClick={handleDownload}
      variant="outline"
      className="gap-2"
    >
      <Download className="h-4 w-4" />
      Baixar Template - Cadastro Médico
    </Button>
  );
};
