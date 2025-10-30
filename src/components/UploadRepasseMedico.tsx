import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from 'xlsx';

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

      // Validar colunas do arquivo antes de enviar
      const reader = new FileReader();
      const validationPromise = new Promise<void>((resolve, reject) => {
        reader.onload = async (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
            
            if (jsonData.length === 0) {
              reject(new Error('Arquivo vazio'));
              return;
            }
            
            const headers = jsonData[0].map((h: any) => String(h).trim());
            const expectedHeaders = ['MEDICO', 'MODALIDADE', 'ESPECIALIDADE', 'CATEGORIA', 'PRIORIDADE', 'VALOR'];
            
            const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
            if (missingHeaders.length > 0) {
              reject(new Error(`Colunas obrigatórias faltando: ${missingHeaders.join(', ')}. Use o template fornecido.`));
              return;
            }
            
            resolve();
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      });
      
      reader.readAsArrayBuffer(file);
      await validationPromise;

      const formData = new FormData();
      formData.append('file', file);

      const { data, error } = await supabase.functions.invoke('processar-repasse-medico', {
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
