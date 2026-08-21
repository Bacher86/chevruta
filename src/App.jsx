import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense, lazy } from "react";
import { safeGet, safeSet, safeList } from "./lib/storage.js";
import { auth } from "./lib/firebase.js";
import { enablePush, pushPermissionState } from "./lib/push.js";
import {
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, sendPasswordResetEmail,
} from "firebase/auth";
const GameModal = lazy(() => import("./Games.jsx"));

/* =========================================================================
   CHEVRUTA v3
   ========================================================================= */

const INK = "#211D1A";
const INK_SOFT = "#5B534A";
const PAPER = "#F1E8D3";
const PAPER_DEEP = "#E7DAB9";
const INDIGO = "#2B3357";
const AMBER = "#C1872B";
const AMBER_SOFT = "#E4C27F";
const POMEGRANATE = "#8C3B3B";
const OLIVE = "#6E7F4B";

const serif = `"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif`;
const sans = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

/* -------------------------------------------------------------------------
   Banco de preguntas
   ------------------------------------------------------------------------- */
const QUESTIONS = [
  { id: "q1", cat: "Tradición", prompt: "Un viernes ideal termina con...", opts: ["Cena de Shabat en familia", "Shabat tranquilo, solo o sola", "Depende de la semana", "No suelo marcar el Shabat"] },
  { id: "q2", cat: "Tradición", prompt: "Tu relación con el kashrut es...", opts: ["Estricta", "Flexible según ocasión", "Simbólica / cultural", "No la practico"] },
  { id: "q3", cat: "Tradición", prompt: "Las festividades para vos son sobre todo...", opts: ["Ritual y sentido religioso", "Familia y encuentro", "Comida y tradición", "Historia y memoria colectiva"] },
  { id: "q4", cat: "Tradición", prompt: "¿Cómo describirías tu observancia hoy?", opts: ["Ortodoxa", "Conservadora", "Reformista", "Secular / cultural", "Explorando"] },
  { id: "q5", cat: "Valores", prompt: "Lo que más valoro en una amistad cercana es...", opts: ["Honestidad directa", "Lealtad silenciosa", "Sentido del humor", "Crecer juntos"], weekly: true },
  { id: "q6", cat: "Valores", prompt: "Frente a un desacuerdo importante, yo...", opts: ["Lo hablo enseguida", "Necesito procesarlo antes", "Busco un mediador", "Prefiero dejarlo pasar"], weekly: true },
  { id: "q7", cat: "Valores", prompt: "Algo que no negocio es...", opts: ["Puntualidad", "Honestidad aunque duela", "Respeto por el silencio ajeno", "Compromiso con la comunidad"] },
  { id: "q8", cat: "Humor", prompt: "En un chat grupal, generalmente sos...", opts: ["El o la que tira el chiste malo", "Quien reacciona con memes", "Quien lee todo y no dice nada", "Quien organiza el plan"] },
  { id: "q9", cat: "Humor", prompt: "Elegí tu superpoder inútil:", opts: ["Saber siempre qué hora es sin reloj", "Recordar cumpleaños de todos", "Encontrar estacionamiento siempre", "Predecir cuándo se corta el WiFi"] },
  { id: "q10", cat: "Humor", prompt: "Tu versión de una noche perfecta es...", opts: ["Juegos de mesa hasta tarde", "Una buena discusión filosófica", "Serie y silencio", "Salir a bailar"] },
  { id: "q11", cat: "Comunidad", prompt: "Lo que más buscás ahora es...", opts: ["Nuevas amistades", "Una relación de pareja", "Ambas cosas, sin apuro", "Todavía no lo sé"] },
  { id: "q12", cat: "Comunidad", prompt: "En un evento comunitario, preferís...", opts: ["Organizar", "Ayudar detrás de escena", "Ir y conocer gente nueva", "Ir acompañado/a de alguien conocido"] },
  { id: "q13", cat: "Comunidad", prompt: "Lo que más te importa de pertenecer a la comunidad es...", opts: ["El sentido de pertenencia", "La continuidad de la tradición", "Los vínculos que se generan", "El aprendizaje constante"], weekly: true },
  { id: "q14", cat: "Valores", prompt: "Un shabatón o retiro comunitario te resulta...", opts: ["Una de mis cosas favoritas", "Lindo pero ocasional", "Me da un poco de pudor social", "Nunca fui, pero me interesa"] },
  { id: "q15", cat: "Humor", prompt: "Si tuvieras que dar clase de algo random, sería sobre...", opts: ["Cocina", "Historia inútil pero fascinante", "Cómo perderse viajando", "Cómo discutir sin pelearse"] },
  { id: "q16", cat: "Tradición", prompt: "Estudiar un texto con otra persona (chevruta) te parece...", opts: ["Una de las mejores formas de conocer a alguien", "Interesante pero intimidante", "No es lo mío, prefiero otra cosa", "Nunca lo probé"], weekly: true },
  // #8 — pregunta encadenada: se desbloquea solo si respondiste q1 y q16
  { id: "q_chain", cat: "Tradición", prompt: "Ya que valorás la tradición y el estudio compartido: si pudieras elegir un texto para estudiar en chevruta con alguien nuevo, ¿de qué tema sería?", opts: ["Ética y valores", "Historia y memoria", "Textos místicos", "Actualidad y comunidad"], requires: ["q1", "q16"] },
];

const SEASONAL_QUESTIONS = [
  { id: "s_rh", cat: "Temporada", holiday: "Rosh Hashaná", months: [8, 9], prompt: "Para el año nuevo, lo que más te gustaría dejar atrás es...", opts: ["Una preocupación", "Un hábito", "Una duda sobre vos mismo/a", "Nada, estoy en paz con el año"] },
  { id: "s_yk", cat: "Temporada", holiday: "Iom Kipur", months: [9, 10], prompt: "El perdón para vos es sobre todo...", opts: ["Un proceso largo", "Algo que se da fácil", "Más difícil hacia uno/a mismo/a que hacia otros", "Todavía lo estoy aprendiendo"] },
  { id: "s_suk", cat: "Temporada", holiday: "Sucot", months: [9, 10], prompt: "Lo efímero (como una sucá) te genera...", opts: ["Calma, todo pasa", "Ansiedad, prefiero lo estable", "Curiosidad", "Depende del día"] },
  { id: "s_jan", cat: "Temporada", holiday: "Janucá", months: [11, 12], prompt: "Un pequeño milagro cotidiano que valorás es...", opts: ["Una conversación inesperada", "Encontrar algo que creías perdido", "Que alguien te entienda sin explicar mucho", "No creo mucho en los milagros"] },
  { id: "s_pur", cat: "Temporada", holiday: "Purim", months: [2, 3], prompt: "Si pudieras disfrazarte de otra versión de vos mismo/a, sería...", opts: ["La versión más audaz", "La versión más tranquila", "La versión de hace 10 años", "No cambiaría nada"] },
  { id: "s_pes", cat: "Temporada", holiday: "Pésaj", months: [3, 4], prompt: "Tu propia forma de \"salir de Egipto\" hoy sería salir de...", opts: ["Una zona de confort", "Un miedo puntual", "Una rutina que ya no te representa", "Ahora mismo no siento que necesite salir de nada"] },
];

const OPEN_PROMPTS = [
  "Contame sobre un momento en el que sentiste que pertenecías a algo más grande.",
  "¿Qué te gustaría que te preguntaran más seguido?",
  "Si tuvieras una tarde libre sin culpa, ¿cómo la usarías?",
  "¿Qué aprendiste de alguien mayor que vos que no olvidás?",
  "Contame algo en lo que cambiaste de opinión en los últimos años.",
];

const CLOSE_STAGE_PROMPT = "¿Qué es lo que más te generó curiosidad de esta persona hasta ahora?";
const FAREWELL_MESSAGE = "Fue lindo conocerte — prefiero dejarlo acá por ahora. Gracias por el intercambio 🙏";
const CIRCLES = ["Sin preferencia", "Jóvenes profesionales", "Familias con chicos", "Recién llegados a la ciudad"];

/* -------------------------------------------------------------------------
   Utilidades
   ------------------------------------------------------------------------- */
function uid() {
  return "u_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
function pseudonym(id) {
  const h = hashStr(id);
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  return `Voz ${letters[h % letters.length]}-${(h % 900) + 100}`;
}
// #16 — avatar abstracto: gradiente determinístico por id, sin fotos
function avatarGradient(id) {
  const h = hashStr(id);
  const hue1 = h % 360;
  const hue2 = (hue1 + 40 + (h >> 8) % 60) % 360;
  return `linear-gradient(135deg, hsl(${hue1},45%,42%), hsl(${hue2},50%,30%))`;
}
function Avatar({ id, size = 40 }) {
  return <div style={{ width: size, height: size, borderRadius: "50%", background: avatarGradient(id), flexShrink: 0 }} />;
}
// Foto con revelación progresiva: sin conexión = solo iniciales/gradiente;
// a medida que avanza la conexión, la foto real aparece cada vez más nítida.
// blur: 0 = nítida, mayor número = más difuminada. null/undefined = sin foto (gradiente).
function PersonPhoto({ p, size = 64, blur = 0, rounded = "50%" }) {
  if (!p.photo) {
    return (
      <div style={{ width: size, height: size, borderRadius: rounded, background: avatarGradient(p.id), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontFamily: serif, fontSize: size * 0.36, color: "#fff" }}>{(p.alias || pseudonym(p.id)).replace(/[^A-Za-zÀ-ÿ]/g, "")[0] || "?"}</span>
      </div>
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: rounded, overflow: "hidden", flexShrink: 0, background: avatarGradient(p.id) }}>
      <img src={p.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: blur > 0 ? `blur(${blur}px)` : "none", transform: blur > 0 ? "scale(1.15)" : "none", transition: "filter .4s" }} />
    </div>
  );
}
// Comprime una foto subida a un dataURL chico antes de guardarla (Firestore
// tiene límite de tamaño por documento, y no queremos fotos pesadas).
function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const maxSide = 480;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function matchId(a, b) {
  return "match:" + [a, b].sort().join("__");
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function isoWeek(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7) + date.getUTCFullYear() * 100;
}
function daysUntilMonday() {
  const d = new Date().getDay();
  return d === 1 ? 7 : (8 - d) % 7 || 7;
}
function fmtDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}
// #7 — nivel de estudiante, según participación (no edad ni status)
function studentRank(p) {
  const score = Object.keys(p.answers || {}).length + (p.streak || 0) + (p.connectionsInitiated || 0) * 2 + (p.badges || []).length * 3;
  if (score >= 30) return "Mentor/a";
  if (score >= 12) return "Constante";
  return "Principiante";
}

const DAY_SEED = Math.floor(Date.now() / 86400000);
const WEEK_SEED = isoWeek();
const CURRENT_MONTH = new Date().getMonth() + 1;
const MONTH_KEY = new Date().getFullYear() + "-" + new Date().getMonth();

function compatScore(a, b) {
  const keys = Object.keys(a.answers || {}).filter((k) => b.answers && b.answers[k] !== undefined);
  if (keys.length === 0) return null;
  let match = 0;
  const sharedCats = new Set();
  let divergent = null;
  keys.forEach((k) => {
    if (a.answers[k] === b.answers[k]) match++;
    else if (!divergent) divergent = k;
  });
  keys.forEach((k) => {
    if (a.answers[k] === b.answers[k]) {
      const q = QUESTIONS.find((q) => q.id === k);
      if (q) sharedCats.add(q.cat);
    }
  });
  return { pct: Math.round((match / keys.length) * 100), common: keys.length, cats: [...sharedCats], divergentQid: divergent };
}
// Etiqueta cualitativa además del %: evita que la gente "cace el número más
// alto" en vez de vincularse — el % sigue visible pero en segundo plano.
function affinityLabel(pct) {
  if (pct >= 85) return "Afinidad muy alta";
  if (pct >= 70) return "Alta afinidad";
  if (pct >= 50) return "Compatibilidad interesante";
  return "Algunos puntos en común";
}

/* -------------------------------------------------------------------------
   Componentes chicos
   ------------------------------------------------------------------------- */
function FlameProgress({ stage }) {
  return (
    <div className="flex gap-1.5 items-center">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: i <= stage ? AMBER : "transparent", border: `1.5px solid ${i <= stage ? AMBER : INK_SOFT}` }} />
      ))}
    </div>
  );
}
function Pill({ children, tone = "default" }) {
  const bg = tone === "amber" ? AMBER_SOFT : tone === "olive" ? "#DCE3CB" : tone === "indigo" ? "#DADFEE" : PAPER_DEEP;
  const fg = tone === "amber" ? "#5A3E0F" : tone === "olive" ? "#3C4A26" : tone === "indigo" ? INDIGO : INK_SOFT;
  return (
    <span style={{ background: bg, color: fg, fontFamily: sans, fontSize: 11, letterSpacing: 0.3 }} className="px-2 py-0.5 rounded-full uppercase font-semibold">
      {children}
    </span>
  );
}
function Button({ children, onClick, variant = "primary", disabled, full, small }) {
  const styles = {
    primary: { background: INDIGO, color: PAPER, border: `1px solid ${INDIGO}` },
    amber: { background: AMBER, color: "#2A1B02", border: `1px solid ${AMBER}` },
    ghost: { background: "transparent", color: INDIGO, border: `1px solid ${INDIGO}` },
    danger: { background: "transparent", color: POMEGRANATE, border: `1px solid ${POMEGRANATE}` },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...styles[variant], fontFamily: sans, opacity: disabled ? 0.4 : 1, width: full ? "100%" : "auto" }} className={`rounded-lg font-semibold active:scale-[0.98] transition ${small ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm"}`}>
      {children}
    </button>
  );
}
function EmptyState({ title, body }) {
  return (
    <div className="text-center py-8 px-6">
      <p style={{ fontFamily: serif, color: INK, fontSize: 17 }} className="mb-1">{title}</p>
      <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 13 }}>{body}</p>
    </div>
  );
}
function Modal({ children, onClose }) {
  return (
    <div style={{ background: "rgba(33,29,26,0.5)" }} className="fixed inset-0 flex items-end justify-center z-50" onClick={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <div style={{ background: PAPER, borderRadius: "20px 20px 0 0", maxWidth: 440, maxHeight: "85vh", overflowY: "auto" }} className="w-full p-6">
        {children}
      </div>
    </div>
  );
}
// #22 — confirmación antes de acciones irreversibles (bloquear, cerrar conexión)
function ConfirmModal({ title, body, confirmLabel, onConfirm, onCancel }) {
  return (
    <Modal onClose={onCancel}>
      <p style={{ fontFamily: serif, fontSize: 18, color: INK }} className="mb-2">{title}</p>
      <p style={{ fontFamily: sans, fontSize: 13, color: INK_SOFT }} className="mb-5">{body}</p>
      <Button full variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
      <div className="h-2" />
      <Button full variant="ghost" onClick={onCancel}>Cancelar</Button>
    </Modal>
  );
}
// #18 — skeleton loader en vez de "Cargando…" en texto plano
function Skeleton({ h = 60, className = "" }) {
  return (
    <div style={{ background: PAPER_DEEP, borderRadius: 12, height: h, animation: "chev-shimmer 1.3s ease-in-out infinite" }} className={"w-full " + className} />
  );
}
// #19 — micro-celebración: ráfaga breve de confetti liviano en CSS puro
function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 16 }).map((_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 0.3, hue: Math.random() * 40 + 25,
  })), []);
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 60, overflow: "hidden" }}>
      {pieces.map((p) => (
        <div key={p.id} style={{
          position: "absolute", top: -10, left: `${p.left}%`, width: 7, height: 7,
          background: `hsl(${p.hue},70%,55%)`, borderRadius: 2,
          animation: `chev-confetti 1.1s ease-in ${p.delay}s forwards`,
        }} />
      ))}
    </div>
  );
}
// #27 — aviso simple de "sin conexión"
function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  if (online) return null;
  return (
    <div style={{ background: POMEGRANATE }} className="px-4 py-2 text-center">
      <p style={{ fontFamily: sans, fontSize: 12, color: PAPER }}>Sin conexión — algunos cambios pueden tardar en guardarse.</p>
    </div>
  );
}
function Bar({ label, pct }) {
  return (
    <div className="mb-2.5">
      <div className="flex justify-between mb-1">
        <span style={{ fontFamily: sans, fontSize: 12.5, color: INK }}>{label}</span>
        <span style={{ fontFamily: sans, fontSize: 12, color: INK_SOFT }}>{pct}%</span>
      </div>
      <div style={{ background: PAPER_DEEP, borderRadius: 6, height: 8 }}>
        <div style={{ background: OLIVE, borderRadius: 6, height: 8, width: `${pct}%`, transition: "width .4s" }} />
      </div>
    </div>
  );
}

// #7 — hint la primera vez que aparece una función, sin armar un sistema
// de tours completo — solo un aviso breve y descartable, una vez.
function FirstTimeHint({ id, text }) {
  const [seen, setSeen] = useState(true);
  useEffect(() => {
    try { setSeen(!!localStorage.getItem("chevruta_hint_" + id)); } catch { setSeen(true); }
  }, [id]);
  function dismiss() {
    try { localStorage.setItem("chevruta_hint_" + id, "1"); } catch {}
    setSeen(true);
  }
  if (seen) return null;
  return (
    <div style={{ background: AMBER_SOFT, borderRadius: 10 }} className="px-3 py-2 mb-2 flex items-center justify-between gap-2">
      <p style={{ fontFamily: sans, fontSize: 11.5, color: "#5A3E0F" }}>{text}</p>
      <button onClick={dismiss} style={{ fontFamily: sans, fontSize: 14, color: "#5A3E0F" }}>✕</button>
    </div>
  );
}

// #5 y #19 (v2) — curioseo: cómo respondió la comunidad, sin conectar
function CommunityBreakdown({ q, allProfiles, onClose }) {
  const counts = q.opts.map((_, i) => allProfiles.filter((p) => p.answers && p.answers[q.id] === i).length);
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  return (
    <Modal onClose={onClose}>
      <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="uppercase tracking-wide font-semibold mb-2">Así respondió la comunidad</p>
      <p style={{ fontFamily: serif, fontSize: 18, color: INK }} className="mb-4">{q.prompt}</p>
      <div className="mb-4">{q.opts.map((o, i) => <Bar key={i} label={o} pct={Math.round((counts[i] / total) * 100)} />)}</div>
      <p style={{ fontFamily: sans, fontSize: 11, color: INK_SOFT }} className="mb-4">{total === 1 && counts.every((c) => c === 0) ? "Todavía nadie respondió." : `${total} personas respondieron.`}</p>
      <Button full variant="ghost" onClick={onClose}>Cerrar</Button>
    </Modal>
  );
}

// #4 — mapa de intereses agregado de toda la comunidad
function CommunityMapModal({ allProfiles, onClose }) {
  const [expandedId, setExpandedId] = useState(null);
  // #28 — feed de descubrimiento: todas las preguntas con respuestas,
  // ordenadas por las que más gente respondió (las más "vivas" primero)
  const feed = useMemo(() => {
    return QUESTIONS.map((q) => {
      const counts = q.opts.map((_, i) => allProfiles.filter((p) => p.answers && p.answers[q.id] === i).length);
      const total = counts.reduce((a, b) => a + b, 0);
      return { q, counts, total };
    }).filter((x) => x.total > 0).sort((a, b) => b.total - a.total);
  }, [allProfiles]);

  return (
    <Modal onClose={onClose}>
      <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="uppercase tracking-wide font-semibold mb-2">Explorar la comunidad</p>
      <p style={{ fontFamily: serif, fontSize: 16, color: INK }} className="mb-4">Agregado y anónimo — nadie ve respuestas individuales acá.</p>
      {feed.length === 0 && <EmptyState title="Todavía no hay datos" body="A medida que la comunidad responda preguntas, va a aparecer acá." />}
      <div className="flex flex-col gap-2.5 mb-3">
        {feed.map(({ q, counts, total }) => {
          const topIdx = counts.indexOf(Math.max(...counts));
          const isOpen = expandedId === q.id;
          return (
            <div key={q.id} style={{ background: "#fff", border: `1px solid ${PAPER_DEEP}`, borderRadius: 12 }} className="p-3.5">
              <div className="flex items-center gap-2 mb-1"><Pill>{q.cat}</Pill><Pill tone="olive">{total} {total === 1 ? "respuesta" : "respuestas"}</Pill></div>
              <p style={{ fontFamily: sans, fontSize: 12.5, color: INK_SOFT }} className="mb-1">{q.prompt}</p>
              <button onClick={() => setExpandedId(isOpen ? null : q.id)} style={{ fontFamily: serif, fontSize: 15, color: OLIVE }} className="text-left">
                {Math.round((counts[topIdx] / total) * 100)}% eligió: "{q.opts[topIdx]}" {isOpen ? "▲" : "▼"}
              </button>
              {isOpen && <div className="mt-2">{q.opts.map((o, i) => <Bar key={i} label={o} pct={Math.round((counts[i] / total) * 100)} />)}</div>}
            </div>
          );
        })}
      </div>
      <Button full variant="ghost" onClick={onClose}>Cerrar</Button>
    </Modal>
  );
}

/* -------------------------------------------------------------------------
   Autenticación (login / registro)
   ------------------------------------------------------------------------- */
const AUTH_ERROR_MESSAGES = {
  "auth/email-already-in-use": "Ese email ya tiene una cuenta — probá iniciar sesión.",
  "auth/invalid-email": "El email no parece válido.",
  "auth/weak-password": "La contraseña necesita al menos 6 caracteres.",
  "auth/user-not-found": "No encontramos una cuenta con ese email.",
  "auth/wrong-password": "La contraseña no coincide.",
  "auth/invalid-credential": "Email o contraseña incorrectos.",
  "auth/too-many-requests": "Demasiados intentos — esperá un momento y probá de nuevo.",
  "auth/missing-password": "Falta la contraseña.",
};
function authErrorMessage(err) {
  if (AUTH_ERROR_MESSAGES[err?.code]) return AUTH_ERROR_MESSAGES[err.code];
  if (err?.code === "auth/unauthorized-domain") {
    return `Este dominio no está autorizado en Firebase todavía. Andá a Firebase Console → Authentication → Settings → Authorized domains, y agregá "${typeof window !== "undefined" ? window.location.hostname : "tu-dominio"}".`;
  }
  // Mostramos el código real en vez de un genérico, para no tener que adivinar.
  return `Algo falló${err?.code ? ` (${err.code})` : ""}. ${err?.message ? err.message : "Probá de nuevo en un momento."}`;
}

function AuthScreen() {
  const [mode, setMode] = useState("signup"); // "signup" | "login"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const isSignup = mode === "signup";
  const canSubmit = email.trim().length > 3 && password.length >= 6 && (!isSignup || password === confirmPassword);

  async function submit() {
    setError(""); setResetSent(false);
    if (isSignup && password !== confirmPassword) { setError("Las contraseñas no coinciden."); return; }
    setLoading(true);
    try {
      if (isSignup) await createUserWithEmailAndPassword(auth, email.trim(), password);
      else await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setError(authErrorMessage(err));
    }
    setLoading(false);
  }

  async function forgotPassword() {
    if (!email.trim()) { setError("Escribí tu email arriba primero, así te mandamos el link."); return; }
    setError(""); setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetSent(true);
    } catch (err) {
      setError(authErrorMessage(err));
    }
    setLoading(false);
  }

  return (
    <div style={{ background: INDIGO, minHeight: "100%" }} className="flex flex-col px-6 py-10 relative overflow-hidden">
      <div style={{ position: "absolute", top: -80, right: -60, width: 220, height: 220, borderRadius: "50%", background: "rgba(193,135,43,0.15)" }} />
      <div style={{ position: "absolute", bottom: -100, left: -70, width: 260, height: 260, borderRadius: "50%", background: "rgba(193,135,43,0.1)" }} />

      <div className="relative mb-10 mt-6">
        <p style={{ fontFamily: sans, color: AMBER_SOFT, fontSize: 11, letterSpacing: 2 }} className="uppercase font-semibold mb-2">Comunidad · Anónimo · Preguntas</p>
        <p style={{ fontFamily: serif, fontSize: 44, color: PAPER, lineHeight: 1.05 }} className="mb-2">Chevruta</p>
        <p style={{ fontFamily: serif, fontSize: 18, color: AMBER_SOFT, fontStyle: "italic" }}>Conocé antes de ver</p>
      </div>

      <div style={{ background: PAPER, borderRadius: 20 }} className="relative p-6">
        <div className="flex gap-1 mb-5" style={{ background: PAPER_DEEP, borderRadius: 10, padding: 3 }}>
          <button onClick={() => { setMode("signup"); setError(""); }} style={{ fontFamily: sans, background: isSignup ? INDIGO : "transparent", color: isSignup ? PAPER : INK_SOFT }} className="flex-1 py-2 rounded-lg text-sm font-semibold transition">Crear cuenta</button>
          <button onClick={() => { setMode("login"); setError(""); }} style={{ fontFamily: sans, background: !isSignup ? INDIGO : "transparent", color: !isSignup ? PAPER : INK_SOFT }} className="flex-1 py-2 rounded-lg text-sm font-semibold transition">Iniciar sesión</button>
        </div>

        <p style={{ fontFamily: serif, fontSize: 19, color: INK }} className="mb-1">{isSignup ? "Sumate a la comunidad" : "Bienvenido/a de nuevo"}</p>
        <p style={{ fontFamily: sans, fontSize: 12.5, color: INK_SOFT }} className="mb-5">{isSignup ? "Con tu email y una contraseña alcanza — el resto de tu perfil es anónimo." : "Ingresá con el email y contraseña de tu cuenta."}</p>

        <div className="flex flex-col gap-3 mb-2">
          <input type="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" style={{ fontFamily: sans, border: `1.5px solid ${PAPER_DEEP}`, background: "#fff" }} className="w-full px-4 py-3 rounded-lg text-base outline-none" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña (mínimo 6 caracteres)" style={{ fontFamily: sans, border: `1.5px solid ${PAPER_DEEP}`, background: "#fff" }} className="w-full px-4 py-3 rounded-lg text-base outline-none" />
          {isSignup && (
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repetir contraseña" style={{ fontFamily: sans, border: `1.5px solid ${PAPER_DEEP}`, background: "#fff" }} className="w-full px-4 py-3 rounded-lg text-base outline-none" />
          )}
        </div>

        {!isSignup && (
          <button onClick={forgotPassword} style={{ fontFamily: sans, color: INDIGO, fontSize: 12 }} className="mb-3 font-semibold">¿Olvidaste tu contraseña?</button>
        )}
        {resetSent && <p style={{ fontFamily: sans, color: OLIVE, fontSize: 12.5 }} className="mb-3">Te mandamos un link a tu email para restablecerla.</p>}
        {error && <p style={{ fontFamily: sans, color: POMEGRANATE, fontSize: 12.5 }} className="mb-3">{error}</p>}

        <Button full variant="amber" disabled={!canSubmit || loading} onClick={submit}>
          {loading ? "Un momento…" : isSignup ? "Crear cuenta" : "Entrar"}
        </Button>

        <p style={{ fontFamily: sans, fontSize: 11, color: INK_SOFT }} className="mt-4 text-center">
          Tu email solo se usa para el login — nadie más de la comunidad lo ve.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Onboarding
   ------------------------------------------------------------------------- */
function Onboarding({ userId, onDone }) {
  const [step, setStep] = useState(0);
  const [alias, setAlias] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [lookingFor, setLookingFor] = useState([]);
  const [city, setCity] = useState("");
  const [observance, setObservance] = useState("");
  const [intention, setIntention] = useState([]);
  const [voucher, setVoucher] = useState("");
  const [words, setWords] = useState(["", "", ""]);
  const [circle, setCircle] = useState("");
  const [photo, setPhoto] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [accessibleText, setAccessibleText] = useState(false);
  const [saving, setSaving] = useState(false);

  // #15 — invitación con propósito: pre-completa el referente desde el link
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref) setVoucher(ref);
    } catch {}
  }, []);

  const toggleIntention = (v) => setIntention((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  const toggleLookingFor = (v) => setLookingFor((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  const wordsOk = words.every((w) => w.trim().length > 0);
  const ageOk = Number(age) >= 18 && Number(age) < 100;
  const canNext = [alias.trim().length >= 2, ageOk && gender !== "", lookingFor.length > 0, city.trim().length >= 2, observance !== "", intention.length > 0, true, wordsOk, true, true][step];

  async function handlePhoto(file) {
    if (!file) return;
    setPhotoBusy(true);
    try { setPhoto(await compressPhoto(file)); } catch {} 
    setPhotoBusy(false);
  }

  async function finish() {
    setSaving(true);
    const id = userId;
    const profile = {
      id, alias: alias.trim(), age: Number(age), gender, lookingFor, city: city.trim(), observance, intention,
      voucher: voucher.trim() || null,
      threeWords: words.map((w) => w.trim()),
      circle: circle || "Sin preferencia",
      photo: photo || null,
      accessibleText,
      answers: {}, answersHistory: {},
      streak: 0, lastAnswered: null,
      curiosityScore: 0, connectionsInitiated: 0,
      paused: false, blocked: [], skipped: [], badges: [],
      createdAt: Date.now(),
    };
    await safeSet("profile:" + id, profile, true);
    setSaving(false);
    onDone(profile);
  }

  const steps = [
    { label: "¿Cómo te llamamos acá?", hint: "Un alias, no tu nombre real todavía.", body: (
      <input autoFocus value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Ej: Estrella del Sur" style={{ fontFamily: sans, border: `1.5px solid ${PAPER_DEEP}`, background: "#fff" }} className="w-full px-4 py-3 rounded-lg text-base outline-none" />
    )},
    { label: "Contanos un poco de vos", hint: "Necesitamos esto para mostrarte a las personas correctas.", body: (
      <div className="flex flex-col gap-4">
        <input autoFocus type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="Tu edad" style={{ fontFamily: sans, border: `1.5px solid ${PAPER_DEEP}`, background: "#fff" }} className="w-full px-4 py-3 rounded-lg text-base outline-none" />
        <div className="flex flex-col gap-2">
          {["Mujer", "Varón", "No binario"].map((o) => (
            <button key={o} onClick={() => setGender(o)} style={{ fontFamily: sans, background: gender === o ? INDIGO : "#fff", color: gender === o ? PAPER : INK, border: `1.5px solid ${gender === o ? INDIGO : PAPER_DEEP}` }} className="text-left px-4 py-3 rounded-lg text-sm font-medium">{o}</button>
          ))}
        </div>
      </div>
    )},
    { label: "¿A quién te gustaría conocer?", hint: "Podés elegir más de una opción.", body: (
      <div className="flex flex-col gap-2">
        {["Mujeres", "Varones", "No binaries"].map((o) => (
          <button key={o} onClick={() => toggleLookingFor(o)} style={{ fontFamily: sans, background: lookingFor.includes(o) ? AMBER_SOFT : "#fff", color: INK, border: `1.5px solid ${lookingFor.includes(o) ? AMBER : PAPER_DEEP}` }} className="text-left px-4 py-3 rounded-lg text-sm font-medium">{o}</button>
        ))}
      </div>
    )},
    { label: "¿En qué ciudad o zona estás?", hint: "Para conectarte con gente cerca tuyo.", body: (
      <input autoFocus value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ej: Buenos Aires — Belgrano" style={{ fontFamily: sans, border: `1.5px solid ${PAPER_DEEP}`, background: "#fff" }} className="w-full px-4 py-3 rounded-lg text-base outline-none" />
    )},
    { label: "¿Cómo describirías tu observancia hoy?", hint: "No hay respuesta correcta.", body: (
      <div className="flex flex-col gap-2">
        {["Ortodoxa", "Conservadora", "Reformista", "Secular / cultural", "Explorando"].map((o) => (
          <button key={o} onClick={() => setObservance(o)} style={{ fontFamily: sans, background: observance === o ? INDIGO : "#fff", color: observance === o ? PAPER : INK, border: `1.5px solid ${observance === o ? INDIGO : PAPER_DEEP}` }} className="text-left px-4 py-3 rounded-lg text-sm font-medium">{o}</button>
        ))}
      </div>
    )},
    { label: "¿Qué estás buscando?", hint: "Podés elegir más de una.", body: (
      <div className="flex flex-col gap-2">
        {["Pareja", "Algo casual, ver qué surge", "Amistad", "Todavía no lo sé"].map((o) => (
          <button key={o} onClick={() => toggleIntention(o)} style={{ fontFamily: sans, background: intention.includes(o) ? AMBER_SOFT : "#fff", color: INK, border: `1.5px solid ${intention.includes(o) ? AMBER : PAPER_DEEP}` }} className="text-left px-4 py-3 rounded-lg text-sm font-medium">{o}</button>
        ))}
      </div>
    )},
    { label: "¿Alguien de la comunidad puede dar fe de vos?", hint: "Opcional. No se muestra públicamente.", body: (
      <input autoFocus value={voucher} onChange={(e) => setVoucher(e.target.value)} placeholder="Nombre de un rabino, madrijim o referente" style={{ fontFamily: sans, border: `1.5px solid ${PAPER_DEEP}`, background: "#fff" }} className="w-full px-4 py-3 rounded-lg text-base outline-none" />
    )},
    { label: "Elegí 3 palabras que te describan", hint: "Es lo primero que otros van a ver de vos, antes que tu cara.", body: (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <input key={i} value={words[i]} onChange={(e) => { const w = [...words]; w[i] = e.target.value; setWords(w); }} placeholder={`Palabra ${i + 1}`} style={{ fontFamily: sans, border: `1.5px solid ${PAPER_DEEP}`, background: "#fff" }} className="w-full px-4 py-3 rounded-lg text-base outline-none" />
        ))}
      </div>
    )},
    { label: "Subí una foto (opcional)", hint: "No se muestra de entrada — se va revelando a medida que la charla avanza. Podés agregarla después si preferís.", body: (
      <div className="flex flex-col items-center gap-3">
        {photo ? (
          <img src={photo} alt="" style={{ width: 140, height: 140, borderRadius: "50%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: 140, height: 140, borderRadius: "50%", background: PAPER_DEEP, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: sans, fontSize: 12, color: INK_SOFT }}>Sin foto</span>
          </div>
        )}
        <label style={{ fontFamily: sans, color: INDIGO, fontSize: 13 }} className="font-semibold cursor-pointer">
          {photoBusy ? "Procesando…" : photo ? "Cambiar foto" : "Elegir foto"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhoto(e.target.files[0])} />
        </label>
      </div>
    )},
    { label: "¿Formás parte de algún círculo?", hint: "Opcional — afina qué ves primero. Podés cambiarlo después.", body: (
      <div className="flex flex-col gap-2">
        {CIRCLES.map((o) => (
          <button key={o} onClick={() => setCircle(o)} style={{ fontFamily: sans, background: circle === o ? INDIGO : "#fff", color: circle === o ? PAPER : INK, border: `1.5px solid ${circle === o ? INDIGO : PAPER_DEEP}` }} className="text-left px-4 py-3 rounded-lg text-sm font-medium">{o}</button>
        ))}
        <label className="flex items-center gap-2 mt-3" style={{ fontFamily: sans, fontSize: 13, color: INK_SOFT }}>
          <input type="checkbox" checked={accessibleText} onChange={(e) => setAccessibleText(e.target.checked)} />
          Activar modo de texto grande (accesibilidad)
        </label>
      </div>
    )},
  ];
  const s = steps[step];

  return (
    <div style={{ background: PAPER, minHeight: "100%" }} className="flex flex-col px-6 py-10">
      <div className="mb-8">
        <p style={{ fontFamily: serif, fontSize: 30, color: INK }}>Chevruta</p>
        <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 12 }} className="tracking-wide uppercase mt-1">Conocé antes de ver</p>
      </div>
      <div className="flex gap-1 mb-8">
        {steps.map((_, i) => <div key={i} style={{ height: 3, flex: 1, background: i <= step ? INDIGO : PAPER_DEEP, borderRadius: 2 }} />)}
      </div>
      <p style={{ fontFamily: serif, fontSize: 21, color: INK }} className="mb-1.5">{s.label}</p>
      <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 13 }} className="mb-5">{s.hint}</p>
      <div className="mb-8">{s.body}</div>
      <div className="mt-auto flex gap-2">
        {step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)}>Atrás</Button>}
        {step < steps.length - 1
          ? <Button full={step === 0} disabled={!canNext} onClick={() => setStep(step + 1)}>Continuar</Button>
          : <Button disabled={saving || !canNext} onClick={finish}>{saving ? "Creando…" : "Entrar a Chevruta"}</Button>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Proponer pregunta comunitaria
   ------------------------------------------------------------------------- */
function ProposeQuestionModal({ myId, onClose, onCreated }) {
  const [prompt, setPrompt] = useState("");
  const [opts, setOpts] = useState(["", ""]);
  const canSave = prompt.trim().length > 5 && opts.filter((o) => o.trim()).length >= 2;

  async function save() {
    const id = "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const q = { id, authorId: myId, prompt: prompt.trim(), opts: opts.map((o) => o.trim()).filter(Boolean), cat: "Comunidad", votes: [], createdAt: Date.now() };
    await safeSet("communityQ:" + id, q, true);
    onCreated(q);
    onClose();
  }

  return (
    <Modal onClose={onClose}>
      <p style={{ fontFamily: serif, fontSize: 18, color: INK }} className="mb-3">Proponer una pregunta</p>
      <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Escribí tu pregunta…" style={{ fontFamily: sans, border: `1.5px solid ${PAPER_DEEP}`, background: "#fff" }} className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none mb-3" />
      {opts.map((o, i) => (
        <input key={i} value={o} onChange={(e) => { const n = [...opts]; n[i] = e.target.value; setOpts(n); }} placeholder={`Opción ${i + 1}`} style={{ fontFamily: sans, border: `1.5px solid ${PAPER_DEEP}`, background: "#fff" }} className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none mb-2" />
      ))}
      {opts.length < 4 && <button onClick={() => setOpts([...opts, ""])} style={{ fontFamily: sans, color: INDIGO, fontSize: 12 }} className="mb-3">+ agregar opción</button>}
      <Button full variant="amber" disabled={!canSave} onClick={save}>Publicar pregunta</Button>
      <div className="h-2" />
      <Button full variant="ghost" onClick={onClose}>Cancelar</Button>
    </Modal>
  );
}

/* -------------------------------------------------------------------------
   Preguntas (deck)
   ------------------------------------------------------------------------- */
// #10-14 — carrusel de preguntas: una por vez, con progreso tipo "stories",
// deshacer, y modo sesión rápida de a 5.
function QuestionCarousel({ pool, profile, onAnswer, onUndo, onBrowse, totalCount }) {
  const [sessionOrder, setSessionOrder] = useState([]);
  const [lastAnswer, setLastAnswer] = useState(null);
  const touchStartX = useRef(null);

  useEffect(() => {
    if (sessionOrder.length === 0 && pool.length > 0) {
      setSessionOrder(pool.slice(0, 5).map((q) => q.id));
    }
  }, [pool]); // eslint-disable-line

  if (pool.length === 0 && sessionOrder.every((id) => profile.answers[id] !== undefined)) {
    return (
      <div>
        <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="uppercase tracking-wide font-semibold mb-2">Seguí construyendo tu perfil ({Object.keys(profile.answers).length}/{totalCount})</p>
        <EmptyState title="Respondiste todo por ahora" body="Volvé mañana por una pregunta nueva del día." />
      </div>
    );
  }

  const remaining = sessionOrder.filter((id) => profile.answers[id] === undefined);
  const currentId = remaining[0];
  const currentQ = pool.find((q) => q.id === currentId) || QUESTIONS.find((q) => q.id === currentId);
  const answeredInSession = sessionOrder.length - remaining.length;

  function skip() {
    setSessionOrder((order) => {
      const idx = order.indexOf(currentId);
      if (idx === -1) return order;
      const next = [...order];
      next.splice(idx, 1);
      next.push(currentId);
      return next;
    });
  }
  function handleAnswer(idx) {
    const prevValue = profile.answers[currentId];
    onAnswer(currentId, idx);
    setLastAnswer({ qid: currentId, prevValue });
    setTimeout(() => setLastAnswer((cur) => (cur && cur.qid === currentId ? null : cur)), 4000);
  }
  function handleUndo() {
    if (!lastAnswer) return;
    onUndo(lastAnswer.qid);
    setLastAnswer(null);
  }
  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX; }
  function onTouchEnd(e) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 60) skip();
    touchStartX.current = null;
  }

  if (!currentQ) {
    return (
      <div>
        <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="uppercase tracking-wide font-semibold mb-2">Seguí construyendo tu perfil ({Object.keys(profile.answers).length}/{totalCount})</p>
        <Skeleton h={140} />
      </div>
    );
  }

  const sessionComplete = remaining.length === 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="uppercase tracking-wide font-semibold">Seguí construyendo tu perfil</p>
        {lastAnswer && <button onClick={handleUndo} style={{ fontFamily: sans, color: POMEGRANATE, fontSize: 11 }} className="font-semibold">↺ Deshacer</button>}
      </div>
      <div className="flex gap-1.5 mb-3">
        {sessionOrder.map((id) => (
          <div key={id} style={{ flex: 1, height: 4, borderRadius: 3, background: profile.answers[id] !== undefined ? OLIVE : id === currentId ? AMBER : PAPER_DEEP }} />
        ))}
      </div>

      {sessionComplete ? (
        <div style={{ background: "#fff", border: `1px solid ${PAPER_DEEP}`, borderRadius: 14 }} className="p-6 text-center">
          <p style={{ fontFamily: serif, fontSize: 17, color: INK }} className="mb-1">¡Sesión completa! ✨</p>
          <p style={{ fontFamily: sans, fontSize: 12.5, color: INK_SOFT }} className="mb-4">Respondiste {answeredInSession} preguntas.</p>
          {pool.length > 0 && <Button variant="amber" onClick={() => setSessionOrder([])}>Traer más preguntas</Button>}
        </div>
      ) : (
        <div key={currentId} className="chev-card-in p-4" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ background: "#fff", border: `1px solid ${PAPER_DEEP}`, borderRadius: 14 }}>
          <div className="flex items-center gap-2 mb-2">
            <Pill>{currentQ.cat}</Pill>
          </div>
          <p style={{ fontFamily: serif, color: INK, fontSize: 17 }} className="mb-3">{currentQ.prompt}</p>
          <div className="flex flex-col gap-1.5 mb-2">
            {currentQ.opts.map((o, i) => (
              <button key={i} onClick={() => handleAnswer(i)} style={{ fontFamily: sans, background: PAPER, border: `1px solid ${PAPER_DEEP}`, color: INK }} className="text-left px-3.5 py-2.5 rounded-lg text-sm active:scale-[0.99] transition">
                {o}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <button onClick={skip} style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11.5 }}>Saltar por ahora →</button>
            <button onClick={() => onBrowse(currentQ)} style={{ fontFamily: sans, color: INDIGO, fontSize: 11 }} className="uppercase font-semibold">Ver comunidad →</button>
          </div>
        </div>
      )}
      <p style={{ fontFamily: sans, fontSize: 10.5, color: INK_SOFT }} className="mt-2 text-center">Deslizá o tocá "Saltar" para pasar a la siguiente</p>
    </div>
  );
}

function QuestionsTab({ profile, onUpdate, allProfiles, communityQuestions, onProposeCreated }) {
  const [showPropose, setShowPropose] = useState(false);
  const [browseQ, setBrowseQ] = useState(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const DAILY_Q = QUESTIONS[DAY_SEED % QUESTIONS.length];
  const weeklyPool = QUESTIONS.filter((q) => q.weekly);
  const WEEKLY_Q = weeklyPool[WEEK_SEED % weeklyPool.length];
  const seasonal = SEASONAL_QUESTIONS.find((q) => q.months.includes(CURRENT_MONTH));

  const allQuestions = useMemo(() => [...QUESTIONS, ...communityQuestions], [communityQuestions]);
  const chainReady = (q) => !q.requires || q.requires.every((r) => profile.answers[r] !== undefined);
  const unanswered = allQuestions.filter((q) => profile.answers[q.id] === undefined && chainReady(q));
  const lockedChain = allQuestions.filter((q) => profile.answers[q.id] === undefined && !chainReady(q));
  const answeredList = allQuestions.filter((q) => profile.answers[q.id] !== undefined);
  const dailyAnswered = profile.answers[DAILY_Q.id] !== undefined;

  const dailyStats = useMemo(() => {
    if (!dailyAnswered) return null;
    const others = allProfiles.filter((p) => p.id !== profile.id && p.answers[DAILY_Q.id] !== undefined);
    if (others.length === 0) return { total: 0, same: 0 };
    return { total: others.length, same: others.filter((p) => p.answers[DAILY_Q.id] === profile.answers[DAILY_Q.id]).length };
  }, [allProfiles, dailyAnswered, profile, DAILY_Q.id]);

  const changedAnswers = Object.entries(profile.answersHistory || {}).filter(([, hist]) => hist.length > 1);

  async function answer(qid, idx) {
    const q = allQuestions.find((x) => x.id === qid);
    const history = { ...(profile.answersHistory || {}) };
    history[qid] = [...(history[qid] || []), { v: idx, ts: Date.now() }];

    const updated = { ...profile, answers: { ...profile.answers, [qid]: idx }, answersHistory: history };
    const today = todayStr();
    if (profile.lastAnswered !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      updated.streak = profile.lastAnswered === yesterday ? profile.streak + 1 : 1;
      updated.lastAnswered = today;
    }
    const totalAnswered = Object.keys(updated.answers).length;
    const badges = new Set(profile.badges);
    if (totalAnswered >= 5) badges.add("Primeros pasos");
    if (totalAnswered >= QUESTIONS.length) badges.add("Estudiante dedicado/a");
    if (updated.streak >= 3) badges.add("Racha de 3 días");
    if (updated.streak >= 7) badges.add("Racha semanal");
    if (q && q.id.startsWith("c_") && q.authorId !== profile.id) badges.add("Explorador/a");
    if (qid === "q_chain") badges.add("Buscador/a profundo/a");
    updated.badges = [...badges];

    await safeSet("profile:" + profile.id, updated, true);
    onUpdate(updated);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1400);
  }

  // #14 — deshacer la última respuesta (single-level, con botón en vez de
  // gesto de swipe hacia atrás, para que sea confiable)
  async function undoAnswer(qid) {
    const answers = { ...profile.answers };
    delete answers[qid];
    const history = { ...(profile.answersHistory || {}) };
    if (history[qid]) history[qid] = history[qid].slice(0, -1);
    const updated = { ...profile, answers, answersHistory: history };
    await safeSet("profile:" + profile.id, updated, true);
    onUpdate(updated);
  }

  async function vote(q) {
    const key = "communityQ:" + q.id;
    const current = (await safeGet(key, true)) || q;
    if (current.votes.includes(profile.id)) return;
    const updated = { ...current, votes: [...current.votes, profile.id] };
    await safeSet(key, updated, true);
    onProposeCreated(updated);
  }

  function QCard({ q, highlight, locked }) {
    return (
      <div style={{ background: highlight ? INDIGO : "#fff", border: highlight ? "none" : `1px solid ${PAPER_DEEP}`, borderRadius: 14, opacity: locked ? 0.55 : 1 }} className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Pill tone={highlight ? "amber" : "default"}>{q.cat}</Pill>
          {locked && <Pill>🔒 requiere otras respuestas</Pill>}
        </div>
        <p style={{ fontFamily: serif, color: highlight ? PAPER : INK, fontSize: 16 }} className="mb-3">{q.prompt}</p>
        {!locked && (
          <div className="flex flex-col gap-1.5">
            {q.opts.map((o, i) => (
              <button key={i} onClick={() => answer(q.id, i)} style={{ fontFamily: sans, background: highlight ? "rgba(241,232,211,0.1)" : PAPER, border: `1px solid ${highlight ? "rgba(241,232,211,0.35)" : PAPER_DEEP}`, color: highlight ? PAPER : INK }} className="text-left px-3.5 py-2 rounded-lg text-sm active:scale-[0.99] transition">
                {o}
              </button>
            ))}
          </div>
        )}
        {!locked && <button onClick={() => setBrowseQ(q)} style={{ fontFamily: sans, color: highlight ? AMBER_SOFT : INDIGO, fontSize: 11 }} className="mt-2 uppercase font-semibold">Ver cómo responde la comunidad →</button>}
      </div>
    );
  }

  return (
    <div className="px-5 py-5 flex flex-col gap-5">
      {seasonal && profile.answers[seasonal.id] === undefined && (
        <div>
          <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="uppercase tracking-wide font-semibold mb-2">Pregunta de temporada · {seasonal.holiday}</p>
          <QCard q={seasonal} />
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="uppercase tracking-wide font-semibold">Reto semanal de la comunidad</p>
          <Pill>faltan {daysUntilMonday()}d</Pill>
        </div>
        {profile.answers[WEEKLY_Q.id] === undefined ? <QCard q={WEEKLY_Q} /> : (
          <div style={{ background: "#fff", border: `1px solid ${PAPER_DEEP}`, borderRadius: 14 }} className="p-4">
            <p style={{ fontFamily: serif, fontSize: 15, color: INK }} className="mb-1">{WEEKLY_Q.prompt}</p>
            <p style={{ fontFamily: sans, fontSize: 12, color: INK_SOFT }} className="mb-2">Ya participaste esta semana.</p>
            <button onClick={() => setBrowseQ(WEEKLY_Q)} style={{ fontFamily: sans, color: INDIGO, fontSize: 11 }} className="uppercase font-semibold">Ver respuestas de la comunidad →</button>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="uppercase tracking-wide font-semibold">Pregunta del día</p>
          <Pill tone="amber">🔥 {profile.streak} días</Pill>
        </div>
        <div style={{ background: INDIGO, borderRadius: 14 }} className="p-5">
          <p style={{ fontFamily: serif, color: PAPER, fontSize: 19 }} className="mb-4">{DAILY_Q.prompt}</p>
          {!dailyAnswered ? (
            <div className="flex flex-col gap-2">
              {DAILY_Q.opts.map((o, i) => (
                <button key={i} onClick={() => answer(DAILY_Q.id, i)} style={{ fontFamily: sans, background: "rgba(241,232,211,0.1)", color: PAPER, border: "1px solid rgba(241,232,211,0.35)" }} className="text-left px-3.5 py-2.5 rounded-lg text-sm">{o}</button>
              ))}
            </div>
          ) : (
            <div>
              <p style={{ fontFamily: sans, color: AMBER_SOFT, fontSize: 13 }} className="mb-1">Ya respondiste: <strong>{DAILY_Q.opts[profile.answers[DAILY_Q.id]]}</strong></p>
              {dailyStats && dailyStats.total > 0 && <p style={{ fontFamily: sans, color: "rgba(241,232,211,0.7)", fontSize: 12 }}>Coincidís con {dailyStats.same} de {dailyStats.total} personas que ya respondieron hoy.</p>}
              <button onClick={() => setBrowseQ(DAILY_Q)} style={{ fontFamily: sans, color: AMBER_SOFT, fontSize: 11 }} className="mt-2 uppercase font-semibold">Ver el desglose completo →</button>
            </div>
          )}
        </div>
      </div>

      {lockedChain.length > 0 && (
        <div>
          <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="uppercase tracking-wide font-semibold mb-2">Pregunta encadenada</p>
          {lockedChain.map((q) => <QCard key={q.id} q={q} locked />)}
        </div>
      )}
      {unanswered.some((q) => q.requires) && (
        <div>
          <p style={{ fontFamily: sans, color: AMBER, fontSize: 11 }} className="uppercase tracking-wide font-semibold mb-2">✨ Pregunta desbloqueada</p>
          {unanswered.filter((q) => q.requires).map((q) => <QCard key={q.id} q={q} />)}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="uppercase tracking-wide font-semibold">Propuestas de la comunidad</p>
          <button onClick={() => setShowPropose(true)} style={{ fontFamily: sans, color: INDIGO, fontSize: 12 }} className="font-semibold">+ proponer</button>
        </div>
        {communityQuestions.length === 0 ? (
          <EmptyState title="Todavía no hay propuestas" body="Sé la primera persona en proponer una pregunta para la comunidad." />
        ) : (
          <div className="flex flex-col gap-3">
            {[...communityQuestions].sort((a, b) => b.votes.length - a.votes.length).slice(0, 3).map((q) => (
              <div key={q.id} style={{ background: "#fff", border: `1px solid ${PAPER_DEEP}`, borderRadius: 14 }} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Pill tone="indigo">Comunidad</Pill>
                  <button onClick={() => vote(q)} style={{ fontFamily: sans, color: q.votes.includes(profile.id) ? AMBER : INK_SOFT, fontSize: 12 }}>👍 {q.votes.length}</button>
                </div>
                <p style={{ fontFamily: serif, color: INK, fontSize: 16 }} className="mb-3">{q.prompt}</p>
                {profile.answers[q.id] === undefined ? (
                  <div className="flex flex-col gap-1.5">
                    {q.opts.map((o, i) => (
                      <button key={i} onClick={() => answer(q.id, i)} style={{ fontFamily: sans, background: PAPER, border: `1px solid ${PAPER_DEEP}`, color: INK }} className="text-left px-3.5 py-2 rounded-lg text-sm">{o}</button>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontFamily: sans, fontSize: 12, color: INK_SOFT }}>Ya respondiste esta.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <QuestionCarousel pool={unanswered.filter((q) => !q.months && !q.requires)} profile={profile} onAnswer={answer} onUndo={undoAnswer} onBrowse={setBrowseQ} totalCount={allQuestions.length} />

      {answeredList.length > 0 && (
        <div style={{ borderTop: `1px solid ${PAPER_DEEP}` }} className="pt-4">
          <button onClick={() => setReviewMode((v) => !v)} style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="uppercase tracking-wide font-semibold mb-2 block">
            {reviewMode ? "Ocultar" : "Revisar y cambiar respuestas anteriores"} {changedAnswers.length > 0 && `· ${changedAnswers.length} cambiaron con el tiempo`}
          </button>
          {reviewMode && (
            <div className="flex flex-col gap-2">
              {answeredList.map((q) => (
                <div key={q.id} style={{ background: "#fff", border: `1px solid ${PAPER_DEEP}`, borderRadius: 12 }} className="p-3">
                  <p style={{ fontFamily: sans, fontSize: 13, color: INK }} className="mb-1.5">{q.prompt}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {q.opts.map((o, i) => (
                      <button key={i} onClick={() => answer(q.id, i)} style={{ fontFamily: sans, fontSize: 11.5, background: profile.answers[q.id] === i ? INDIGO : PAPER, color: profile.answers[q.id] === i ? PAPER : INK_SOFT, border: `1px solid ${profile.answers[q.id] === i ? INDIGO : PAPER_DEEP}` }} className="px-2.5 py-1 rounded-full">{o}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showPropose && <ProposeQuestionModal myId={profile.id} onClose={() => setShowPropose(false)} onCreated={onProposeCreated} />}
      {browseQ && <CommunityBreakdown q={browseQ} allProfiles={allProfiles} onClose={() => setBrowseQ(null)} />}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Desafío de trivia grupal (#9)
   ------------------------------------------------------------------------- */
function GroupTriviaModal({ groupKey, myId, participantIds, onClose }) {
  const [q] = useState(() => QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]);
  const [myAnswer, setMyAnswer] = useState(null);
  const [answers, setAnswers] = useState({});
  const key = "groupTrivia:" + groupKey + ":" + q.id;

  const load = useCallback(async () => setAnswers((await safeGet(key, true)) || {}), [key]);
  useEffect(() => { load(); const t = setInterval(load, 2000); return () => clearInterval(t); }, [load]);

  async function pick(i) {
    setMyAnswer(i);
    const current = (await safeGet(key, true)) || {};
    current[myId] = i;
    await safeSet(key, current, true);
    load();
  }

  const allAnswered = participantIds.every((id) => answers[id] !== undefined);
  const agreeCount = allAnswered ? (() => {
    const counts = {};
    participantIds.forEach((id) => { counts[answers[id]] = (counts[answers[id]] || 0) + 1; });
    return Math.max(...Object.values(counts));
  })() : null;

  return (
    <Modal onClose={onClose}>
      <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="uppercase tracking-wide font-semibold mb-2">Desafío de trivia grupal · {participantIds.length} personas</p>
      <p style={{ fontFamily: serif, fontSize: 19, color: INK }} className="mb-4">{q.prompt}</p>
      <div className="flex flex-col gap-2 mb-4">
        {q.opts.map((o, i) => (
          <button key={i} disabled={myAnswer !== null} onClick={() => pick(i)} style={{ fontFamily: sans, background: myAnswer === i ? INDIGO : "#fff", color: myAnswer === i ? PAPER : INK, border: `1.5px solid ${myAnswer === i ? INDIGO : PAPER_DEEP}`, opacity: myAnswer !== null && myAnswer !== i ? 0.5 : 1 }} className="text-left px-4 py-2.5 rounded-lg text-sm">{o}</button>
        ))}
      </div>
      {myAnswer === null && <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 12 }}>Elegí una opción — el resto responde a ciegas.</p>}
      {myAnswer !== null && !allAnswered && <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 12 }}>Esperando al resto del grupo ({Object.keys(answers).length}/{participantIds.length})…</p>}
      {allAnswered && (
        <div style={{ background: "#DCE3CB", borderRadius: 12 }} className="p-3 mb-3">
          <p style={{ fontFamily: serif, fontSize: 15, color: INK }}>{agreeCount === participantIds.length ? "¡Coincidieron todos! 🎉" : `${agreeCount} de ${participantIds.length} coincidieron.`}</p>
        </div>
      )}
      <Button full variant="ghost" onClick={onClose}>Cerrar</Button>
    </Modal>
  );
}

/* -------------------------------------------------------------------------
   Ecos (descubrimiento)
   ------------------------------------------------------------------------- */
// #30 (ampliado) — pestaña "Jugar": hub central de minijuegos, siempre a un
// tap de distancia desde la barra inferior.
function PlayTab({ profile, allProfiles, existingMatchIds, onOpenMatch }) {
  const [soloId, setSoloId] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const others = allProfiles.filter((p) => existingMatchIds.includes(p.id));
      const found = [];
      for (const o of others) {
        const m = await safeGet(matchId(profile.id, o.id), true);
        if (m && !m.closed) found.push({ other: o, match: m });
      }
      setMatches(found);
      setLoading(false);
    })();
  }, [allProfiles, existingMatchIds, profile.id]);

  async function quickPlay() {
    const candidates = allProfiles.filter((p) => p.id !== profile.id && !p.paused && !(profile.blocked || []).includes(p.id) && compatScore(profile, p));
    if (candidates.length === 0) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const mid = matchId(profile.id, pick.id);
    const existing = await safeGet(mid, true);
    if (!existing) {
      await safeSet(mid, {
        participants: [profile.id, pick.id], stage: 3, messages: [], reveal: {}, duelQids: [], duelScore: { agree: 0, total: 0 },
        pairStreak: 0, pairStreakDate: null, openAnswers: {}, closeQAnswers: {}, listenOnly: {}, closed: false, closedBy: null,
        stageHistory: [{ stage: 3, ts: Date.now() }], createdAt: Date.now(),
      }, true);
    }
    setSoloId(pick.id);
  }

  return (
    <div className="px-5 py-5 flex flex-col gap-5">
      <div style={{ background: INDIGO, borderRadius: 16 }} className="p-5 text-center">
        <p style={{ fontSize: 34 }} className="mb-2">🎲</p>
        <p style={{ fontFamily: serif, fontSize: 18, color: PAPER }} className="mb-1">Hoy solo quiero jugar</p>
        <p style={{ fontFamily: sans, fontSize: 12.5, color: "rgba(241,232,211,0.8)" }} className="mb-4">Te conectamos con alguien afín y entrás directo a elegir un minijuego.</p>
        <Button full variant="amber" onClick={quickPlay}>Jugar con alguien al azar</Button>
      </div>

      <div>
        <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="uppercase tracking-wide font-semibold mb-2">Jugar dentro de una conexión</p>
        {loading ? (
          <div className="flex flex-col gap-2"><Skeleton h={56} /><Skeleton h={56} /></div>
        ) : matches.length === 0 ? (
          <EmptyState title="Todavía no tenés conexiones activas" body="Conectá con alguien en Descubrir, o probá jugar al azar arriba." />
        ) : (
          <div className="flex flex-col gap-2.5">
            {matches.map(({ other, match }) => (
              <div key={other.id} style={{ background: "#fff", border: `1px solid ${PAPER_DEEP}`, borderRadius: 14 }} className="p-3.5 flex items-center gap-3">
                <Avatar id={other.id} size={38} />
                <div className="flex-1">
                  <p style={{ fontFamily: serif, fontSize: 15, color: INK }}>{match.stage >= 5 ? other.alias : pseudonym(other.id)}</p>
                  <FlameProgress stage={match.stage} />
                </div>
                <Button small variant="ghost" onClick={() => onOpenMatch(other.id)}>Abrir chat</Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {soloId && (
        <Suspense fallback={<Modal onClose={() => setSoloId(null)}><p style={{ fontFamily: sans, color: INK_SOFT }}>Cargando minijuegos…</p></Modal>}>
          <GameModal mid={matchId(profile.id, soloId)} myId={profile.id} otherId={soloId} onClose={() => setSoloId(null)} />
        </Suspense>
      )}
    </div>
  );
}

// Mazo estilo Tinder: una persona a la vez, con swipe y botones grandes de
// pasar / conectar. Reemplaza la lista larga de tarjetas.
function SwipeDeck({ candidates, profile, onSkip, onConnect, constellation, affinityLabel }) {
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const touchStartX = useRef(null);
  const current = candidates[index];

  function next() { setDragX(0); setIndex((i) => i + 1); }
  function handleSkip() { if (current) { onSkip(current.p.id); next(); } }
  function handleConnect() { if (current) { onConnect(current.p.id); } }

  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX; }
  function onTouchMove(e) {
    if (touchStartX.current === null) return;
    setDragX(e.touches[0].clientX - touchStartX.current);
  }
  function onTouchEnd() {
    if (Math.abs(dragX) > 90) { dragX < 0 ? handleSkip() : handleConnect(); }
    else setDragX(0);
    touchStartX.current = null;
  }

  if (!current) {
    return (
      <div>
        <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="uppercase tracking-wide font-semibold mb-3">Descubrir</p>
        <EmptyState title="Por ahora es todo" body="Viste a todas las personas afines disponibles. Volvé más tarde por caras nuevas (o respondé más preguntas para afinar tus ecos)." />
      </div>
    );
  }

  const { p, score } = current;
  const commonEchoes = constellation(p);
  const sameCircle = p.circle && p.circle === profile.circle && profile.circle !== "Sin preferencia";
  const rotation = dragX / 18;
  const likeOpacity = Math.min(Math.max(dragX / 80, 0), 1);
  const passOpacity = Math.min(Math.max(-dragX / 80, 0), 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="uppercase tracking-wide font-semibold">Descubrir</p>
        <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }}>{candidates.length - index} {candidates.length - index === 1 ? "persona" : "personas"}</p>
      </div>

      <div
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        style={{ background: "#fff", border: `1px solid ${PAPER_DEEP}`, borderRadius: 20, transform: `translateX(${dragX}px) rotate(${rotation}deg)`, transition: touchStartX.current ? "none" : "transform .25s", position: "relative", overflow: "hidden" }}
        className="select-none"
      >
        <div style={{ position: "absolute", top: 16, left: 16, background: OLIVE, color: "#fff", opacity: likeOpacity, fontFamily: sans, fontWeight: 700, fontSize: 13, padding: "4px 10px", borderRadius: 8, border: "2px solid #fff", zIndex: 2 }}>CONECTAR</div>
        <div style={{ position: "absolute", top: 16, right: 16, background: POMEGRANATE, color: "#fff", opacity: passOpacity, fontFamily: sans, fontWeight: 700, fontSize: 13, padding: "4px 10px", borderRadius: 8, border: "2px solid #fff", zIndex: 2 }}>PASAR</div>

        <div style={{ height: 220, background: p.photo ? "#000" : avatarGradient(p.id), display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
          {p.photo ? (
            <img src={p.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(22px) brightness(0.9)", transform: "scale(1.2)" }} />
          ) : (
            <div style={{ width: 84, height: 84, borderRadius: "50%", background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: serif, fontSize: 32, color: "#fff" }}>{pseudonym(p.id).split(" ")[1]?.[0] || "?"}</span>
            </div>
          )}
          <p style={{ position: "absolute", bottom: 10, left: 14, fontFamily: sans, fontSize: 10.5, color: "rgba(255,255,255,0.85)" }}>{p.photo ? "Su foto se revela a medida que charlan" : "Todavía sin foto"}</p>
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p style={{ fontFamily: serif, fontSize: 20, color: INK }}>{pseudonym(p.id)}{p.age ? `, ${p.age}` : ""}</p>
              <p style={{ fontFamily: sans, fontSize: 12.5, color: INK_SOFT }}>{p.city}</p>
            </div>
            <div className="text-right">
              <p style={{ fontFamily: serif, fontSize: 15, color: OLIVE }}>{affinityLabel(score.pct)}</p>
              <p style={{ fontFamily: sans, fontSize: 10.5, color: INK_SOFT }}>{score.pct}% afinidad</p>
            </div>
          </div>
          {p.threeWords && p.threeWords.length > 0 && <p style={{ fontFamily: sans, fontSize: 13.5, color: INK }} className="italic mb-2.5">"{p.threeWords.join(" · ")}"</p>}
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {sameCircle && <Pill tone="indigo">✦ {p.circle}</Pill>}
            {score.cats.map((c) => <Pill key={c} tone="olive">{c}</Pill>)}
          </div>
          {commonEchoes > 0 && <p style={{ fontFamily: sans, fontSize: 11.5, color: INK_SOFT }}>✨ Tenés {commonEchoes} {commonEchoes === 1 ? "eco" : "ecos"} en común con esta persona</p>}
        </div>
      </div>

      <div className="flex items-center justify-center gap-6 mt-5">
        <button onClick={handleSkip} style={{ width: 58, height: 58, borderRadius: "50%", background: "#fff", border: `2px solid ${POMEGRANATE}`, color: POMEGRANATE, fontSize: 24 }} className="flex items-center justify-center active:scale-95 transition">✕</button>
        <button onClick={handleConnect} style={{ width: 66, height: 66, borderRadius: "50%", background: OLIVE, border: "none", color: "#fff", fontSize: 26 }} className="flex items-center justify-center active:scale-95 transition">♥</button>
      </div>
      <p style={{ fontFamily: sans, fontSize: 10.5, color: INK_SOFT }} className="mt-3 text-center">Deslizá la tarjeta, o tocá los botones</p>
    </div>
  );
}

function EcosTab({ profile, onUpdate, allProfiles, onOpenMatch, existingMatchIds }) {
  const [showMap, setShowMap] = useState(false);
  const [showGroupTrivia, setShowGroupTrivia] = useState(false);
  const [groupFeedback, setGroupFeedback] = useState(null);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [soloPlayId, setSoloPlayId] = useState(null);
  const viewedRef = useRef(false);

  const candidates = useMemo(() => {
    return allProfiles
      .filter((p) => p.id !== profile.id && !p.paused && !(profile.blocked || []).includes(p.id) && !(profile.skipped || []).includes(p.id))
      // Compatibilidad de género/orientación mutua — perfiles viejos sin
      // estos campos se muestran igual (no los rompemos retroactivamente)
      .filter((p) => {
        if (!profile.gender || !p.gender) return true;
        const iWantThem = !profile.lookingFor || profile.lookingFor.length === 0 || profile.lookingFor.includes(p.gender);
        const theyWantMe = !p.lookingFor || p.lookingFor.length === 0 || p.lookingFor.includes(profile.gender);
        return iWantThem && theyWantMe;
      })
      .map((p) => ({ p, score: compatScore(profile, p) }))
      .filter((x) => x.score && x.score.common >= 2)
      .sort((a, b) => {
        // #6 — boost por círculo temático compartido
        const aBoost = a.p.circle && a.p.circle === profile.circle && profile.circle !== "Sin preferencia" ? 1000 : 0;
        const bBoost = b.p.circle && b.p.circle === profile.circle && profile.circle !== "Sin preferencia" ? 1000 : 0;
        return (b.score.pct + bBoost) - (a.score.pct + aBoost);
      });
  }, [allProfiles, profile]);

  // Estilo Tinder: "pasar" saca a la persona del mazo por ahora (se guarda,
  // no vuelve a aparecer hasta que decidas lo contrario)
  async function skipPerson(otherId) {
    const updated = { ...profile, skipped: [...(profile.skipped || []), otherId] };
    await safeSet("profile:" + profile.id, updated, true);
    onUpdate(updated);
  }

  function constellation(p) {
    return allProfiles.filter((q) => q.id !== profile.id && q.id !== p.id).filter((q) => {
      const s1 = compatScore(profile, q);
      const s2 = compatScore(p, q);
      return s1 && s2 && s1.pct >= 60 && s2.pct >= 60;
    }).length;
  }

  // #10 — "casi": registrar (una vez por sesión) que vi al mejor candidato
  useEffect(() => {
    if (viewedRef.current || candidates.length === 0) return;
    viewedRef.current = true;
    const top = candidates[0].p.id;
    safeSet("viewed:" + profile.id + ":" + top, { ts: Date.now() }, true);
  }, [candidates, profile.id]);

  // #5 — bienvenida a nuevos miembros
  const newest = allProfiles.filter((p) => p.id !== profile.id).sort((a, b) => b.createdAt - a.createdAt)[0];
  const showWelcome = newest && Date.now() - newest.createdAt < 1000 * 60 * 60 * 72;

  const fresh = allProfiles.filter((p) => p.id !== profile.id && Date.now() - p.createdAt < 1000 * 60 * 60 * 48);
  const freshHighAffinity = fresh.filter((p) => { const s = compatScore(profile, p); return s && s.pct >= 70; });

  const blindPool = candidates.filter((c) => !existingMatchIds.includes(c.p.id));
  const blindCandidates = blindPool.length > 3 ? blindPool.slice(3) : blindPool;
  const blindPick = blindCandidates.length > 0 ? blindCandidates[hashStr(profile.id + "_" + WEEK_SEED) % blindCandidates.length] : null;

  const groupPool = candidates.filter((c) => !existingMatchIds.includes(c.p.id)).slice(0, 6);
  const monthGroup = groupPool.length >= 3 ? groupPool.slice(0, 3) : null;
  const groupKey = monthGroup ? MONTH_KEY + "_" + [profile.id, ...monthGroup.map((g) => g.p.id)].sort().join("_") : null;
  const [groupInterested, setGroupInterested] = useState(false);
  useEffect(() => {
    if (!monthGroup) return;
    safeGet("groupInterest:" + MONTH_KEY + ":" + profile.id, true).then((v) => setGroupInterested(!!v));
    safeGet("feedback:" + MONTH_KEY + ":" + profile.id, true).then((v) => setFeedbackSent(!!v));
  }, [monthGroup]); // eslint-disable-line
  async function joinGroup() {
    await safeSet("groupInterest:" + MONTH_KEY + ":" + profile.id, true, true);
    setGroupInterested(true);
  }
  async function sendFeedback(rating) {
    await safeSet("feedback:" + MONTH_KEY + ":" + profile.id, { rating, ts: Date.now() }, true);
    setFeedbackSent(true);
  }

  async function connect(otherId) {
    const mid = matchId(profile.id, otherId);
    const existing = await safeGet(mid, true);
    if (!existing) {
      await safeSet(mid, {
        participants: [profile.id, otherId], stage: 3, messages: [], reveal: {}, duelQids: [], duelScore: { agree: 0, total: 0 },
        pairStreak: 0, pairStreakDate: null, openAnswers: {}, closeQAnswers: {}, listenOnly: {}, closed: false, closedBy: null,
        stageHistory: [{ stage: 3, ts: Date.now() }], createdAt: Date.now(),
      }, true);
      const updatedMe = { ...profile, connectionsInitiated: (profile.connectionsInitiated || 0) + 1 };
      const badges = new Set(updatedMe.badges);
      if (updatedMe.connectionsInitiated >= 3) badges.add("Rompehielos");
      updatedMe.badges = [...badges];
      await safeSet("profile:" + profile.id, updatedMe, true);
    }
    onOpenMatch(otherId);
  }

  if (Object.keys(profile.answers).length < 5) {
    return <div className="px-5 py-5"><EmptyState title="Todavía estás construyendo tu perfil" body='Respondé al menos 5 preguntas en la pestaña "Preguntas" para empezar a ver ecos de compatibilidad.' /></div>;
  }

  return (
    <div className="px-5 py-5 flex flex-col gap-5">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => setShowMap(true)} style={{ fontFamily: sans, color: INDIGO, fontSize: 12 }} className="font-semibold">🗺️ Explorar la comunidad</button>
      </div>

      {showWelcome && (
        <div style={{ background: "#DCE3CB", borderRadius: 12 }} className="p-3">
          <p style={{ fontFamily: sans, fontSize: 12.5, color: "#3C4A26" }}>
            👋 Alguien nuevo se sumó a la comunidad{newest.threeWords && newest.threeWords[0] ? ` — valora mucho "${newest.threeWords[0]}"` : ""}.
          </p>
        </div>
      )}
      {freshHighAffinity.length > 0 && (
        <div style={{ background: AMBER_SOFT, borderRadius: 12 }} className="p-3">
          <p style={{ fontFamily: sans, fontSize: 12.5, color: "#5A3E0F" }}>
            {freshHighAffinity.length === 1 ? "1 persona nueva" : `${freshHighAffinity.length} personas nuevas`} con alta afinidad se sumaron esta semana.
          </p>
        </div>
      )}

      {blindPick && (
        <div>
          <FirstTimeHint id="blind_pick" text="💡 Cada semana te sugerimos a alguien fuera de tu top habitual, a propósito — para salir de la zona de confort." />
          <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="uppercase tracking-wide font-semibold mb-2">Tu ronda ciega de esta semana</p>
          <div style={{ background: INDIGO, borderRadius: 14 }} className="p-4">
            <p style={{ fontFamily: sans, color: AMBER_SOFT, fontSize: 12 }} className="mb-1.5">Elegida especialmente para sacarte de tu zona de confort</p>
            <p style={{ fontFamily: serif, fontSize: 17, color: PAPER }} className="mb-2">{pseudonym(blindPick.p.id)}</p>
            {blindPick.score.cats.length > 0 && <div className="flex flex-wrap gap-1.5 mb-3">{blindPick.score.cats.map((c) => <Pill key={c} tone="amber">{c}</Pill>)}</div>}
            <Button full variant="amber" onClick={() => connect(blindPick.p.id)}>Conectar de todos modos</Button>
          </div>
        </div>
      )}

      {monthGroup && (
        <div>
          <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="uppercase tracking-wide font-semibold mb-2">Sugerencia del mes: encuentro grupal</p>
          <div style={{ background: "#fff", border: `1px solid ${PAPER_DEEP}`, borderRadius: 14 }} className="p-4">
            <p style={{ fontFamily: sans, fontSize: 13, color: INK }} className="mb-2">Un café chico con {monthGroup.length} personas afines a vos, elegidas este mes:</p>
            <div className="flex flex-wrap gap-1.5 mb-3">{monthGroup.map(({ p }) => <Pill key={p.id} tone="olive">{pseudonym(p.id)}</Pill>)}</div>
            {!groupInterested ? (
              <Button full variant="ghost" onClick={joinGroup}>Me interesa</Button>
            ) : (
              <>
                <p style={{ fontFamily: sans, fontSize: 12, color: OLIVE }} className="mb-2">Anotado/a — te avisamos si se arma. ✓</p>
                <Button full variant="ghost" onClick={() => setShowGroupTrivia(true)}>🎲 Desafío de trivia grupal</Button>
                <div className="h-2" />
                {!feedbackSent ? (
                  <div style={{ background: PAPER, borderRadius: 10 }} className="p-3">
                    <p style={{ fontFamily: sans, fontSize: 12, color: INK }} className="mb-1.5">¿Ya se dio el encuentro? Contanos cómo estuvo (privado):</p>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => sendFeedback(n)} style={{ fontSize: 16 }}>⭐</button>)}
                    </div>
                  </div>
                ) : (
                  <p style={{ fontFamily: sans, fontSize: 11.5, color: OLIVE }}>Gracias por el feedback 🙏</p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <SwipeDeck candidates={candidates} profile={profile} onSkip={skipPerson} onConnect={connect} constellation={constellation} affinityLabel={affinityLabel} />

      {showMap && <CommunityMapModal allProfiles={allProfiles} onClose={() => setShowMap(false)} />}
      {showGroupTrivia && monthGroup && (
        <GroupTriviaModal groupKey={groupKey} myId={profile.id} participantIds={[profile.id, ...monthGroup.map((g) => g.p.id)]} onClose={() => setShowGroupTrivia(false)} />
      )}
      {soloPlayId && (
        <Suspense fallback={<Modal onClose={() => setSoloPlayId(null)}><p style={{ fontFamily: sans, color: INK_SOFT }}>Cargando minijuegos…</p></Modal>}>
          <GameModal mid={matchId(profile.id, soloPlayId)} myId={profile.id} otherId={soloPlayId} onClose={() => setSoloPlayId(null)} />
        </Suspense>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Duelo de trivia (1 a 1)
   ------------------------------------------------------------------------- */
function TriviaDuel({ mid, myId, otherId, match, onClose, onScoreUpdate }) {
  const [q] = useState(() => QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]);
  const [myAnswer, setMyAnswer] = useState(null);
  const [duel, setDuel] = useState(null);
  const key = mid + ":duel:" + q.id;
  const countedRef = useRef(false);

  const load = useCallback(async () => setDuel(await safeGet(key, true)), [key]);
  useEffect(() => { load(); const t = setInterval(load, 2000); return () => clearInterval(t); }, [load]);

  async function pick(i) {
    setMyAnswer(i);
    const current = (await safeGet(key, true)) || {};
    current[myId] = i;
    await safeSet(key, current, true);
    load();
  }

  const bothAnswered = duel && duel[myId] !== undefined && duel[otherId] !== undefined;

  useEffect(() => {
    if (bothAnswered && !countedRef.current && !(match.duelQids || []).includes(q.id)) {
      countedRef.current = true;
      onScoreUpdate(q.id, duel[myId] === duel[otherId]);
    }
  }, [bothAnswered]); // eslint-disable-line

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between mb-2">
        <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="uppercase tracking-wide font-semibold">Duelo de trivia</p>
        {match.duelScore && match.duelScore.total > 0 && <Pill tone="amber">{match.duelScore.agree}/{match.duelScore.total} coincidencias</Pill>}
      </div>
      <p style={{ fontFamily: serif, fontSize: 19, color: INK }} className="mb-4">{q.prompt}</p>
      <div className="flex flex-col gap-2 mb-4">
        {q.opts.map((o, i) => (
          <button key={i} disabled={myAnswer !== null} onClick={() => pick(i)} style={{ fontFamily: sans, background: myAnswer === i ? INDIGO : "#fff", color: myAnswer === i ? PAPER : INK, border: `1.5px solid ${myAnswer === i ? INDIGO : PAPER_DEEP}`, opacity: myAnswer !== null && myAnswer !== i ? 0.5 : 1 }} className="text-left px-4 py-2.5 rounded-lg text-sm">{o}</button>
        ))}
      </div>
      {myAnswer === null && <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 12 }}>Elegí una opción — la otra persona responde a ciegas.</p>}
      {myAnswer !== null && !bothAnswered && <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 12 }}>Esperando la respuesta de la otra persona…</p>}
      {bothAnswered && (
        <div style={{ background: duel[myId] === duel[otherId] ? "#DCE3CB" : "#F0DCDC", borderRadius: 12 }} className="p-3 mb-3">
          <p style={{ fontFamily: serif, fontSize: 15, color: INK }}>{duel[myId] === duel[otherId] ? "¡Coincidieron! 🎉" : "Respondieron distinto — igual está bueno saberlo."}</p>
        </div>
      )}
      <Button full variant="ghost" onClick={onClose}>Cerrar</Button>
    </Modal>
  );
}

/* -------------------------------------------------------------------------
   Hilo de conexión
   ------------------------------------------------------------------------- */
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮"];
const STAGE_LABELS = { 3: "Conexión anónima", 4: "Revelación parcial", 5: "Revelación total" };
const PACE_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 4; // 4 días

function ConnectionThread({ myProfile, otherId, allProfiles, onBack, onReport }) {
  const mid = matchId(myProfile.id, otherId);
  const [match, setMatch] = useState(null);
  const [text, setText] = useState("");
  const [openText, setOpenText] = useState("");
  const [closeText, setCloseText] = useState("");
  const [showDuel, setShowDuel] = useState(false);
  const [showGames, setShowGames] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [reactingIdx, setReactingIdx] = useState(null);
  const [paceDismissed, setPaceDismissed] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const celebratedRef = useRef(false);
  const seenMarkedRef = useRef(false);
  const other = allProfiles.find((p) => p.id === otherId);

  const load = useCallback(async () => setMatch(await safeGet(mid, true)), [mid]);
  useEffect(() => { load(); const t = setInterval(load, 2500); return () => clearInterval(t); }, [load]);

  // Marca "visto" una sola vez al abrir el hilo (no en cada poll)
  useEffect(() => {
    if (!match || seenMarkedRef.current) return;
    seenMarkedRef.current = true;
    const seenBy = { ...(match.seenBy || {}), [myProfile.id]: Date.now() };
    safeSet(mid, { ...match, seenBy }, true).then(() => load());
  }, [match, mid, myProfile.id]); // eslint-disable-line

  useEffect(() => {
    if (!match || !other) return;
    const DAILY_Q = QUESTIONS[DAY_SEED % QUESTIONS.length];
    const today = todayStr();
    const bothToday = myProfile.answers[DAILY_Q.id] !== undefined && other.answers[DAILY_Q.id] !== undefined
      && myProfile.lastAnswered === today && other.lastAnswered === today;
    if (bothToday && match.pairStreakDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const newStreak = match.pairStreakDate === yesterday ? (match.pairStreak || 0) + 1 : 1;
      safeSet(mid, { ...match, pairStreak: newStreak, pairStreakDate: today }, true).then(() => load());
    }
  }, [match, other]); // eslint-disable-line

  // #19 — micro-celebración al llegar a la revelación total, una sola vez
  useEffect(() => {
    if (match && match.stage === 5 && !celebratedRef.current) {
      celebratedRef.current = true;
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 1300);
    }
  }, [match]);

  if (!match || !other) {
    return (
      <div className="px-5 py-5">
        <button onClick={onBack} style={{ fontFamily: sans, color: INDIGO }} className="text-sm mb-4">← Volver</button>
        <EmptyState title="Cargando conexión…" body="" />
      </div>
    );
  }

  const myMsgCount = match.messages.filter((m) => m.from === myProfile.id).length;
  const otherMsgCount = match.messages.filter((m) => m.from === otherId).length;
  const closeQAnswers = match.closeQAnswers || {};
  const bothClosedQ = closeQAnswers[myProfile.id] && closeQAnswers[otherId];
  const canRequestReveal = match.stage === 3 && myMsgCount >= 2 && otherMsgCount >= 2 && bothClosedQ;
  const iConsented = !!match.reveal[myProfile.id];
  const otherConsented = !!match.reveal[otherId];
  const myListenOnly = match.listenOnly && match.listenOnly[myProfile.id];
  const otherListenOnly = match.listenOnly && match.listenOnly[otherId];

  const openQ = OPEN_PROMPTS[hashStr(mid) % OPEN_PROMPTS.length];
  const myOpenAnswer = match.openAnswers && match.openAnswers[myProfile.id];
  const otherOpenAnswer = match.openAnswers && match.openAnswers[otherId];

  const score = compatScore(myProfile, other);
  const divergentQ = score && score.divergentQid ? QUESTIONS.find((q) => q.id === score.divergentQid) : null;

  const lastMsgTs = match.messages.length > 0 ? match.messages[match.messages.length - 1].ts : match.createdAt;
  const showPaceCheck = !match.closed && match.stage < 5 && Date.now() - lastMsgTs > PACE_THRESHOLD_MS && !paceDismissed;

  async function send() {
    if (!text.trim() || match.closed) return;
    const isQuestion = text.trim().endsWith("?");
    const updated = { ...match, messages: [...match.messages, { from: myProfile.id, text: text.trim(), ts: Date.now(), reactions: {} }] };
    setText("");
    await safeSet(mid, updated, true);
    setMatch(updated);
    if (isQuestion) {
      const badges = new Set(myProfile.badges);
      const newScore = (myProfile.curiosityScore || 0) + 1;
      if (newScore >= 5) badges.add("Buen/a oyente");
      const merged = { ...myProfile, curiosityScore: newScore, badges: [...badges] };
      await safeSet("profile:" + myProfile.id, merged, true);
    }
  }

  async function submitOpenAnswer() {
    if (!openText.trim()) return;
    const updated = { ...match, openAnswers: { ...match.openAnswers, [myProfile.id]: openText.trim() } };
    setOpenText("");
    await safeSet(mid, updated, true);
    setMatch(updated);
  }

  async function submitCloseAnswer() {
    if (!closeText.trim()) return;
    const updated = { ...match, closeQAnswers: { ...closeQAnswers, [myProfile.id]: closeText.trim() } };
    setCloseText("");
    await safeSet(mid, updated, true);
    setMatch(updated);
  }

  async function react(idx, emoji) {
    const messages = [...match.messages];
    const m = { ...messages[idx] };
    const reactions = { ...(m.reactions || {}) };
    const list = reactions[emoji] || [];
    reactions[emoji] = list.includes(myProfile.id) ? list.filter((id) => id !== myProfile.id) : [...list, myProfile.id];
    m.reactions = reactions;
    messages[idx] = m;
    const updated = { ...match, messages };
    await safeSet(mid, updated, true);
    setMatch(updated);
    setReactingIdx(null);
  }

  async function advanceStage() {
    const updated = { ...match, stage: 4, stageHistory: [...(match.stageHistory || []), { stage: 4, ts: Date.now() }] };
    await safeSet(mid, updated, true);
    setMatch(updated);
  }
  async function consentReveal() {
    const reveal = { ...match.reveal, [myProfile.id]: true };
    const bothIn = reveal[myProfile.id] && reveal[otherId];
    const updated = { ...match, reveal, stage: bothIn ? 5 : match.stage, stageHistory: bothIn ? [...(match.stageHistory || []), { stage: 5, ts: Date.now() }] : match.stageHistory };
    await safeSet(mid, updated, true);
    setMatch(updated);
  }
  async function onScoreUpdate(qid, agree) {
    const updated = { ...match, duelQids: [...(match.duelQids || []), qid], duelScore: { agree: (match.duelScore?.agree || 0) + (agree ? 1 : 0), total: (match.duelScore?.total || 0) + 1 } };
    await safeSet(mid, updated, true);
    setMatch(updated);
  }
  async function toggleListenOnly() {
    const updated = { ...match, listenOnly: { ...match.listenOnly, [myProfile.id]: !myListenOnly } };
    await safeSet(mid, updated, true);
    setMatch(updated);
  }
  async function closeConnection() {
    const updated = { ...match, closed: true, closedBy: myProfile.id, messages: [...match.messages, { from: myProfile.id, text: FAREWELL_MESSAGE, ts: Date.now(), reactions: {} }] };
    await safeSet(mid, updated, true);
    setMatch(updated);
  }

  const displayName = match.stage >= 5 ? other.alias : match.stage >= 4 ? other.alias[0] + "…" : pseudonym(other.id);
  // Foto progresiva: nada en etapa 3, borrosa en etapa 4, nítida en etapa 5
  const photoBlur = match.stage >= 5 ? 0 : match.stage >= 4 ? 5 : null;

  return (
    <div className="flex flex-col h-full">
      <div style={{ borderBottom: `1px solid ${PAPER_DEEP}` }} className="px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {photoBlur !== null && <PersonPhoto p={other} size={44} blur={photoBlur} />}
            <div>
              <button onClick={onBack} style={{ fontFamily: sans, color: INDIGO }} className="text-xs mb-1 block">← Todos los chats</button>
              <p style={{ fontFamily: serif, fontSize: 18, color: INK }}>{displayName}{match.stage >= 4 && other.age ? `, ${other.age}` : ""}</p>
              <div className="mt-1"><FlameProgress stage={match.stage} /></div>
            </div>
          </div>
          <button onClick={() => onReport(otherId)} style={{ fontFamily: sans, color: POMEGRANATE, fontSize: 11 }} className="uppercase font-semibold">Reportar</button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {match.pairStreak > 0 && <Pill tone="amber">🔥 Racha compartida: {match.pairStreak} días</Pill>}
          {myListenOnly && <Pill tone="indigo">👂 Vos: modo escucha</Pill>}
          {otherListenOnly && <Pill tone="indigo">👂 {displayName}: modo escucha</Pill>}
          {match.closed && <Pill>Conexión cerrada</Pill>}
        </div>
        <button onClick={() => setShowTimeline((v) => !v)} style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="mt-2 uppercase font-semibold">
          {showTimeline ? "Ocultar" : "Ver"} línea de tiempo del vínculo
        </button>
        {showTimeline && (
          <div style={{ background: PAPER, borderRadius: 10 }} className="p-2.5 mt-2">
            {(match.stageHistory || []).map((h, i) => (
              <p key={i} style={{ fontFamily: sans, fontSize: 11.5, color: INK }}>· {STAGE_LABELS[h.stage] || `Etapa ${h.stage}`} — {fmtDate(h.ts)}</p>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
        {showPaceCheck && (
          <div style={{ background: AMBER_SOFT, borderRadius: 12 }} className="p-3">
            <p style={{ fontFamily: sans, fontSize: 12.5, color: "#5A3E0F" }} className="mb-2">Esta conexión lleva un tiempo tranquila. ¿Seguís con ganas de continuarla?</p>
            <div className="flex gap-2">
              <Button small variant="ghost" onClick={() => setPaceDismissed(true)}>Sí, sigo interesado/a</Button>
              <Button small variant="danger" onClick={closeConnection}>Prefiero cerrarla</Button>
            </div>
          </div>
        )}

        {divergentQ && (
          <div style={{ background: "#F0DCDC", borderRadius: 12 }} className="p-3">
            <p style={{ fontFamily: sans, fontSize: 11, color: POMEGRANATE }} className="uppercase font-semibold mb-1">Donde más difieren</p>
            <p style={{ fontFamily: serif, fontSize: 14, color: INK }}>{divergentQ.prompt}</p>
          </div>
        )}

        {match.stage >= 3 && (
          <div style={{ background: "#fff", border: `1px solid ${PAPER_DEEP}`, borderRadius: 12 }} className="p-3.5">
            <p style={{ fontFamily: sans, fontSize: 11, color: INK_SOFT }} className="uppercase font-semibold mb-1.5">Pregunta abierta</p>
            <p style={{ fontFamily: serif, fontSize: 14.5, color: INK }} className="mb-2">{openQ}</p>
            {!myOpenAnswer ? (
              <div className="flex gap-2">
                <input value={openText} onChange={(e) => setOpenText(e.target.value)} placeholder="Tu respuesta…" style={{ fontFamily: sans, border: `1px solid ${PAPER_DEEP}` }} className="flex-1 px-3 py-2 rounded-lg text-xs outline-none" />
                <Button small onClick={submitOpenAnswer}>Enviar</Button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <p style={{ fontFamily: sans, fontSize: 12.5, color: INK }}><strong>Vos:</strong> {myOpenAnswer}</p>
                {otherOpenAnswer ? <p style={{ fontFamily: sans, fontSize: 12.5, color: INK }}><strong>{displayName}:</strong> {otherOpenAnswer}</p> : <p style={{ fontFamily: sans, fontSize: 11.5, color: INK_SOFT }}>Esperando su respuesta…</p>}
              </div>
            )}
          </div>
        )}

        {match.stage === 3 && !bothClosedQ && (myMsgCount >= 1 || otherMsgCount >= 1) && (
          <div style={{ background: INDIGO, borderRadius: 12 }} className="p-3.5">
            <p style={{ fontFamily: sans, fontSize: 11, color: AMBER_SOFT }} className="uppercase font-semibold mb-1.5">Pregunta de cierre de etapa</p>
            <p style={{ fontFamily: serif, fontSize: 14.5, color: PAPER }} className="mb-2">{CLOSE_STAGE_PROMPT}</p>
            {!closeQAnswers[myProfile.id] ? (
              <div className="flex gap-2">
                <input value={closeText} onChange={(e) => setCloseText(e.target.value)} placeholder="Tu respuesta…" style={{ fontFamily: sans, border: "1px solid rgba(241,232,211,0.35)", background: "rgba(241,232,211,0.1)", color: PAPER }} className="flex-1 px-3 py-2 rounded-lg text-xs outline-none" />
                <Button small variant="amber" onClick={submitCloseAnswer}>Enviar</Button>
              </div>
            ) : (
              <p style={{ fontFamily: sans, fontSize: 11.5, color: "rgba(241,232,211,0.8)" }}>{bothClosedQ ? "Ambos respondieron — ya se puede pedir la revelación parcial." : "Respondiste — esperando a la otra persona."}</p>
            )}
          </div>
        )}

        {match.messages.length === 0 && <EmptyState title="Empezá la conversación" body="Los mensajes son anónimos hasta que ambos decidan revelarse." />}
        {match.messages.map((m, i) => {
          const isMine = m.from === myProfile.id;
          const isLastMine = isMine && !match.messages.slice(i + 1).some((mm) => mm.from === myProfile.id);
          const seenByOther = isLastMine && match.seenBy && match.seenBy[otherId] && match.seenBy[otherId] >= m.ts;
          return (
          <div key={i} className={"flex flex-col " + (isMine ? "items-end" : "items-start")}>
            <div style={{ background: isMine ? INDIGO : "#fff", color: isMine ? PAPER : INK, border: isMine ? "none" : `1px solid ${PAPER_DEEP}`, maxWidth: "78%", fontFamily: sans, fontSize: 14 }} className="px-3.5 py-2 rounded-2xl" onDoubleClick={() => setReactingIdx(i)}>
              {m.text}
            </div>
            <div className="flex items-center gap-1 mt-1">
              {Object.entries(m.reactions || {}).filter(([, ids]) => ids.length > 0).map(([emoji, ids]) => (
                <button key={emoji} onClick={() => react(i, emoji)} style={{ fontFamily: sans, fontSize: 11, background: ids.includes(myProfile.id) ? AMBER_SOFT : PAPER_DEEP }} className="px-1.5 py-0.5 rounded-full">{emoji} {ids.length}</button>
              ))}
              {!match.closed && <button onClick={() => setReactingIdx(reactingIdx === i ? null : i)} style={{ fontFamily: sans, fontSize: 11, color: INK_SOFT }}>+</button>}
            </div>
            {seenByOther && <p style={{ fontFamily: sans, fontSize: 10, color: INK_SOFT }} className="mt-0.5">Visto</p>}
            {reactingIdx === i && (
              <div className="flex gap-1 mt-1">
                {REACTION_EMOJIS.map((e) => <button key={e} onClick={() => react(i, e)} style={{ fontSize: 15 }}>{e}</button>)}
              </div>
            )}
          </div>
          );
        })}
      </div>

      <div className="px-5 py-3 flex flex-col gap-2" style={{ borderTop: `1px solid ${PAPER_DEEP}` }}>
        {match.closed ? (
          <p style={{ fontFamily: sans, fontSize: 12.5, color: INK_SOFT }} className="text-center">Esta conexión fue cerrada.</p>
        ) : (
          <>
            {match.stage === 3 && (
              <div className="flex flex-col gap-2">
                <FirstTimeHint id="games_button" text="💡 Los minijuegos son para romper el hielo — al terminar, siempre queda una pregunta para seguir charlando." />
                <div className="flex gap-2 flex-wrap">
                  <Button variant="ghost" onClick={() => setShowDuel(true)}>🎲 Duelo de trivia</Button>
                  <Button variant="ghost" onClick={() => setShowGames(true)}>🎮 Minijuegos</Button>
                  <Button variant="ghost" onClick={toggleListenOnly}>{myListenOnly ? "Salir del modo escucha" : "👂 Modo solo escuchar"}</Button>
                  {canRequestReveal && <Button variant="amber" onClick={advanceStage}>Habilitar revelación parcial</Button>}
                </div>
              </div>
            )}
            {match.stage === 4 && !iConsented && <Button variant="amber" full onClick={consentReveal}>Aceptar revelación completa</Button>}
            {match.stage === 4 && iConsented && !otherConsented && <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 12 }}>Esperando que la otra persona también acepte revelarse…</p>}
            {match.stage === 5 && (
              <div style={{ background: "#DCE3CB", borderRadius: 10 }} className="p-2.5">
                <p style={{ fontFamily: sans, fontSize: 12, color: "#3C4A26" }}>Ambos se revelaron. Ciudad: {other.city}. La conversación puede seguir fuera de la app si ambos quieren.</p>
              </div>
            )}
            <div className="flex gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Escribí un mensaje anónimo…" style={{ fontFamily: sans, border: `1.5px solid ${PAPER_DEEP}`, background: "#fff" }} className="flex-1 px-3.5 py-2.5 rounded-lg text-sm outline-none" />
              <Button onClick={send}>Enviar</Button>
            </div>
            <button onClick={() => setConfirmClose(true)} style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="self-center underline">Cerrar esta conexión con aviso</button>
          </>
        )}
      </div>

      {showDuel && <TriviaDuel mid={mid} myId={myProfile.id} otherId={otherId} match={match} onClose={() => setShowDuel(false)} onScoreUpdate={onScoreUpdate} />}
      {showConfetti && <Confetti />}
      {confirmClose && (
        <ConfirmModal
          title="¿Cerrar esta conexión?"
          body="Le vamos a mandar un mensaje de despedida amable de tu parte. No podés deshacer esto."
          confirmLabel="Sí, cerrar con aviso"
          onConfirm={() => { closeConnection(); setConfirmClose(false); }}
          onCancel={() => setConfirmClose(false)}
        />
      )}
      {showGames && (
        <Suspense fallback={<Modal onClose={() => setShowGames(false)}><p style={{ fontFamily: sans, color: INK_SOFT }}>Cargando minijuegos…</p></Modal>}>
          <GameModal mid={mid} myId={myProfile.id} otherId={otherId} onClose={() => setShowGames(false)} />
        </Suspense>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Conexiones
   ------------------------------------------------------------------------- */
function ConnectionsTab({ myProfile, allProfiles, onOpen, onMatchIds }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const others = allProfiles.filter((p) => p.id !== myProfile.id);
      const found = [];
      for (const o of others) {
        const m = await safeGet(matchId(myProfile.id, o.id), true);
        if (m) found.push({ other: o, match: m });
      }
      setMatches(found.sort((a, b) => b.match.createdAt - a.match.createdAt));
      onMatchIds(found.map((f) => f.other.id));
      setLoading(false);
    })();
  }, [allProfiles, myProfile.id]); // eslint-disable-line

  if (loading) return <div className="px-5 py-5 flex flex-col gap-3"><Skeleton h={72} /><Skeleton h={72} /><Skeleton h={72} /></div>;

  return (
    <div className="px-5 py-5">
      <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="uppercase tracking-wide font-semibold mb-3">Tus conexiones</p>
      {matches.length === 0 ? (
        <EmptyState title="Todavía no tenés conexiones" body="Andá a la pestaña Ecos para empezar a conectar con alguien." />
      ) : (
        <div className="flex flex-col gap-3">
          {matches.map(({ other, match }) => {
            const lastMsg = match.messages[match.messages.length - 1];
            const name = match.stage >= 5 ? other.alias : match.stage >= 4 ? other.alias[0] + "…" : pseudonym(other.id);
            return (
              <button key={other.id} onClick={() => onOpen(other.id)} style={{ background: "#fff", border: `1px solid ${PAPER_DEEP}`, borderRadius: 14, opacity: match.closed ? 0.6 : 1 }} className="p-4 text-left">
                <div className="flex items-center justify-between mb-1.5">
                  <p style={{ fontFamily: serif, fontSize: 16, color: INK }}>{name}</p>
                  <FlameProgress stage={match.stage} />
                </div>
                <div className="flex items-center gap-2">
                  <p style={{ fontFamily: sans, fontSize: 12, color: INK_SOFT }} className="truncate flex-1">{match.closed ? "Conexión cerrada" : lastMsg ? lastMsg.text : "Todavía sin mensajes"}</p>
                  {match.pairStreak > 0 && <Pill tone="amber">🔥{match.pairStreak}</Pill>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Perfil
   ------------------------------------------------------------------------- */
function ProfileTab({ profile, onUpdate, onLogout, userEmail, allProfiles }) {
  const [almost, setAlmost] = useState(null);
  const [refName, setRefName] = useState("");
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editAlias, setEditAlias] = useState(profile.alias);
  const [editCity, setEditCity] = useState(profile.city);
  const [editCircle, setEditCircle] = useState(profile.circle || "Sin preferencia");
  const [editWords, setEditWords] = useState(profile.threeWords || ["", "", ""]);
  const [editAge, setEditAge] = useState(profile.age || "");
  const [editGender, setEditGender] = useState(profile.gender || "");
  const [editLookingFor, setEditLookingFor] = useState(profile.lookingFor || []);
  const [editPhoto, setEditPhoto] = useState(profile.photo || null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [pushState, setPushState] = useState(pushPermissionState());
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState("");
  const canvasRef = useRef(null);

  async function handleEnablePush() {
    setPushBusy(true);
    setPushMsg("");
    const res = await enablePush(profile.id);
    setPushBusy(false);
    setPushState(pushPermissionState());
    if (res.ok) { setPushMsg("¡Listo! Ya te vamos a avisar."); }
    else if (res.reason === "denied") setPushMsg("Bloqueaste el permiso — activalo desde la configuración del navegador.");
    else if (res.reason === "unsupported") setPushMsg("Tu navegador no soporta notificaciones.");
    else if (res.reason === "no_vapid_key") setPushMsg("Falta terminar de configurar las notificaciones del lado del servidor.");
    else setPushMsg("No pudimos activarlas, probá de nuevo en un rato.");
  }

  useEffect(() => {
    (async () => {
      const keys = await safeList("viewed:", true);
      const mine = keys.filter((k) => k.endsWith(":" + profile.id));
      let count = 0;
      for (const k of mine) {
        const v = await safeGet(k, true);
        if (v && Date.now() - v.ts < 1000 * 60 * 60 * 24 * 14) {
          const viewerId = k.split(":")[1];
          const existingMatch = await safeGet(matchId(profile.id, viewerId), true);
          if (!existingMatch) count++;
        }
      }
      setAlmost(count);
    })();
  }, [profile.id]);

  async function togglePause() {
    const updated = { ...profile, paused: !profile.paused };
    await safeSet("profile:" + profile.id, updated, true);
    onUpdate(updated);
  }
  async function toggleAccessible() {
    const updated = { ...profile, accessibleText: !profile.accessibleText };
    await safeSet("profile:" + profile.id, updated, true);
    onUpdate(updated);
  }
  function copyInviteLink() {
    const link = `${window.location.origin}${window.location.pathname}?ref=${encodeURIComponent(refName || profile.alias)}`;
    navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  // #21 — editar perfil después de creado
  async function saveEdits() {
    const updated = {
      ...profile, alias: editAlias.trim() || profile.alias, city: editCity.trim() || profile.city, circle: editCircle,
      threeWords: editWords.map((w) => w.trim()),
      age: editAge ? Number(editAge) : profile.age, gender: editGender || profile.gender, lookingFor: editLookingFor,
      photo: editPhoto,
    };
    await safeSet("profile:" + profile.id, updated, true);
    onUpdate(updated);
    setEditing(false);
  }
  async function handleEditPhoto(file) {
    if (!file) return;
    setPhotoBusy(true);
    try { setEditPhoto(await compressPhoto(file)); } catch {}
    setPhotoBusy(false);
  }
  const toggleEditLookingFor = (v) => setEditLookingFor((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  // #29 — compartir perfil como imagen (tarjeta con alias, 3 palabras y racha)
  function shareCard() {
    const canvas = document.createElement("canvas");
    canvas.width = 800; canvas.height = 500;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = INDIGO; ctx.fillRect(0, 0, 800, 500);
    ctx.fillStyle = "rgba(193,135,43,0.12)"; ctx.beginPath(); ctx.arc(720, 60, 160, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = AMBER_SOFT; ctx.font = "italic 22px Georgia"; ctx.fillText("Conocé antes de ver", 50, 70);
    ctx.fillStyle = PAPER; ctx.font = "bold 52px Georgia"; ctx.fillText("Chevruta", 50, 140);
    ctx.fillStyle = PAPER; ctx.font = "34px Georgia"; ctx.fillText(profile.alias, 50, 230);
    ctx.fillStyle = "#D8CFB8"; ctx.font = "italic 22px Georgia";
    ctx.fillText(`"${(profile.threeWords || []).join(" · ")}"`, 50, 270);
    ctx.fillStyle = AMBER; ctx.font = "bold 20px Georgia";
    ctx.fillText(`🔥 Racha de ${profile.streak} días  ·  ${studentRank(profile)}`, 50, 330);
    ctx.fillStyle = "#9AA1C2"; ctx.font = "16px Georgia";
    ctx.fillText(profile.city, 50, 460);
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "chevruta.png"; a.click();
      URL.revokeObjectURL(url);
    });
  }

  const weekAgo = Date.now() - 7 * 86400000;
  const answersThisWeek = Object.values(profile.answersHistory || {}).flat().filter((h) => h.ts > weekAgo).length;
  const rank = studentRank(profile);

  return (
    <div className="px-5 py-5 flex flex-col gap-5">
      <div style={{ background: INDIGO, borderRadius: 16 }} className="p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            {profile.photo ? <img src={profile.photo} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover" }} /> : <Avatar id={profile.id} size={34} />}
            <p style={{ fontFamily: serif, fontSize: 22, color: PAPER }}>{profile.alias}{profile.age ? `, ${profile.age}` : ""}</p>
          </div>
          <Pill tone="amber">{rank}</Pill>
        </div>
        <p style={{ fontFamily: sans, fontSize: 12, color: AMBER_SOFT }} className="mt-0.5">{profile.city} · {profile.observance}</p>
        {profile.circle && profile.circle !== "Sin preferencia" && <p style={{ fontFamily: sans, fontSize: 11.5, color: "rgba(241,232,211,0.8)" }} className="mt-0.5">Círculo: {profile.circle}</p>}
        {profile.threeWords && <p style={{ fontFamily: sans, fontSize: 12, color: "rgba(241,232,211,0.8)" }} className="italic mt-1">"{profile.threeWords.join(" · ")}"</p>}
        <div className="flex gap-4 mt-4">
          <div><p style={{ fontFamily: serif, fontSize: 20, color: PAPER }}>{profile.streak}</p><p style={{ fontFamily: sans, fontSize: 10, color: "rgba(241,232,211,0.7)" }} className="uppercase">racha</p></div>
          <div><p style={{ fontFamily: serif, fontSize: 20, color: PAPER }}>{Object.keys(profile.answers).length}</p><p style={{ fontFamily: sans, fontSize: 10, color: "rgba(241,232,211,0.7)" }} className="uppercase">respondidas</p></div>
          <div><p style={{ fontFamily: serif, fontSize: 20, color: PAPER }}>{profile.badges.length}</p><p style={{ fontFamily: sans, fontSize: 10, color: "rgba(241,232,211,0.7)" }} className="uppercase">insignias</p></div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button small variant="ghost" onClick={() => setEditing((v) => !v)}>{editing ? "Cancelar" : "✎ Editar perfil"}</Button>
          <Button small variant="ghost" onClick={shareCard}>📤 Compartir tarjeta</Button>
        </div>
      </div>

      {/* #21 — editar perfil después de creado */}
      {editing && (
        <div style={{ background: "#fff", border: `1px solid ${PAPER_DEEP}`, borderRadius: 14 }} className="p-4 flex flex-col gap-2.5">
          <div className="flex items-center gap-3">
            {editPhoto ? <img src={editPhoto} alt="" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover" }} /> : <div style={{ width: 64, height: 64, borderRadius: "50%", background: PAPER_DEEP }} />}
            <label style={{ fontFamily: sans, color: INDIGO, fontSize: 12.5 }} className="font-semibold cursor-pointer">
              {photoBusy ? "Procesando…" : editPhoto ? "Cambiar foto" : "Agregar foto"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleEditPhoto(e.target.files[0])} />
            </label>
          </div>
          <input value={editAlias} onChange={(e) => setEditAlias(e.target.value)} placeholder="Alias" style={{ fontFamily: sans, border: `1.5px solid ${PAPER_DEEP}` }} className="w-full px-3 py-2 rounded-lg text-sm outline-none" />
          <div className="flex gap-2">
            <input type="number" value={editAge} onChange={(e) => setEditAge(e.target.value)} placeholder="Edad" style={{ fontFamily: sans, border: `1.5px solid ${PAPER_DEEP}` }} className="w-24 px-3 py-2 rounded-lg text-sm outline-none" />
            <select value={editGender} onChange={(e) => setEditGender(e.target.value)} style={{ fontFamily: sans, border: `1.5px solid ${PAPER_DEEP}` }} className="flex-1 px-3 py-2 rounded-lg text-sm outline-none">
              <option value="">Género…</option>
              <option value="Mujer">Mujer</option>
              <option value="Varón">Varón</option>
              <option value="No binario">No binario</option>
            </select>
          </div>
          <p style={{ fontFamily: sans, fontSize: 11, color: INK_SOFT }} className="mt-1">Buscás conocer a:</p>
          <div className="flex flex-wrap gap-1.5">
            {["Mujeres", "Varones", "No binaries"].map((o) => (
              <button key={o} onClick={() => toggleEditLookingFor(o)} style={{ fontFamily: sans, fontSize: 12, background: editLookingFor.includes(o) ? AMBER_SOFT : "#fff", color: INK, border: `1.5px solid ${editLookingFor.includes(o) ? AMBER : PAPER_DEEP}` }} className="px-3 py-1.5 rounded-full">{o}</button>
            ))}
          </div>
          <input value={editCity} onChange={(e) => setEditCity(e.target.value)} placeholder="Ciudad" style={{ fontFamily: sans, border: `1.5px solid ${PAPER_DEEP}` }} className="w-full px-3 py-2 rounded-lg text-sm outline-none" />
          <select value={editCircle} onChange={(e) => setEditCircle(e.target.value)} style={{ fontFamily: sans, border: `1.5px solid ${PAPER_DEEP}` }} className="w-full px-3 py-2 rounded-lg text-sm outline-none">
            {CIRCLES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {[0, 1, 2].map((i) => (
            <input key={i} value={editWords[i]} onChange={(e) => { const w = [...editWords]; w[i] = e.target.value; setEditWords(w); }} placeholder={`Palabra ${i + 1}`} style={{ fontFamily: sans, border: `1.5px solid ${PAPER_DEEP}` }} className="w-full px-3 py-2 rounded-lg text-sm outline-none" />
          ))}
          <Button full variant="amber" onClick={saveEdits}>Guardar cambios</Button>
        </div>
      )}

      <div style={{ background: "#fff", border: `1px solid ${PAPER_DEEP}`, borderRadius: 14 }} className="p-4">
        <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="uppercase tracking-wide font-semibold mb-2">Tu semana</p>
        <p style={{ fontFamily: sans, fontSize: 13, color: INK }}>Respondiste <strong>{answersThisWeek}</strong> {answersThisWeek === 1 ? "pregunta" : "preguntas"} · racha de <strong>{profile.streak}</strong> {profile.streak === 1 ? "día" : "días"} · curiosidad: <strong>{profile.curiosityScore || 0}</strong></p>
        {almost !== null && almost > 0 && (
          <p style={{ fontFamily: sans, fontSize: 12.5, color: OLIVE }} className="mt-2">✨ {almost} {almost === 1 ? "persona casi conectó" : "personas casi conectaron"} con vos esta quincena, sin dar el paso todavía.</p>
        )}
      </div>

      {profile.badges.length > 0 && (
        <div>
          <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="uppercase tracking-wide font-semibold mb-2">Insignias</p>
          <div className="flex flex-wrap gap-2">{profile.badges.map((b) => <Pill key={b} tone="amber">{b}</Pill>)}</div>
        </div>
      )}

      <div>
        <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="uppercase tracking-wide font-semibold mb-2">Buscás</p>
        <div className="flex flex-wrap gap-2">{profile.intention.map((i) => <Pill key={i} tone="olive">{i}</Pill>)}</div>
      </div>

      <div>
        <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="uppercase tracking-wide font-semibold mb-2">Confianza comunitaria</p>
        <p style={{ fontFamily: sans, fontSize: 13, color: INK }}>{profile.voucher ? `Referenciado/a por ${profile.voucher} (pendiente de verificación)` : "Sin referencia comunitaria cargada."}</p>
      </div>

      {/* #15 invitación con propósito */}
      <div style={{ background: "#fff", border: `1px solid ${PAPER_DEEP}`, borderRadius: 14 }} className="p-4">
        <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="uppercase tracking-wide font-semibold mb-2">Generar invitación (para referentes)</p>
        <input value={refName} onChange={(e) => setRefName(e.target.value)} placeholder="Tu nombre como referente (opcional)" style={{ fontFamily: sans, border: `1.5px solid ${PAPER_DEEP}` }} className="w-full px-3 py-2 rounded-lg text-xs outline-none mb-2" />
        <Button full variant="ghost" onClick={copyInviteLink}>{copied ? "¡Copiado!" : "Copiar link de invitación"}</Button>
        <p style={{ fontFamily: sans, fontSize: 11, color: INK_SOFT }} className="mt-2">Quien entre con ese link va a tener tu nombre precargado como referencia comunitaria.</p>
      </div>

      <div style={{ borderTop: `1px solid ${PAPER_DEEP}` }} className="pt-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p style={{ fontFamily: serif, fontSize: 15, color: INK }}>Notificaciones</p>
            <p style={{ fontFamily: sans, fontSize: 11, color: INK_SOFT }}>Avisos de mensajes y conexiones nuevas, aunque tengas la app cerrada.</p>
          </div>
          {pushState === "granted" ? (
            <Pill tone="olive">Activadas</Pill>
          ) : (
            <Button small variant="amber" onClick={handleEnablePush}>{pushBusy ? "…" : "Activar"}</Button>
          )}
        </div>
        {pushMsg && <p style={{ fontFamily: sans, fontSize: 11, color: INK_SOFT }}>{pushMsg}</p>}
        <div className="flex items-center justify-between">
          <p style={{ fontFamily: serif, fontSize: 15, color: INK }}>Pausar mi visibilidad</p>
          <button onClick={togglePause} style={{ width: 44, height: 26, borderRadius: 13, background: profile.paused ? AMBER : PAPER_DEEP, position: "relative" }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: profile.paused ? 21 : 3, transition: "left .2s" }} />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <p style={{ fontFamily: serif, fontSize: 15, color: INK }}>Texto grande (accesibilidad)</p>
          <button onClick={toggleAccessible} style={{ width: 44, height: 26, borderRadius: 13, background: profile.accessibleText ? AMBER : PAPER_DEEP, position: "relative" }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: profile.accessibleText ? 21 : 3, transition: "left .2s" }} />
          </button>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${PAPER_DEEP}` }} className="pt-4">
        {userEmail && <p style={{ fontFamily: sans, fontSize: 11.5, color: INK_SOFT }} className="mb-2">Sesión iniciada como {userEmail}</p>}
        <Button full variant="ghost" onClick={() => setConfirmLogout(true)}>Cerrar sesión</Button>
        <button onClick={() => setShowTerms(true)} style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="mt-3 underline block mx-auto">Términos y privacidad</button>
      </div>
      {confirmLogout && (
        <ConfirmModal
          title="¿Cerrar sesión?"
          body="Vas a tener que volver a ingresar tu email y contraseña la próxima vez."
          confirmLabel="Cerrar sesión"
          onConfirm={onLogout}
          onCancel={() => setConfirmLogout(false)}
        />
      )}
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Modal de reporte
   ------------------------------------------------------------------------- */
function ReportModal({ targetId, myProfile, onClose, onBlock }) {
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);
  const [confirmingBlock, setConfirmingBlock] = useState(false);

  async function submit() {
    await safeSet("report:" + targetId + ":" + myProfile.id + ":" + Date.now(), { reason, ts: Date.now() }, true);
    setSent(true);
  }
  async function block() {
    const updated = { ...myProfile, blocked: [...(myProfile.blocked || []), targetId] };
    await safeSet("profile:" + myProfile.id, updated, true);
    onBlock(updated);
  }

  if (confirmingBlock) {
    return (
      <ConfirmModal
        title="¿Bloquear a esta persona?"
        body="No va a poder verte en Ecos ni volver a contactarte. Podés hacerlo en cualquier momento, pero no hay un botón para deshacerlo después."
        confirmLabel="Sí, bloquear"
        onConfirm={block}
        onCancel={() => setConfirmingBlock(false)}
      />
    );
  }

  return (
    <Modal onClose={onClose}>
      {sent ? (
        <>
          <p style={{ fontFamily: serif, fontSize: 18, color: INK }} className="mb-4">Gracias, lo vamos a revisar.</p>
          <Button full variant="amber" onClick={() => setConfirmingBlock(true)}>Bloquear también a esta persona</Button>
          <div className="h-2" />
          <Button full variant="ghost" onClick={onClose}>Cerrar</Button>
        </>
      ) : (
        <>
          <p style={{ fontFamily: serif, fontSize: 18, color: INK }} className="mb-3">Reportar conexión</p>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Contanos qué pasó…" style={{ fontFamily: sans, border: `1.5px solid ${PAPER_DEEP}`, background: "#fff" }} className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none mb-3 h-24" />
          <Button full variant="danger" onClick={submit}>Enviar reporte</Button>
          <div className="h-2" />
          <Button full variant="ghost" onClick={onClose}>Cancelar</Button>
        </>
      )}
    </Modal>
  );
}

/* -------------------------------------------------------------------------
   App principal
   ------------------------------------------------------------------------- */
// #6 — tutorial de bienvenida (una sola vez, antes del login)
const INTRO_SLIDES = [
  { emoji: "💛", title: "Bienvenido/a a Chevruta", body: "Conocé gente de tu comunidad para algo serio, casual, o lo que surja — primero la esencia, después la cara." },
  { emoji: "❓", title: "Empezás respondiendo preguntas", body: "Tu perfil se arma con lo que pensás, no solo con una foto. Elegís a quién te gustaría conocer." },
  { emoji: "🔥", title: "Deslizá para descubrir", body: "Vas a ver a una persona a la vez: si te interesa, conectás; si no, pasás. Simple." },
  { emoji: "🫂", title: "La foto se revela con la charla", body: "Empezás a conocerla por dentro. Su foto se va destapando a medida que la conexión avanza." },
];
function IntroTutorial({ onDone }) {
  const [i, setI] = useState(0);
  const s = INTRO_SLIDES[i];
  return (
    <div style={{ background: INDIGO, minHeight: "100%" }} className="flex flex-col px-6 py-10">
      <button onClick={onDone} style={{ fontFamily: sans, color: AMBER_SOFT, fontSize: 12 }} className="self-end mb-6">Saltar</button>
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <p style={{ fontSize: 52 }} className="mb-5 chev-fade-in" key={i}>{s.emoji}</p>
        <p style={{ fontFamily: serif, fontSize: 24, color: PAPER }} className="mb-3">{s.title}</p>
        <p style={{ fontFamily: sans, fontSize: 14, color: "#D8CFB8" }} className="max-w-xs">{s.body}</p>
      </div>
      <div className="flex gap-1.5 justify-center mb-6">
        {INTRO_SLIDES.map((_, idx) => <div key={idx} style={{ width: idx === i ? 20 : 7, height: 7, borderRadius: 4, background: idx === i ? AMBER : "rgba(241,232,211,0.3)", transition: "width .2s" }} />)}
      </div>
      <Button full variant="amber" onClick={() => (i < INTRO_SLIDES.length - 1 ? setI(i + 1) : onDone())}>
        {i < INTRO_SLIDES.length - 1 ? "Siguiente" : "Empezar"}
      </Button>
    </div>
  );
}

// #8 — ayuda accesible desde cualquier pantalla
function HelpModal({ onClose }) {
  const items = [
    ["¿Qué es Chevruta?", "Una app para conocer gente de tu comunidad para pareja (o lo que surja), a través de preguntas y afinidad real — no solo una foto."],
    ["¿Cómo funciona Descubrir?", "Deslizás de a una persona: si te interesa tocás ♥ (conectar), si no ✕ (pasar). Solo te mostramos gente que también busca conocer a alguien como vos."],
    ["¿Cómo avanza una conexión?", "Empiezan a chatear de forma anónima. A medida que la charla avanza, se va revelando primero parte del nombre y la foto, y luego todo — solo si ambos aceptan."],
    ["¿Es realmente anónimo al principio?", "Sí — nadie ve tu alias real ni tu foto nítida antes de que la conexión avance lo suficiente."],
    ["¿Puedo dejar de hablar con alguien?", "Sí, en cualquier momento podés cerrar una conexión con un aviso amable, o pausar tu visibilidad general desde tu Perfil."],
    ["¿Qué son los minijuegos?", "Formas rápidas y livianas de romper el hielo dentro de una conexión — no reemplazan la charla, la acompañan."],
  ];
  return (
    <Modal onClose={onClose}>
      <p style={{ fontFamily: serif, fontSize: 19, color: INK }} className="mb-4">¿Cómo funciona Chevruta?</p>
      <div className="flex flex-col gap-3 mb-4">
        {items.map(([q, a]) => (
          <div key={q}>
            <p style={{ fontFamily: serif, fontSize: 14.5, color: INK }} className="mb-0.5">{q}</p>
            <p style={{ fontFamily: sans, fontSize: 12.5, color: INK_SOFT }}>{a}</p>
          </div>
        ))}
      </div>
      <Button full variant="ghost" onClick={onClose}>Cerrar</Button>
    </Modal>
  );
}

// #23 — términos y privacidad, resumen simple
function TermsModal({ onClose }) {
  return (
    <Modal onClose={onClose}>
      <p style={{ fontFamily: serif, fontSize: 19, color: INK }} className="mb-4">Términos y privacidad (resumen)</p>
      <div className="flex flex-col gap-3 mb-4" style={{ fontFamily: sans, fontSize: 12.5, color: INK_SOFT }}>
        <p>Tu email solo se usa para iniciar sesión — no es visible para otras personas de la comunidad.</p>
        <p>Tus respuestas, mensajes y alias quedan guardados en la base de datos de la app hasta que decidas eliminarlos o pidas la baja de tu cuenta.</p>
        <p>El anonimato es progresivo: vos controlás cuándo revelar tu identidad real en cada conexión.</p>
        <p>Este es un proyecto en desarrollo activo — funcionalidades y estas condiciones pueden cambiar.</p>
      </div>
      <Button full variant="ghost" onClick={onClose}>Cerrar</Button>
    </Modal>
  );
}

// #9 — checklist de primeros pasos
function FirstStepsChecklist({ profile, hasConnection, onDismiss }) {
  const steps = [
    { done: Object.keys(profile.answers).length >= 5, label: "Respondé al menos 5 preguntas" },
    { done: hasConnection, label: "Conectá con alguien en Ecos" },
    { done: profile.badges.length > 0, label: "Ganá tu primera insignia" },
  ];
  const allDone = steps.every((s) => s.done);
  if (allDone) return null;
  return (
    <div style={{ background: "#fff", border: `1.5px solid ${AMBER}`, borderRadius: 14 }} className="p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <p style={{ fontFamily: serif, fontSize: 15, color: INK }}>Primeros pasos</p>
        <button onClick={onDismiss} style={{ fontFamily: sans, fontSize: 11, color: INK_SOFT }}>Ocultar</button>
      </div>
      <div className="flex flex-col gap-1.5">
        {steps.map((s, i) => (
          <p key={i} style={{ fontFamily: sans, fontSize: 12.5, color: s.done ? OLIVE : INK }}>{s.done ? "✅" : "⬜"} {s.label}</p>
        ))}
      </div>
    </div>
  );
}

function AppInner() {
  const [phase, setPhase] = useState("loading");
  const [showIntro, setShowIntro] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [allProfiles, setAllProfiles] = useState([]);
  const [communityQuestions, setCommunityQuestions] = useState([]);
  const [tab, setTab] = useState("preguntas");
  const [openMatchId, setOpenMatchId] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [matchIds, setMatchIds] = useState([]);
  const [showHelp, setShowHelp] = useState(false);
  const [showChecklist, setShowChecklist] = useState(true);
  const [awaySummary, setAwaySummary] = useState(null);
  const [allMatches, setAllMatches] = useState({}); // otherId -> match, para saber no-leídos

  const refreshAll = useCallback(async () => {
    const keys = await safeList("profile:", true);
    const profiles = [];
    for (const k of keys) { const v = await safeGet(k, true); if (v) profiles.push(v); }
    setAllProfiles(profiles);

    const qKeys = await safeList("communityQ:", true);
    const qs = [];
    for (const k of qKeys) { const v = await safeGet(k, true); if (v) qs.push(v); }
    setCommunityQuestions(qs);
  }, []);

  // Intro de bienvenida — una sola vez por dispositivo
  useEffect(() => {
    try {
      if (!localStorage.getItem("chevruta_seen_intro")) setShowIntro(true);
    } catch {}
  }, []);
  function dismissIntro() {
    try { localStorage.setItem("chevruta_seen_intro", "1"); } catch {}
    setShowIntro(false);
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      if (!user) { setPhase("auth"); setProfile(null); return; }
      const p = await safeGet("profile:" + user.uid, true);
      if (p) { setProfile(p); setPhase("app"); await refreshAll(); }
      else { setPhase("onboarding"); }
    });
    return () => unsub();
  }, [refreshAll]);

  useEffect(() => {
    if (phase !== "app") return;
    const t = setInterval(refreshAll, 6000);
    return () => clearInterval(t);
  }, [phase, refreshAll]);

  // Carga los matches propios (para saber si hay mensajes no leídos → puntito en la pestaña)
  useEffect(() => {
    if (phase !== "app" || !profile) return;
    (async () => {
      const others = allProfiles.filter((p) => p.id !== profile.id);
      const found = {};
      for (const o of others) {
        const m = await safeGet(matchId(profile.id, o.id), true);
        if (m) found[o.id] = m;
      }
      setAllMatches(found);
    })();
  }, [phase, profile, allProfiles]);

  // #25 — "mientras no estabas": una sola vez por sesión, al entrar
  useEffect(() => {
    if (phase !== "app" || !profile) return;
    try {
      const lastVisit = Number(localStorage.getItem("chevruta_last_visit") || 0);
      const now = Date.now();
      if (lastVisit && now - lastVisit > 1000 * 60 * 30) {
        const newProfiles = allProfiles.filter((p) => p.id !== profile.id && p.createdAt > lastVisit).length;
        const unread = Object.values(allMatches).filter((m) => {
          const last = m.messages[m.messages.length - 1];
          return last && last.from !== profile.id && last.ts > lastVisit;
        }).length;
        if (newProfiles > 0 || unread > 0) setAwaySummary({ newProfiles, unread });
      }
      localStorage.setItem("chevruta_last_visit", String(now));
    } catch {}
  }, [phase, profile, allProfiles, allMatches]);

  // #3 — integración con el botón atrás del celular/navegador para el hilo de conexión
  useEffect(() => {
    function onPop() {
      setOpenMatchId((cur) => (cur ? null : cur));
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  function openMatch(id) {
    try { window.history.pushState({ chevrutaThread: true }, ""); } catch {}
    setTab("conexiones");
    setOpenMatchId(id);
  }
  function closeMatch() {
    setOpenMatchId(null);
    refreshAll();
  }
  function goHome() {
    setOpenMatchId(null);
    setTab("preguntas");
  }

  function handleOnboarded(p) { setProfile(p); setPhase("app"); refreshAll(); }
  function updateProfile(p) { setProfile(p); setAllProfiles((prev) => prev.map((x) => (x.id === p.id ? p : x))); }
  function upsertCommunityQ(q) { setCommunityQuestions((prev) => { const exists = prev.some((x) => x.id === q.id); return exists ? prev.map((x) => (x.id === q.id ? q : x)) : [...prev, q]; }); }
  async function handleLogout() { await signOut(auth); setTab("preguntas"); setOpenMatchId(null); }

  if (phase === "loading") {
    return <div style={{ background: PAPER, height: "100%" }} className="flex items-center justify-center"><p style={{ fontFamily: serif, color: INK_SOFT }}>Abriendo Chevruta…</p></div>;
  }
  if (phase === "auth") {
    if (showIntro) return <div style={{ height: "100%", fontFamily: sans }}><IntroTutorial onDone={dismissIntro} /></div>;
    return <div style={{ height: "100%", fontFamily: sans }}><AuthScreen /></div>;
  }
  if (phase === "onboarding" && authUser) {
    return <div style={{ height: "100%", fontFamily: sans }}><Onboarding userId={authUser.uid} onDone={handleOnboarded} /></div>;
  }
  if (phase === "onboarding" || !profile) {
    return <div style={{ background: PAPER, height: "100%" }} className="flex items-center justify-center"><p style={{ fontFamily: serif, color: INK_SOFT }}>Abriendo Chevruta…</p></div>;
  }

  const lastVisitTs = (() => { try { return Number(localStorage.getItem("chevruta_last_visit_ecos") || 0); } catch { return 0; } })();
  const hasNewEcos = allProfiles.some((p) => p.id !== profile.id && p.createdAt > lastVisitTs);
  const hasUnreadMsgs = Object.values(allMatches).some((m) => {
    const last = m.messages[m.messages.length - 1];
    return last && last.from !== profile.id && (!m.seenBy || !m.seenBy[profile.id] || m.seenBy[profile.id] < last.ts);
  });

  const tabs = [
    { id: "preguntas", label: "Inicio", icon: "🏠" },
    { id: "ecos", label: "Descubrir", icon: "🔥", dot: hasNewEcos },
    { id: "jugar", label: "Jugar", icon: "🎲" },
    { id: "conexiones", label: "Chat", icon: "💬", dot: hasUnreadMsgs },
    { id: "perfil", label: "Perfil", icon: "👤" },
  ];

  function selectTab(id) {
    setOpenMatchId(null);
    setTab(id);
    if (id === "ecos") { try { localStorage.setItem("chevruta_last_visit_ecos", String(Date.now())); } catch {} }
  }

  const scaleStyle = profile.accessibleText ? { zoom: 1.16 } : {};

  return (
    <div style={{ background: PAPER, height: "100%", display: "flex", flexDirection: "column", ...scaleStyle }}>
      <OfflineBanner />
      <div style={{ maxWidth: 440, margin: "0 auto", width: "100%", height: "100%", display: "flex", flexDirection: "column", background: PAPER }}>
        {/* #1 — header fijo con logo que siempre vuelve al inicio (visible SIEMPRE, incluso adentro de un chat) */}
        <div style={{ borderBottom: `1px solid ${PAPER_DEEP}` }} className="px-5 pt-5 pb-3 flex items-center justify-between">
          <button onClick={goHome} className="flex items-center gap-2">
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: INDIGO, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: serif, color: AMBER, fontSize: 15 }}>C</span>
            </div>
            <p style={{ fontFamily: serif, fontSize: 20, color: INK }}>Chevruta</p>
          </button>
          <div className="flex items-center gap-2">
            <Pill tone="amber">{allProfiles.length} en la comunidad</Pill>
            <button onClick={() => setShowHelp(true)} style={{ width: 26, height: 26, borderRadius: "50%", border: `1.5px solid ${PAPER_DEEP}`, fontFamily: sans, fontSize: 12, color: INK_SOFT }}>?</button>
          </div>
        </div>

        {/* Contenido: el chat abierto vive DENTRO de la pestaña Chat, sin tapar el nav */}
        <div key={tab + (openMatchId || "")} className="flex-1 overflow-y-auto chev-fade-in">
          {tab === "preguntas" && (
            <div className="px-5 pt-5">
              {showChecklist && <FirstStepsChecklist profile={profile} hasConnection={Object.keys(allMatches).length > 0} onDismiss={() => setShowChecklist(false)} />}
            </div>
          )}
          {tab === "preguntas" && <QuestionsTab profile={profile} onUpdate={updateProfile} allProfiles={allProfiles} communityQuestions={communityQuestions} onProposeCreated={upsertCommunityQ} />}
          {tab === "ecos" && <EcosTab profile={profile} onUpdate={updateProfile} allProfiles={allProfiles} onOpenMatch={openMatch} existingMatchIds={matchIds} />}
          {tab === "jugar" && <PlayTab profile={profile} allProfiles={allProfiles} existingMatchIds={matchIds} onOpenMatch={openMatch} />}
          {tab === "conexiones" && (
            openMatchId ? (
              <Suspense fallback={<div className="px-5 py-5"><Skeleton h={80} /></div>}>
                <ConnectionThread myProfile={profile} otherId={openMatchId} allProfiles={allProfiles} onBack={closeMatch} onReport={(id) => setReportTarget(id)} />
              </Suspense>
            ) : (
              <ConnectionsTab myProfile={profile} allProfiles={allProfiles} onOpen={openMatch} onMatchIds={setMatchIds} />
            )
          )}
          {tab === "perfil" && <ProfileTab profile={profile} onUpdate={updateProfile} onLogout={handleLogout} userEmail={authUser?.email} allProfiles={allProfiles} />}
        </div>

        {/* #1 — barra inferior FIJA, visible siempre, incluso adentro de un chat */}
        <div style={{ borderTop: `1px solid ${PAPER_DEEP}`, background: "#fff" }} className="flex">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => selectTab(t.id)} style={{ fontFamily: sans, color: tab === t.id ? INDIGO : INK_SOFT, fontWeight: tab === t.id ? 700 : 500, position: "relative" }} className="flex-1 py-2.5 text-[10px] flex flex-col items-center gap-0.5">
              <span style={{ fontSize: 17 }}>{t.icon}</span>
              {t.label}
              {t.dot && <span style={{ position: "absolute", top: 2, right: "calc(50% - 22px)", width: 7, height: 7, borderRadius: "50%", background: POMEGRANATE }} />}
            </button>
          ))}
        </div>
      </div>
      {reportTarget && <ReportModal targetId={reportTarget} myProfile={profile} onClose={() => setReportTarget(null)} onBlock={(p) => { updateProfile(p); setReportTarget(null); }} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {awaySummary && (
        <Modal onClose={() => setAwaySummary(null)}>
          <p style={{ fontFamily: serif, fontSize: 19, color: INK }} className="mb-2">Mientras no estabas…</p>
          <div className="flex flex-col gap-1.5 mb-4">
            {awaySummary.newProfiles > 0 && <p style={{ fontFamily: sans, fontSize: 13.5, color: INK }}>👋 {awaySummary.newProfiles} {awaySummary.newProfiles === 1 ? "persona nueva se sumó" : "personas nuevas se sumaron"} a la comunidad</p>}
            {awaySummary.unread > 0 && <p style={{ fontFamily: sans, fontSize: 13.5, color: INK }}>💬 Tenés {awaySummary.unread} {awaySummary.unread === 1 ? "mensaje nuevo" : "mensajes nuevos"} sin ver</p>}
          </div>
          <Button full variant="amber" onClick={() => setAwaySummary(null)}>Genial, vamos</Button>
        </Modal>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
   #26 — Error Boundary: si algo se rompe, mostramos una pantalla amigable
   con opción de recargar, en vez de una pantalla en blanco sin explicación.
   ------------------------------------------------------------------------- */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, message: err?.message || "Error desconocido" };
  }
  componentDidCatch(err, info) {
    console.error("Chevruta crash:", err, info);
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ background: PAPER, height: "100%" }} className="flex flex-col items-center justify-center px-8 text-center">
        <p style={{ fontSize: 40 }} className="mb-3">😕</p>
        <p style={{ fontFamily: serif, fontSize: 20, color: INK }} className="mb-2">Algo se rompió</p>
        <p style={{ fontFamily: sans, fontSize: 13, color: INK_SOFT }} className="mb-1">
          No es tu culpa — encontramos un error inesperado.
        </p>
        <p style={{ fontFamily: sans, fontSize: 11, color: INK_SOFT }} className="mb-5 opacity-70">{this.state.message}</p>
        <Button variant="amber" onClick={() => window.location.reload()}>Recargar la app</Button>
      </div>
    );
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
