import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Square, X, Download, RotateCcw, Loader2, Image } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { detectCurrency, initializeCurrencyDetection } from '../models/currencyDetector';
import { DetectionDebouncer, filterDetectionByConfidence } from '../utils/confidenceFilter';
import { DetectionTracker, createDetectionSummary, PerformanceMonitor } from '../utils/detectionUtils';
import { formatCurrency as formatCurrencyUtil } from '../utils/currencyMapping';
import html2canvas from 'html2canvas';
import 'html2canvas/dist/html2canvas.min.js'; // Ensure html2canvas is imported correctly

interface MoneyData {
  count: number;
  nominal: number;
  subtotal: number;
}

const MoneyCounter = () => {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const tableRef = useRef<HTMLDivElement>(null); // Untuk gambar tabel
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCamera, setIsCamera] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [moneyData, setMoneyData] = useState<MoneyData[]>([]);

  // Utility class instances
  const debouncer = useRef(new DetectionDebouncer(2000));
  const tracker = useRef(new DetectionTracker());
  const performanceMonitor = useRef(new PerformanceMonitor());

  const denominations = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100];

  useEffect(() => {
    const initAI = async () => {
      const success = await initializeCurrencyDetection();
      setIsInitialized(success);
      if (success) {
        toast({
          title: "AI System Ready",
          description: "Sistem deteksi AI telah siap digunakan",
        });
      } else {
        toast({
          title: "AI System Warning",
          description: "Sistem AI tidak dapat dimuat, menggunakan deteksi alternatif",
          variant: "destructive"
        });
      }
    };
    initAI();
  }, [toast]);

  const formatCurrency = (number: number) => formatCurrencyUtil(number);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      setStream(mediaStream);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
      setIsCamera(true);
      toast({
        title: "Kamera Aktif",
        description: "Kamera siap digunakan untuk menghitung uang",
      });
    } catch (err) {
      console.error('Error accessing camera:', err);
      toast({
        title: "Error",
        description: "Tidak dapat mengakses kamera. Pastikan Anda memberikan izin kamera.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      if (videoRef.current) videoRef.current.srcObject = null;
      setIsCamera(false);
      toast({
        title: "Kamera Dimatikan",
        description: "Kamera telah dimatikan",
      });
    }
  }, [stream, toast]);

  const detectMoney = useCallback(async () => {
    if (!videoRef.current || isDetecting) return;
    setIsDetecting(true);
    const startTime = performance.now();
    try {
      const detection = await detectCurrency(videoRef.current);
      const endTime = performance.now();
      performanceMonitor.current.recordDetectionTime(startTime, endTime);

      if (!detection) {
        toast({
          title: "Detection Failed",
          description: "Tidak dapat mendeteksi uang. Coba lagi.",
          variant: "destructive"
        });
        setIsDetecting(false);
        return;
      }
      const filteredDetection = filterDetectionByConfidence(detection);
      if (!filteredDetection.shouldCount) {
        toast({
          title: "Confidence Too Low",
          description: "Tingkat kepercayaan deteksi terlalu rendah. Coba lagi dengan pencahayaan yang lebih baik.",
          variant: "destructive"
        });
        setIsDetecting(false);
        return;
      }
      if (!debouncer.current.shouldCount(detection)) {
        toast({
          title: "Duplicate Detection",
          description: "Uang yang sama baru saja terdeteksi. Tunggu sebentar sebelum mencoba lagi.",
        });
        setIsDetecting(false);
        return;
      }
      tracker.current.recordDetection(detection);
      const denomination = detection.denomination;
      const count = 1;
      setMoneyData(prevData => {
        const existingIndex = prevData.findIndex(item => item.nominal === denomination);
        let newData;
        if (existingIndex >= 0) {
          newData = [...prevData];
          newData[existingIndex].count += count;
          newData[existingIndex].subtotal = newData[existingIndex].count * denomination;
        } else {
          newData = [...prevData, { count, nominal: denomination, subtotal: count * denomination }];
        }
        return newData.sort((a, b) => b.nominal - a.nominal);
      });
      const summary = createDetectionSummary(detection);
      toast({
        title: "Uang Terdeteksi!",
        description: summary,
      });
    } catch (error) {
      console.error('Detection error:', error);
      toast({
        title: "Error",
        description: "Terjadi kesalahan saat mendeteksi uang.",
        variant: "destructive"
      });
    } finally {
      setIsDetecting(false);
    }
  }, [toast, isDetecting]);

  const downloadCSV = useCallback(() => {
    let csvContent = "data:text/csv;charset=utf-8,Jumlah,Nominal,Subtotal\n";
    moneyData.forEach(item => {
      csvContent += `${item.count},${formatCurrency(item.nominal)},${formatCurrency(item.subtotal)}\n`;
    });
    const total = moneyData.reduce((sum, item) => sum + item.subtotal, 0);
    csvContent += `,,${formatCurrency(total)}\n`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "hasil_hitung_uang.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({
      title: "CSV Downloaded",
      description: "File hasil perhitungan telah didownload",
    });
  }, [moneyData, toast]);

  // INTEGRASI DOWNLOAD GAMBAR TABEL
  const downloadTableImage = useCallback(() => {
    if (!tableRef.current) return;
    html2canvas(tableRef.current, { scale: 2 }).then(canvas => {
      const link = document.createElement('a');
      link.download = 'hasil_hitung_uang.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast({
        title: "Gambar Tabel Diunduh",
        description: "Tabel hasil perhitungan telah didownload sebagai gambar",
      });
    });
  }, [toast]);

  const resetData = useCallback(() => {
    setMoneyData([]);
    debouncer.current.reset();
    tracker.current.reset();
    performanceMonitor.current.reset();
    toast({
      title: "Data Direset",
      description: "Semua data perhitungan telah dihapus",
    });
  }, [toast]);

  const total = moneyData.reduce((sum, item) => sum + item.subtotal, 0);

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4 lg:p-6">
      {/* Navbar */}
      <div className="neo-card bg-primary text-primary-foreground p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-lg sm:text-xl lg:text-2xl font-black uppercase tracking-wider leading-tight">
            PENGHITUNG UANG OTOMATIS
          </h1>
          <Button 
            onClick={isCamera ? stopCamera : startCamera}
            className="neo-button bg-accent text-accent-foreground neo-shadow-sm font-black uppercase w-full sm:w-auto"
            size="lg"
          >
            <Camera className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            <span className="text-sm sm:text-base">{isCamera ? 'TUTUP KAMERA' : 'BUKA KAMERA'}</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
        {/* Camera Section */}
        <div className="neo-card p-3 sm:p-4 lg:p-6">
          <h2 className="text-lg sm:text-xl font-black mb-4 uppercase tracking-wide">KAMERA</h2>
          {isCamera ? (
            <div className="space-y-3 sm:space-y-4">
              <div className="relative neo-border bg-black">
                <video 
                  ref={videoRef}
                  className="w-full h-auto"
                  autoPlay 
                  playsInline
                />
                <div className="absolute inset-2 sm:inset-4 border-2 sm:border-4 border-dashed border-secondary pointer-events-none"></div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Button 
                  onClick={detectMoney}
                  disabled={isDetecting || !isInitialized}
                  className="neo-button bg-secondary text-secondary-foreground neo-shadow-sm font-black uppercase flex-1 text-sm sm:text-base py-3"
                >
                  {isDetecting ? (
                    <>
                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin" />
                      MENDETEKSI...
                    </>
                  ) : (
                    <>
                      <Square className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                      AMBIL GAMBAR
                    </>
                  )}
                </Button>
                <Button 
                  onClick={stopCamera}
                  className="neo-button bg-destructive text-destructive-foreground neo-shadow-sm font-black uppercase text-sm sm:text-base py-3 px-6"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="neo-border bg-muted p-6 sm:p-8 lg:p-12 text-center min-h-[250px] sm:min-h-[300px] flex flex-col items-center justify-center">
              <Camera className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground mb-4" />
              <p className="font-bold text-sm sm:text-lg uppercase text-center leading-relaxed">
                KLIK "BUKA KAMERA" UNTUK MULAI MENGHITUNG UANG
              </p>
            </div>
          )}
        </div>

        {/* Results Section */}
        <div className="neo-card p-3 sm:p-4 lg:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
            <h2 className="text-lg sm:text-xl font-black uppercase tracking-wide">HASIL PERHITUNGAN</h2>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button 
                onClick={resetData}
                className="neo-button bg-destructive text-destructive-foreground neo-shadow-sm font-black uppercase text-xs sm:text-sm px-2 sm:px-3 py-2 flex-1 sm:flex-none"
                size="sm"
              >
                <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                <span className="hidden sm:inline">RESET</span>
                <span className="sm:hidden">RST</span>
              </Button>
              <Button 
                onClick={downloadCSV}
                className="neo-button bg-success text-success-foreground neo-shadow-sm font-black uppercase text-xs sm:text-sm px-2 sm:px-3 py-2 flex-1 sm:flex-none"
                size="sm"
              >
                <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                <span className="hidden sm:inline">CSV</span>
                <span className="sm:hidden">DL</span>
              </Button>
              {/* Tombol Download Gambar */}
              <Button 
                onClick={downloadTableImage}
                className="neo-button bg-info text-info-foreground neo-shadow-sm font-black uppercase text-xs sm:text-sm px-2 sm:px-3 py-2 flex-1 sm:flex-none"
                size="sm"
              >
                <Image className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                <span className="hidden sm:inline">IMG</span>
                <span className="sm:hidden">IMG</span>
              </Button>
            </div>
          </div>
          
          {/* ref di sini! */}
          <div ref={tableRef} className="neo-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[300px]">
                <thead>
                  <tr className="bg-primary text-primary-foreground">
                    <th className="p-2 sm:p-3 lg:p-4 text-left font-black uppercase text-xs sm:text-sm lg:text-base">JUMLAH</th>
                    <th className="p-2 sm:p-3 lg:p-4 text-left font-black uppercase text-xs sm:text-sm lg:text-base">NOMINAL</th>
                    <th className="p-2 sm:p-3 lg:p-4 text-left font-black uppercase text-xs sm:text-sm lg:text-base">SUBTOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {moneyData.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-4 sm:p-6 lg:p-8 text-center font-bold text-muted-foreground uppercase text-sm sm:text-base">
                        BELUM ADA DATA
                      </td>
                    </tr>
                  ) : (
                    moneyData.map((item, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-muted' : 'bg-card'}>
                        <td className="p-2 sm:p-3 lg:p-4 font-bold text-sm sm:text-base">{item.count}</td>
                        <td className="p-2 sm:p-3 lg:p-4 font-bold text-xs sm:text-sm lg:text-base">{formatCurrency(item.nominal)}</td>
                        <td className="p-2 sm:p-3 lg:p-4 font-bold text-xs sm:text-sm lg:text-base">{formatCurrency(item.subtotal)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-accent text-accent-foreground">
                    <td colSpan={2} className="p-2 sm:p-3 lg:p-4 font-black uppercase text-right text-sm sm:text-base">TOTAL:</td>
                    <td className="p-2 sm:p-3 lg:p-4 font-black text-base sm:text-lg lg:text-xl">{formatCurrency(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          
          <div className="mt-3 sm:mt-4 neo-border bg-secondary text-secondary-foreground p-3 sm:p-4">
            <p className="font-bold uppercase text-xs sm:text-sm lg:text-base leading-relaxed">
              <span className="text-accent-foreground">STATUS AI:</span> {isInitialized ? 'Aktif' : 'Memuat...'} • 
              Sistem menggunakan AI computer vision untuk mendeteksi uang kertas Indonesia dengan 
              fallback ke deteksi berbasis warna untuk meningkatkan akurasi.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MoneyCounter;