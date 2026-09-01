import { useCallback, useEffect, useRef } from "react";
import kaching from "@/assets/caching-demo-1.mp3.asset.json";

/**
 * Toca o efeito sonoro "kaching" nas notificações.
 * O áudio é pré-carregado e destravado no primeiro gesto do usuário
 * (exigência de autoplay no iOS/Android).
 */
export function useNotificationSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const audio = new Audio(kaching.url);
    audio.preload = "auto";
    audio.volume = 0.6;
    audioRef.current = audio;

    const unlock = () => {
      if (unlockedRef.current) return;
      unlockedRef.current = true;
      audio.muted = true;
      audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
        })
        .catch(() => {
          audio.muted = false;
        });
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.currentTime = 0;
      void audio.play().catch(() => {});
    } catch {
      /* nunca quebra a UI */
    }
  }, []);
}
