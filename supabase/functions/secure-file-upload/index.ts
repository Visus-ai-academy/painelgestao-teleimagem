import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FileValidationRequest {
  filename: string;
  fileSize: number;
  mimeType: string;
  checksum?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar autenticação
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const { filename, fileSize, mimeType, checksum }: FileValidationRequest = await req.json();

    console.log(`📁 Validando arquivo: ${filename}`);

    // Validações de segurança
    const validationResult = validateFile(filename, fileSize, mimeType);
    
    if (!validationResult.isValid) {
      console.log(`❌ Arquivo rejeitado: ${validationResult.reason}`);
      return new Response(
        JSON.stringify({ 
          error: 'File validation failed', 
          reason: validationResult.reason 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Log de segurança
    await supabase.from('audit_logs').insert({
      table_name: 'file_uploads',
      operation: 'UPLOAD_VALIDATED',
      record_id: checksum || 'unknown',
      new_data: {
        filename,
        fileSize,
        mimeType,
        validationPassed: true
      },
      user_email: 'system',
      severity: 'info'
    });

    console.log(`✅ Arquivo validado com sucesso: ${filename}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'File validation passed',
        sanitizedFilename: sanitizeFilename(filename)
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('❌ Erro na validação:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});

function validateFile(filename: string, fileSize: number, mimeType: string): { isValid: boolean; reason?: string } {
  // Validar extensão do arquivo
  const allowedExtensions = ['.xlsx', '.xls', '.csv', '.pdf'];
  const fileExtension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  
  if (!allowedExtensions.includes(fileExtension)) {
    return { isValid: false, reason: 'Extensão de arquivo não permitida' };
  }

  // Validar MIME type
  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/pdf'
  ];

  if (!allowedMimeTypes.includes(mimeType)) {
    return { isValid: false, reason: 'Tipo de arquivo não permitido' };
  }

  // Validar tamanho do arquivo (máximo 50MB)
  const maxSize = 50 * 1024 * 1024;
  if (fileSize > maxSize) {
    return { isValid: false, reason: 'Arquivo muito grande (máximo 50MB)' };
  }

  // Validar tamanho mínimo
  if (fileSize < 100) {
    return { isValid: false, reason: 'Arquivo muito pequeno ou vazio' };
  }

  // Validar caracteres no nome do arquivo
  const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (dangerousChars.test(filename)) {
    return { isValid: false, reason: 'Nome do arquivo contém caracteres não permitidos' };
  }

  // Validar comprimento do nome
  if (filename.length > 255) {
    return { isValid: false, reason: 'Nome do arquivo muito longo' };
  }

  return { isValid: true };
}

function sanitizeFilename(filename: string): string {
  // Remove caracteres perigosos e espaços extras
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .trim();
}