/**
 * Letter-substitution solver.
 * Candidates come from ENABLE plus the single letters a and i.
 * A finished sentence is ranked by word-frequency weights
 * (common short words cost less) plus a bonus for common word pairs.
 * The search tries those cheaper readings first.
 */

const COMMON = new Map(
  [
    ["a", 2],
    ["i", 4],
    ["the", 1],
    ["of", 3],
    ["to", 2],
    ["and", 2],
    ["in", 3],
    ["is", 3],
    ["it", 3],
    ["that", 4],
    ["you", 4],
    ["for", 5],
    ["on", 4],
    ["be", 4],
    ["or", 5],
    ["are", 5],
    ["as", 5],
    ["we", 5],
    ["not", 5],
    ["at", 5],
    ["this", 6],
    ["with", 6],
    ["but", 6],
    ["have", 6],
    ["from", 7],
    ["they", 7],
    ["was", 7],
    ["by", 6],
    ["he", 6],
    ["an", 4],
    ["if", 7],
    ["do", 7],
    ["so", 6],
    ["no", 6],
    ["all", 6],
    ["there", 6],
    ["what", 6],
    ["when", 8],
    ["where", 8],
    ["who", 7],
    ["which", 8],
    ["than", 7],
    ["then", 8],
    ["will", 8],
    ["can", 7],
    ["your", 7],
    ["our", 7],
    ["my", 7],
    ["me", 8],
    ["am", 8],
    ["been", 9],
    ["has", 7],
    ["had", 8],
    ["its", 8],
    ["his", 7],
    ["her", 8],
    ["she", 8],
    ["one", 8],
    ["new", 10],
  ].map(([word, cost]) => [word, cost]),
);

const BIGRAMS = new Set(
  `to be|be or|or not|not to|is not|there is|is a|a way|a will|well done|is better|better than|i think|i am|it is|is what|what you|you see|you look|look at|at that|all that|where there|we have|have to|to fear|the only|only thing|than well|not what|fear is|is fear|let there|there be|be light|makes perfect|speak louder|louder than|than words|late than|than never|is power|done is|think therefore|therefore i|that matters|matters it|thing we|fear itself|you look|look at`.split(
    "|",
  ),
);

function wordCost(word, levelOf) {
  const known = COMMON.get(word);
  if (known != null) return known;
  const level = levelOf?.get(word) || 0;
  if (!level) return 480;
  if (level <= 15) return 24 + level;
  if (level <= 30) return 50 + level;
  if (level <= 50) return 90 + level * 2;
  return 180 + level * 3;
}

export const MAX_CHARS = 1000;
export const TOO_LONG = "Too long \u2014 please use fewer than 1,000 characters.";
export const TIME_LIMIT_MS = 5000;

const PATTERN_INDEX = new WeakMap();

export function patternKey(word) {
  const seen = new Map();
  let next = 0;
  let key = "";
  for (const ch of word) {
    if (!seen.has(ch)) seen.set(ch, next++);
    key += `${seen.get(ch)},`;
  }
  return key;
}

export function dictionaryWithSingles(words, levelOf) {
  const list = words.slice();
  for (const extra of ["a", "i"]) {
    if (!list.includes(extra)) list.push(extra);
  }
  return { words: list, levelOf };
}

function patternIndex(words) {
  let index = PATTERN_INDEX.get(words);
  if (index) return index;
  index = new Map();
  for (const word of words) {
    const key = `${word.length}:${patternKey(word)}`;
    let bucket = index.get(key);
    if (!bucket) index.set(key, (bucket = []));
    bucket.push(word);
  }
  PATTERN_INDEX.set(words, index);
  return index;
}

export function parseKnown(text) {
  const map = new Map();
  const errors = [];
  const parts = String(text)
    .toUpperCase()
    .split(/[,;\n]+/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^([A-Z])\s*=\s*([A-Z])$/);
    if (!match) {
      errors.push(trimmed);
      continue;
    }
    map.set(match[1], match[2].toLowerCase());
  }
  return { map, errors };
}

function cipherWords(text) {
  const words = [];
  const re = /[A-Za-z]+/g;
  let match;
  const upper = text.toUpperCase();
  while ((match = re.exec(upper))) {
    words.push(match[0]);
  }
  return words;
}

function canUse(cipher, plain, assign, used, noSelf) {
  const localPlain = new Map();
  for (let i = 0; i < cipher.length; i++) {
    const c = cipher[i];
    const p = plain[i];
    if (noSelf && c === p.toUpperCase()) return false;
    const already = assign.get(c);
    if (already && already !== p) return false;
    const claimed = localPlain.get(c);
    if (claimed && claimed !== p) return false;
    const owner = used.get(p);
    if (owner && owner !== c) return false;
    localPlain.set(c, p);
  }
  const seen = new Map();
  for (const [c, p] of localPlain) {
    if (seen.has(p) && seen.get(p) !== c) return false;
    seen.set(p, c);
  }
  return true;
}

function applyWord(cipher, plain, assign, used) {
  const added = [];
  for (let i = 0; i < cipher.length; i++) {
    const c = cipher[i];
    if (!assign.has(c)) {
      assign.set(c, plain[i]);
      used.set(plain[i], c);
      added.push(c);
    }
  }
  return added;
}

export function decodeWith(text, assign) {
  let out = "";
  for (const ch of text.toUpperCase()) {
    if (ch >= "A" && ch <= "Z") out += (assign.get(ch) || "_").toUpperCase();
    else out += ch;
  }
  return out;
}

export function scorePlain(text, levelOf) {
  const words = text.toLowerCase().match(/[a-z]+/g) || [];
  let score = 0;
  for (let i = 0; i < words.length; i++) {
    score += wordCost(words[i], levelOf);
    if (i && BIGRAMS.has(`${words[i - 1]} ${words[i]}`)) score -= 22;
  }
  return score;
}

export function solveCryptogram(raw, dictionary, options = {}) {
  const text = String(raw);
  if ([...text].length > MAX_CHARS) return { ok: false, error: TOO_LONG };
  const prepared = text.replace(/[\u00A0\u3000]/g, " ").normalize("NFKC");
  if (!/[A-Za-z]/.test(prepared)) {
    return {
      ok: false,
      error: "Type a coded sentence. If this is Morse code, open the Morse Code Translator.",
      hint: /[.\-]/.test(prepared) ? { href: "/", label: "Morse Code Translator" } : null,
    };
  }
  const noSelf = options.noSelf !== false;
  const known = options.known instanceof Map ? options.known : parseKnown(options.known || "").map;
  const deadline = options.deadline ?? Date.now() + TIME_LIMIT_MS;
  const now = options.now || Date.now;
  const words = dictionaryWithSingles(dictionary.words, dictionary.levelOf).words;
  const index = patternIndex(dictionary.words.includes("a") ? dictionary.words : words);
  const tokens = [...new Set(cipherWords(prepared))];
  const unique = tokens.map((cipher) => {
    const key = `${cipher.length}:${patternKey(cipher.toLowerCase())}`;
    const bucket = index.get(key) || [];
    return { cipher, candidates: bucket };
  });
  unique.sort((a, b) => a.candidates.length - b.candidates.length || a.cipher.length - b.cipher.length);

  const assign = new Map();
  const used = new Map();
  for (const [cipher, plain] of known) {
    if (noSelf && cipher === plain.toUpperCase()) {
      return {
        ok: false,
        error: `${cipher}=${plain.toUpperCase()} breaks the rule that a letter is never itself. Change the known letter, or turn that rule off.`,
      };
    }
    if (used.has(plain) && used.get(plain) !== cipher) {
      return { ok: false, error: `${plain.toUpperCase()} is already used by ${used.get(plain)}. Change the known letters and press Solve again.` };
    }
    assign.set(cipher, plain);
    used.set(plain, cipher);
  }

  const solutions = [];
  let timedOut = false;
  const limit = options.limit || 5000;
  const seenText = new Set();
  const heap = [];
  const ordered = unique.map((item) => ({
    cipher: item.cipher,
    candidates: item.candidates.slice().sort((a, b) => wordCost(a, dictionary.levelOf) - wordCost(b, dictionary.levelOf)),
  }));
  heap.push({ score: 0, assign, used, remaining: ordered });
  let expansions = 0;
  const maxExpansions = options.maxExpansions || 25000;
  function pushState(state) {
    heap.push(state);
    if (heap.length > 8000) {
      heap.sort((a, b) => a.score - b.score);
      heap.length = 2500;
    }
  }
  function popState() {
    let best = 0;
    for (let i = 1; i < heap.length; i++) {
      if (heap[i].score < heap[best].score) best = i;
    }
    return heap.splice(best, 1)[0];
  }
  while (heap.length && solutions.length < limit && expansions < maxExpansions) {
    if (now() > deadline) {
      timedOut = true;
      break;
    }
    const state = popState();
    expansions += 1;
    if (!state.remaining.length) {
      const textOut = decodeWith(prepared, state.assign);
      if (!seenText.has(textOut)) {
        seenText.add(textOut);
        solutions.push({
          text: textOut,
          assign: new Map(state.assign),
          score: scorePlain(textOut, dictionary.levelOf),
        });
      }
      continue;
    }
    let best = 0;
    for (let i = 1; i < state.remaining.length; i++) {
      if (state.remaining[i].candidates.length < state.remaining[best].candidates.length) best = i;
    }
    const item = state.remaining[best];
    if (item.candidates.length > 600 && !solutions.length) break;
    const rest = [];
    for (let i = 0; i < state.remaining.length; i++) {
      if (i !== best) rest.push(state.remaining[i]);
    }
    for (const plain of item.candidates) {
      if (!canUse(item.cipher, plain, state.assign, state.used, noSelf)) continue;
      const nextAssign = new Map(state.assign);
      const nextUsed = new Map(state.used);
      applyWord(item.cipher, plain, nextAssign, nextUsed);
      const next = [];
      let dead = false;
      for (const other of rest) {
        const filtered = [];
        for (const candidate of other.candidates) {
          if (canUse(other.cipher, candidate, nextAssign, nextUsed, noSelf)) filtered.push(candidate);
        }
        if (!filtered.length) {
          dead = true;
          break;
        }
        next.push({ cipher: other.cipher, candidates: filtered });
      }
      if (dead) continue;
      const added = Math.min(48, wordCost(plain, dictionary.levelOf));
      pushState({ score: state.score + added, assign: nextAssign, used: nextUsed, remaining: next });
    }
  }
  if (now() > deadline) timedOut = true;
  if (!solutions.length && now() < deadline) {
    const extra = wideSearch(prepared, ordered, dictionary, noSelf, assign, deadline, now);
    for (const item of extra) {
      if (seenText.has(item.text)) continue;
      seenText.add(item.text);
      solutions.push(item);
    }
  }

  solutions.sort((a, b) => a.score - b.score || (a.text < b.text ? -1 : a.text > b.text ? 1 : 0));
  return {
    ok: true,
    prepared,
    solutions,
    timedOut,
    partial: solutions.length ? null : partialFrom(prepared, assign),
  };
}

function wideSearch(prepared, unique, dictionary, noSelf, knownAssign, deadline, now) {
  const found = [];
  const seen = new Set();
  const baseUsed = new Map();
  for (const [cipher, plain] of knownAssign) baseUsed.set(plain, cipher);

  function collect(assign) {
    const textOut = decodeWith(prepared, assign);
    if (seen.has(textOut)) return;
    seen.add(textOut);
    found.push({
      text: textOut,
      assign: new Map(assign),
      score: scorePlain(textOut, dictionary.levelOf),
    });
  }

  function dig(remaining, assign, used) {
    if (found.length >= 40 || now() > deadline) return;
    if (!remaining.length) {
      collect(assign);
      return;
    }
    let best = 0;
    for (let i = 1; i < remaining.length; i++) {
      if (remaining[i].candidates.length < remaining[best].candidates.length) best = i;
    }
    const item = remaining[best];
    const rest = [];
    for (let i = 0; i < remaining.length; i++) if (i !== best) rest.push(remaining[i]);
    for (const plain of item.candidates) {
      if (!canUse(item.cipher, plain, assign, used, noSelf)) continue;
      const added = applyWord(item.cipher, plain, assign, used);
      const next = [];
      let dead = false;
      for (const other of rest) {
        const filtered = [];
        for (const candidate of other.candidates) {
          if (canUse(other.cipher, candidate, assign, used, noSelf)) filtered.push(candidate);
        }
        if (!filtered.length) {
          dead = true;
          break;
        }
        next.push({ cipher: other.cipher, candidates: filtered });
      }
      if (!dead) dig(next, assign, used);
      for (const cipher of added) {
        used.delete(assign.get(cipher));
        assign.delete(cipher);
      }
      if (found.length >= 40 || now() > deadline) return;
    }
  }

  for (const item of unique) {
    if (now() > deadline || found.length >= 40) break;
    for (const plain of item.candidates.slice(0, 8)) {
      if (now() > deadline || found.length >= 40) break;
      const assign = new Map(knownAssign);
      const used = new Map(baseUsed);
      if (!canUse(item.cipher, plain, assign, used, noSelf)) continue;
      const added = applyWord(item.cipher, plain, assign, used);
      const remaining = [];
      let tooWide = false;
      for (const other of unique) {
        if (other.cipher === item.cipher) continue;
        const filtered = [];
        for (const candidate of other.candidates) {
          if (!canUse(other.cipher, candidate, assign, used, noSelf)) continue;
          filtered.push(candidate);
          if (filtered.length > 220) break;
        }
        if (!filtered.length || filtered.length > 220) {
          tooWide = true;
          break;
        }
        remaining.push({ cipher: other.cipher, candidates: filtered });
      }
      if (!tooWide) dig(remaining, assign, used);
      for (const cipher of added) {
        used.delete(assign.get(cipher));
        assign.delete(cipher);
      }
    }
  }
  return found;
}

function partialFrom(text, assign) {
  if (!assign.size) return null;
  return decodeWith(text, assign);
}

export function hideOffensive(solutions, offensive) {
  const shown = [];
  let hidden = 0;
  for (const item of solutions) {
    const words = item.text.toLowerCase().match(/[a-z]+/g) || [];
    if (words.some((word) => offensive.has(word))) hidden += 1;
    else shown.push(item);
  }
  return { shown, hidden };
}

export function letterMap(assign) {
  return [...assign.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([cipher, plain]) => `${cipher}=${plain.toUpperCase()}`)
    .join(" ");
}
