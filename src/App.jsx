import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { safeGet, safeSet, safeList } from "./lib/storage.js";
import { GameModal } from "./Games.jsx";

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
  const featured = ["q1", "q5", "q11", "q13"];
  return (
    <Modal onClose={onClose}>
      <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="uppercase tracking-wide font-semibold mb-2">Mapa de intereses de la comunidad</p>
      <p style={{ fontFamily: serif, fontSize: 16, color: INK }} className="mb-4">Agregado y anónimo — nadie ve respuestas individuales acá.</p>
      {featured.map((qid) => {
        const q = QUESTIONS.find((x) => x.id === qid);
        const counts = q.opts.map((_, i) => allProfiles.filter((p) => p.answers && p.answers[q.id] === i).length);
        const total = counts.reduce((a, b) => a + b, 0);
        if (total === 0) return null;
        const topIdx = counts.indexOf(Math.max(...counts));
        return (
          <div key={qid} style={{ background: "#fff", border: `1px solid ${PAPER_DEEP}`, borderRadius: 12 }} className="p-3.5 mb-3">
            <p style={{ fontFamily: sans, fontSize: 12.5, color: INK_SOFT }} className="mb-1">{q.prompt}</p>
            <p style={{ fontFamily: serif, fontSize: 15, color: OLIVE }}>{Math.round((counts[topIdx] / total) * 100)}% eligió: "{q.opts[topIdx]}"</p>
          </div>
        );
      })}
      <Button full variant="ghost" onClick={onClose}>Cerrar</Button>
    </Modal>
  );
}

/* -------------------------------------------------------------------------
   Onboarding
   ------------------------------------------------------------------------- */
function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [alias, setAlias] = useState("");
  const [city, setCity] = useState("");
  const [observance, setObservance] = useState("");
  const [intention, setIntention] = useState([]);
  const [voucher, setVoucher] = useState("");
  const [words, setWords] = useState(["", "", ""]);
  const [circle, setCircle] = useState("");
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
  const wordsOk = words.every((w) => w.trim().length > 0);
  const canNext = [alias.trim().length >= 2, city.trim().length >= 2, observance !== "", intention.length > 0, true, wordsOk, true][step];

  async function finish() {
    setSaving(true);
    const id = uid();
    const profile = {
      id, alias: alias.trim(), city: city.trim(), observance, intention,
      voucher: voucher.trim() || null,
      threeWords: words.map((w) => w.trim()),
      circle: circle || "Sin preferencia",
      accessibleText,
      answers: {}, answersHistory: {},
      streak: 0, lastAnswered: null,
      curiosityScore: 0, connectionsInitiated: 0,
      paused: false, blocked: [], badges: [],
      createdAt: Date.now(),
    };
    await safeSet("myUserId", id, false);
    await safeSet("profile:" + id, profile, true);
    setSaving(false);
    onDone(profile);
  }

  const steps = [
    { label: "¿Cómo te llamamos acá?", hint: "Un alias, no tu nombre real.", body: (
      <input autoFocus value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Ej: Estrella del Sur" style={{ fontFamily: sans, border: `1.5px solid ${PAPER_DEEP}`, background: "#fff" }} className="w-full px-4 py-3 rounded-lg text-base outline-none" />
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
        {["Amistad", "Pareja", "Comunidad / eventos", "Todavía no lo sé"].map((o) => (
          <button key={o} onClick={() => toggleIntention(o)} style={{ fontFamily: sans, background: intention.includes(o) ? AMBER_SOFT : "#fff", color: INK, border: `1.5px solid ${intention.includes(o) ? AMBER : PAPER_DEEP}` }} className="text-left px-4 py-3 rounded-lg text-sm font-medium">{o}</button>
        ))}
      </div>
    )},
    { label: "¿Alguien de la comunidad puede dar fe de vos?", hint: "Opcional. No se muestra públicamente.", body: (
      <input autoFocus value={voucher} onChange={(e) => setVoucher(e.target.value)} placeholder="Nombre de un rabino, madrijim o referente" style={{ fontFamily: sans, border: `1.5px solid ${PAPER_DEEP}`, background: "#fff" }} className="w-full px-4 py-3 rounded-lg text-base outline-none" />
    )},
    { label: "Elegí 3 palabras que te describan", hint: "Es lo primero que otros van a ver de vos, antes de cualquier foto.", body: (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <input key={i} value={words[i]} onChange={(e) => { const w = [...words]; w[i] = e.target.value; setWords(w); }} placeholder={`Palabra ${i + 1}`} style={{ fontFamily: sans, border: `1.5px solid ${PAPER_DEEP}`, background: "#fff" }} className="w-full px-4 py-3 rounded-lg text-base outline-none" />
        ))}
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
function QuestionsTab({ profile, onUpdate, allProfiles, communityQuestions, onProposeCreated }) {
  const [showPropose, setShowPropose] = useState(false);
  const [browseQ, setBrowseQ] = useState(null);
  const [reviewMode, setReviewMode] = useState(false);

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

      <div>
        <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="uppercase tracking-wide font-semibold mb-2">Seguí construyendo tu perfil ({Object.keys(profile.answers).length}/{allQuestions.length})</p>
        {unanswered.filter((q) => !q.months && !q.requires).length === 0 ? (
          <EmptyState title="Respondiste todo por ahora" body="Volvé mañana por una pregunta nueva del día." />
        ) : (
          <div className="flex flex-col gap-3">
            {unanswered.filter((q) => !q.months && !q.requires).slice(0, 4).map((q) => <QCard key={q.id} q={q} />)}
          </div>
        )}
      </div>

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
function EcosTab({ profile, allProfiles, onOpenMatch, existingMatchIds }) {
  const [showMap, setShowMap] = useState(false);
  const [showGroupTrivia, setShowGroupTrivia] = useState(false);
  const [groupFeedback, setGroupFeedback] = useState(null);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const viewedRef = useRef(false);

  const candidates = useMemo(() => {
    return allProfiles
      .filter((p) => p.id !== profile.id && !p.paused && !(profile.blocked || []).includes(p.id))
      .map((p) => ({ p, score: compatScore(profile, p) }))
      .filter((x) => x.score && x.score.common >= 2)
      .sort((a, b) => {
        // #6 — boost por círculo temático compartido
        const aBoost = a.p.circle && a.p.circle === profile.circle && profile.circle !== "Sin preferencia" ? 1000 : 0;
        const bBoost = b.p.circle && b.p.circle === profile.circle && profile.circle !== "Sin preferencia" ? 1000 : 0;
        return (b.score.pct + bBoost) - (a.score.pct + aBoost);
      });
  }, [allProfiles, profile]);

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
      <button onClick={() => setShowMap(true)} style={{ fontFamily: sans, color: INDIGO, fontSize: 12 }} className="font-semibold self-start">🗺️ Ver mapa de intereses de la comunidad</button>

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

      <div>
        <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="uppercase tracking-wide font-semibold mb-3">Ecos cerca tuyo</p>
        {candidates.length === 0 ? (
          <EmptyState title="Todavía no hay ecos" body="A medida que más personas respondan preguntas, vas a ver compatibilidades acá." />
        ) : (
          <div className="flex flex-col gap-3">
            {candidates.map(({ p, score }) => {
              const commonEchoes = constellation(p);
              const sameCircle = p.circle && p.circle === profile.circle && profile.circle !== "Sin preferencia";
              return (
                <div key={p.id} style={{ background: "#fff", border: `1px solid ${PAPER_DEEP}`, borderRadius: 14 }} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p style={{ fontFamily: serif, fontSize: 17, color: INK }}>{pseudonym(p.id)}</p>
                      <p style={{ fontFamily: sans, fontSize: 12, color: INK_SOFT }}>{p.city}</p>
                    </div>
                    <div className="text-right">
                      <p style={{ fontFamily: serif, fontSize: 22, color: OLIVE }}>{score.pct}%</p>
                      <p style={{ fontFamily: sans, fontSize: 10, color: INK_SOFT }} className="uppercase">afinidad</p>
                    </div>
                  </div>
                  {p.threeWords && p.threeWords.length > 0 && <p style={{ fontFamily: sans, fontSize: 12.5, color: INK }} className="italic mb-2">"{p.threeWords.join(" · ")}"</p>}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {sameCircle && <Pill tone="indigo">✦ {p.circle}</Pill>}
                    {score.cats.map((c) => <Pill key={c} tone="olive">{c}</Pill>)}
                  </div>
                  {commonEchoes > 0 && <p style={{ fontFamily: sans, fontSize: 11.5, color: INK_SOFT }} className="mb-3">✨ Tenés {commonEchoes} {commonEchoes === 1 ? "eco" : "ecos"} en común con esta persona</p>}
                  <Button full variant="amber" onClick={() => connect(p.id)}>Conectar de forma anónima</Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showMap && <CommunityMapModal allProfiles={allProfiles} onClose={() => setShowMap(false)} />}
      {showGroupTrivia && monthGroup && (
        <GroupTriviaModal groupKey={groupKey} myId={profile.id} participantIds={[profile.id, ...monthGroup.map((g) => g.p.id)]} onClose={() => setShowGroupTrivia(false)} />
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
  const other = allProfiles.find((p) => p.id === otherId);

  const load = useCallback(async () => setMatch(await safeGet(mid, true)), [mid]);
  useEffect(() => { load(); const t = setInterval(load, 2500); return () => clearInterval(t); }, [load]);

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

  return (
    <div className="flex flex-col h-full">
      <div style={{ borderBottom: `1px solid ${PAPER_DEEP}` }} className="px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <button onClick={onBack} style={{ fontFamily: sans, color: INDIGO }} className="text-xs mb-1 block">← Ecos</button>
            <p style={{ fontFamily: serif, fontSize: 18, color: INK }}>{displayName}</p>
            <div className="mt-1"><FlameProgress stage={match.stage} /></div>
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
        {match.messages.map((m, i) => (
          <div key={i} className={"flex flex-col " + (m.from === myProfile.id ? "items-end" : "items-start")}>
            <div style={{ background: m.from === myProfile.id ? INDIGO : "#fff", color: m.from === myProfile.id ? PAPER : INK, border: m.from === myProfile.id ? "none" : `1px solid ${PAPER_DEEP}`, maxWidth: "78%", fontFamily: sans, fontSize: 14 }} className="px-3.5 py-2 rounded-2xl" onDoubleClick={() => setReactingIdx(i)}>
              {m.text}
            </div>
            <div className="flex items-center gap-1 mt-1">
              {Object.entries(m.reactions || {}).filter(([, ids]) => ids.length > 0).map(([emoji, ids]) => (
                <button key={emoji} onClick={() => react(i, emoji)} style={{ fontFamily: sans, fontSize: 11, background: ids.includes(myProfile.id) ? AMBER_SOFT : PAPER_DEEP }} className="px-1.5 py-0.5 rounded-full">{emoji} {ids.length}</button>
              ))}
              {!match.closed && <button onClick={() => setReactingIdx(reactingIdx === i ? null : i)} style={{ fontFamily: sans, fontSize: 11, color: INK_SOFT }}>+</button>}
            </div>
            {reactingIdx === i && (
              <div className="flex gap-1 mt-1">
                {REACTION_EMOJIS.map((e) => <button key={e} onClick={() => react(i, e)} style={{ fontSize: 15 }}>{e}</button>)}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="px-5 py-3 flex flex-col gap-2" style={{ borderTop: `1px solid ${PAPER_DEEP}` }}>
        {match.closed ? (
          <p style={{ fontFamily: sans, fontSize: 12.5, color: INK_SOFT }} className="text-center">Esta conexión fue cerrada.</p>
        ) : (
          <>
            {match.stage === 3 && (
              <div className="flex gap-2 flex-wrap">
                <Button variant="ghost" onClick={() => setShowDuel(true)}>🎲 Duelo de trivia</Button>
                <Button variant="ghost" onClick={() => setShowGames(true)}>🎮 Minijuegos</Button>
                <Button variant="ghost" onClick={toggleListenOnly}>{myListenOnly ? "Salir del modo escucha" : "👂 Modo solo escuchar"}</Button>
                {canRequestReveal && <Button variant="amber" onClick={advanceStage}>Habilitar revelación parcial</Button>}
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
            <button onClick={closeConnection} style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="self-center underline">Cerrar esta conexión con aviso</button>
          </>
        )}
      </div>

      {showDuel && <TriviaDuel mid={mid} myId={myProfile.id} otherId={otherId} match={match} onClose={() => setShowDuel(false)} onScoreUpdate={onScoreUpdate} />}
      {showGames && <GameModal mid={mid} myId={myProfile.id} otherId={otherId} onClose={() => setShowGames(false)} />}
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

  if (loading) return <div className="px-5 py-5"><EmptyState title="Cargando…" body="" /></div>;

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
function ProfileTab({ profile, onUpdate }) {
  const [almost, setAlmost] = useState(null);
  const [refName, setRefName] = useState("");
  const [copied, setCopied] = useState(false);

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

  const weekAgo = Date.now() - 7 * 86400000;
  const answersThisWeek = Object.values(profile.answersHistory || {}).flat().filter((h) => h.ts > weekAgo).length;
  const rank = studentRank(profile);

  return (
    <div className="px-5 py-5 flex flex-col gap-5">
      <div style={{ background: INDIGO, borderRadius: 16 }} className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <p style={{ fontFamily: serif, fontSize: 22, color: PAPER }}>{profile.alias}</p>
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
      </div>

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
    </div>
  );
}

/* -------------------------------------------------------------------------
   Modal de reporte
   ------------------------------------------------------------------------- */
function ReportModal({ targetId, myProfile, onClose, onBlock }) {
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);

  async function submit() {
    await safeSet("report:" + targetId + ":" + myProfile.id + ":" + Date.now(), { reason, ts: Date.now() }, true);
    setSent(true);
  }
  async function block() {
    const updated = { ...myProfile, blocked: [...(myProfile.blocked || []), targetId] };
    await safeSet("profile:" + myProfile.id, updated, true);
    onBlock(updated);
  }

  return (
    <Modal onClose={onClose}>
      {sent ? (
        <>
          <p style={{ fontFamily: serif, fontSize: 18, color: INK }} className="mb-4">Gracias, lo vamos a revisar.</p>
          <Button full variant="amber" onClick={block}>Bloquear también a esta persona</Button>
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
export default function App() {
  const [phase, setPhase] = useState("loading");
  const [profile, setProfile] = useState(null);
  const [allProfiles, setAllProfiles] = useState([]);
  const [communityQuestions, setCommunityQuestions] = useState([]);
  const [tab, setTab] = useState("preguntas");
  const [openMatchId, setOpenMatchId] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [matchIds, setMatchIds] = useState([]);

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

  useEffect(() => {
    (async () => {
      const myId = await safeGet("myUserId", false);
      if (myId) {
        const p = await safeGet("profile:" + myId, true);
        if (p) { setProfile(p); setPhase("app"); await refreshAll(); return; }
      }
      setPhase("onboarding");
    })();
  }, [refreshAll]);

  useEffect(() => {
    if (phase !== "app") return;
    const t = setInterval(refreshAll, 6000);
    return () => clearInterval(t);
  }, [phase, refreshAll]);

  function handleOnboarded(p) { setProfile(p); setPhase("app"); refreshAll(); }
  function updateProfile(p) { setProfile(p); setAllProfiles((prev) => prev.map((x) => (x.id === p.id ? p : x))); }
  function upsertCommunityQ(q) { setCommunityQuestions((prev) => { const exists = prev.some((x) => x.id === q.id); return exists ? prev.map((x) => (x.id === q.id ? q : x)) : [...prev, q]; }); }

  if (phase === "loading") {
    return <div style={{ background: PAPER, height: "100%" }} className="flex items-center justify-center"><p style={{ fontFamily: serif, color: INK_SOFT }}>Abriendo Chevruta…</p></div>;
  }
  if (phase === "onboarding") {
    return <div style={{ height: "100%", fontFamily: sans }}><Onboarding onDone={handleOnboarded} /></div>;
  }

  const tabs = [
    { id: "preguntas", label: "Preguntas" },
    { id: "ecos", label: "Ecos" },
    { id: "conexiones", label: "Conexiones" },
    { id: "perfil", label: "Perfil" },
  ];

  // #14 — modo texto grande: escala visual liviana sobre todo el contenedor
  const scaleStyle = profile.accessibleText ? { zoom: 1.16 } : {};

  return (
    <div style={{ background: PAPER, height: "100%", display: "flex", flexDirection: "column", ...scaleStyle }}>
      <div style={{ maxWidth: 440, margin: "0 auto", width: "100%", height: "100%", display: "flex", flexDirection: "column", background: PAPER }}>
        {openMatchId ? (
          <ConnectionThread myProfile={profile} otherId={openMatchId} allProfiles={allProfiles} onBack={() => { setOpenMatchId(null); refreshAll(); }} onReport={(id) => setReportTarget(id)} />
        ) : (
          <>
            <div style={{ borderBottom: `1px solid ${PAPER_DEEP}` }} className="px-5 pt-5 pb-3 flex items-center justify-between">
              <p style={{ fontFamily: serif, fontSize: 22, color: INK }}>Chevruta</p>
              <Pill tone="amber">{allProfiles.length} en la comunidad</Pill>
            </div>
            <div className="flex-1 overflow-y-auto">
              {tab === "preguntas" && <QuestionsTab profile={profile} onUpdate={updateProfile} allProfiles={allProfiles} communityQuestions={communityQuestions} onProposeCreated={upsertCommunityQ} />}
              {tab === "ecos" && <EcosTab profile={profile} allProfiles={allProfiles} onOpenMatch={setOpenMatchId} existingMatchIds={matchIds} />}
              {tab === "conexiones" && <ConnectionsTab myProfile={profile} allProfiles={allProfiles} onOpen={setOpenMatchId} onMatchIds={setMatchIds} />}
              {tab === "perfil" && <ProfileTab profile={profile} onUpdate={updateProfile} />}
            </div>
            <div style={{ borderTop: `1px solid ${PAPER_DEEP}`, background: "#fff" }} className="flex">
              {tabs.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{ fontFamily: sans, color: tab === t.id ? INDIGO : INK_SOFT, fontWeight: tab === t.id ? 700 : 500 }} className="flex-1 py-3 text-xs">{t.label}</button>
              ))}
            </div>
          </>
        )}
      </div>
      {reportTarget && <ReportModal targetId={reportTarget} myProfile={profile} onClose={() => setReportTarget(null)} onBlock={(p) => { updateProfile(p); setReportTarget(null); }} />}
    </div>
  );
}
