export function syncPrintTitle(doc, text) {
  let el = doc.getElementById("print-title");
  if (!el) {
    el = doc.createElement("p");
    el.setAttribute("id", "print-title");
    el.setAttribute("class", "print-title");
    el.setAttribute("hidden", "");
    const h1 = doc.querySelector("h1");
    if (h1?.insertAdjacentElement) h1.insertAdjacentElement("afterend", el);
    else if (h1?.parent?.append) h1.parent.append(el);
    else return;
  }
  const title = String(text || "").trim();
  el.textContent = title;
  if (title) el.removeAttribute("hidden");
  else el.setAttribute("hidden", "");
}

export function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function setBusy(buttons, busy) {
  for (const button of buttons) {
    if (!button) continue;
    const label = button.querySelector(".btn-label");
    if (!label) continue;
    if (!button.dataset.idle) button.dataset.idle = label.textContent;
    label.textContent = busy ? "Working\u2026" : button.dataset.idle;
    button.disabled = !!busy;
  }
}

export async function withBusy(buttons, work) {
  const list = [].concat(buttons).filter(Boolean);
  setBusy(list, true);
  await nextTick();
  try {
    return await work();
  } finally {
    setBusy(list, false);
  }
}

export async function copyText(text) {
  try {
    if (globalThis.navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  return false;
}

export function downloadBlob(doc, filename, blob) {
  const link = doc.createElement("a");
  const create = globalThis.URL?.createObjectURL
    ? (value) => URL.createObjectURL(value)
    : () => "blob:local";
  const revoke = globalThis.URL?.revokeObjectURL ? (value) => URL.revokeObjectURL(value) : () => {};
  const url = create(blob);
  link.href = url;
  link.download = filename;
  (doc.body || doc.documentElement).append(link);
  link.click();
  link.remove();
  setTimeout(() => revoke(url), 1500);
}

export function slugName(text, fallback) {
  const slug = String(text)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/^[. -]+|[. -]+$/g, "")
    .slice(0, 40);
  return slug || fallback;
}

export const COPY_FAILED =
  "Copy failed. Select the result and copy it with your device\u2019s copy command.";
