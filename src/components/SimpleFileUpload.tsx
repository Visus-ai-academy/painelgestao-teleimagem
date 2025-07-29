import { Button } from "@/components/ui/button";
import { Upload, File } from "lucide-react";
import { useRef } from "react";

interface SimpleFileUploadProps {
  onUpload: (file: File) => Promise<void>;
  acceptedTypes: string[];
  title: string;
  isUploading?: boolean;
}

export function SimpleFileUpload({ onUpload, acceptedTypes, title, isUploading }: SimpleFileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        await onUpload(file);
      } catch (error) {
        console.error('Erro no upload:', error);
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes.join(',')}
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <Button
        onClick={handleButtonClick}
        disabled={isUploading}
        className="w-full flex items-center gap-2"
        variant="outline"
      >
        {isUploading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
            Processando...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            {title}
          </>
        )}
      </Button>
      
      <div className="text-xs text-muted-foreground text-center">
        <File className="h-3 w-3 inline mr-1" />
        {acceptedTypes.join(', ')}
      </div>
    </div>
  );
}