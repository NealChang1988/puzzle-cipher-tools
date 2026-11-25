/**
 * Letter-substitution solver.
 * Candidates come from ENABLE plus the single letters a and i.
 * A complete assignment is ranked by the sum of SCOWL levels
 * (10 is the most common, so a lower sum is a better answer).
 */

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

function undo(added, assign, used) {
  for (const c of added) {
    used.delete(assign.get(c));
    assign.delete(c);
  }
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
  let score = 0;
  const re = /[A-Za-z]+/g;
  let match;
  const lower = text.toLowerCase();
  while ((match = re.exec(lower))) {
    const level = levelOf.get(match[0]);
    score += level || 120;
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
  let steps = 0;
  const limit = options.limit || 5000;
  function search(remaining) {
    if (solutions.length >= limit) return;
    if ((steps++ & 255) === 0 && now() > deadline) {
      timedOut = true;
      return;
    }
    if (!remaining.length) {
      const textOut = decodeWith(prepared, assign);
      solutions.push({
        text: textOut,
        assign: new Map(assign),
        score: scorePlain(textOut, dictionary.levelOf),
      });
      return;
    }
    let best = 0;
    for (let i = 1; i < remaining.length; i++) {
      if (remaining[i].candidates.length < remaining[best].candidates.length) best = i;
    }
    const item = remaining[best];
    for (const plain of item.candidates) {
      if (!canUse(item.cipher, plain, assign, used, noSelf)) continue;
      const added = applyWord(item.cipher, plain, assign, used);
      const next = [];
      let dead = false;
      for (let i = 0; i < remaining.length; i++) {
        if (i === best) continue;
        const other = remaining[i];
        const filtered = other.candidates.filter((candidate) => canUse(other.cipher, candidate, assign, used, noSelf));
        if (!filtered.length) {
          dead = true;
          break;
        }
        next.push({ cipher: other.cipher, candidates: filtered });
      }
      if (!dead) search(next);
      undo(added, assign, used);
      if (timedOut || solutions.length >= limit) return;
    }
  }
  if (now() > deadline) timedOut = true;
  else search(unique);

  solutions.sort((a, b) => a.score - b.score || (a.text < b.text ? -1 : a.text > b.text ? 1 : 0));
  return {
    ok: true,
    prepared,
    solutions,
    timedOut,
    partial: solutions.length ? null : partialFrom(prepared, assign),
  };
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
