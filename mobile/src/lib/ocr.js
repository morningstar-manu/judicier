import Constants from "expo-constants";
import { api } from "../api/client";

/** ML Kit sur build natif, sinon OCR serveur (Expo Go). */
export async function recognizeMrzFromImage(uri, dataUrl = "") {
  const localText = await tryMlKit(uri);
  if (localText) {
    return api.parseMrz(localText);
  }

  if (!dataUrl?.startsWith("data:image")) {
    return { ok: false, msg: "Image non disponible — réessayez la capture." };
  }

  return api.scanMrz(dataUrl);
}

async function tryMlKit(uri) {
  if (Constants.appOwnership === "expo") return null;
  try {
    const TextRecognition = require("@react-native-ml-kit/text-recognition").default;
    const result = await TextRecognition.recognize(uri);
    const text = (result?.text || "").trim();
    return text || null;
  } catch {
    return null;
  }
}
