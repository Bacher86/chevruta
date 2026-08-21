import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { firebaseConfig } from "./firebase";
import { safeGet, safeSet } from "./storage";

// ⚠️ Reemplazar por la clave VAPID real generada en:
// Firebase Console → Configuración del proyecto → Cloud Messaging →
// "Certificados push web" → Generar par de claves.
// Sin esto, getToken() falla silenciosamente y las notificaciones no van a andar.
const VAPID_KEY = "REEMPLAZAR_CON_TU_VAPID_KEY";

// Pide permiso de notificaciones al usuario y, si acepta, guarda el token
// FCM de este dispositivo en su perfil (soporta varios dispositivos por persona).
export async function enablePush(profileId) {
  try {
    if (!(await isSupported())) return { ok: false, reason: "unsupported" };
    if (VAPID_KEY.startsWith("REEMPLAZAR")) return { ok: false, reason: "no_vapid_key" };

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: "denied" };

    const registration = await navigator.serviceWorker.ready;
    const messaging = getMessaging();
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    if (!token) return { ok: false, reason: "no_token" };

    const profile = await safeGet("profile:" + profileId, true);
    const tokens = new Set(profile?.fcmTokens || []);
    tokens.add(token);
    await safeSet("profile:" + profileId, { ...profile, fcmTokens: [...tokens] }, true);
    return { ok: true, token };
  } catch (e) {
    return { ok: false, reason: e?.message || "error" };
  }
}

export function pushPermissionState() {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission; // "granted" | "denied" | "default"
}
