
import Dashboard from "./Dashboard";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { generateImplementationReport } from "@/lib/wordGenerator";
import { toast } from "sonner";

export default function Index() {
  const handleGenerateReport = async () => {
    try {
      await generateImplementationReport();
      toast.success("Relatório Word gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      toast.error("Erro ao gerar relatório Word");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Button onClick={handleGenerateReport} className="gap-2">
          <FileText className="h-4 w-4" />
          Gerar Relatório Word
        </Button>
      </div>
      <Dashboard />
    </div>
  );
}
