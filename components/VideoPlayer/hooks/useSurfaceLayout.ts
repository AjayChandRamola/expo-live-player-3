// components/VideoPlayer/hooks/useSurfaceLayout.ts
import { useCallback, useState } from "react";
import type { LayoutChangeEvent } from "react-native";

export interface SurfaceLayout {
  readonly width: number;
  readonly height: number;
}

export function useSurfaceLayout(): readonly [SurfaceLayout, (event: LayoutChangeEvent) => void] {
  const [layout, setLayout] = useState<SurfaceLayout>({ width: 0, height: 0 });
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);
  return [layout, onLayout] as const;
}
