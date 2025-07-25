export async function detectCurrencyFromVideoAPI(video: HTMLVideoElement) {
  // Ambil satu frame dari video
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob: Blob = await new Promise(resolve => canvas.toBlob(blob => resolve(blob!), "image/jpeg", 0.9)!);

  // Kirim ke backend FastAPI
  const formData = new FormData();
  formData.append("file", blob, "20k_frame.jpg"); // Ganti nama file untuk test dummy logic di backend

  const res = await fetch("http://localhost:8000/detect", {
    method: "POST",
    body: formData,
  });
  const data = await res.json();

  // Mapping class ke nominal (contoh)
  const classToNominal = {
    0: 1000,
    1: 2000,
    2: 5000,
    3: 10000,
    4: 20000,
    5: 50000,
    6: 100000,
  };

  return (data.predictions as any[]).map(pred => ({
    nominal: classToNominal[pred.class_] || 0,
    confidence: pred.confidence,
    box: pred.box,
  }));
}