"use client";

import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

export interface SignaturePadHandle {
  isEmpty: () => boolean;
  toDataURL: () => string;
  clear: () => void;
}

/**
 * لوحة توقيع بسيطة تعمل باللمس والفأرة، بدون أي مكتبة خارجية.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, { height?: number }>(
  function SignaturePad({ height = 160 }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const hasDrawn = useRef(false);
    const [isEmptyState, setIsEmptyState] = useState(true);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(ratio, ratio);
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#111827";
      }
    }, []);

    const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
      drawing.current = true;
      const ctx = canvasRef.current?.getContext("2d");
      const { x, y } = getPos(e);
      ctx?.beginPath();
      ctx?.moveTo(x, y);
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    };

    const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current) return;
      const ctx = canvasRef.current?.getContext("2d");
      const { x, y } = getPos(e);
      ctx?.lineTo(x, y);
      ctx?.stroke();
      hasDrawn.current = true;
      setIsEmptyState(false);
    };

    const end = () => { drawing.current = false; };

    useImperativeHandle(ref, () => ({
      isEmpty: () => !hasDrawn.current,
      toDataURL: () => canvasRef.current?.toDataURL("image/png") || "",
      clear: () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasDrawn.current = false;
        setIsEmptyState(true);
      },
    }));

    return (
      <div className="space-y-2">
        <div className="relative rounded-lg border-2 border-dashed border-border bg-white touch-none" style={{ height }}>
          <canvas
            ref={canvasRef}
            className="w-full h-full touch-none cursor-crosshair rounded-lg"
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
          />
          {isEmptyState && (
            <span className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground pointer-events-none">
              وقّع هنا بإصبعك أو الفأرة
            </span>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");
            if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            hasDrawn.current = false;
            setIsEmptyState(true);
          }}
        >
          <Eraser className="h-3.5 w-3.5 ml-1" /> مسح التوقيع
        </Button>
      </div>
    );
  }
);
