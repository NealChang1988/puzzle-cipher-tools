function decode(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function classListFor(set) {
  return {
    add(...names) {
      for (const name of names) if (name) set.add(name);
    },
    remove(...names) {
      for (const name of names) set.delete(name);
    },
    toggle(name, force) {
      const has = set.has(name);
      const next = force === undefined ? !has : !!force;
      if (next) set.add(name);
      else set.delete(name);
      return next;
    },
    contains(name) {
      return set.has(name);
    },
  };
}

export function createElement(tag) {
  const el = {
    tagName: String(tag).toLowerCase(),
    id: "",
    children: [],
    parent: null,
    attrs: {},
    dataset: {},
    style: {},
    classSet: new Set(),
    listeners: {},
    value: "",
    _text: "",
    disabled: false,
    hidden: false,
    checked: false,
    ownerDocument: null,
  };
  el.classList = classListFor(el.classSet);
  Object.defineProperty(el, "textContent", {
    get() {
      if (!el.children.length) return el._text || "";
      return el.children.map((child) => child.textContent || "").join("");
    },
    set(value) {
      el._text = value == null ? "" : String(value);
      el.children = [];
    },
  });
  el.setAttribute = (name, value) => {
    el.attrs[name] = String(value);
    if (name === "id") el.id = String(value);
    if (name === "class") {
      el.classSet.clear();
      for (const part of String(value).split(/\s+/)) if (part) el.classSet.add(part);
    }
    if (name === "hidden") el.hidden = true;
  };
  el.getAttribute = (name) => (name in el.attrs ? el.attrs[name] : null);
  el.removeAttribute = (name) => {
    delete el.attrs[name];
    if (name === "hidden") el.hidden = false;
  };
  el.addEventListener = (type, fn) => {
    (el.listeners[type] ||= []).push(fn);
  };
  el.dispatchEvent = (event) => {
    const fns = el.listeners[event.type] || [];
    return Promise.all(fns.map((fn) => fn({ ...event, target: el, currentTarget: el, preventDefault() {} })));
  };
  el.click = () => el.dispatchEvent({ type: "click" });
  el.append = (...nodes) => {
    for (const node of nodes) {
      if (node == null) continue;
      if (typeof node === "string") {
        const text = createElement("#text");
        text._text = node;
        text.parent = el;
        el.children.push(text);
      } else {
        node.parent = el;
        el.children.push(node);
      }
    }
  };
  el.prepend = (...nodes) => {
    const made = [];
    for (const node of nodes) {
      if (typeof node === "string") {
        const text = createElement("#text");
        text._text = node;
        text.parent = el;
        made.push(text);
      } else {
        node.parent = el;
        made.push(node);
      }
    }
    el.children = [...made, ...el.children];
  };
  el.replaceChildren = (...nodes) => {
    el.children = [];
    el._text = "";
    el.append(...nodes);
  };
  el.remove = () => {
    if (!el.parent) return;
    el.parent.children = el.parent.children.filter((child) => child !== el);
  };
  el.querySelectorAll = (selector) => queryAll(el, selector);
  el.querySelector = (selector) => queryAll(el, selector)[0] || null;
  el.focus = () => {
    el.focused = true;
  };
  if (el.tagName === "canvas") {
    const ctx = {
      font: "",
      fillStyle: "",
      strokeStyle: "",
      textBaseline: "",
      textAlign: "",
      lineWidth: 1,
      lineCap: "butt",
      measureText(text) {
        return { width: [...String(text)].length * 24 };
      },
      fillRect() {},
      fillText() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {},
      canvas: el,
    };
    el.getContext = () => ctx;
    el.toBlob = (callback) => {
      callback(new Blob([Uint8Array.from([137, 80, 78, 71])], { type: "image/png" }));
    };
  }
  return el;
}

function matches(el, selector) {
  if (!el?.tagName || el.tagName === "#text") return false;
  if (selector.startsWith("#") && !selector.includes(" ")) return el.id === selector.slice(1);
  if (selector.startsWith(".") && !selector.includes(" ")) return el.classSet.has(selector.slice(1));
  const match = selector.match(/^([a-z0-9-]+)?(?:#([\w-]+))?(?:\.([\w-]+))?$/i);
  if (!match) return false;
  if (match[1] && el.tagName !== match[1].toLowerCase()) return false;
  if (match[2] && el.id !== match[2]) return false;
  if (match[3] && !el.classSet.has(match[3])) return false;
  if (!match[1] && !match[2] && !match[3]) return false;
  return true;
}

function descendants(node, out = []) {
  for (const child of node.children || []) {
    out.push(child);
    descendants(child, out);
  }
  return out;
}

function queryAll(root, selector) {
  const parts = selector.trim().split(/\s+/);
  let current = [root];
  for (const part of parts) {
    const next = [];
    for (const node of current) {
      for (const child of descendants(node)) {
        if (matches(child, part)) next.push(child);
      }
    }
    current = next;
  }
  return current;
}

function walk(node, visit) {
  if (visit(node)) return node;
  for (const child of node.children || []) {
    const found = walk(child, visit);
    if (found) return found;
  }
  return null;
}

export function parseDocument(html) {
  const root = createElement("document");
  const doc = {
    documentElement: null,
    body: null,
    head: null,
    fonts: { load: async () => [], ready: Promise.resolve() },
    getElementById(id) {
      return walk(root, (node) => node.id === id);
    },
    createElement,
    querySelector(selector) {
      return queryAll(root, selector)[0] || null;
    },
    querySelectorAll(selector) {
      return queryAll(root, selector);
    },
  };
  root.ownerDocument = doc;
  const stack = [root];
  const voidTags = new Set(["meta", "link", "img", "input", "br", "hr", "source", "wbr"]);
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z0-9-]+)>|<([a-zA-Z0-9-]+)([^>]*?)(\/?)>|([^<]+)/g;
  let match;
  while ((match = re.exec(html))) {
    if (match[0].startsWith("<!--")) continue;
    if (match[1]) {
      const name = match[1].toLowerCase();
      while (stack.length > 1 && stack.at(-1).tagName !== name) stack.pop();
      if (stack.length > 1) stack.pop();
      continue;
    }
    if (match[2]) {
      const el = createElement(match[2]);
      el.ownerDocument = doc;
      const attrs = match[3] || "";
      const attrRe = /([^\s"'=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"']+)))?/g;
      let attr;
      while ((attr = attrRe.exec(attrs))) {
        const name = attr[1];
        if (name.startsWith("/")) continue;
        const value = attr[2] ?? attr[3] ?? attr[4] ?? "";
        el.setAttribute(name, decode(value));
        if (name === "checked") el.checked = true;
        if (name === "hidden") el.hidden = true;
        if (name === "value" && (el.tagName === "input" || el.tagName === "option")) el.value = decode(value);
      }
      stack.at(-1).children.push(el);
      el.parent = stack.at(-1);
      const selfClosing = match[4] === "/" || voidTags.has(el.tagName);
      if (!selfClosing) stack.push(el);
      if (el.tagName === "body") doc.body = el;
      if (el.tagName === "head") doc.head = el;
      if (el.tagName === "html") doc.documentElement = el;
      continue;
    }
    if (match[5]) {
      const text = decode(match[5]);
      if (!text) continue;
      const parent = stack.at(-1);
      if (parent.tagName === "textarea" || parent.tagName === "pre" || parent.tagName === "option") {
        parent._text = (parent._text || "") + text;
        if (parent.tagName === "textarea") parent.value = parent._text;
      } else if (text.trim()) {
        const node = createElement("#text");
        node._text = text;
        node.parent = parent;
        parent.children.push(node);
      }
    }
  }
  for (const node of descendants(root)) {
    if (node.tagName === "select") {
      const selected = (node.children || []).find((child) => child.tagName === "option" && child.attrs.selected != null);
      const first = (node.children || []).find((child) => child.tagName === "option");
      node.value = (selected || first)?.attrs.value || (selected || first)?.value || "";
    }
  }
  doc.body = doc.body || root;
  return doc;
}

export function installBrowserGlobals(doc, location) {
  globalThis.document = doc;
  globalThis.location = location;
  globalThis.history = { replaceState() {} };
  const clipboard = {
    written: "",
    async writeText(text) {
      clipboard.written = text;
    },
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    enumerable: true,
    writable: true,
    value: { clipboard },
  });
  globalThis.AudioContext = class {
    constructor() {
      this.destination = {};
      this.currentTime = 0;
      this.state = "running";
    }
    createOscillator() {
      return { frequency: { value: 0 }, connect() {}, start() {}, stop() {} };
    }
    createGain() {
      return { gain: { setValueAtTime() {} }, connect() {} };
    }
    resume() {
      return Promise.resolve();
    }
  };
  if (!globalThis.URL.createObjectURL) globalThis.URL.createObjectURL = () => "blob:test";
  if (!globalThis.URL.revokeObjectURL) globalThis.URL.revokeObjectURL = () => {};
}
