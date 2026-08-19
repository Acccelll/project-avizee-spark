/** Parser XML mínimo, namespace-tolerante e sem dependência de DOM. */
export interface XmlNode {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function decodeXmlEntities(raw: string): string {
  return raw.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (full, code: string) => {
    if (/^#x/i.test(code)) {
      const n = parseInt(code.slice(2), 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : full;
    }
    if (code.startsWith("#")) {
      const n = parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : full;
    }
    return ENTITIES[code.toLowerCase()] ?? full;
  });
}

export function localName(name: string): string {
  const i = name.indexOf(":");
  return i >= 0 ? name.slice(i + 1) : name;
}

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) attrs[localName(m[1])] = decodeXmlEntities(m[3] ?? m[4] ?? "");
  return attrs;
}

export class XmlLiteError extends Error {}

export function parseXmlLite(xml: string): XmlNode {
  if (typeof xml !== "string" || !xml.trim()) throw new XmlLiteError("XML vazio");
  let src = xml.replace(/^\uFEFF/, "");
  src = src.replace(/<\?[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  src = src.replace(/<!DOCTYPE[^>[]*(\[[\s\S]*?\])?[^>]*>/gi, "");

  const root: XmlNode = { name: "#root", attrs: {}, children: [], text: "" };
  const stack: XmlNode[] = [root];
  const tagRe = /<(\/)?([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/)?>/g;
  let cursor = 0;
  let m: RegExpExecArray | null;
  const pushText = (chunk: string) => {
    if (!chunk) return;
    const cleaned = decodeXmlEntities(chunk.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_f, inner: string) => inner));
    if (cleaned.trim() || stack[stack.length - 1].text) stack[stack.length - 1].text += cleaned;
  };

  while ((m = tagRe.exec(src)) !== null) {
    pushText(src.slice(cursor, m.index));
    cursor = tagRe.lastIndex;
    const closing = !!m[1];
    const name = localName(m[2]);
    if (closing) {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].name === name) { stack.length = i; break; }
      }
      continue;
    }
    const node: XmlNode = { name, attrs: parseAttrs(m[3] ?? ""), children: [], text: "" };
    stack[stack.length - 1].children.push(node);
    if (!m[4]) stack.push(node);
  }
  pushText(src.slice(cursor));
  if (!root.children[0]) throw new XmlLiteError("XML sem elemento raiz");
  return root.children[0];
}

export function findFirst(node: XmlNode | null | undefined, name: string): XmlNode | null {
  if (!node) return null;
  if (node.name === name) return node;
  for (const c of node.children) { const f = findFirst(c, name); if (f) return f; }
  return null;
}

export function findAll(node: XmlNode | null | undefined, name: string): XmlNode[] {
  if (!node) return [];
  const out: XmlNode[] = [];
  const walk = (n: XmlNode) => { if (n.name === name) out.push(n); n.children.forEach(walk); };
  walk(node);
  return out;
}

export function child(node: XmlNode | null | undefined, name: string): XmlNode | null {
  return node?.children.find((c) => c.name === name) ?? null;
}

export function textOf(node: XmlNode | null | undefined, ...names: string[]): string {
  for (const name of names) {
    const el = findFirst(node, name);
    if (el?.text.trim()) return el.text.trim();
  }
  return "";
}

export function numberOf(node: XmlNode | null | undefined, ...names: string[]): number | null {
  const raw = textOf(node, ...names);
  if (!raw) return null;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
