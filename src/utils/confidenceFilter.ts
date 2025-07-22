export class DetectionDebouncer {
  constructor(timeout: number) {}
  shouldCount(data: any) { return true; }
  reset() {}
}

export function filterDetectionByConfidence(detection: any) {
  // Dummy: selalu lolos deteksi
  return { ...detection, shouldCount: true };
}