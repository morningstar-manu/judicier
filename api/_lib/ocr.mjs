/** OCR serveur (Tesseract) — fonctionne avec Expo Go via l'API. */

let workerPromise = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, { logger: () => {} });
      await worker.setParameters({
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<",
        tessedit_pageseg_mode: "11",
      });
      return worker;
    })();
  }
  return workerPromise;
}

export async function ocrFromDataUrl(dataUrl) {
  const src = String(dataUrl || "").trim();
  if (!src.startsWith("data:image")) {
    throw new Error("Image invalide (dataUrl attendu)");
  }
  const worker = await getWorker();
  const { data } = await worker.recognize(src);
  return String(data?.text || "")
    .toUpperCase()
    .replace(/[^A-Z0-9<\n\r]/g, " ")
    .trim();
}
