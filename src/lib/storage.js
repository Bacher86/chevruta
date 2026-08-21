import { db } from "./firebase.js";
import {
  doc, getDoc, setDoc, collection, query, orderBy,
  startAt, endAt, getDocs, documentId,
} from "firebase/firestore";

/**
 * Capa de compatibilidad: misma firma que el resto de la app espera
 * (safeGet/safeSet/safeList con flag "shared"), respaldada por Firestore.
 *
 * shared = true  -> colección "kv_store" en Firestore, visible para todos
 * shared = false -> localStorage del navegador (dato de este dispositivo)
 *
 * Cada documento de kv_store usa el "key" original (ej: "profile:u_123")
 * como ID de documento, con el valor guardado en el campo "value".
 */

const COLLECTION = "kv_store";

export async function safeGet(key, shared) {
  if (!shared) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  }
  try {
    const snap = await getDoc(doc(db, COLLECTION, key));
    return snap.exists() ? snap.data().value : null;
  } catch {
    return null;
  }
}

export async function safeSet(key, value, shared) {
  if (!shared) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
  try {
    await setDoc(doc(db, COLLECTION, key), { value, updatedAt: Date.now() });
    return true;
  } catch {
    return false;
  }
}

export async function safeList(prefix, shared) {
  if (!shared) return [];
  try {
    // Prefijo sobre el ID de documento: rango [prefix, prefix + \uf8ff)
    const q = query(
      collection(db, COLLECTION),
      orderBy(documentId()),
      startAt(prefix),
      endAt(prefix + "\uf8ff")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.id);
  } catch {
    return [];
  }
}
