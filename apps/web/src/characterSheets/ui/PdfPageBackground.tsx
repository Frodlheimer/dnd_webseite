import { useEffect, useRef, useState } from 'react';

const PDF_STANDARD_FONT_DATA_URL = '/standard_fonts/';

type PdfPageBackgroundProps = {
  enabled: boolean;
  pdfUrl: string;
  pageNumber: number;
  width: number;
  height: number;
  scale: number;
};

export const PdfPageBackground = ({
  enabled,
  pdfUrl,
  pageNumber,
  width,
  height,
  scale
}: PdfPageBackgroundProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setError(null);
      return;
    }

    let cancelled = false;
    let loadingTask:
      | {
          promise: Promise<{
            getPage: (index: number) => Promise<unknown>;
            destroy: () => Promise<void>;
          }>;
          destroy?: () => void;
        }
      | null = null;
    let cleanupDocument: (() => Promise<void>) | null = null;

    const run = async () => {
      try {
        const [pdfjs, workerSrc] = await Promise.all([
          import('pdfjs-dist/legacy/build/pdf.mjs'),
          import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
        ]);

        if (cancelled) {
          return;
        }

        pdfjs.GlobalWorkerOptions.workerSrc = workerSrc.default;
        loadingTask = pdfjs.getDocument({
          url: pdfUrl,
          standardFontDataUrl: PDF_STANDARD_FONT_DATA_URL
        });
        const pdfDocument = await loadingTask.promise;
        cleanupDocument = async () => {
          await pdfDocument.destroy();
        };

        if (cancelled) {
          return;
        }

        const page = (await pdfDocument.getPage(pageNumber)) as {
          getViewport: (args: { scale: number }) => { width: number; height: number };
          render: (args: {
            canvasContext: CanvasRenderingContext2D;
            viewport: { width: number; height: number };
          }) => { promise: Promise<void> };
        };
        const viewport = page.getViewport({
          scale
        });

        const canvas = canvasRef.current;
        if (!canvas) {
          return;
        }
        const context = canvas.getContext('2d');
        if (!context) {
          return;
        }

        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        await page.render({
          canvasContext: context,
          viewport
        }).promise;
        if (!cancelled) {
          setError(null);
        }
      } catch (renderError) {
        if (!cancelled) {
          setError(renderError instanceof Error ? renderError.message : 'Could not render PDF page');
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (loadingTask?.destroy) {
        loadingTask.destroy();
      }
      if (cleanupDocument) {
        void cleanupDocument();
      }
    };
  }, [enabled, pageNumber, pdfUrl, scale, width, height]);

  if (!enabled) {
    return null;
  }

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 z-[1] h-full w-full" aria-hidden="true" />
      {error ? (
        <div className="absolute inset-0 z-[2] flex items-center justify-center bg-slate-950/60 px-3 text-center text-xs text-rose-200">
          Failed to render PDF background.
        </div>
      ) : null}
    </>
  );
};
