// ============================================================
// Utilitário de compressão de imagens no cliente
// Comprime para WebP, redimensiona para máx 800px, qualidade 55
// Resultado: ~60-100KB por foto
// ============================================================

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeKB?: number;
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 800,
  maxHeight: 800,
  quality: 0.55,
  maxSizeKB: 150,
};

/**
 * Comprime uma imagem usando Canvas API
 * - Redimensiona mantendo aspect ratio
 * - Converte para WebP (melhor compressão)
 * - Se ainda maior que maxSizeKB, reduz qualidade progressivamente
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Erro ao ler imagem"));

    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;

      // Redimensionar mantendo aspect ratio
      if (width > opts.maxWidth! || height > opts.maxHeight!) {
        const ratio = Math.min(opts.maxWidth! / width, opts.maxHeight! / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Erro ao criar contexto canvas"));
        return;
      }

      // Fundo branco para PNGs com transparência
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Primeira tentativa com qualidade especificada
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Erro ao comprimir imagem"));
            return;
          }

          // Se ainda maior que maxSizeKB, reduzir qualidade progressivamente
          if (opts.maxSizeKB && blob.size > opts.maxSizeKB * 1024) {
            compressIteratively(canvas, opts.maxSizeKB, resolve, reject);
          } else {
            resolve(blob);
          }
        },
        "image/webp",
        opts.quality
      );
    };

    img.onerror = () => reject(new Error("Erro ao carregar imagem"));
    reader.readAsDataURL(file);
  });
}

/**
 * Compressão iterativa - reduz qualidade até atingir o tamanho desejado
 */
function compressIteratively(
  canvas: HTMLCanvasElement,
  maxSizeKB: number,
  resolve: (blob: Blob) => void,
  reject: (error: Error) => void,
  currentQuality: number = 0.45
) {
  if (currentQuality < 0.1) {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Erro na compressão"))),
      "image/webp",
      0.1
    );
    return;
  }

  canvas.toBlob(
    (blob) => {
      if (!blob) {
        reject(new Error("Erro na compressão"));
        return;
      }

      if (blob.size <= maxSizeKB * 1024) {
        resolve(blob);
      } else {
        compressIteratively(canvas, maxSizeKB, resolve, reject, currentQuality - 0.15);
      }
    },
    "image/webp",
    currentQuality
  );
}

/**
 * Valida se o arquivo é uma imagem suportada
 */
export function validateImageFile(file: File): string | null {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    return "Tipo não suportado. Use JPG, PNG, WebP ou GIF.";
  }
  if (file.size > 10 * 1024 * 1024) {
    return "Imagem muito grande. Máximo 10MB antes da compressão.";
  }
  return null;
}

/**
 * Cria preview URL para exibição
 */
export function createPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}

/**
 * Libera preview URL da memória
 */
export function revokePreviewUrl(url: string): void {
  URL.revokeObjectURL(url);
}
