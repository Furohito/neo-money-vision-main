export class DetectionTracker {
  recordDetection(data: any) {}
  reset() {}
}

export function createDetectionSummary(detection: any) {
  // Tampilkan summary sederhana
  return `Deteksi: ${JSON.stringify(detection)}`;
}

export class PerformanceMonitor {
  recordDetectionTime(start: number, end: number) {}
  reset() {}
}