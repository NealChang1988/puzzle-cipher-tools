const PATHS = {
  pencil:
    '<path d="M4 20l4.2-.8L19 8.4 15.6 5 5 15.6 4 20z"></path><path d="M13.5 7.1l3.4 3.4"></path>',
  ear: '<path d="M8 10a4 4 0 0 1 8 0c0 3-2 3.5-2 6"></path><path d="M10 19a2 2 0 0 0 4 0"></path>',
  copy: '<rect x="8" y="8" width="11" height="12" rx="1.5"></rect><path d="M5 15V5.5A1.5 1.5 0 0 1 6.5 4H15"></path>',
  play: '<path d="M8 6l10 6-10 6V6z"></path>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="1.5"></rect>',
  download: '<path d="M12 4v10"></path><path d="M8 10l4 4 4-4"></path><path d="M5 19h14"></path>',
  link: '<path d="M10 13a4 4 0 0 0 6 0l2-2a4 4 0 0 0-6-6l-1 1"></path><path d="M14 11a4 4 0 0 0-6 0l-2 2a4 4 0 0 0 6 6l1-1"></path>',
  clear: '<path d="M6 7h12"></path><path d="M9 7V5h6v2"></path><path d="M8 7l1 13h6l1-13"></path>',
  search: '<circle cx="11" cy="11" r="6"></circle><path d="M16 16l4 4"></path>',
  grid: '<rect x="4" y="4" width="16" height="16" rx="1"></rect><path d="M4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16"></path>',
  bulb: '<path d="M9 18h6"></path><path d="M10 21h4"></path><path d="M12 3a6 6 0 0 0-3 11c.5.6 1 1.4 1 2h4c0-.6.5-1.4 1-2a6 6 0 0 0-3-11z"></path>',
  check: '<path d="M5 12.5l4.2 4.2L19 7.5"></path>',
  image: '<rect x="4" y="5" width="16" height="14" rx="1.5"></rect><path d="M8 14l2.5-2.5L14 15l2-2 2 2"></path>',
};

export function icon(name) {
  const body = PATHS[name] || PATHS.pencil;
  return `<svg class="ico" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

export function button(id, label, iconName, extra = "") {
  const classes = ["btn", extra].filter(Boolean).join(" ");
  return `<button type="button" class="${classes}" id="${id}">${icon(iconName)}<span class="btn-label">${label}</span></button>`;
}

export const MARK = `<svg class="mark" viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
  <rect width="32" height="32" rx="8" fill="#efe6d6"></rect>
  <circle cx="8" cy="16" r="2.1" fill="#1c1915"></circle>
  <circle cx="14" cy="16" r="2.1" fill="#1c1915"></circle>
  <circle cx="20" cy="16" r="2.1" fill="#1c1915"></circle>
  <rect x="24" y="14.4" width="5.5" height="3.2" rx="1.2" fill="#9a3412"></rect>
</svg>`;
