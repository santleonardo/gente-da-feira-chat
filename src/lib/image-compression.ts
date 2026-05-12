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

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Erro ao comprimir imagem"));
            return;
          }

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

function compressIteratively(
  canvas: HTMLCanvasElement,
  maxSizeKB: number,
  resolve: (blob: Blob) => void,
  reject: (error: Error) => void,
  currentQuality: number = 0.45
) {
  if (currentQuality < 0.1) {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Erro na compressao"))),
      "image/webp",
      0.1
    );
    return;
  }

  canvas.toBlob(
    (blob) => {
      if (!blob) {
        reject(new Error("Erro na compressao"));
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

export function validateImageFile(file: File): string | null {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    return "Tipo nao suportado. Use JPG, PNG, WebP ou GIF.";
  }
  if (file.size > 10 * 1024 * 1024) {
    return "Imagem muito grande. Maximo 10MB antes da compressao.";
  }
  return null;
}

export function createPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}

export function revokePreviewUrl(url: string): void {
  URL.revokeObjectURL(url);
}
