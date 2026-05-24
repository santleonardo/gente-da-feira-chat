// ═══════════════════════════════════════════════════════════
// Image compression utility — mobile-friendly
// Suporta HEIC/HEIF (iPhone), fallback JPEG se WebP falhar,
// e usa createObjectURL em vez de readAsDataURL para menor
// consumo de memória em dispositivos móveis.
// ═══════════════════════════════════════════════════════════

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

// Tipos MIME que o navegador consegue renderizar no <img>/<canvas>
const BROWSER_RENDERABLE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/avif",
  // iPhone / Safari podem reportar estes tipos:
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
];

// Verifica se o navegador suporta exportar WebP via canvas.toBlob
let _webpSupported: boolean | null = null;
async function checkWebPSupport(): Promise<boolean> {
  if (_webpSupported !== null) return _webpSupported;
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      canvas.toBlob(
        (blob) => {
          _webpSupported = blob !== null && blob.type === "image/webp";
          resolve(_webpSupported);
        },
        "image/webp",
        0.5
      );
    } catch {
      _webpSupported = false;
      resolve(false);
    }
  });
}

// ═══════════════════════════════════════════════════════════
// compressImage — comprime uma imagem para WebP (ou JPEG fallback)
// ═══════════════════════════════════════════════════════════
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const useWebP = await checkWebPSupport();
  const outputType = useWebP ? "image/webp" : "image/jpeg";
  const outputExt = useWebP ? "webp" : "jpg";

  return new Promise((resolve, reject) => {
    const img = new Image();

    // Usar createObjectURL em vez de readAsDataURL — muito mais
    // eficiente em memória para fotos grandes de celular (4-12MB).
    // O navegador faz decode streaming direto do Blob.
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      // Libera o object URL assim que a imagem carregar
      URL.revokeObjectURL(objectUrl);

      try {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        // Limita dimensões — fotos de celular podem ter 4000+ px
        if (width > opts.maxWidth! || height > opts.maxHeight!) {
          const ratio = Math.min(opts.maxWidth! / width, opts.maxHeight! / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // Mínimo 1px para evitar canvas vazio
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Erro ao criar contexto canvas"));
          return;
        }

        // Fundo branco para imagens com transparência (PNG → WebP/JPEG)
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Limpa referência da imagem para liberar memória
        img.src = "";

        const tryExport = (quality: number, isRetry: boolean = false) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                // Se WebP falhou, tenta JPEG como fallback
                if (outputType === "image/webp" && !isRetry) {
                  canvas.toBlob(
                    (jpegBlob) => {
                      if (!jpegBlob) {
                        reject(new Error("Erro ao comprimir imagem"));
                        return;
                      }
                      if (opts.maxSizeKB && jpegBlob.size > opts.maxSizeKB * 1024) {
                        compressIteratively(canvas, opts.maxSizeKB, "image/jpeg", resolve, reject);
                      } else {
                        resolve(jpegBlob);
                      }
                    },
                    "image/jpeg",
                    Math.min(quality, 0.8)
                  );
                  return;
                }
                reject(new Error("Erro ao comprimir imagem"));
                return;
              }

              if (opts.maxSizeKB && blob.size > opts.maxSizeKB * 1024) {
                compressIteratively(canvas, opts.maxSizeKB, outputType, resolve, reject);
              } else {
                resolve(blob);
              }
            },
            outputType,
            quality
          );
        };

        tryExport(opts.quality!);
      } catch (err) {
        reject(new Error("Erro ao processar imagem no canvas"));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Erro ao carregar imagem"));
    };

    // Para HEIC/HEIF: alguns navegadores (Safari 17+) conseguem
    // renderizar nativamente. Se não conseguir, o onerror será
    // chamado. Não tentamos conversão manual aqui — o fallback
    // é o usuário escolher formato compatível na câmera.
    img.src = objectUrl;
  });
}

// ═══════════════════════════════════════════════════════════
// compressIteratively — reduz qualidade gradativamente até
// atingir o tamanho desejado
// ═══════════════════════════════════════════════════════════
function compressIteratively(
  canvas: HTMLCanvasElement,
  maxSizeKB: number,
  outputType: string,
  resolve: (blob: Blob) => void,
  reject: (error: Error) => void,
  currentQuality: number = 0.45
) {
  if (currentQuality < 0.1) {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Erro na compressao"))),
      outputType,
      0.1
    );
    return;
  }

  canvas.toBlob(
    (blob) => {
      if (!blob) {
        // Fallback JPEG se WebP falhar na compressão iterativa
        if (outputType === "image/webp") {
          compressIteratively(canvas, maxSizeKB, "image/jpeg", resolve, reject, currentQuality);
          return;
        }
        reject(new Error("Erro na compressao"));
        return;
      }

      if (blob.size <= maxSizeKB * 1024) {
        resolve(blob);
      } else {
        compressIteratively(canvas, maxSizeKB, outputType, resolve, reject, currentQuality - 0.15);
      }
    },
    outputType,
    currentQuality
  );
}

// ═══════════════════════════════════════════════════════════
// validateImageFile — aceita HEIC/HEIF e tipos mobile
// ═══════════════════════════════════════════════════════════
export function validateImageFile(file: File): string | null {
  // Alguns celulares (Android) enviam fotos com type vazio ou
  // tipo não padrão. Verificamos pela extensão também.
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const heicExtensions = ["heic", "heif", "hif"];

  // Tipo MIME reconhecido
  if (BROWSER_RENDERABLE_TYPES.includes(file.type)) {
    // OK — tipo conhecido
  } else if (file.type === "" || file.type === "application/octet-stream") {
    // Tipo vazio — tenta reconhecer pela extensão
    if (!heicExtensions.includes(ext) && !["jpg", "jpeg", "png", "webp", "gif", "bmp", "avif"].includes(ext)) {
      return "Tipo nao suportado. Use JPG, PNG, WebP, GIF ou HEIC.";
    }
  } else if (!BROWSER_RENDERABLE_TYPES.includes(file.type)) {
    // Tipo MIME desconhecido — verifica extensão
    if (["jpg", "jpeg", "png", "webp", "gif", "bmp", "avif", ...heicExtensions].includes(ext)) {
      // Extensão válida — permite (o navegador pode conseguir renderizar)
    } else {
      return "Tipo nao suportado. Use JPG, PNG, WebP, GIF ou HEIC.";
    }
  }

  if (file.size > 20 * 1024 * 1024) {
    return "Imagem muito grande. Maximo 20MB antes da compressao.";
  }
  return null;
}

export function createPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}

export function revokePreviewUrl(url: string): void {
  URL.revokeObjectURL(url);
}
