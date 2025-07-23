import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VolumetriaUpload } from '@/components/VolumetriaUpload';
import { FileUpload } from '@/components/FileUpload';
import { Upload, Database, FileSpreadsheet } from "lucide-react";

export default function UploadDados() {

  const handleUploadSuccess = () => {
    // Callback para sucesso no upload
    console.log('Upload realizado com sucesso');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Upload className="h-8 w-8" />
          Upload de Dados
        </h1>
        <p className="text-muted-foreground mt-1">
          Centralize todos os uploads de dados do sistema
        </p>
      </div>

      {/* Volumetria Uploads */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Volumetria</h2>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload - Volumetria Padrão</CardTitle>
            </CardHeader>
            <CardContent>
              <VolumetriaUpload 
                arquivoFonte="volumetria_padrao" 
                onSuccess={handleUploadSuccess} 
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upload - Volumetria Fora do Padrão</CardTitle>
            </CardHeader>
            <CardContent>
              <VolumetriaUpload 
                arquivoFonte="volumetria_fora_padrao" 
                onSuccess={handleUploadSuccess} 
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Faturamento Uploads */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Faturamento</h2>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload - Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <FileUpload
                title="Upload de Clientes"
                description="Upload de arquivo de clientes no formato CSV"
                acceptedTypes={['.csv', '.xlsx', '.xls']}
                maxSizeInMB={10}
                expectedFormat={["nome", "email", "telefone", "cnpj"]}
                onUpload={async (file) => {
                  console.log('Upload de clientes:', file.name);
                  handleUploadSuccess();
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upload - Contratos</CardTitle>
            </CardHeader>
            <CardContent>
              <FileUpload
                title="Upload de Contratos"
                description="Upload de arquivo de contratos no formato CSV"
                acceptedTypes={['.csv', '.xlsx', '.xls']}
                maxSizeInMB={10}
                expectedFormat={["cliente", "numero_contrato", "valor"]}
                onUpload={async (file) => {
                  console.log('Upload de contratos:', file.name);
                  handleUploadSuccess();
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upload - Exames</CardTitle>
            </CardHeader>
            <CardContent>
              <FileUpload
                title="Upload de Exames"
                description="Upload de arquivo de exames no formato CSV"
                acceptedTypes={['.csv', '.xlsx', '.xls']}
                maxSizeInMB={25}
                expectedFormat={["paciente", "medico", "modalidade", "especialidade"]}
                onUpload={async (file) => {
                  console.log('Upload de exames:', file.name);
                  handleUploadSuccess();
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upload - Faturas</CardTitle>
            </CardHeader>
            <CardContent>
              <FileUpload
                title="Upload de Faturas"
                description="Upload de arquivo de faturas no formato CSV"
                acceptedTypes={['.csv', '.xlsx', '.xls']}
                maxSizeInMB={25}
                expectedFormat={["numero_fatura", "cliente", "valor", "data_vencimento"]}
                onUpload={async (file) => {
                  console.log('Upload de faturas:', file.name);
                  handleUploadSuccess();
                }}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}