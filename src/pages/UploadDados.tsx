import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileUpload } from '@/components/FileUpload';
import { FileText } from "lucide-react";

export default function UploadDados() {

  const handleUploadSuccess = () => {
    // Callback para sucesso no upload
    console.log('Upload realizado com sucesso');
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload de Dados</h1>
        <p className="text-muted-foreground mt-2">
          Upload do arquivo de referência para preenchimento automático de valores
        </p>
      </div>

      {/* Seção Arquivo de Referência - De Para */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Arquivo de Referência - De Para
          </CardTitle>
          <CardDescription>
            Upload do arquivo de referência com valores para preenchimento automático dos arquivos fora do padrão
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUpload
            title="Tabela De Para (ESTUDO_DESCRICAO x VALORES)"
            description="Arquivo com as colunas ESTUDO_DESCRICAO e VALORES para preenchimento automático dos valores zerados nos arquivos 1, 2, 3 e 4"
            acceptedTypes={['.csv', '.xlsx', '.xls']}
            maxSizeInMB={50}
            expectedFormat={["ESTUDO_DESCRICAO", "VALORES"]}
            onUpload={async (file) => {
              console.log('Upload de arquivo de referência:', file.name);
              handleUploadSuccess();
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}