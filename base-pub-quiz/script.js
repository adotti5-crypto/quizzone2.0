import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue, push, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Configurazione Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBU7C35fywrz7QvmP6ZgXatw4ycGGCx7-E",
  authDomain: "basequiz-2e30c.firebaseapp.com",
  databaseURL: "https://basequiz-2e30c-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "basequiz-2e30c",
  storageBucket: "basequiz-2e30c.firebasestorage.app",
  messagingSenderId: "790064093563",
  appId: "1:790064093563:web:16a99621eb1ce6e26f05de",
  measurementId: "G-ZFT0C86E2J"
};

// Inizializzazione
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const firebaseConfig = {
  apiKey: "AIzaSyBU7C35fywrz7QvmP6ZgXatw4ycGGCx7-E",
  authDomain: "basequiz-2e30c.firebaseapp.com",
  databaseURL: "https://basequiz-2e30c-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "basequiz-2e30c",
  storageBucket: "basequiz-2e30c.firebasestorage.app",
  messagingSenderId: "790064093563",
  appId: "1:790064093563:web:16a99621eb1ce6e26f05de",
  measurementId: "G-ZFT0C86E2J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);const SDK = 'https://www.gstatic.com/firebasejs/10.14.1';
const MODES = { crossword: 'Cruciverba', bomb: 'Bomba', photo: 'Foto anno' };
const PHASES = { lobby: 'Iscrizioni aperte', ready: 'Pronti al via', live: 'Si gioca', closed: 'Tempo scaduto', results: 'Risultati del round', between: 'Turno concluso', final: 'Classifica finale' };
const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
const uid = () => crypto.randomUUID().replaceAll('-', '');
const optionIndex = value => Number(String(value).slice(1));
export const normalize = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const photoPoints = (answer, year) => { const d = Math.abs(Number(answer) - Number(year)); return d === 0 ? 30 : Math.max(0, 24 - d * 4); };
export const crosswordPoints = (revealed, elapsed) => Math.max(0, 30 - 2 * revealed) + (elapsed < 30000 ? 5 : 0);
const letterIndexes = answer => Array.from(answer).flatMap((ch, i) => /[\p{L}\p{N}]/u.test(ch) ? [i] : []);
export const revealBatch = answer => Math.max(1, Math.ceil(letterIndexes(answer).length * .05));
export function validateQuestion(q) {
  if (!MODES[q.mode]) throw Error('Scegli una modalità valida.');
  if (!q.prompt?.trim() || q.prompt.length > 400) throw Error('La domanda deve contenere da 1 a 400 caratteri.');
  if (q.mode === 'crossword' && (!normalize(q.answer || '') || q.answer.length > 80)) throw Error('Inserisci una soluzione di massimo 80 caratteri.');
  if (q.mode === 'bomb') {
    if (!Array.isArray(q.options) || q.options.length !== 10 || q.options.some(s => !s.trim() || s.length > 100)) throw Error('Inserisci esattamente 10 opzioni, massimo 100 caratteri ciascuna.');
    if (new Set(q.options.map(normalize)).size !== 10) throw Error('Le 10 opzioni devono essere diverse.');
    if (!Number.isInteger(q.bomb) || q.bomb < 0 || q.bomb > 9) throw Error('Indica la posizione della bomba, da 1 a 10.');
  }
  if (q.mode === 'photo') {
    if (!Number.isInteger(q.year) || q.year < 1 || q.year > 2100) throw Error('Inserisci un anno intero tra 1 e 2100.');
    if (!safeImage(q.image)) throw Error('Inserisci un URL HTTPS valido per la foto.');
  }
  return q;
}
function safeImage(url) { try { return new URL(url).protocol === 'https:'; } catch { return false; } }
function shuffle(values) { const a = [...values]; for (let i = a.length - 1; i > 0; i--) { const n = new Uint32Array(1); crypto.getRandomValues(n); const j = n[0] % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Funzioni pure condivise dall'applicazione e dalle verifiche automatiche.
export function createRound(q, players, id, number) {
  validateQuestion(q);
  const roster = Object.fromEntries(Object.entries(players || {}).filter(([, p]) => !p.kicked).map(([id]) => [id, true]));
  const r = { id, number, mode: q.mode, prompt: q.prompt, turn: 1, turnKey: 't1', roster, eliminated: {}, revealed: {}, revealEvents: {}, settled: {}, startedAt: 0, deadline: 0 };
  if (q.mode === 'crossword') r.mask = Array.from(q.answer.toUpperCase()).map(ch => /[\p{L}\p{N}]/u.test(ch) ? '_' : ch);
  // Chiavi con prefisso: Firebase non deve convertire mappe sparse in array con null.
  if (q.mode === 'bomb') r.options = Object.fromEntries(q.options.map((label, i) => ['o' + i, label]));
  if (q.mode === 'photo') r.image = q.image;
  return r;
}
export function revealLetters(r, secret, at, count) {
  const answer = Array.from(secret.answer.toUpperCase());
  r.revealed ||= {}; r.revealEvents ||= {};
  let remaining = Math.min(count, 10 - Object.keys(r.revealed).length);
  for (const i of secret.order) {
    if (remaining <= 0) break;
    const key = 'l' + i;
    if (r.revealed[key] !== undefined) continue;
    r.revealed[key] = answer[i]; r.revealEvents[key] = at; remaining--;
  }
  return r;
}
export function catchUpLetters(r, secret, until) {
  if (r.mode !== 'crossword' || !r.startedAt) return r;
  r.autoSteps ||= 0;
  const steps = Math.floor((Math.min(until, r.deadline - 1) - r.startedAt) / 5000);
  while (r.autoSteps < steps) {
    r.autoSteps++;
    // Si penalizzano solo le lettere effettivamente pubblicate prima della risposta.
    // Dopo un ritardo della regia, nessuna penalità retroattiva per lettere non viste.
    revealLetters(r, secret, until, revealBatch(secret.answer));
  }
  return r;
}
export function settleGame(game, secret, answers, at) {
  const g = clone(game), r = g.round;
  if (!r || g.phase !== 'closed' || r.settled?.['t' + r.turn]) return g;
  r.settled ||= {}; r.eliminated ||= {};
  const used = new Set(); r.results = {};
  for (const id of Object.keys(r.roster || {})) {
    const player = g.players?.[id];
    if (!player || player.kicked) continue;
    const a = answers?.[id];
    const valid = a && a.at >= r.startedAt && a.at <= r.deadline && a.at <= (r.closedAt || r.deadline);
    let points = 0, text = 'Nessuna risposta in tempo.';
    if (r.mode === 'crossword' && valid) {
      const correct = normalize(a.value) === normalize(secret.answer);
      const revealed = Object.values(r.revealEvents || {}).filter(t => t <= a.at).length;
      points = correct ? crosswordPoints(revealed, a.at - r.startedAt) : 0;
      text = correct ? 'Risposta corretta!' : 'Risposta non corretta.';
    }
    if (r.mode === 'photo' && valid && /^\d{1,4}$/.test(a.value)) {
      points = photoPoints(a.value, secret.year);
      const d = Math.abs(Number(a.value) - secret.year);
      text = d === 0 ? 'Anno esatto!' : `Distanza: ${d} ${d === 1 ? 'anno' : 'anni'}.`;
    }
    if (r.mode === 'bomb') {
      const alreadyOut = r.eliminated[id] && r.eliminated[id].turn < r.turn;
      if (alreadyOut) { r.results[id] = { points: 0, text: 'Eliminato in un turno precedente.' }; continue; }
      if (valid && r.options?.[a.value] !== undefined && optionIndex(a.value) !== secret.bomb && !r.eliminated[id]) {
        points = 5; used.add(a.value); text = 'Salvo! +5 punti.';
      } else {
        r.eliminated[id] = { turn: r.turn, reason: valid && optionIndex(a.value) === secret.bomb ? 'Bomba!' : 'Tempo scaduto' };
        text = r.eliminated[id].reason + ' Eliminato dalla manche.';
      }
    }
    player.score = (player.score || 0) + points;
    r.results[id] = { points, text };
  }
  if (r.mode === 'bomb') {
    for (const key of used) delete r.options[key];
    const survivors = Object.keys(r.roster || {}).filter(id => !r.eliminated[id] && g.players?.[id] && !g.players[id].kicked);
    const safeRemain = Object.keys(r.options || {}).some(key => optionIndex(key) !== secret.bomb);
    if (!survivors.length || !safeRemain) {
      g.phase = 'results'; r.solution = secret.options[secret.bomb]; r.bombIndex = secret.bomb;
      for (const id of survivors) { g.players[id].score += 10; r.results[id].points += 10; r.results[id].text = 'Manche completata! +10 punti bonus.'; }
    } else g.phase = 'between';
  } else { g.phase = 'results'; r.solution = r.mode === 'photo' ? String(secret.year) : secret.answer; }
  r.settled['t' + r.turn] = true;
  return g;
}

/* Adapter demo: stato locale condiviso tra schede dello stesso browser.
 * Web Locks rende atomiche le modifiche concorrenti. Nessun dato demo è online.
 */
function demoStore() {
  const key = 'base-quiz-demo-v1';
  const watchers = new Set();
  const read = () => JSON.parse(localStorage.getItem(key) || '{}');
  const valueAt = (data, path) => path.split('/').filter(Boolean).reduce((v, k) => v?.[k], data) ?? null;
  const put = (data, path, value) => { const parts = path.split('/').filter(Boolean), last = parts.pop(); let n = data; for (const k of parts) n = n[k] ||= {}; if (value === null) delete n[last]; else n[last] = value; };
  const notify = () => { const data = read(); for (const w of watchers) w.fn(clone(valueAt(data, w.path))); };
  const atomic = async fn => {
    if (!navigator.locks) throw Error('La demo richiede localhost o HTTPS e un browser recente.');
    return navigator.locks.request(key, async () => { const data = read(); const result = fn(data); localStorage.setItem(key, JSON.stringify(data)); queueMicrotask(notify); return result; });
  };
  addEventListener('storage', e => { if (e.key === key) notify(); });
  let userId = sessionStorage.getItem('base-demo-uid');
  if (!userId) { userId = uid(); sessionStorage.setItem('base-demo-uid', userId); }
  return {
    demo: true, connected: true, uid: userId, now: () => Date.now(), stamp: () => Date.now(),
    get: async path => clone(valueAt(read(), path)),
    set: (path, v) => atomic(data => put(data, path, v)),
    tx: (path, fn) => atomic(data => { const value = fn(clone(valueAt(data, path))); if (value === undefined) return { committed: false }; put(data, path, value); return { committed: true, value }; }),
    watch: (path, fn) => { const w = { path, fn }; watchers.add(w); fn(clone(valueAt(read(), path))); return () => watchers.delete(w); },
    login: async () => {}, logout: async () => {}, isAdmin: async () => true,
    presence: async (code, role) => { await atomic(data => put(data, `presence/${code}/${userId}`, { online: true, at: Date.now(), role })); },
    upload: async () => { throw Error('Il caricamento file richiede Firebase Storage. In demo usa un URL HTTPS.'); }
  };
}
async function firebaseStore() {
  const [appSDK, dbSDK, authSDK, storageSDK] = await Promise.all(['app', 'database', 'auth', 'storage'].map(name => import(`${SDK}/firebase-${name}.js`)));
  const app = appSDK.initializeApp(firebaseConfig), db = dbSDK.getDatabase(app), auth = authSDK.getAuth(app);
  await authSDK.setPersistence(auth, authSDK.browserSessionPersistence);
  await new Promise(resolve => { const off = authSDK.onAuthStateChanged(auth, () => { off(); resolve(); }); });
  if (!auth.currentUser) await authSDK.signInAnonymously(auth);
  let offset = 0, presencePath = null, presenceRole = null;
  const store = {
    demo: false, connected: false, get uid() { return auth.currentUser?.uid; },
    now: () => Date.now() + offset, stamp: () => dbSDK.serverTimestamp(),
    get: async path => (await dbSDK.get(dbSDK.ref(db, path))).val(),
    set: (path, value) => dbSDK.set(dbSDK.ref(db, path), value),
    tx: async (path, fn) => { const res = await dbSDK.runTransaction(dbSDK.ref(db, path), fn, { applyLocally: false }); return { committed: res.committed, value: res.snapshot.val() }; },
    watch: (path, fn) => dbSDK.onValue(dbSDK.ref(db, path), snap => fn(snap.val()), error => report(error)),
    login: async (email, password) => { await authSDK.signInWithEmailAndPassword(auth, email, password); },
    logout: async () => { await authSDK.signOut(auth); await authSDK.signInAnonymously(auth); },
    isAdmin: async () => (await dbSDK.get(dbSDK.ref(db, `admins/${auth.currentUser.uid}`))).val() === true,
    presence: async (code, role) => {
      presencePath = `presence/${code}/${auth.currentUser.uid}`; presenceRole = role;
      if (store.connected) {
        await dbSDK.onDisconnect(dbSDK.ref(db, presencePath)).set({ online: false, at: dbSDK.serverTimestamp(), role });
        await dbSDK.set(dbSDK.ref(db, presencePath), { online: true, at: dbSDK.serverTimestamp(), role });
      }
    },
    clearPresence: async () => {
      if (presencePath) {
        const ref = dbSDK.ref(db, presencePath);
        await dbSDK.onDisconnect(ref).cancel();
        await dbSDK.set(ref, { online: false, at: dbSDK.serverTimestamp(), role: presenceRole });
        presencePath = null;
      }
    },
    upload: async file => {
      if (file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) throw Error('Scegli JPG, PNG, WebP o GIF, massimo 5 MB.');
      const storage = storageSDK.getStorage(app);
      const ref = storageSDK.ref(storage, `quiz-images/${store.uid}/${uid()}`);
      await storageSDK.uploadBytes(ref, file, { contentType: file.type, cacheControl: 'public,max-age=31536000' });
      return storageSDK.getDownloadURL(ref);
    }
  };
  dbSDK.onValue(dbSDK.ref(db, '.info/serverTimeOffset'), s => { offset = s.val() || 0; });
  dbSDK.onValue(dbSDK.ref(db, '.info/connected'), s => {
    store.connected = s.val() === true; updateConnection();
    if (store.connected && presencePath) store.presence(presencePath.split('/')[1], presenceRole).catch(report);
  });
  return store;
}

// Esempi importati SOLO dall'host; in Firebase le soluzioni restano nel ramo protetto.
const SAMPLES = {
  base_01: { mode: 'crossword', prompt: 'Il fiume che attraversa Palazzolo sull’Oglio.', answer: 'OGLIO' },
  base_02: { mode: 'crossword', prompt: 'Il cocktail italiano con bitter, vermouth rosso e gin.', answer: 'NEGRONI' },
  base_03: { mode: 'crossword', prompt: 'La città lombarda conosciuta come la Leonessa d’Italia.', answer: 'BRESCIA' },
  base_04: { mode: 'bomb', prompt: 'Sono tutti corpi celesti reali del Sistema Solare… tranne uno. Evita l’intruso!', options: ['Mercurio', 'Venere', 'Terra', 'Marte', 'Giove', 'Saturno', 'Urano', 'Nettuno', 'Plutone', 'Pandora (Avatar)'], bomb: 9 },
  base_05: { mode: 'photo', prompt: 'Un passo che ha fatto la storia. In quale anno è stata scattata questa foto?', image: 'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/solar/2023/09/a/as11_40_5902.jpg?crop=faces%2Cfocalpoint&fit=clip&h=1883&w=1825', year: 1969 }
};

let store, role = '', code = '', game = null, questions = {}, secrets = {}, entries = {}, presence = {}, ownAnswers = {}, liveAnswers = {};
let mode = 'crossword', selectedQuestion = '', duration = 60, unsub = [], answerUnsub = null, answerPath = '', busy = false, ticking = false, processing = false;
let draft = '', draftKey = '', renderSignature = '', editorId = '', editorMode = 'crossword', lastHeartbeat = 0;
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function toast(message, error = false) { const el = $('#toast'); if (!el) return; el.textContent = message; el.className = 'toast' + (error ? ' error' : ''); el.hidden = false; clearTimeout(toast.timeout); toast.timeout = setTimeout(() => { el.hidden = true; }, error ? 9000 : 4500); }
function report(error) {
  console.error(error);
  const errorCode = String(error.code || '');
  let message = error.message || String(error);
  if (/permission|PERMISSION_DENIED/.test(errorCode + message)) message = 'Accesso negato. Verifica le regole Firebase, l’UID del presentatore o lo stato della tua partecipazione.';
  if (/auth\/(invalid-credential|wrong-password|user-not-found)/.test(errorCode)) message = 'Email o password non corrette.';
  if (/network/.test(errorCode)) message = 'Connessione non disponibile. Controlla la rete e riprova.';
  toast(message, true);
}
function updateConnection() { const el = $('#connection'); if (!el || !store) return; el.textContent = store.demo ? 'DEMO LOCALE' : store.connected ? 'LIVE CONNESSO' : 'OFFLINE'; el.className = 'badge ' + (store.demo ? '' : store.connected ? 'live' : 'offline'); }
function requireOnline() { if (!store.connected) throw Error('Connessione assente: attendi il ritorno online prima di continuare.'); }
function saveView() { sessionStorage.setItem('base-view', JSON.stringify({ role, code })); }
function sortedPlayers() { return Object.entries(game?.players || {}).filter(([, p]) => !p.kicked).sort((a, b) => b[1].score - a[1].score || a[1].name.localeCompare(b[1].name, 'it')); }
function online(id) { return presence?.[id]?.online && store.now() - presence[id].at < 45000; }
function hostAlive() { return game && store.now() - (game.tickAt || game.createdAt) < 15000; }
function joinURL(target = 'player') { const url = new URL(location.href); url.search = ''; url.hash = ''; url.searchParams.set('role', target); url.searchParams.set('session', code); return url.href; }
async function changeGame(mutator) { requireOnline(); const result = await store.tx(`games/${code}`, g => { if (!g || g.owner !== store.uid) return; return mutator(g); }); if (!result.committed) throw Error('Operazione non applicata. La sessione è cambiata: riprova.'); return result.value; }
function button(action, text, className = '', disabled = false, extras = '') { return `<button data-action="${action}" class="${className}" ${disabled ? 'disabled' : ''} ${extras}>${text}</button>`; }
function modal(content) { $('#modal-body').innerHTML = content; if (!$('#modal').open) $('#modal').showModal(); }
function closeModal() { $('#modal').close(); }
function confirmAction(title, text, action) {
  modal(`<div class="confirmation"><h2>${esc(title)}</h2><p>${esc(text)}</p><div class="actions">${button('close-modal', 'Annulla', 'quiet')}${button('confirm', 'Conferma', 'primary')}</div></div>`);
  $('[data-action="confirm"]').onclick = async () => { closeModal(); await guarded(action); };
}
async function guarded(fn) { if (busy) return; busy = true; try { await fn(); } catch (error) { report(error); } finally { busy = false; render(true); } }

function clearListeners() { for (const off of unsub) off(); unsub = []; answerUnsub?.(); answerUnsub = null; answerPath = ''; ownAnswers = {}; liveAnswers = {}; }
async function enterSession(nextRole, sessionCode) {
  requireOnline();
  const g = await store.get(`games/${sessionCode}`);
  if (!g) throw Error('Sessione non trovata. Controlla il codice.');
  if (nextRole === 'host' && g.owner !== store.uid) throw Error('Questa sessione appartiene a un altro presentatore.');
  clearListeners(); role = nextRole; code = sessionCode; game = g; saveView();
  unsub.push(store.watch(`games/${code}`, v => { game = v; subscribeAnswers(); render(); }));
  unsub.push(store.watch(`presence/${code}`, v => { presence = v || {}; render(); }));
  if (role === 'host') {
    unsub.push(store.watch('questions', v => { questions = v || {}; render(); }));
    unsub.push(store.watch(`secrets/${code}`, v => { secrets = v || {}; processBombAnswers().catch(report); }));
    unsub.push(store.watch(`entries/${code}`, v => { entries = v || {}; syncPlayers().catch(report); }));
  }
  await store.presence(code, role); lastHeartbeat = store.now(); render(true);
}
function subscribeAnswers() {
  const r = game?.round;
  const path = r ? `answers/${code}/${r.id}/${r.turnKey}` + (role === 'host' ? '' : role === 'player' ? `/${store.uid}` : '/none') : '';
  if (path === answerPath) return;
  answerUnsub?.(); answerUnsub = null; answerPath = path; ownAnswers = {}; liveAnswers = {};
  if (!r || role === 'public') return;
  if (draftKey !== path) { draft = ''; draftKey = path; }
  answerUnsub = store.watch(path, v => { if (role === 'host') { liveAnswers = v || {}; processBombAnswers().catch(report); } else ownAnswers = v || {}; render(); });
}
async function syncPlayers() {
  if (role !== 'host' || !game || !store.connected) return;
  const missing = Object.entries(entries).filter(([id]) => !game.players?.[id]);
  if (!missing.length) return;
  await changeGame(g => { g.players ||= {}; for (const [id, e] of missing) if (!g.players[id]) g.players[id] = { name: e.name, score: 0, kicked: false }; return g; });
}
async function processBombAnswers() {
  if (processing || role !== 'host' || game?.phase !== 'live' || game.round?.mode !== 'bomb' || !store.connected) return;
  const r = game.round, secret = secrets[r.id]; if (!secret) return;
  const victims = Object.entries(liveAnswers).filter(([id, a]) => r.roster?.[id] && !r.eliminated?.[id] && optionIndex(a.value) === secret.bomb && a.at >= r.startedAt && a.at <= r.deadline).map(([id]) => id);
  if (!victims.length) return;
  processing = true;
  try { await changeGame(g => { if (g.phase !== 'live' || g.round?.id !== r.id || g.round.turn !== r.turn) return g; g.round.eliminated ||= {}; for (const id of victims) g.round.eliminated[id] = { turn: r.turn, reason: 'Bomba!' }; return g; }); } finally { processing = false; }
}

// Viste: il timer aggiorna solo il numero, senza interrompere la digitazione.
function render(force = false) {
  if (!store) return;
  const g = clone(game); if (g) delete g.tickAt;
  const sig = JSON.stringify([role, code, g, questions, ownAnswers, Object.keys(liveAnswers), Object.keys(presence).map(id => [id, online(id)]), mode, selectedQuestion]);
  if (!force && sig === renderSignature) return;
  renderSignature = sig;
  const focus = document.activeElement, focusId = focus?.id, start = focus?.selectionStart, end = focus?.selectionEnd;
  const saved = Object.fromEntries([...document.querySelectorAll('#app [data-preserve]')].map(el => [el.id, el.value]));
  document.body.classList.toggle('projection', role === 'public' && !!code);
  $('#leave').hidden = !role; updateConnection();
  if (!role) $('#app').innerHTML = homeView();
  else if (!code) $('#app').innerHTML = role === 'host' ? hostSetupView() : joinView();
  else if (!game) $('#app').innerHTML = '<div class="empty"><strong>Sessione non disponibile</strong>Il presentatore ha chiuso o rimosso questa sessione.</div>';
  else $('#app').innerHTML = role === 'host' ? hostView() : role === 'public' ? publicView() : playerView();
  for (const [id, value] of Object.entries(saved)) { const el = document.getElementById(id); if (el && el.matches('[data-preserve]')) el.value = value; }
  const nextFocus = focusId && document.getElementById(focusId);
  if (nextFocus && !$('#modal').open) { nextFocus.focus({ preventScroll: true }); if (typeof start === 'number' && /^(text|search|password|email)$/.test(nextFocus.type)) nextFocus.setSelectionRange(start, end); }
  for (const img of document.querySelectorAll('.quiz-photo')) img.onerror = () => { const msg = document.createElement('p'); msg.className = 'photo-error'; msg.textContent = 'Foto non disponibile. Il presentatore deve controllare l’URL prima di avviare il timer.'; img.replaceWith(msg); };
  paintClock();
}
function homeView() {
  return `<section class="welcome"><div><div class="eyebrow">BASE PALAZZOLO S/O · GAME NIGHT</div><h1><span>Quizzone.</span></h1><p class="intro">Il tavolo diventa una squadra.<br>La serata diventa una sfida.</p><div class="ruleline"><span>01 / CRUCIVERBA</span><span>02 / BOMBA</span><span>03 / FOTO ANNO</span></div></div><div class="role-stack"><p class="section-label">SCEGLI COME ENTRARE</p><button class="role-card featured" data-role="player"><span class="role-icon" aria-hidden="true">01</span><span><span class="role-title">Giochiamo.</span><span class="role-desc">Entra con la tua squadra e rispondi dal telefono.</span></span><span class="arrow" aria-hidden="true">↗</span></button><button class="role-card" data-role="public"><span class="role-icon" aria-hidden="true">02</span><span><span class="role-title">Sul grande schermo.</span><span class="role-desc">Domande, conto alla rovescia e classifica live.</span></span><span class="arrow" aria-hidden="true">↗</span></button><button class="role-card" data-role="host"><span class="role-icon" aria-hidden="true">03</span><span><span class="role-title">Conduci la serata.</span><span class="role-desc">La regia del quiz, dal primo round al podio.</span></span><span class="arrow" aria-hidden="true">↗</span></button>${store.demo ? '<p class="demo-note">Demo locale attiva. Apri più schede di questo browser per provare i ruoli. Per giocare tra dispositivi, configura Firebase seguendo il README.</p>' : '<p class="demo-note">Hai già il codice della serata? Scegli “Giochiamo” e raggiungi la tua squadra.</p>'}</div></section>`;
}
function joinView() {
  const proposed = new URL(location.href).searchParams.get('session') || '';
  return `<section class="form-wrap">${button('home', '← Scegli un altro ruolo', 'back')}<div class="eyebrow">${role === 'player' ? 'IL TUO TAVOLO, LA TUA SQUADRA' : 'PRONTI PER IL GRANDE SCHERMO'}</div><h1>${role === 'player' ? 'Entra in partita.' : 'Accendi il quiz.'}</h1><p class="muted">Inserisci il codice mostrato dal presentatore.</p><form id="join-form"><label for="session-code">Codice sessione</label><input id="session-code" name="code" placeholder="Es. BASE26" value="${esc(proposed)}" minlength="6" maxlength="6" pattern="[A-Za-z0-9]{6}" autocapitalize="characters" autocomplete="off" required data-preserve>${role === 'player' ? '<label for="team-name">Nome della squadra</label><input id="team-name" name="name" placeholder="Come vi chiamate?" minlength="2" maxlength="28" autocomplete="off" required data-preserve>' : ''}<button class="primary full" type="submit">${role === 'player' ? 'Entra nella serata →' : 'Apri schermo pubblico →'}</button></form><p class="form-note">${store.demo ? 'Demo: usa il codice creato dal presentatore in un’altra scheda dello stesso browser.' : 'Il punteggio rimane associato a questa scheda. Non usare la navigazione in incognito per la partita.'}</p></section>`;
}
function hostSetupView() {
  return `<section class="form-wrap">${button('home', '← Scegli un altro ruolo', 'back')}<div class="eyebrow">LA REGIA DELLA SERATA</div><h1>Si va in scena.</h1><p class="muted">${store.demo ? 'Crea una sessione demo e prova tutti i controlli.' : 'Accedi con l’account del presentatore autorizzato.'}</p><form id="host-form">${store.demo ? '' : '<label for="host-email">Email presentatore</label><input id="host-email" name="email" type="email" autocomplete="username" required data-preserve><label for="host-password">Password</label><input id="host-password" name="password" type="password" autocomplete="current-password" required data-preserve>'}<label for="resume-code">Riprendi sessione <span class="muted">(facoltativo)</span></label><input id="resume-code" name="resume" maxlength="6" pattern="[A-Za-z0-9]{6}" placeholder="Codice della sessione esistente" data-preserve><button class="primary full" type="submit">${store.demo ? 'Apri la regia →' : 'Accedi e apri la regia →'}</button></form><p class="form-note">Lascia il codice vuoto per creare una nuova serata. Tieni la regia aperta durante il gioco.</p></section>`;
}
function heading(eyebrow, title, right = '') { return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1></div>${right}</div>`; }
function ranking(limit = 1000) {
  const rows = sortedPlayers(); let previousScore = null, rank = 0;
  if (!rows.length) return '<p class="empty">La classifica si riempirà con le prime squadre.</p>';
  return `<div class="leaderboard">${rows.slice(0, limit).map(([id, p], i) => { if (p.score !== previousScore) rank = i + 1; previousScore = p.score; return `<div class="rank-row"><span class="rank-num">${String(rank).padStart(2, '0')}</span><span class="team-name">${esc(p.name)}${id === store.uid && role === 'player' ? ' <small>(voi)</small>' : ''}</span><span class="points">${p.score}<small>PT</small></span></div>`; }).join('')}</div>`;
}
function roundView() {
  const r = game.round;
  if (game.phase === 'final') return finalView();
  if (!r) return `<div class="empty"><span class="empty-mark">B.</span><strong>La serata sta per iniziare.</strong>Riunite la squadra. Il primo round arriva tra poco.</div>`;
  let body = '';
  if (r.mode === 'crossword') body = `<div class="letters" aria-label="Soluzione parzialmente rivelata">${(r.mask || []).map((char, i) => { const c = r.solution ? Array.from(r.solution)[i] : r.revealed?.['l' + i] ?? char; return `<span class="letter ${char === ' ' ? 'space' : char !== '_' ? 'punct' : c !== '_' ? 'revealed' : ''}">${esc(c === '_' ? '·' : c)}</span>`; }).join('')}</div><p class="hint">${Object.keys(r.revealed || {}).length} lettere rivelate · 30 punti − 2 per lettera · +5 entro 30 secondi</p>`;
  if (r.mode === 'photo') body = `<img class="quiz-photo" src="${esc(r.image)}" alt="Foto del round: indovina in quale anno è stata scattata" referrerpolicy="no-referrer"><p class="hint">Anno esatto: 30 punti · ±1: 20 · ±2: 16 · ±3: 12 · ±4: 8 · ±5: 4</p>`;
  if (r.mode === 'bomb') body = `<div class="answer-options">${Object.entries(r.options || {}).map(([key, label]) => `<button ${role === 'player' && canAnswer() ? '' : 'disabled'} data-option="${key}" class="${ownAnswers.value === key ? 'chosen' : ''} ${r.bombIndex === optionIndex(key) ? 'bomb-reveal' : ''}"><span>${String(optionIndex(key) + 1).padStart(2, '0')}</span>${esc(label)}</button>`).join('')}</div><p class="hint">Turno ${r.turn} · +5 se sopravvivi · +10 alla fine della manche</p>`;
  return `<div class="round-card"><div class="round-top"><div><div class="eyebrow">ROUND ${String(r.number).padStart(2, '0')} / ${MODES[r.mode]}</div><p class="hint">${PHASES[game.phase]}</p></div><div><div class="timer" data-timer>00:00</div><span class="timer-label">${game.phase === 'ready' || game.phase === 'between' ? 'IN ATTESA DEL VIA' : 'TEMPO RIMASTO'}</span></div></div><h2 class="question">${esc(r.prompt)}</h2>${body}${r.solution ? `<div class="result"><strong>${r.mode === 'bomb' ? 'La bomba era' : 'La risposta è'}: ${esc(r.solution)}</strong></div>` : ''}</div>`;
}
function hostView() {
  const r = game.round, players = Object.entries(game.players || {}), active = players.filter(([, p]) => !p.kicked);
  const list = Object.entries(questions).filter(([, q]) => q.mode === mode);
  if (!list.some(([id]) => id === selectedQuestion)) selectedQuestion = list[0]?.[0] || '';
  const canNew = ['lobby', 'results'].includes(game.phase);
  return `${heading('PANNELLO PRESENTATORE', 'La tua regia.', `<div class="actions">${button('editor', '＋ Database domande', 'quiet')}${button('project', 'Apri proiettore ↗', 'quiet')}</div>`)}<div class="host-grid"><div class="stack"><section class="panel"><div class="panel-heading"><div class="session-tag"><span class="section-label">SESSIONE</span><span class="session-code">${code}</span>${button('copy', 'Copia invito', 'small quiet')}</div><span class="badge">${PHASES[game.phase]}</span></div><div class="stat-row"><div class="stat"><strong>${active.length}</strong><small>SQUADRE IN GARA</small></div><div class="stat"><strong>${players.filter(([id]) => online(id)).length}</strong><small>CONNESSE ORA</small></div><div class="stat"><strong>${Object.keys(liveAnswers).length} / ${Object.keys(r?.roster || {}).filter(id => !game.players?.[id]?.kicked && (!r?.eliminated?.[id] || r.eliminated[id].turn === r.turn)).length}</strong><small>RISPOSTE DEL TURNO</small></div></div></section><section class="panel"><div class="panel-heading"><h2>Il prossimo round</h2><small>Tre modi di sfidarsi</small></div><div class="mode-tabs" role="group" aria-label="Modalità prossimo round">${Object.entries(MODES).map(([key, label], i) => `<button data-mode="${key}" class="${mode === key ? 'active' : ''}" aria-pressed="${mode === key}">${String(i + 1).padStart(2, '0')} / ${label}</button>`).join('')}</div><div class="inline-fields"><div><label for="question-select">Domanda</label><select id="question-select">${list.length ? list.map(([id, q]) => `<option value="${id}" ${id === selectedQuestion ? 'selected' : ''}>${esc(q.prompt)}</option>`).join('') : '<option value="">Aggiungi una domanda nell’editor</option>'}</select></div><div><label for="duration">Secondi</label><input id="duration" type="number" value="${duration}" min="10" max="300" step="5"></div></div><div class="round-controls">${button('prepare', 'Avvia round →', 'primary', !canNew || !selectedQuestion)}${button('timer', '▶ Avvia timer', '', game.phase !== 'ready')}${button('reveal', 'Rivela lettera', '', r?.mode !== 'crossword' || game.phase !== 'live' || Object.keys(r?.revealed || {}).length >= Math.min(10, (r?.mask || []).filter(c => c === '_').length))}${button('settle', game.phase === 'live' ? 'Chiudi e calcola punti' : 'Calcola punteggi', '', !['live', 'closed'].includes(game.phase))}${button('next-turn', 'Turno successivo →', 'primary', game.phase !== 'between')}${button('final', 'Classifica finale', 'quiet', !['lobby', 'results', 'between'].includes(game.phase))}${game.phase === 'final' ? button('resume', 'Riprendi la serata', 'primary') : ''}</div>${!canNew && game.phase !== 'final' ? '<p class="hint">Concludi il round attuale prima di prepararne un altro.</p>' : ''}</section>${roundView()}<section class="panel"><div class="panel-heading"><h2>Squadre & punteggi</h2><small>${active.length} in gara</small></div>${players.length ? players.map(([id, p]) => `<div class="player-admin ${p.kicked ? 'kicked' : ''}"><span class="team-name">${esc(p.name)}<span class="player-meta">${p.kicked ? 'Rimosso dalla sessione' : online(id) ? 'Connesso' : 'Non connesso'}${r?.eliminated?.[id] ? ' · Eliminato dalla manche' : ''}</span></span><span class="points">${p.score}<small>PT</small></span><div class="actions">${button('points', '± Punti', 'small quiet', false, `data-id="${id}"`)}${button(p.kicked ? 'restore' : 'kick', p.kicked ? 'Reinserisci' : 'Kick / elimina', 'small ' + (p.kicked ? '' : 'danger'), false, `data-id="${id}"`)}</div></div>`).join('') : '<p class="empty">Condividi il codice o il link di invito per far entrare le squadre.</p>'}${store.demo ? `<div class="round-controls">${button('demo-teams', '＋ Squadre dimostrative', 'small quiet', !canNew)}<small>Solo per provare la classifica.</small></div>` : ''}</section></div><aside class="stack"><section class="panel"><div class="panel-heading"><h2>Classifica live</h2><span class="badge">PUNTI</span></div><div class="scroll-area">${ranking()}</div></section><div class="info-strip">Tieni aperta questa regia durante la partita. Il timer chiude le risposte alla scadenza; premi <strong>Calcola punteggi</strong> per assegnare i punti e mostrare la soluzione.</div>${store.demo ? '<div class="info-strip">Stai provando una demo locale. Le squadre su altri telefoni potranno connettersi dopo la configurazione Firebase.</div>' : ''}</aside></div>`;
}
function canAnswer() {
  const r = game?.round, p = game?.players?.[store.uid];
  return !!(r && p && !p.kicked && r.roster?.[store.uid] && !r.eliminated?.[store.uid] && game.phase === 'live' && store.now() < r.deadline && store.connected && ownAnswers.value === undefined);
}
function playerView() {
  const p = game.players?.[store.uid], r = game.round;
  let notice = '', form = '';
  if (!p) notice = 'Iscrizione ricevuta. In attesa che il presentatore ti ammetta…';
  else if (p.kicked) notice = 'Sei stato rimosso dalla sessione. Il presentatore può reinserirti.';
  else if (r && !r.roster?.[store.uid]) notice = 'Sei dentro! Parteciperai dal prossimo round.';
  else if (r?.eliminated?.[store.uid]) notice = `${r.eliminated[store.uid].reason} Sei fuori da questa manche. Tornerai nel prossimo round.`;
  else if (ownAnswers.value !== undefined) notice = `Risposta inviata: ${r?.mode === 'bomb' ? r.options?.[ownAnswers.value] || 'opzione selezionata' : ownAnswers.value}. Attendi i risultati.`;
  else if (game.phase === 'ready') notice = 'Preparati: il presentatore sta per avviare il timer.';
  else if (game.phase === 'closed') notice = 'Tempo! Il presentatore sta calcolando i punteggi.';
  else if (game.phase === 'between') notice = 'Turno concluso. Preparati al prossimo!';
  if (canAnswer() && r.mode !== 'bomb') form = `<form id="answer-form" class="answer-form"><label for="answer">${r.mode === 'photo' ? 'In quale anno?' : 'La vostra risposta'}</label><input id="answer" name="answer" ${r.mode === 'photo' ? 'type="number" min="1" max="2100" step="1" inputmode="numeric"' : 'type="text" maxlength="80" autocomplete="off"'} placeholder="${r.mode === 'photo' ? 'Es. 1984' : 'Scrivi la soluzione…'}" value="${esc(draft)}" required><button class="primary" type="submit">Conferma risposta →</button><p class="hint">Una sola risposta per turno. Dopo l’invio non potrai modificarla.</p></form>`;
  const result = r?.results?.[store.uid];
  return `<div class="player-layout">${heading('LA TUA SQUADRA / ' + code, esc(p?.name || entries?.[store.uid]?.name || 'Benvenuti.'), `<div class="player-score"><strong>${p?.score || 0}</strong><span class="section-label">PUNTI<br>TOTALI</span></div>`)}<div data-host-warning class="info-strip connection-note" ${hostAlive() ? 'hidden' : ''}>Il presentatore non è connesso. Attendi il suo ritorno; il termine del timer rimane valido.</div>${notice ? `<div class="info-strip player-status" role="status">${esc(notice)}</div>` : ''}${p?.kicked ? '' : roundView()}${form}${result && ['results', 'between'].includes(game.phase) ? `<div class="result ${result.points ? '' : 'bad'}"><strong>+${result.points} punti</strong>${esc(result.text)}</div>` : ''}${game.phase !== 'final' ? `<section class="panel" style="margin-top:22px"><div class="panel-heading"><h2>Classifica live</h2><small>Ogni punto conta</small></div>${ranking()}</section>` : ''}</div>`;
}
function publicView() {
  return `${heading('LA SFIDA È APERTA', game.phase === 'final' ? 'La serata, in classifica.' : 'Quizzone dal vivo.', `<div class="actions"><div class="session-tag"><span class="section-label">ENTRA CON IL CODICE</span><span class="session-code">${code}</span></div>${button('fullscreen', '⛶ Schermo intero', 'quiet small')}</div>`)}<div data-host-warning class="info-strip connection-note" ${hostAlive() ? 'hidden' : ''}>In attesa del presentatore…</div><div class="public-grid"><section>${game.phase === 'lobby' ? `<div class="public-lobby"><div class="ready-line" style="margin:0 auto 30px"></div><div class="eyebrow">RADUNA LA TUA SQUADRA</div><h2>Stasera si gioca.<br>Ci siete?</h2><p class="muted">Apri il sito sul telefono e inserisci il codice</p><div class="code-big">${code}</div><p class="join-url"><a href="${esc(joinURL())}">${esc(location.host + location.pathname)}</a></p></div>` : roundView()}</section><aside class="panel"><div class="panel-heading"><h2>Classifica live</h2><span class="badge">TOP 10</span></div>${ranking(10)}${sortedPlayers().length > 10 ? `<p class="hint">${sortedPlayers().length} squadre in gara · classifica completa sui telefoni</p>` : ''}</aside></div>`;
}
function finalView() {
  const rows = sortedPlayers(), best = rows[0]?.[1]?.score, winners = rows.filter(([, p]) => p.score === best);
  return `<section class="round-card"><div class="eyebrow">BASE PALAZZOLO S/O / FINE SERATA</div><h2 class="final-title" style="margin-top:20px">${winners.length > 1 ? 'Vittoria condivisa.' : 'Il vostro momento.'}</h2>${winners.length ? `<div class="winner">${winners.length > 1 ? 'Le squadre vincitrici' : 'La squadra vincitrice'}<strong>${winners.map(([, p]) => esc(p.name)).join(' · ')}</strong><span class="count">${best} punti</span></div>` : '<p class="muted">Nessuna squadra in classifica.</p>'}${ranking()}</section>`;
}
function paintClock() {
  if (!store) return;
  const r = game?.round;
  const sec = r ? game.phase === 'ready' ? r.duration : game.phase === 'live' ? Math.max(0, Math.ceil((r.deadline - store.now()) / 1000)) : 0 : 0;
  for (const el of document.querySelectorAll('[data-timer]')) { el.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`; el.classList.toggle('urgent', sec <= 10 && game?.phase === 'live'); }
  for (const el of document.querySelectorAll('[data-host-warning]')) el.hidden = hostAlive();
  if (role === 'player' && game?.phase === 'live' && r && store.now() >= r.deadline) {
    for (const el of document.querySelectorAll('#answer-form input, #answer-form button, [data-option]')) el.disabled = true;
  }
}

// Editor in un dialogo: gli aggiornamenti live non cancellano una bozza aperta.
function editorView(id = '') {
  editorId = id; const q = questions[id]; editorMode = q?.mode || editorMode;
  modal(`<div class="modal-heading"><div><div class="eyebrow">DATABASE DOMANDE</div><h2>Prepara la prossima sfida.</h2></div>${button('close-modal', 'Chiudi', 'quiet small')}</div><div class="editor-grid"><aside>${button('new-question', '＋ Nuova domanda', 'primary full')}<div class="question-list" style="margin-top:16px">${Object.entries(questions).map(([key, item]) => `<button data-edit="${key}" class="quiet"><small>${MODES[item.mode]}</small>${esc(item.prompt)}</button>`).join('') || '<p class="muted">Il database è vuoto.</p>'}</div>${button('samples', 'Importa esempi', 'quiet small full')}<p class="hint">Gli esempi sono pubblici: crea domande originali per la serata.</p></aside><form id="editor-form"><label for="editor-mode">Modalità</label><select id="editor-mode" name="mode" ${id ? 'disabled' : ''}>${Object.entries(MODES).map(([key, text]) => `<option value="${key}" ${key === editorMode ? 'selected' : ''}>${text}</option>`).join('')}</select><label for="editor-prompt">Domanda</label><textarea id="editor-prompt" name="prompt" maxlength="400" required>${esc(q?.prompt || '')}</textarea><div id="editor-specific">${editorFields(q)}</div><div class="editor-actions">${id ? button('delete-question', 'Elimina domanda', 'danger quiet') : '<span></span>'}<button type="submit" class="primary">Salva domanda</button></div></form></div>`);
}
function editorFields(q) {
  if (editorMode === 'crossword') return `<label for="editor-answer">Soluzione</label><input id="editor-answer" name="answer" maxlength="80" value="${esc(q?.answer || '')}" required><p class="hint">Spazi, maiuscole, accenti e punteggiatura non influiscono sulla verifica della risposta.</p>`;
  if (editorMode === 'bomb') return `<label for="editor-options">10 opzioni, una per riga</label><textarea class="ten-options" id="editor-options" name="options" required>${esc(q?.options?.join('\n') || '')}</textarea><label for="editor-bomb">Quale opzione è la bomba? (1–10)</label><input id="editor-bomb" name="bomb" type="number" min="1" max="10" step="1" value="${(q?.bomb ?? 9) + 1}" required><p class="hint">Le altre nove opzioni devono essere sicure.</p>`;
  return `<label for="editor-year">Anno corretto</label><input id="editor-year" name="year" type="number" min="1" max="2100" step="1" value="${q?.year || ''}" required><label for="editor-image">URL della foto (HTTPS)</label><input id="editor-image" name="image" type="url" value="${esc(q?.image || '')}" placeholder="https://…"><label for="editor-file">Oppure carica un’immagine</label><input id="editor-file" name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" ${store.demo ? 'disabled' : ''}><p class="hint">Massimo 5 MB. Il file viene salvato su Firebase Storage. Evita date nella foto o nel nome del file.</p>${q?.image ? `<img class="quiz-photo" style="height:150px" src="${esc(q.image)}" alt="Anteprima domanda">` : ''}`;
}

async function createSession() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 8; attempt++) {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    const candidate = Array.from(bytes, b => chars[b % chars.length]).join('');
    const created = await store.tx(`games/${candidate}`, current => current ? undefined : { owner: store.uid, createdAt: store.now(), tickAt: store.now(), phase: 'lobby', players: {}, roundNumber: 0 });
    if (created.committed) return candidate;
  }
  throw Error('Non è stato possibile generare un codice. Riprova.');
}
async function prepareRound() {
  const q = clone(questions[selectedQuestion]);
  if (!q) throw Error('Aggiungi e seleziona una domanda.');
  validateQuestion(q);
  const seconds = Number($('#duration').value);
  if (!Number.isInteger(seconds) || seconds < 10 || seconds > 300) throw Error('Scegli una durata intera tra 10 e 300 secondi.');
  if (!sortedPlayers().length) throw Error('Attendi almeno una squadra prima di avviare il round.');
  duration = seconds;
  const id = uid(), secret = { ...q };
  if (q.mode === 'crossword') { secret.answer = q.answer.toUpperCase(); secret.order = shuffle(letterIndexes(secret.answer)); }
  await store.set(`secrets/${code}/${id}`, secret);
  await changeGame(g => {
    if (!['lobby', 'results'].includes(g.phase)) return;
    g.roundNumber = (g.roundNumber || 0) + 1;
    g.round = createRound(secret, g.players, id, g.roundNumber); g.round.duration = seconds; g.phase = 'ready'; return g;
  });
  toast('Round pronto. Avvia il timer quando tutti sono pronti.');
}
async function startTimer() {
  await changeGame(g => { if (g.phase !== 'ready') return; const at = store.now(); g.round.startedAt = at; g.round.deadline = at + g.round.duration * 1000; g.phase = 'live'; g.tickAt = at; return g; });
}
async function settle() {
  const id = game.round?.id, turn = game.round?.turn;
  if (!id) return;
  // Prima si chiude l'accettazione sul server, poi si legge il set immutabile di risposte.
  if (game.phase === 'live') await changeGame(g => {
    if (g.round?.id !== id || g.round.turn !== turn || g.phase !== 'live') return g;
    g.phase = 'closed'; g.round.closedAt = Math.min(store.now(), g.round.deadline); return g;
  });
  const [secret, answers] = await Promise.all([store.get(`secrets/${code}/${id}`), store.get(`answers/${code}/${id}/t${turn}`)]);
  if (!secret) throw Error('Soluzione privata non disponibile. Riprendi con l’account presentatore.');
  await changeGame(g => {
    if (g.round?.id !== id || g.round.turn !== turn) return g;
    return settleGame(g, secret, answers || {}, store.now());
  });
  toast('Punteggi aggiornati.');
}
async function sendAnswer(value) {
  requireOnline();
  if (!canAnswer()) throw Error('Non puoi rispondere ora: risposta già inviata, tempo scaduto o squadra fuori gara.');
  const r = game.round;
  value = String(value).trim();
  if (!value || value.length > 80) throw Error('Inserisci una risposta da 1 a 80 caratteri.');
  if (r.mode === 'photo' && (!/^\d{1,4}$/.test(value) || Number(value) < 1 || Number(value) > 2100)) throw Error('Inserisci un anno intero tra 1 e 2100.');
  if (r.mode === 'bomb' && r.options?.[value] === undefined) throw Error('Questa opzione non è più disponibile.');
  // Firebase rifiuta sul server duplicati, risposte tardive e giocatori esclusi.
  await store.set(`answers/${code}/${r.id}/${r.turnKey}/${store.uid}`, { value, at: store.stamp() });
  toast('Risposta inviata!');
}
async function tick() {
  if (!store || ticking || !code || !game || !store.connected) return;
  ticking = true;
  try {
    if (store.now() - lastHeartbeat > 15000) { lastHeartbeat = store.now(); await store.presence(code, role); render(); }
    if (role !== 'host') return;
    const at = store.now(), roundId = game.round?.id, secret = secrets[roundId];
    await changeGame(g => {
      g.tickAt = at;
      if (g.phase === 'live' && g.round) {
        if (secret && g.round.id === roundId && g.round.mode === 'crossword') catchUpLetters(g.round, secret, at);
        if (at >= g.round.deadline) { g.phase = 'closed'; g.round.closedAt = g.round.deadline; }
      }
      return g;
    });
  } catch (error) { if (store.connected) report(error); } finally { ticking = false; }
}
async function leave() {
  clearListeners();
  if (store.clearPresence) await store.clearPresence();
  else if (code) await store.set(`presence/${code}/${store.uid}`, { online: false, at: store.now(), role });
  const wasHost = role === 'host';
  role = ''; code = ''; game = null; questions = {}; secrets = {}; entries = {}; presence = {}; saveView();
  if (wasHost && !store.demo) await store.logout();
  history.replaceState(null, '', location.pathname); render(true);
}
function requestLeave() {
  if (role === 'host' && code) confirmAction('Lasciare la regia?', 'La partita si fermerà in attesa del presentatore. Per riprenderla, accedi di nuovo e inserisci il codice ' + code + '.', leave);
  else guarded(leave);
}
function pointsDialog(id) {
  const p = game.players?.[id]; if (!p) return;
  const operationId = uid();
  modal(`<div class="modal-heading"><h2>Modifica punti</h2>${button('close-modal', 'Chiudi', 'quiet small')}</div><p>${esc(p.name)} · ${p.score} punti</p><form id="points-form" data-id="${id}" data-operation="${operationId}"><label for="points-delta">Punti da aggiungere o sottrarre</label><input id="points-delta" name="delta" type="number" min="-1000" max="1000" step="1" placeholder="Es. 10 oppure -5" required><label for="points-reason">Motivo della correzione</label><input id="points-reason" name="reason" maxlength="100" placeholder="Es. bonus del presentatore" required><div class="round-controls"><button class="primary" type="submit">Applica modifica</button></div></form>`);
}
async function handleAction(action, el) {
  if (action === 'close-modal') { closeModal(); return; }
  if (action === 'home') { requestLeave(); return; }
  if (action === 'confirm') return;
  if (action === 'editor') { editorView(); return; }
  if (action === 'new-question') { editorView(); return; }
  if (action === 'points') { pointsDialog(el.dataset.id); return; }
  if (action === 'project') { window.open(joinURL('public'), '_blank', 'noopener'); return; }
  if (action === 'fullscreen') { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); return; }
  if (action === 'copy') {
    try { await navigator.clipboard.writeText(joinURL()); toast('Link di invito copiato.'); }
    catch { modal(`<div class="modal-heading"><h2>Invita la squadra</h2>${button('close-modal', 'Chiudi', 'quiet small')}</div><label for="invite-link">Copia questo link</label><input id="invite-link" value="${esc(joinURL())}" readonly>`); $('#invite-link').select(); }
    return;
  }
  if (action === 'kick') { const id = el.dataset.id; confirmAction('Rimuovere questa squadra?', `${game.players[id].name} non potrà più rispondere. Potrai reinserirla dalla regia.`, async () => {
    await changeGame(g => { if (g.players?.[id]) { g.players[id].kicked = true; if (g.round?.roster?.[id]) { g.round.eliminated ||= {}; g.round.eliminated[id] = { turn: g.round.turn, reason: 'Rimosso dal presentatore' }; } } return g; });
  }); return; }
  if (action === 'delete-question') { const id = editorId; confirmAction('Eliminare la domanda?', 'La domanda verrà rimossa dal database. Un round già avviato conserverà la sua copia.', async () => { await store.set(`questions/${id}`, null); toast('Domanda eliminata.'); editorView(); }); return; }
  if (action === 'final') { confirmAction('Mostrare la classifica finale?', 'Le iscrizioni si chiuderanno. Potrai riprendere la serata in seguito. Una manche Bomba interrotta mantiene solo i punti già assegnati.', async () => { await changeGame(g => { if (!['lobby', 'results', 'between'].includes(g.phase)) return; g.phase = 'final'; return g; }); }); return; }
  await guarded(async () => {
    requireOnline();
    if (action === 'prepare') await prepareRound();
    if (action === 'timer') await startTimer();
    if (action === 'settle') await settle();
    if (action === 'reveal') {
      const id = game.round.id, secret = secrets[id]; if (!secret) throw Error('Attendi il caricamento della soluzione.');
      await changeGame(g => { if (g.phase !== 'live' || g.round?.id !== id || store.now() >= g.round.deadline) return; catchUpLetters(g.round, secret, store.now()); revealLetters(g.round, secret, store.now(), 1); return g; });
    }
    if (action === 'next-turn') await changeGame(g => { if (g.phase !== 'between') return; g.round.turn++; g.round.turnKey = 't' + g.round.turn; g.round.startedAt = 0; g.round.deadline = 0; delete g.round.closedAt; delete g.round.results; g.phase = 'ready'; return g; });
    if (action === 'resume') await changeGame(g => { if (g.phase !== 'final') return; g.phase = 'lobby'; delete g.round; return g; });
    if (action === 'restore') await changeGame(g => { const id = el.dataset.id; if (g.players?.[id]) { g.players[id].kicked = false; if (g.round?.roster) delete g.round.roster[id]; } return g; });
    if (action === 'demo-teams' && store.demo) {
      for (const [i, name] of ['Gli irriducibili', 'Quelli del bancone', 'Ultimo giro'].entries()) await store.set(`entries/${code}/demo${i}`, { name, joinedAt: store.now() });
      toast('Squadre demo aggiunte. Puoi assegnare punti dalla regia.');
    }
    if (action === 'samples') {
      for (const [id, q] of Object.entries(SAMPLES)) await store.tx(`questions/${id}`, current => current || q);
      toast('Esempi importati senza sovrascrivere le modifiche.'); editorView();
    }
  });
}

async function handleSubmit(form) {
  const data = new FormData(form);
  await guarded(async () => {
    requireOnline();
    if (form.id === 'host-form') {
      if (!store.demo) { await store.login(String(data.get('email')), String(data.get('password'))); if (!await store.isAdmin()) { await store.logout(); throw Error('Account non autorizzato. Aggiungi il suo UID in /admins dalla console Firebase.'); } }
      if (store.demo && !await store.get('questions')) await store.set('questions', SAMPLES);
      const resume = String(data.get('resume') || '').trim().toUpperCase();
      await enterSession('host', resume || await createSession());
    }
    if (form.id === 'join-form') {
      const requestedCode = String(data.get('code')).trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(requestedCode)) throw Error('Il codice deve avere 6 lettere o numeri.');
      const g = await store.get(`games/${requestedCode}`);
      if (!g) throw Error('Codice non trovato. Chiedi al presentatore.');
      if (role === 'player') {
        if (g.phase === 'final') throw Error('Le iscrizioni per questa serata sono chiuse.');
        const name = String(data.get('name') || '').trim();
        if (name.length < 2 || name.length > 28) throw Error('Il nome deve contenere da 2 a 28 caratteri.');
        const previous = await store.get(`entries/${requestedCode}/${store.uid}`);
        if (!previous) await store.set(`entries/${requestedCode}/${store.uid}`, { name, joinedAt: store.stamp() });
      }
      await enterSession(role, requestedCode);
    }
    if (form.id === 'answer-form') await sendAnswer(data.get('answer'));
    if (form.id === 'editor-form') {
      // Il riferimento della domanda resta stabile anche durante un upload lento.
      const saveId = editorId || uid();
      const q = { mode: editorMode, prompt: String(data.get('prompt')).trim() };
      if (editorMode === 'crossword') q.answer = String(data.get('answer')).trim().toUpperCase();
      if (editorMode === 'bomb') { q.options = String(data.get('options')).trim().split(/\r?\n/).map(s => s.trim()); q.bomb = Number(data.get('bomb')) - 1; }
      if (editorMode === 'photo') {
        q.year = Number(data.get('year')); q.image = String(data.get('image') || '').trim();
        const file = data.get('file');
        if (file && file.size) { toast('Caricamento della foto…'); q.image = await store.upload(file); if ($('#editor-image')) $('#editor-image').value = q.image; }
      }
      validateQuestion(q);
      await store.set(`questions/${saveId}`, q);
      toast('Domanda salvata.'); editorView();
    }
    if (form.id === 'points-form') {
      const delta = Number(data.get('delta')), reason = String(data.get('reason')).trim(), id = form.dataset.id, operation = form.dataset.operation;
      if (!Number.isInteger(delta) || !delta || Math.abs(delta) > 1000 || !reason) throw Error('Inserisci una variazione intera da −1000 a +1000 e un motivo.');
      await changeGame(g => { g.adjustments ||= {}; if (g.adjustments[operation] || !g.players?.[id]) return g; g.players[id].score = (g.players[id].score || 0) + delta; g.adjustments[operation] = { player: id, delta, reason, at: store.now() }; return g; });
      closeModal(); toast('Punteggio aggiornato.');
    }
  });
}

async function boot() {
  try {
    const configured = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'appId'].every(key => firebaseConfig[key] && !firebaseConfig[key].includes('INSERISCI'));
    store = configured ? await firebaseStore() : demoStore();
    updateConnection();
    document.addEventListener('click', event => {
      const roleButton = event.target.closest('[data-role]');
      if (roleButton) { role = roleButton.dataset.role; code = ''; saveView(); render(true); return; }
      const modeButton = event.target.closest('[data-mode]');
      if (modeButton) { mode = modeButton.dataset.mode; selectedQuestion = ''; render(true); return; }
      const edit = event.target.closest('[data-edit]'); if (edit) { editorView(edit.dataset.edit); return; }
      const option = event.target.closest('[data-option]'); if (option && !option.disabled) {
        const value = option.dataset.option;
        confirmAction('Confermare la scelta?', game.round.options[value] + ' — potrai scegliere una sola opzione in questo turno.', () => sendAnswer(value)); return;
      }
      const el = event.target.closest('[data-action]'); if (el && !el.disabled) handleAction(el.dataset.action, el).catch(report);
    });
    document.addEventListener('submit', event => { if (event.target.matches('form')) { event.preventDefault(); handleSubmit(event.target).catch(report); } });
    document.addEventListener('input', event => { if (event.target.id === 'answer') draft = event.target.value; if (event.target.id === 'duration') duration = Number(event.target.value); });
    document.addEventListener('change', event => {
      if (event.target.id === 'question-select') selectedQuestion = event.target.value;
      if (event.target.id === 'editor-mode') { editorMode = event.target.value; $('#editor-specific').innerHTML = editorFields(); }
    });
    $('#leave').onclick = requestLeave; $('#home-link').onclick = event => { event.preventDefault(); requestLeave(); };
    const params = new URL(location.href).searchParams;
    const restored = JSON.parse(sessionStorage.getItem('base-view') || '{}');
    const matchingRestore = restored.role && restored.code && (!params.get('role') || (params.get('role') === restored.role && params.get('session') === restored.code));
    if (matchingRestore) {
      try {
        if (restored.role === 'host' && !await store.isAdmin()) throw Error('Accedi di nuovo come presentatore.');
        if (!store.connected) await new Promise(resolve => setTimeout(resolve, 1000));
        await enterSession(restored.role, restored.code);
      } catch (error) { role = restored.role; code = ''; report(error); }
    } else if (params.get('role') === 'public' && /^[A-Z0-9]{6}$/.test(params.get('session') || '')) {
      role = 'public'; render(true);
      // Attendere la prima connessione Firebase prima di aprire l'invito.
      if (!store.connected) await new Promise(resolve => { const interval = setInterval(() => { if (store.connected) { clearInterval(interval); clearTimeout(timeout); resolve(); } }, 100); const timeout = setTimeout(() => { clearInterval(interval); resolve(); }, 6000); });
      try { await enterSession('public', params.get('session')); } catch (error) { report(error); }
    } else if (params.get('role') === 'player') { role = 'player'; }
    render(true);
    setInterval(paintClock, 200); setInterval(tick, 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  } catch (error) {
    console.error(error);
    $('#app').innerHTML = `<section class="form-wrap"><h1>Configurazione da completare.</h1><p class="info-strip">${esc(error.message)}</p><p class="form-note">Controlla firebaseConfig, i provider Authentication e la connessione a Internet. Consulta il README incluso nel progetto.</p><button class="primary" onclick="location.reload()">Riprova</button></section>`;
  }
}
if (typeof document !== 'undefined') boot();
