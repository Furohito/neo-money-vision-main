import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Square, X, Download, RotateCcw, Loader2, Image, Upload } from 'lucide-react';
import html2canvas from 'html2canvas';

interface MoneyData {
  count: number;
  nominal: number;
  subtotal: number;
}

function formatCurrency(nominal: number) {
  return nominal.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 });
}

const API_ENDPOINT = "http://localhost:8000/detect"; // ganti sesuai backendmu

const MoneyCounter = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCamera, setIsCamera] = useState(false);
  const [moneyData, setMoneyData] = useState<MoneyData[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  // --- Improved startCamera, auto fallback & error log ---
  const startCamera = useCallback(async () => {
    try {
      // Cek permission, untuk browser yang support
      if (navigator.permissions) {
        const perm = await navigator.permissions.query({ name: "camera" as PermissionName });
        if (perm.state === "denied") {
          alert("Akses kamera diblokir browser. Silakan cek pengaturan izin kamera (klik ikon kamera di address bar).");
          return;
        }
      }
      let mediaStream = null;
      try {
        // Coba environment/back camera dulu
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 640 }, height: { ideal: 480 } }
        });
      } catch (err) {
        // Fallback ke user/front camera
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
        });
      }
      setStream(mediaStream);
      setIsCamera(true);
      // Penting! assign stream ke videoRef
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
    } catch (err: any) {
      if (err && err.name === "NotAllowedError") {
        alert("Akses kamera ditolak. Silakan klik ikon kamera di address bar dan pilih Allow/Izinkan.");
      } else if (err && err.name === "NotFoundError") {
        alert("Tidak ada device kamera ditemukan.");
      } else {
        alert('Tidak bisa akses kamera! ' + (err && err.message ? err.message : err));
      }
      console.error("Camera error:", err);
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCamera(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [stream]);

  // Capture & Send to Backend API
  const detectMoney = useCallback(async () => {
    if (!videoRef.current || isDetecting) return;
    setIsDetecting(true);

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    const blob: Blob = await new Promise(resolve => canvas.toBlob(blob => resolve(blob!), "image/jpeg", 0.92)!);

    const formData = new FormData();
    formData.append('file', blob, "frame.jpg");

    try {
      const res = await fetch(API_ENDPOINT, { method: 'POST', body: formData });
      const data = await res.json();

      const classToNominal = {
        0: 1000, 1: 2000, 2: 5000, 3: 10000, 4: 20000, 5: 50000, 6: 100000,
      };
      if (!data.predictions || data.predictions.length === 0) {
        alert("Tidak ada uang terdeteksi!");
        setIsDetecting(false);
        return;
      }
      data.predictions.forEach((pred: any) => {
        const nominal = classToNominal[pred.class_] || 0;
        if (nominal) {
          setMoneyData(prev => {
            const idx = prev.findIndex(item => item.nominal === nominal);
            if (idx >= 0) {
              const newData = [...prev];
              newData[idx].count += 1;
              newData[idx].subtotal = newData[idx].count * nominal;
              return newData;
            }
            return [...prev, { count: 1, nominal, subtotal: nominal }];
          });
        }
      });
    } catch (err) {
      alert('Gagal terhubung ke server deteksi');
    }
    setIsDetecting(false);
  }, [isDetecting]);

  // Download CSV
  const downloadCSV = useCallback(() => {
    let csvContent = "data:text/csv;charset=utf-8,JUMLAH,NOMINAL,SUBTOTAL\n";
    moneyData.forEach(item => {
      csvContent += `${item.count},${item.nominal},${item.subtotal}\n`;
    });
    csvContent += `,,${moneyData.reduce((s, d) => s + d.subtotal, 0)}\n`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.href = encodedUri;
    link.download = "hasil_hitung_uang.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [moneyData]);

  // Download Table as Image
  const downloadTableImage = useCallback(() => {
    if (!tableRef.current) return;
    html2canvas(tableRef.current, { scale: 2 }).then(canvas => {
      const link = document.createElement('a');
      link.download = 'hasil_hitung_uang.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  }, []);

  // Reset Data
  const resetData = useCallback(() => {
    setMoneyData([]);
  }, []);

  // Upload Gambar untuk Deteksi Manual (API)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploadLoading(true);
    setUploadResult(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(API_ENDPOINT, { method: 'POST', body: formData });
      const data = await res.json();
      setUploadResult(data);
    } catch {
      setUploadResult({ error: "Gagal koneksi ke server deteksi" });
    }
    setUploadLoading(false);
  };

  const total = moneyData.reduce((sum, item) => sum + item.subtotal, 0);

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4 lg:p-6">
      {/* Navbar */}
      <div className="neo-card bg-primary text-primary-foreground p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-lg sm:text-xl lg:text-2xl font-black uppercase tracking-wider leading-tight">
            HASIL PERHITUNGAN
          </h1>
          <Button onClick={isCamera ? stopCamera : startCamera} className="neo-button font-black uppercase w-full sm:w-auto" size="lg">
            <Camera className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            {isCamera ? 'TUTUP KAMERA' : 'BUKA KAMERA'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
        {/* Camera Section */}
        <div className="neo-card p-3 sm:p-4 lg:p-6">
          <h2 className="text-lg sm:text-xl font-black mb-4 uppercase tracking-wide">KAMERA</h2>
          <div className="space-y-3 sm:space-y-4">
            <div className="relative neo-border bg-black aspect-video max-w-full rounded overflow-hidden">
              {/* <video> harus selalu mounted, agar stream tidak hilang */}
              <video
                ref={videoRef}
                className="w-full h-auto max-h-[300px] sm:max-h-[350px] lg:max-h-[400px] mx-auto"
                autoPlay
                playsInline
                muted
              />
              <div className="absolute inset-2 sm:inset-4 border-2 sm:border-4 border-dashed border-secondary pointer-events-none rounded"></div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Button
                onClick={detectMoney}
                disabled={!isCamera || isDetecting}
                className="neo-button flex-1 font-black uppercase py-3 text-sm sm:text-base"
              >
                {isDetecting ? <Loader2 className="animate-spin w-4 h-4 sm:w-5 sm:h-5 mr-2" /> : <Square className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />}
                {isDetecting ? "MENDETEKSI..." : "AMBIL GAMBAR"}
              </Button>
              <Button
                onClick={stopCamera}
                disabled={!isCamera}
                className="neo-button bg-destructive flex-1 font-black uppercase py-3 text-sm sm:text-base"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </div>
          </div>
          {!isCamera && (
            <div className="mt-4 text-center text-sm text-muted-foreground font-bold uppercase tracking-wider">
              Kamera belum aktif.<br />Klik "BUKA KAMERA" dan izinkan akses kamera di browser.
            </div>
          )}
        </div>

        {/* Results Section */}
        <div className="neo-card p-3 sm:p-4 lg:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
            <h2 className="text-lg sm:text-xl font-black uppercase tracking-wide">TABEL REKAP</h2>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                onClick={resetData}
                className="neo-button bg-destructive font-black uppercase text-xs sm:text-sm px-2 sm:px-3 py-2 flex-1 sm:flex-none"
                size="sm"
              >
                <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                RESET
              </Button>
              <Button
                onClick={downloadCSV}
                className="neo-button bg-success font-black uppercase text-xs sm:text-sm px-2 sm:px-3 py-2 flex-1 sm:flex-none"
                size="sm"
              >
                <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                CSV
              </Button>
              <Button
                onClick={downloadTableImage}
                className="neo-button bg-info font-black uppercase text-xs sm:text-sm px-2 sm:px-3 py-2 flex-1 sm:flex-none"
                size="sm"
              >
                <Image className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                IMG
              </Button>
            </div>
          </div>
          <div ref={tableRef} className="neo-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[300px] text-xs sm:text-sm lg:text-base">
                <thead>
                  <tr className="bg-black text-white">
                    <th className="p-2 sm:p-3 lg:p-4 text-left font-black uppercase">JUMLAH</th>
                    <th className="p-2 sm:p-3 lg:p-4 text-left font-black uppercase">NOMINAL</th>
                    <th className="p-2 sm:p-3 lg:p-4 text-left font-black uppercase">SUBTOTAL</th>
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
                    moneyData.map((item, idx) => (
                      <tr key={item.nominal} className={idx % 2 === 0 ? 'bg-muted' : ''}>
                        <td className="p-2 sm:p-3 lg:p-4 font-bold">{item.count}</td>
                        <td className="p-2 sm:p-3 lg:p-4 font-bold">{formatCurrency(item.nominal)}</td>
                        <td className="p-2 sm:p-3 lg:p-4 font-bold">{formatCurrency(item.subtotal)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-yellow-500 text-black">
                    <td colSpan={2} className="p-2 sm:p-3 lg:p-4 font-bold text-right">TOTAL:</td>
                    <td className="p-2 sm:p-3 lg:p-4 font-bold">{formatCurrency(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <div className="neo-card p-3 sm:p-4 lg:p-6 mt-6">
        <h2 className="text-lg sm:text-xl font-black mb-4 uppercase tracking-wide flex items-center">
          <Upload className="w-5 h-5 mr-2" /> Upload Deteksi
        </h2>
        <form onSubmit={handleUpload} className="flex flex-col sm:flex-row gap-3 items-center mb-3">
          <input type="file" accept="image/*" onChange={handleFileChange} className="flex-1" />
          <Button type="submit" disabled={uploadLoading || !file} className="neo-button font-black uppercase text-sm flex items-center">
            {uploadLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Upload & Deteksi
          </Button>
        </form>
        {uploadResult && (
          <div className="mt-2 bg-muted p-3 rounded w-full overflow-auto">
            <h3 className="text-base font-bold mb-1">Hasil Deteksi Upload:</h3>
            <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(uploadResult, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default MoneyCounter;