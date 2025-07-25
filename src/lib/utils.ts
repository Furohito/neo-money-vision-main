import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Utility for combining classNames (from your code)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format currency to Rupiah
export function formatCurrency(number: number) {
  return number.toLocaleString("id-ID", { style: "currency", currency: "IDR" });
}

// Detection Debouncer
export class DetectionDebouncer {
  private lastDetectionTime: number;
  private debounceTime: number;
  private lastDenomination?: number;

  constructor(debounceTime: number = 2000) {
    this.lastDetectionTime = 0;
    this.debounceTime = debounceTime;
  }

  shouldCount(detection: any): boolean {
    const now = Date.now();
    if (
      this.lastDenomination === detection.denomination &&
      now - this.lastDetectionTime < this.debounceTime
    ) {
      return false;
    }
    this.lastDenomination = detection.denomination;
    this.lastDetectionTime = now;
    return true;
  }

  reset() {
    this.lastDetectionTime = 0;
    this.lastDenomination = undefined;
  }
}

// Filter detection by confidence (contoh sederhana)
export function filterDetectionByConfidence(detection: any) {
  const minConfidence = 0.7;
  return {
    shouldCount: detection.confidence >= minConfidence,
    ...detection
  };
}

// Detection Tracker
export class DetectionTracker {
  private detections: any[] = [];

  recordDetection(detection: any) {
    this.detections.push({ ...detection, time: Date.now() });
  }

  reset() {
    this.detections = [];
  }
}

// Create detection summary
export function createDetectionSummary(detection: any) {
  return `Nominal: Rp${detection.denomination?.toLocaleString()}, Keyakinan: ${(detection.confidence*100).toFixed(1)}%`;
}

// Performance Monitor
export class PerformanceMonitor {
  private times: number[] = [];
  recordDetectionTime(start: number, end: number) {
    this.times.push(end - start);
  }
  reset() {
    this.times = [];
  }
}