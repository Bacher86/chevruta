/**
 * Backend de Chevruta (Firebase Cloud Functions v2).
 *
 * Escucha escrituras en la colección "kv_store" (la misma que usa el
 * cliente vía safeGet/safeSet) y dispara notificaciones push reales
 * cuando: (a) llega un mensaje nuevo en una conexión, o (b) alguien
 * inicia una conexión nueva con otra persona.
 *
 * Deploy: ver README_BACKEND.md en la raíz del proyecto.
 */
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

async function sendToProfile(profileId, title, body, data) {
  const snap = await db.collection("kv_store").doc("profile:" + profileId).get();
  if (!snap.exists) return;
  const profile = snap.data().value;
  const tokens = profile?.fcmTokens || [];
  if (tokens.length === 0) return;
  try {
    const res = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: data || {},
      webpush: { fcmOptions: { link: "/" } },
    });
    // Limpieza: si un token quedó inválido (usuario desinstaló, etc.), lo sacamos
    const stale = [];
    res.responses.forEach((r, i) => { if (!r.success) stale.push(tokens[i]); });
    if (stale.length > 0) {
      const cleaned = tokens.filter((t) => !stale.includes(t));
      await db.collection("kv_store").doc("profile:" + profileId).set(
        { value: { ...profile, fcmTokens: cleaned }, updatedAt: Date.now() },
        { merge: true }
      );
    }
  } catch (e) {
    console.error("Error enviando push a", profileId, e);
  }
}

exports.onMatchWrite = onDocumentWritten("kv_store/{docId}", async (event) => {
  const docId = event.params.docId;
  if (!docId.startsWith("match:")) return;

  const before = event.data.before.exists ? event.data.before.data().value : null;
  const after = event.data.after.exists ? event.data.after.data().value : null;
  if (!after || !Array.isArray(after.participants)) return;

  const [idA, idB] = after.participants;

  // Conexión recién creada -> avisar a AMBOS que alguien quiere conocerlos
  // (el que la inició ya lo sabe porque la creó él mismo, pero igual es
  // información útil / confirma que se guardó bien; el que la recibe es
  // el caso importante).
  if (!before) {
    await Promise.all([
      sendToProfile(idA, "Nueva conexión en Chevruta", "Alguien de la comunidad quiere conocerte.", { type: "new_match" }),
      sendToProfile(idB, "Nueva conexión en Chevruta", "Alguien de la comunidad quiere conocerte.", { type: "new_match" }),
    ]);
    return;
  }

  // Mensaje nuevo -> avisar solo a quien NO lo mandó
  const beforeCount = (before.messages || []).length;
  const afterCount = (after.messages || []).length;
  if (afterCount > beforeCount) {
    const lastMsg = after.messages[after.messages.length - 1];
    const recipient = lastMsg.from === idA ? idB : idA;
    await sendToProfile(recipient, "Nuevo mensaje en Chevruta", "Tenés un mensaje nuevo en una de tus conexiones.", { type: "new_message" });
    return;
  }

  // Revelación total recién aceptada por ambos -> celebrar
  const beforeStage = before.stage, afterStage = after.stage;
  if (afterStage === 5 && beforeStage !== 5) {
    await Promise.all([
      sendToProfile(idA, "¡Se revelaron! 🎉", "Vos y tu conexión aceptaron mostrarse del todo.", { type: "reveal" }),
      sendToProfile(idB, "¡Se revelaron! 🎉", "Vos y tu conexión aceptaron mostrarse del todo.", { type: "reveal" }),
    ]);
  }
});
