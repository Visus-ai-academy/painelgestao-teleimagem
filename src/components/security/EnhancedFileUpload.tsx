import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, AlertTriangle, CheckCircle, X, FileText, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface FileUploadProps {
  onFileProcessed?: (result: any) => void;
  maxFileSize?: number;
  allowedTypes?: string[];
  validateContent?: boolean;
}

export function EnhancedFileUpload({ 
  onFileProcessed, 
  maxFileSize = 50 * 1024 * 1024,
  allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  validateContent = true
}: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  const validateFileEnhanced = async (file: File): Promise<ValidationResult> => {
    try {
      let contentSample = '';
      
      if (validateContent && file.type === 'text/csv') {
        // Read first 1KB of CSV files for content validation
        const slice = file.slice(0, 1024);
        contentSample = await slice.text();
      }

      // Use direct SQL call since the function might not be in types yet
      const { data, error } = await supabase.rpc('validate_file_upload_enhanced' as any, {
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        file_content_sample: contentSample || null
      });

      if (error) {
        console.error('Validation error:', error);
        // Fallback to basic validation
        return {
          valid: file.size <= maxFileSize && allowedTypes.includes(file.type),
          errors: file.size > maxFileSize ? ['File size exceeds limit'] : 
                  !allowedTypes.includes(file.type) ? ['Invalid file type'] : [],
          warnings: []
        };
      }

      // Type assertion for the response
      const validationData = data as any;
      return {
        valid: validationData?.valid || false,
        errors: validationData?.errors || [],
        warnings: validationData?.warnings || []
      };
    } catch (error) {
      console.error('Erro na validação:', error);
      return {
        valid: false,
        errors: ['Erro interno na validação do arquivo'],
        warnings: []
      };
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setValidationResult(null);
    setUploadProgress(0);

    // Validate file
    const validation = await validateFileEnhanced(file);
    setValidationResult(validation);

    if (validation.valid) {
      toast({
        title: "Arquivo Válido",
        description: "O arquivo passou na validação de segurança",
      });
    } else {
      toast({
        title: "Arquivo Rejeitado",
        description: "O arquivo não passou na validação de segurança",
        variant: "destructive",
      });
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !validationResult?.valid) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      // Here you would implement the actual file upload logic
      // For now, we'll simulate a successful upload
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      toast({
        title: "Upload Concluído",
        description: "Arquivo enviado com sucesso",
      });

      if (onFileProcessed) {
        onFileProcessed({
          filename: selectedFile.name,
          size: selectedFile.size,
          type: selectedFile.type,
          status: 'success'
        });
      }

      // Reset form
      setSelectedFile(null);
      setValidationResult(null);
      setUploadProgress(0);

    } catch (error) {
      console.error('Erro no upload:', error);
      toast({
        title: "Erro no Upload",
        description: "Falha ao enviar o arquivo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setValidationResult(null);
    setUploadProgress(0);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Upload Seguro de Arquivos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Input */}
        <div className="space-y-2">
          <Input
            type="file"
            onChange={handleFileSelect}
            accept={allowedTypes.join(',')}
            disabled={uploading}
          />
          <div className="text-xs text-muted-foreground">
            Tipos aceitos: CSV, Excel. Tamanho máximo: {formatFileSize(maxFileSize)}
          </div>
        </div>

        {/* File Info */}
        {selectedFile && (
          <Card className="bg-gray-50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-blue-500" />
                  <div>
                    <div className="font-medium">{selectedFile.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatFileSize(selectedFile.size)} • {selectedFile.type}
                    </div>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearFile}
                  disabled={uploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Validation Results */}
        {validationResult && (
          <div className="space-y-2">
            {/* Status Badge */}
            <div className="flex items-center gap-2">
              {validationResult.valid ? (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Validação Aprovada
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Validação Rejeitada
                </Badge>
              )}
            </div>

            {/* Errors */}
            {validationResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-1">Problemas encontrados:</div>
                  <ul className="text-sm space-y-1">
                    {validationResult.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Warnings */}
            {validationResult.warnings.length > 0 && (
              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription>
                  <div className="font-medium mb-1 text-yellow-800">Avisos:</div>
                  <ul className="text-sm space-y-1 text-yellow-700">
                    {validationResult.warnings.map((warning, index) => (
                      <li key={index}>• {warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Upload Progress */}
        {uploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Enviando arquivo...</span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        {/* Upload Button */}
        <Button
          onClick={handleUpload}
          disabled={!selectedFile || !validationResult?.valid || uploading}
          className="w-full"
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? 'Enviando...' : 'Enviar Arquivo'}
        </Button>
      </CardContent>
    </Card>
  );
}
