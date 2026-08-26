import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2, ZoomIn } from "lucide-react";

const CROP = 288; // tamanho do quadro de recorte em px
const OUTPUT = 512; // tamanho final da imagem gerada

type Props = {
  file: File | null;
  open: boolean;
  isSaving?: boolean;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
};

export function AvatarCropDialog({ file, open, isSaving, onCancel, onConfirm }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    if (!file) {
      setSrc(null);
      setImg(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setSrc(url);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    const image = new Image();
    image.onload = () => setImg(image);
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // escala base para preencher o quadro (cover)
  const baseScale = img ? Math.max(CROP / img.naturalWidth, CROP / img.naturalHeight) : 1;
  const dispW = img ? img.naturalWidth * baseScale * zoom : 0;
  const dispH = img ? img.naturalHeight * baseScale * zoom : 0;

  const clamp = useCallback(
    (x: number, y: number) => {
      const maxX = Math.max(0, (dispW - CROP) / 2);
      const maxY = Math.max(0, (dispH - CROP) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y)),
      };
    },
    [dispW, dispH],
  );

  useEffect(() => {
    setOffset((o) => clamp(o.x, o.y));
  }, [clamp]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setOffset(clamp(d.ox + (e.clientX - d.x), d.oy + (e.clientY - d.y)));
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const handleConfirm = () => {
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const ratio = OUTPUT / CROP;
    const dx = (CROP / 2 + offset.x - dispW / 2) * ratio;
    const dy = (CROP / 2 + offset.y - dispH / 2) * ratio;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, OUTPUT, OUTPUT);
    ctx.drawImage(img, dx, dy, dispW * ratio, dispH * ratio);
    canvas.toBlob(
      (blob) => {
        if (blob) onConfirm(blob);
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !isSaving && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar foto de perfil</DialogTitle>
          <DialogDescription>
            Arraste a imagem para posicionar e use o zoom para enquadrar. A prévia mostra
            exatamente como sua foto ficará.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-5">
          <div
            className="relative overflow-hidden rounded-full border-4 border-primary/20 bg-muted touch-none select-none cursor-grab active:cursor-grabbing"
            style={{ width: CROP, height: CROP }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {src && (
              <img
                src={src}
                alt="Prévia da foto de perfil"
                draggable={false}
                className="absolute left-1/2 top-1/2 max-w-none"
                style={{
                  width: dispW,
                  height: dispH,
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                }}
              />
            )}
          </div>

          <div className="flex w-full items-center gap-3 px-2">
            <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.01}
              onValueChange={(v) => setZoom(v[0] ?? 1)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!img || isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar foto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
