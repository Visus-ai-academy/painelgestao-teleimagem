import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UploadRepasseMedicoProps {
  onUploadComplete?: () => void;
}

export const UploadRepasseMedico = ({ onUploadComplete }: UploadRepasseMedicoProps) => {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      console.log('🔄 Iniciando upload de repasse médico:', file.name);

      const formData = new FormData();
      formData.append('file', file);

      const { data, error } = await supabase.functions.invoke('importar-repasse-medico', {
        body: formData
      });

      if (error) throw error;

      console.log('✅ Upload concluído:', data);
      toast.success(`Repasse médico processado com sucesso!`);
      
      // Disparar evento para atualizar outras telas
      window.dispatchEvent(new Event('repasse-updated'));
      
      if (onUploadComplete) {
        onUploadComplete();
      }

    } catch (error: any) {
      console.error('❌ Erro no upload:', error);
      toast.error(`Erro no upload: ${error.message}`);
    } finally {
      setIsUploading(false);
      // Reset input
      event.target.value = '';
    }
  };

  const handleButtonClick = () => {
    document.getElementById('upload-repasse-input')?.click();
  };

  return (
    <>
      <input
        id="upload-repasse-input"
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <Button
        onClick={handleButtonClick}
        disabled={isUploading}
        className="w-full gap-2"
      >
        {isUploading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
            Processando...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            Upload Repasse Médico
          </>
        )}
      </Button>
    </>
  );
};
