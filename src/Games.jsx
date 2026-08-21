import React, { useState, useEffect, useCallback, useRef } from "react";
import { safeGet, safeSet } from "./lib/storage.js";

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
function Modal({ children, onClose }) {
  return (
    <div style={{ background: "rgba(33,29,26,0.5)" }} className="fixed inset-0 flex items-end justify-center z-50" onClick={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <div style={{ background: PAPER, borderRadius: "20px 20px 0 0", maxWidth: 440, maxHeight: "88vh", overflowY: "auto" }} className="w-full p-6">
        {children}
      </div>
    </div>
  );
}
function Pill({ children, tone = "default" }) {
  const bg = tone === "amber" ? AMBER_SOFT : tone === "olive" ? "#DCE3CB" : tone === "indigo" ? "#DADFEE" : PAPER_DEEP;
  const fg = tone === "amber" ? "#5A3E0F" : tone === "olive" ? "#3C4A26" : tone === "indigo" ? INDIGO : INK_SOFT;
  return <span style={{ background: bg, color: fg, fontFamily: sans, fontSize: 11 }} className="px-2 py-0.5 rounded-full uppercase font-semibold">{children}</span>;
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* -------------------------------------------------------------------------
   Catálogo de minijuegos + preguntas de cierre por tema
   ------------------------------------------------------------------------- */
export const GAME_TYPES = [
  { id: "ttt", label: "Ta-Te-Ti", emoji: "❌⭕", desc: "El clásico de 3 en línea, rápido" },
  { id: "c4", label: "Cuatro en línea", emoji: "🔴🟡", desc: "Conectá 4 fichas antes que la otra persona" },
  { id: "domino", label: "Dominó", emoji: "🁫", desc: "Versión simplificada del clásico de fichas" },
  { id: "rps", label: "Piedra, papel o tijera", emoji: "✊✋✌️", desc: "Mejor de 3, simultáneo y a ciegas" },
  { id: "chain", label: "Cadena de palabras", emoji: "🔗", desc: "Arman juntos una cadena de palabras asociadas" },
];

const POST_GAME_PROMPTS = {
  ttt: [
    "¿Sos más de planear con anticipación o de improvisar sobre la marcha?",
    "¿Preferís jugar seguro o arriesgar para ganar más rápido?",
  ],
  c4: [
    "¿Pensás varios pasos adelante en la vida real, o vas resolviendo como viene?",
    "¿Preferís resultados rápidos o construir algo de a poco?",
  ],
  domino: [
    "¿Sos bueno/a notando patrones? Contame de una vez que se te dio bien.",
    "¿Preferís tener un plan claro o adaptarte con lo que hay?",
  ],
  rps: [
    "¿Confiás más en tu instinto o en pensar antes de decidir?",
    "¿Sos de arriesgar en lo incierto o de jugar sobre seguro?",
  ],
  chain: [
    "Mirando la cadena que armaron: ¿qué palabra los sorprendió más?",
    "¿A dónde creen que hubiese llegado la cadena si seguían 10 palabras más?",
  ],
};

function promptFor(type, mid) {
  const pool = POST_GAME_PROMPTS[type] || [];
  return pool.length ? pool[hashStr(mid + type) % pool.length] : null;
}

function PostGamePrompt({ type, mid, onNewGame }) {
  const p = promptFor(type, mid);
  return (
    <div style={{ background: INDIGO, borderRadius: 12 }} className="p-3.5 mt-3">
      {p && (
        <>
          <p style={{ fontFamily: sans, fontSize: 11, color: AMBER_SOFT }} className="uppercase font-semibold mb-1">Para seguir charlando</p>
          <p style={{ fontFamily: serif, fontSize: 15, color: PAPER }} className="mb-3">{p}</p>
        </>
      )}
      <Button full variant="amber" onClick={onNewGame}>Elegir otro juego</Button>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Hook genérico de sesión de juego (Firestore/kv_store vía storage.js)
   ------------------------------------------------------------------------- */
function useGameSession(mid) {
  const key = "game:" + mid;
  const [session, setSession] = useState(null);
  const load = useCallback(async () => setSession(await safeGet(key, true)), [key]);
  useEffect(() => { load(); const t = setInterval(load, 1800); return () => clearInterval(t); }, [load]);
  const save = useCallback(async (next) => { await safeSet(key, next, true); setSession(next); }, [key]);
  return [session, save, load];
}

/* =========================================================================
   TA-TE-TI
   ========================================================================= */
const TTT_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function tttWinner(board) {
  for (const [a,b,c] of TTT_LINES) if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  if (board.every((c) => c)) return "draw";
  return null;
}
function TicTacToe({ mid, myId, otherId }) {
  const [session, save] = useGameSession(mid);
  const p1 = [myId, otherId].sort()[0], p2 = [myId, otherId].sort()[1];
  useEffect(() => {
    if (!session || session.type !== "ttt" || !session.data || !session.data.board) {
      save({ type: "ttt", turn: p1, winner: null, data: { board: Array(9).fill(null) } });
    }
  }, []); // eslint-disable-line
  if (!session || session.type !== "ttt" || !session.data || !session.data.board) return <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 13 }}>Preparando el tablero…</p>;

  const mySymbol = myId === p1 ? "X" : "O";
  const board = session.data.board;

  async function play(i) {
    if (board[i] || session.winner || session.turn !== myId) return;
    const next = [...board];
    next[i] = mySymbol;
    const w = tttWinner(next);
    await save({ ...session, data: { board: next }, turn: myId === p1 ? p2 : p1, winner: w });
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-3" style={{ maxWidth: 220, margin: "0 auto" }}>
        {board.map((c, i) => (
          <button key={i} onClick={() => play(i)} style={{ width: 68, height: 68, background: "#fff", border: `1.5px solid ${PAPER_DEEP}`, fontFamily: serif, fontSize: 30, color: c === "X" ? INDIGO : POMEGRANATE }} className="rounded-lg flex items-center justify-center">
            {c}
          </button>
        ))}
      </div>
      <p style={{ fontFamily: sans, fontSize: 12.5, color: INK_SOFT }} className="text-center mb-2">
        Vos sos <strong>{mySymbol}</strong> {session.winner ? "" : session.turn === myId ? "— tu turno" : "— esperando a la otra persona"}
      </p>
      {session.winner && (
        <p style={{ fontFamily: serif, fontSize: 16, color: OLIVE }} className="text-center">
          {session.winner === "draw" ? "Empate 🤝" : session.winner === mySymbol ? "¡Ganaste! 🎉" : "Ganó la otra persona"}
        </p>
      )}
    </div>
  );
}

/* =========================================================================
   CUATRO EN LÍNEA
   ========================================================================= */
const C4_COLS = 7, C4_ROWS = 6;
function c4Idx(row, col) { return row * C4_COLS + col; }
function c4Winner(board) {
  const get = (r, c) => (r < 0 || r >= C4_ROWS || c < 0 || c >= C4_COLS ? null : board[c4Idx(r, c)]);
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (let r = 0; r < C4_ROWS; r++) for (let c = 0; c < C4_COLS; c++) {
    const v = get(r, c);
    if (!v) continue;
    for (const [dr, dc] of dirs) {
      if (get(r+dr,c+dc)===v && get(r+2*dr,c+2*dc)===v && get(r+3*dr,c+3*dc)===v) return v;
    }
  }
  if (board.every((c) => c)) return "draw";
  return null;
}
function ConnectFour({ mid, myId, otherId }) {
  const [session, save] = useGameSession(mid);
  const p1 = [myId, otherId].sort()[0], p2 = [myId, otherId].sort()[1];
  useEffect(() => {
    if (!session || session.type !== "c4" || !session.data || !session.data.board) {
      save({ type: "c4", turn: p1, winner: null, data: { board: Array(C4_COLS * C4_ROWS).fill(null) } });
    }
  }, []); // eslint-disable-line
  if (!session || session.type !== "c4" || !session.data || !session.data.board) return <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 13 }}>Preparando el tablero…</p>;

  const mySymbol = myId === p1 ? "R" : "Y";
  const board = session.data.board;
  const colorOf = (v) => (v === "R" ? POMEGRANATE : v === "Y" ? AMBER : "#fff");

  async function drop(col) {
    if (session.winner || session.turn !== myId) return;
    let target = -1;
    for (let r = 0; r < C4_ROWS; r++) if (!board[c4Idx(r, col)]) { target = r; break; }
    if (target === -1) return;
    const next = [...board];
    next[c4Idx(target, col)] = mySymbol;
    const w = c4Winner(next);
    await save({ ...session, data: { board: next }, turn: myId === p1 ? p2 : p1, winner: w });
  }

  return (
    <div>
      <div style={{ background: INDIGO, borderRadius: 12, padding: 8, maxWidth: 280, margin: "0 auto" }}>
        {Array.from({ length: C4_ROWS }).map((_, rIdx) => {
          const r = C4_ROWS - 1 - rIdx;
          return (
            <div key={r} className="flex gap-1.5 justify-center mb-1.5">
              {Array.from({ length: C4_COLS }).map((_, c) => (
                <button key={c} onClick={() => drop(c)} style={{ width: 30, height: 30, borderRadius: "50%", background: colorOf(board[c4Idx(r, c)]), border: "1px solid rgba(0,0,0,0.15)" }} />
              ))}
            </div>
          );
        })}
      </div>
      <p style={{ fontFamily: sans, fontSize: 12.5, color: INK_SOFT }} className="text-center mt-2 mb-2">
        Vos sos {mySymbol === "R" ? "🔴" : "🟡"} {session.winner ? "" : session.turn === myId ? "— tu turno" : "— esperando a la otra persona"}
      </p>
      {session.winner && (
        <p style={{ fontFamily: serif, fontSize: 16, color: OLIVE }} className="text-center">
          {session.winner === "draw" ? "Empate 🤝" : session.winner === mySymbol ? "¡Ganaste! 🎉" : "Ganó la otra persona"}
        </p>
      )}
    </div>
  );
}

/* =========================================================================
   DOMINÓ (versión simplificada, set doble-6)
   ========================================================================= */
function buildDominoDeck() {
  const deck = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) deck.push([a, b]);
  return deck;
}
function tileStr([a, b]) { return `${a}|${b}`; }
function Domino({ mid, myId, otherId }) {
  const [session, save] = useGameSession(mid);
  const p1 = [myId, otherId].sort()[0], p2 = [myId, otherId].sort()[1];
  const iAmHost = myId === p1;
  const [selected, setSelected] = useState(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (session && session.type === "domino" && session.data && session.data.hands) return;
    if (!iAmHost || initRef.current) return;
    initRef.current = true;
    const rng = mulberry32(hashStr(mid + ":domino"));
    const deck = buildDominoDeck();
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    const hand1 = deck.slice(0, 7), hand2 = deck.slice(7, 14), boneyard = deck.slice(14);
    const highestDouble = (h, id) => h.reduce((best, t) => (t[0] === t[1] && (!best || t[0] > best.v) ? { v: t[0], id } : best), null);
    const starter = highestDouble(hand1, p1) || highestDouble(hand2, p2) || { id: p1 };
    save({
      type: "domino", winner: null, turn: starter.id,
      data: { hands: { [p1]: hand1, [p2]: hand2 }, boneyard, line: [], leftEnd: null, rightEnd: null, passes: 0 },
    });
  }, [session]); // eslint-disable-line

  if (!session || session.type !== "domino" || !session.data || !session.data.hands) return <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 13 }}>Repartiendo fichas…</p>;

  const { hands, boneyard, line, leftEnd, rightEnd } = session.data;
  const myHand = hands[myId] || [];
  const otherHand = hands[otherId] || [];
  const canPlay = (t) => leftEnd === null || t[0] === leftEnd || t[1] === leftEnd || t[0] === rightEnd || t[1] === rightEnd;
  const hasPlayable = myHand.some(canPlay);

  async function playTile(tile, side) {
    if (session.winner || session.turn !== myId) return;
    let [a, b] = tile;
    const next = { ...session.data };
    const newLine = [...line];
    if (line.length === 0) {
      newLine.push(tile);
      next.leftEnd = a; next.rightEnd = b;
    } else if (side === "left") {
      if (b !== leftEnd) [a, b] = [b, a];
      newLine.unshift([a, b]);
      next.leftEnd = a;
    } else {
      if (a !== rightEnd) [a, b] = [b, a];
      newLine.push([a, b]);
      next.rightEnd = b;
    }
    next.line = newLine;
    next.hands = { ...hands, [myId]: myHand.filter((t) => tileStr(t) !== tileStr(tile)) };
    next.passes = 0;
    const iWon = next.hands[myId].length === 0;
    await save({ ...session, data: next, turn: otherId, winner: iWon ? myId : null });
    setSelected(null);
  }

  async function drawTile() {
    if (session.turn !== myId || boneyard.length === 0) return;
    const next = { ...session.data };
    const [tile, ...rest] = boneyard;
    next.boneyard = rest;
    next.hands = { ...hands, [myId]: [...myHand, tile] };
    await save({ ...session, data: next });
  }

  async function pass() {
    if (session.turn !== myId) return;
    const passes = (session.data.passes || 0) + 1;
    if (passes >= 2 && boneyard.length === 0) {
      const pipSum = (h) => h.reduce((s, [a, b]) => s + a + b, 0);
      const mySum = pipSum(myHand), otherSum = pipSum(otherHand);
      const w = mySum === otherSum ? "draw" : mySum < otherSum ? myId : otherId;
      await save({ ...session, data: { ...session.data, passes }, winner: w });
    } else {
      await save({ ...session, data: { ...session.data, passes }, turn: otherId });
    }
  }

  return (
    <div>
      <p style={{ fontFamily: sans, fontSize: 11.5, color: INK_SOFT }} className="text-center mb-2">A la otra persona le quedan {otherHand.length} fichas · boneyard: {boneyard.length}</p>
      <div style={{ background: "#fff", border: `1px solid ${PAPER_DEEP}`, borderRadius: 10, minHeight: 50 }} className="flex flex-wrap items-center justify-center gap-1 p-2 mb-3">
        {line.length === 0 ? <span style={{ fontFamily: sans, fontSize: 12, color: INK_SOFT }}>Mesa vacía — jugá la primera ficha</span> :
          line.map((t, i) => <span key={i} style={{ fontFamily: serif, fontSize: 14, background: PAPER, border: `1px solid ${PAPER_DEEP}` }} className="px-2 py-1 rounded">{t[0]}|{t[1]}</span>)}
      </div>
      <div className="flex flex-wrap gap-1.5 justify-center mb-3">
        {myHand.map((t, i) => {
          const playable = canPlay(t) && session.turn === myId && !session.winner;
          return (
            <button key={i} disabled={!playable} onClick={() => setSelected(selected === i ? null : i)} style={{ fontFamily: serif, fontSize: 15, background: selected === i ? AMBER_SOFT : "#fff", border: `1.5px solid ${playable ? INDIGO : PAPER_DEEP}`, opacity: playable ? 1 : 0.45 }} className="px-2.5 py-1.5 rounded-lg">
              {t[0]}|{t[1]}
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <div className="flex gap-2 justify-center mb-3">
          {line.length === 0 ? (
            <Button small onClick={() => playTile(myHand[selected], "right")}>Jugar ficha</Button>
          ) : (
            <>
              {(myHand[selected][0] === leftEnd || myHand[selected][1] === leftEnd) && <Button small onClick={() => playTile(myHand[selected], "left")}>◀ Poner a la izquierda</Button>}
              {(myHand[selected][0] === rightEnd || myHand[selected][1] === rightEnd) && <Button small onClick={() => playTile(myHand[selected], "right")}>Poner a la derecha ▶</Button>}
            </>
          )}
        </div>
      )}
      {session.turn === myId && !session.winner && !hasPlayable && (
        <div className="flex gap-2 justify-center mb-2">
          {boneyard.length > 0 ? <Button small variant="ghost" onClick={drawTile}>Robar ficha</Button> : <Button small variant="ghost" onClick={pass}>Pasar</Button>}
        </div>
      )}
      <p style={{ fontFamily: sans, fontSize: 12.5, color: INK_SOFT }} className="text-center">
        {session.winner ? "" : session.turn === myId ? "Tu turno" : "Esperando a la otra persona"}
      </p>
      {session.winner && (
        <p style={{ fontFamily: serif, fontSize: 16, color: OLIVE }} className="text-center mt-1">
          {session.winner === "draw" ? "Empate 🤝" : session.winner === myId ? "¡Ganaste! 🎉" : "Ganó la otra persona"}
        </p>
      )}
    </div>
  );
}

/* =========================================================================
   PIEDRA, PAPEL O TIJERA — mejor de 3, simultáneo
   ========================================================================= */
const RPS_OPTS = [{ id: "piedra", e: "✊" }, { id: "papel", e: "✋" }, { id: "tijera", e: "✌️" }];
function rpsBeats(a, b) {
  if (a === b) return null;
  if ((a === "piedra" && b === "tijera") || (a === "tijera" && b === "papel") || (a === "papel" && b === "piedra")) return a;
  return b;
}
function RPS({ mid, myId, otherId }) {
  const [session, save] = useGameSession(mid);
  useEffect(() => {
    if (!session || session.type !== "rps" || !session.data || !session.data.scores) {
      save({ type: "rps", winner: null, data: { round: 1, scores: { [myId]: 0, [otherId]: 0 }, choices: {} } });
    }
  }, []); // eslint-disable-line
  if (!session || session.type !== "rps" || !session.data || !session.data.scores) return <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 13 }}>Preparando la ronda…</p>;

  const { round, scores, choices } = session.data;
  const bothChose = choices[myId] !== undefined && choices[otherId] !== undefined;

  async function choose(id) {
    if (session.winner || choices[myId] !== undefined) return;
    const next = { ...session.data, choices: { ...choices, [myId]: id } };
    await save({ ...session, data: next });
  }

  useEffect(() => {
    if (!bothChose || session.winner) return;
    const winnerChoice = rpsBeats(choices[myId], choices[otherId]);
    const winnerId = winnerChoice === null ? null : winnerChoice === choices[myId] ? myId : otherId;
    const newScores = { ...scores };
    if (winnerId) newScores[winnerId] = (newScores[winnerId] || 0) + 1;
    const overallWinner = newScores[myId] >= 2 ? myId : newScores[otherId] >= 2 ? otherId : null;
    const t = setTimeout(() => {
      save({ ...session, data: { round: round + 1, scores: newScores, choices: {} }, winner: overallWinner });
    }, 1400);
    return () => clearTimeout(t);
  }, [bothChose]); // eslint-disable-line

  return (
    <div>
      <p style={{ fontFamily: sans, fontSize: 12.5, color: INK_SOFT }} className="text-center mb-3">Ronda {round} · Marcador {scores[myId] || 0} - {scores[otherId] || 0}</p>
      {!session.winner ? (
        <>
          <div className="flex gap-3 justify-center mb-3">
            {RPS_OPTS.map((o) => (
              <button key={o.id} disabled={choices[myId] !== undefined} onClick={() => choose(o.id)} style={{ fontSize: 34, background: choices[myId] === o.id ? AMBER_SOFT : "#fff", border: `1.5px solid ${choices[myId] === o.id ? AMBER : PAPER_DEEP}`, opacity: choices[myId] && choices[myId] !== o.id ? 0.4 : 1 }} className="w-16 h-16 rounded-full flex items-center justify-center">
                {o.e}
              </button>
            ))}
          </div>
          <p style={{ fontFamily: sans, fontSize: 12, color: INK_SOFT }} className="text-center">
            {choices[myId] === undefined ? "Elegí a ciegas" : bothChose ? "..." : "Esperando a la otra persona…"}
          </p>
          {bothChose && (
            <p style={{ fontFamily: serif, fontSize: 15, color: OLIVE }} className="text-center mt-2">
              {choices[myId]} vs {choices[otherId]}
            </p>
          )}
        </>
      ) : (
        <p style={{ fontFamily: serif, fontSize: 17, color: OLIVE }} className="text-center">{session.winner === myId ? "¡Ganaste la serie! 🎉" : "Ganó la otra persona la serie"}</p>
      )}
    </div>
  );
}

/* =========================================================================
   CADENA DE PALABRAS
   ========================================================================= */
function WordChain({ mid, myId, otherId }) {
  const [session, save] = useGameSession(mid);
  const [word, setWord] = useState("");
  const p1 = [myId, otherId].sort()[0];
  useEffect(() => {
    if (!session || session.type !== "chain" || !session.data || !session.data.words) {
      save({ type: "chain", turn: p1, winner: null, data: { words: [] } });
    }
  }, []); // eslint-disable-line
  if (!session || session.type !== "chain" || !session.data || !session.data.words) return <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 13 }}>Empezando la cadena…</p>;

  const words = session.data.words;
  const myTurn = session.turn === myId && !session.winner;

  async function submit() {
    if (!word.trim() || !myTurn) return;
    const nextWords = [...words, { by: myId, word: word.trim() }];
    setWord("");
    const finished = nextWords.length >= 10;
    await save({ ...session, data: { words: nextWords }, turn: otherId, winner: finished ? "done" : null });
  }
  async function finishNow() {
    await save({ ...session, winner: "done" });
  }

  return (
    <div>
      <div style={{ background: "#fff", border: `1px solid ${PAPER_DEEP}`, borderRadius: 12, minHeight: 60 }} className="p-3 mb-3 flex flex-wrap gap-1.5">
        {words.length === 0 ? <span style={{ fontFamily: sans, fontSize: 12, color: INK_SOFT }}>Empiecen con cualquier palabra…</span> :
          words.map((w, i) => (
            <span key={i} style={{ fontFamily: serif, fontSize: 13.5, background: w.by === myId ? INDIGO : PAPER, color: w.by === myId ? PAPER : INK, border: `1px solid ${PAPER_DEEP}` }} className="px-2.5 py-1 rounded-full">
              {w.word}
            </span>
          ))}
      </div>
      {!session.winner ? (
        <>
          <div className="flex gap-2 mb-2">
            <input value={word} onChange={(e) => setWord(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} disabled={!myTurn} placeholder={myTurn ? "Tu palabra…" : "Esperando a la otra persona…"} style={{ fontFamily: sans, border: `1.5px solid ${PAPER_DEEP}`, background: "#fff" }} className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" />
            <Button small disabled={!myTurn} onClick={submit}>Sumar</Button>
          </div>
          {words.length >= 4 && <button onClick={finishNow} style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="underline">Terminar acá y ver la cadena</button>}
        </>
      ) : (
        <p style={{ fontFamily: serif, fontSize: 16, color: OLIVE }} className="text-center">Cadena completa 🔗 — {words.length} palabras</p>
      )}
    </div>
  );
}

/* =========================================================================
   Contenedores
   ========================================================================= */
export function GamePickerModal({ onPick, onClose }) {
  return (
    <Modal onClose={onClose}>
      <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="uppercase tracking-wide font-semibold mb-3">Elegí un minijuego</p>
      <div className="flex flex-col gap-2 mb-3">
        {GAME_TYPES.map((g) => (
          <button key={g.id} onClick={() => onPick(g.id)} style={{ background: "#fff", border: `1.5px solid ${PAPER_DEEP}` }} className="text-left px-4 py-3 rounded-lg flex items-center gap-3">
            <span style={{ fontSize: 22 }}>{g.emoji}</span>
            <span>
              <span style={{ fontFamily: serif, fontSize: 15, color: INK, display: "block" }}>{g.label}</span>
              <span style={{ fontFamily: sans, fontSize: 11.5, color: INK_SOFT }}>{g.desc}</span>
            </span>
          </button>
        ))}
      </div>
      <Button full variant="ghost" onClick={onClose}>Cerrar</Button>
    </Modal>
  );
}

export function GameModal({ mid, myId, otherId, onClose }) {
  const [session, , reload] = useGameSession(mid);
  const [selectedType, setSelectedType] = useState(null);
  const key = "game:" + mid;

  // Si ya había una partida en curso para esta conexión, entrar directo a ella.
  useEffect(() => {
    if (session && session.type && !selectedType) setSelectedType(session.type);
  }, [session]); // eslint-disable-line

  async function startGame(type) {
    // Limpiamos cualquier partida anterior; cada juego arma su propio
    // estado inicial correcto en su primer render (ver useEffect de cada uno).
    await safeSet(key, null, true);
    setSelectedType(type);
    reload();
  }

  if (!selectedType) {
    return <GamePickerModal onPick={startGame} onClose={onClose} />;
  }

  const GameComp = { ttt: TicTacToe, c4: ConnectFour, domino: Domino, rps: RPS, chain: WordChain }[selectedType];
  const label = GAME_TYPES.find((g) => g.id === selectedType)?.label || "Minijuego";
  const finished = session && session.type === selectedType && !!session.winner;

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between mb-3">
        <p style={{ fontFamily: sans, color: INK_SOFT, fontSize: 11 }} className="uppercase tracking-wide font-semibold">{label}</p>
        <Pill>en vivo</Pill>
      </div>
      {GameComp && <GameComp mid={mid} myId={myId} otherId={otherId} />}
      {finished && <PostGamePrompt type={selectedType} mid={mid} onNewGame={() => setSelectedType(null)} />}
      <div className="h-2" />
      <Button full variant="ghost" onClick={onClose}>Cerrar</Button>
    </Modal>
  );
}

export default GameModal;
