
import Dashboard from "./Dashboard";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { downloadImplementationReport } from "@/lib/reportPdfGenerator";
import { useToast } from "@/hooks/use-toast";

export default function Index() {
  const { toast } = useToast();

  const handleDownloadReport = () => {
    try {
      downloadImplementationReport();
      toast({
        title: "Relatório gerado",
        description: "O download do PDF foi iniciado com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao gerar o relatório PDF.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end p-4">
        <Button 
          onClick={handleDownloadReport}
          className="flex items-center gap-2"
          variant="outline"
        >
          <FileText className="h-4 w-4" />
          Baixar Relatório de Implementações (PDF)
        </Button>
      </div>
      <Dashboard />
    </div>
  );
}
