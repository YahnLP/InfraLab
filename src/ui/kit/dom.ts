/** Mini-helper DOM (repris de l'esprit de `h()` du simulateur réseau, typé). */
type Kid = Node | string | number | null | false | undefined;
type Attrs = Record<string, unknown> | null | undefined;

function apply(el: Element, attrs: Attrs): void {
  if (!attrs) return;
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'class') el.setAttribute('class', String(v));
    else if (k === 'style' && typeof v === 'object') Object.assign((el as HTMLElement).style, v);
    else if (k === 'value' && 'value' in el) (el as HTMLInputElement).value = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
}
function append(el: Element, kids: Kid[]): void {
  for (const k of kids) if (k !== null && k !== false && k !== undefined) el.append(k instanceof Node ? k : String(k));
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag); apply(el, attrs); append(el, kids); return el;
}
const SVG_NS = 'http://www.w3.org/2000/svg';
export function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs?: Attrs, ...kids: Kid[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag); apply(el, attrs); append(el, kids); return el;
}
export function svgFromString(inner: string): SVGGElement {
  const g = document.createElementNS(SVG_NS, 'g'); g.innerHTML = inner; return g;
}
export function clear(el: Element): void { while (el.firstChild) el.removeChild(el.firstChild); }
