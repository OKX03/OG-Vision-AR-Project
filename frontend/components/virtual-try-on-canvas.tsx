"use client";

import VirtualTryOn from "@/components/virtual-try-on";

type Props = {
  modelPath: string | null;
  initialCalibration?: any;
  staticImageSrc?: string | null;
};

export default function VirtualTryOnCanvas({ modelPath, initialCalibration, staticImageSrc }: Props) {

  return <VirtualTryOn modelPath={modelPath || ""} initialCalibration={initialCalibration} staticImageSrc={staticImageSrc} />;
}