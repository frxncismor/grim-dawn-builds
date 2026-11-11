import { HtmlParser } from '@angular/compiler';
import { lstat, readdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

export const STATIC_HOME_MARKER = 'gd-static-home';
export const STATIC_PAGE_MARKER = 'gd-static-page';
const STATIC_MARKERS = [STATIC_HOME_MARKER, STATIC_PAGE_MARKER];
export const STATIC_PAGE_SELECTORS = ['gd-about-page', 'gd-legal-page', 'gd-author-page'] as const;
interface StaticContract {
  selector: string;
  marker: string;
}
const homeContract: StaticContract = { selector: 'app-home-page', marker: STATIC_HOME_MARKER };
interface Node {
  name?: string;
  attrs?: { name: string; value: string }[];
  children?: Node[];
  sourceSpan: { start: { offset: number }; end: { offset: number } };
  startSourceSpan?: Node['sourceSpan'];
  endSourceSpan?: Node['sourceSpan'];
}
function fail(): never {
  throw new Error('Portada estática inválida.');
}
function pageContract(selector: string): StaticContract {
  if (!(STATIC_PAGE_SELECTORS as readonly string[]).includes(selector)) fail();
  return { selector, marker: STATIC_PAGE_MARKER };
}
function elements(html: string): Node[] {
  const parsed = new HtmlParser().parse(html, 'Home');
  if (parsed.errors.length) fail();
  const result: Node[] = [];
  function walk(nodes: Node[]) {
    for (const node of nodes) {
      if (node.name) {
        node.name = node.name.toLowerCase();
        result.push(node);
      }
      if (node.children) walk(node.children);
    }
  }
  walk(parsed.rootNodes as Node[]);
  return result;
}
const attr = (node: Node, name: string) =>
  node.attrs?.find((a) => a.name.toLowerCase() === name)?.value;
const baseCustom = ['app-root', 'gd-site-layout', 'router-outlet'];
const forbiddenTags = new Set([
  'button',
  'input',
  'textarea',
  'select',
  'form',
  'canvas',
  'iframe',
  'video',
  'audio',
  'object',
  'embed',
  'dialog',
  'template',
]);
const forbiddenRoles = new Set([
  'button',
  'tab',
  'tablist',
  'slider',
  'switch',
  'listbox',
  'tree',
  'treeitem',
  'menu',
  'menuitem',
  'dialog',
  'combobox',
  'option',
  'checkbox',
  'radio',
  'spinbutton',
  'textbox',
  'status',
]);
function safeLink(value: string | undefined): boolean {
  if (!value || value.trim() !== value) return false;
  if (/^#[A-Za-z][\w-]*$/.test(value)) return true;
  if (
    (!value.startsWith('/') && !/^https?:\/\//i.test(value)) ||
    value.startsWith('//') ||
    value.includes('\\')
  )
    return false;
  try {
    const url = new URL(value, 'https://local.invalid');
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}
function structuralGuard(nodes: Node[], selector: string): void {
  const custom = new Set([...baseCustom, selector]);
  for (const tag of ['head', 'body', selector, 'main', 'h1'])
    if (nodes.filter((n) => n.name === tag).length !== 1) fail();
  if (!nodes.some((n) => n.name === 'title') || !nodes.some((n) => n.name === 'a')) fail();
  for (const node of nodes) {
    const name = node.name!.toLowerCase();
    if (
      forbiddenTags.has(name) ||
      (name.includes('-') && !custom.has(name)) ||
      name.includes(':') ||
      name === 'svg' ||
      name === 'math' ||
      forbiddenRoles.has((attr(node, 'role') ?? '').toLowerCase())
    )
      fail();
    for (const a of node.attrs ?? [])
      if (/^on/i.test(a.name) || ['contenteditable', 'autofocus'].includes(a.name.toLowerCase()))
        fail();
    if (attr(node, 'jsaction') !== undefined && name !== 'a') fail();
    if (name === 'a' && !safeLink(attr(node, 'href'))) fail();
    if (name === 'meta' && attr(node, 'http-equiv') !== undefined) fail();
    if (name === 'base' && !/^\/(?!\/)[A-Za-z0-9_/-]*$/.test(attr(node, 'href') ?? '')) fail();
    if (
      attr(node, 'tabindex') !== undefined &&
      !(name === 'main' && attr(node, 'tabindex') === '-1')
    )
      fail();
  }
}
function dataScript(node: Node): boolean {
  return ['application/ld+json', 'application/json'].includes(attr(node, 'type') ?? '');
}
function scriptPreload(node: Node): boolean {
  return (
    node.name === 'link' &&
    ((attr(node, 'rel') ?? '')
      .toLowerCase()
      .split(/\s+/)
      .some((v) => ['modulepreload', 'prefetch', 'prerender'].includes(v)) ||
      attr(node, 'as')?.toLowerCase() === 'script')
  );
}
function marker(nodes: Node[], name: string): boolean {
  if (nodes.filter((n) => n.name === 'meta' && attr(n, 'name') === name).length > 1) fail();
  return nodes.some(
    (n) => n.name === 'meta' && attr(n, 'name') === name && attr(n, 'content') === '1',
  );
}
function hasMarker(nodes: Node[], name: string): boolean {
  return nodes.some((n) => n.name === 'meta' && attr(n, 'name') === name);
}
/** A marker alone is insufficient: no executable request or JS-only control is accepted. */
function assertStatic(html: string, contract: StaticContract): void {
  try {
    const nodes = elements(html);
    structuralGuard(nodes, contract.selector);
    if (!marker(nodes, contract.marker)) fail();
    if (STATIC_MARKERS.some((name) => name !== contract.marker && hasMarker(nodes, name))) fail();
    for (const node of nodes) {
      if (scriptPreload(node)) fail();
      if (node.name === 'script') {
        if (!dataScript(node) || attr(node, 'src') !== undefined) fail();
        JSON.parse(body(html, node));
      }
    }
  } catch {
    fail();
  }
}
export function assertStaticHome(html: string): void {
  assertStatic(html, homeContract);
}
export function assertStaticPage(html: string, selector: string): void {
  assertStatic(html, pageContract(selector));
}
function body(html: string, node: Node): string {
  if (!node.startSourceSpan || !node.endSourceSpan) fail();
  return html.slice(node.startSourceSpan.end.offset, node.endSourceSpan.start.offset);
}
/** Inline executable bytes also belong to a hydrated route's initial JS budget. */
export function inlineExecutableScripts(html: string): string[] {
  return elements(html)
    .filter((n) => n.name === 'script' && !dataScript(n) && attr(n, 'src') === undefined)
    .map((n) => body(html, n))
    .filter((s) => s.trim().length > 0);
}
function staticHtml(html: string, contract: StaticContract): string {
  try {
    // Angular's critical-CSS loader uses this one known handler. Make CSS native.
    if (!marker(elements(html), contract.marker)) {
      const escape = (value: string) =>
        value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
      const links = elements(html).filter(
        (n) =>
          n.name === 'link' &&
          attr(n, 'rel') === 'stylesheet' &&
          attr(n, 'media') === 'print' &&
          attr(n, 'onload') === "this.media='all'",
      );
      for (const link of links.sort(
        (a, b) => b.sourceSpan.start.offset - a.sourceSpan.start.offset,
      )) {
        const attrs = link
          .attrs!.filter((a) => a.name !== 'onload')
          .map((a) => `${a.name}="${escape(a.name === 'media' ? 'all' : a.value)}"`)
          .join(' ');
        html =
          html.slice(0, link.sourceSpan.start.offset) +
          `<link ${attrs}>` +
          html.slice(link.sourceSpan.end.offset);
      }
    }
    const nodes = elements(html);
    structuralGuard(nodes, contract.selector);
    if (marker(nodes, contract.marker)) {
      assertStatic(html, contract);
      return html;
    }
    const edits: { start: number; end: number; value: string }[] = [];
    let bootstraps = 0;
    const contracts = nodes.filter(
      (n) => n.name === 'script' && attr(n, 'id') === 'ng-event-dispatch-contract',
    );
    if (contracts.length > 1) fail();
    if (
      contracts.length &&
      (body(html, contracts[0]).trim() !==
        readFileSync(
          new URL(import.meta.resolve('@angular/core/event-dispatch-contract.min.js')),
          'utf8',
        ).trim() ||
        attr(contracts[0], 'src') !== undefined)
    )
      fail();
    let replayCalls = 0;
    for (const node of nodes) {
      let replacement: string | undefined;
      if (node.name === 'script') {
        if (dataScript(node)) {
          if (attr(node, 'src') !== undefined) fail();
          const data = JSON.parse(body(html, node));
          if (attr(node, 'type') === 'application/json') {
            const source = data['gd-content-source'];
            if (source) {
              if (
                !['fixture', 'api'].includes(source.source) ||
                typeof source.includeDrafts !== 'boolean'
              )
                fail();
              replacement = `<script id="ng-state" type="application/json">${JSON.stringify({ 'gd-content-source': { source: source.source, includeDrafts: source.includeDrafts } })}</script>`;
            } else replacement = '';
          }
        } else if (contracts.includes(node)) {
          replacement = '';
        } else if (
          contracts.length &&
          /^window\.__jsaction_bootstrap\(document\.body,"[A-Za-z0-9_-]+",\["click"\],\[\]\);$/.test(
            body(html, node).trim(),
          )
        ) {
          replayCalls++;
          replacement = '';
        } else {
          if (
            !/^[A-Za-z0-9_-]+\.js$/.test(attr(node, 'src') ?? '') ||
            body(html, node).trim() ||
            !['module', 'text/javascript', ''].includes(attr(node, 'type') ?? '')
          )
            fail();
          replacement = '';
          bootstraps++;
        }
      } else if (scriptPreload(node)) {
        if (!/^[A-Za-z0-9_-]+\.js$/.test(attr(node, 'href') ?? '')) fail();
        replacement = '';
      }
      if (replacement !== undefined)
        edits.push({
          start: node.sourceSpan.start.offset,
          end: node.sourceSpan.end.offset,
          value: replacement,
        });
    }
    if (!bootstraps) fail();
    if (contracts.length && replayCalls !== 1) fail();
    const head = nodes.find((n) => n.name === 'head')!;
    if (!head.endSourceSpan) fail();
    edits.push({
      start: head.endSourceSpan.start.offset,
      end: head.endSourceSpan.start.offset,
      value: `<meta name="${contract.marker}" content="1">`,
    });
    for (const edit of edits.sort((a, b) => b.start - a.start))
      html = html.slice(0, edit.start) + edit.value + html.slice(edit.end);
    assertStatic(html, contract);
    return html;
  } catch {
    fail();
  }
}
/** Transform a trusted Angular prerender only after enforcing the static Home contract. */
export function staticHomeHtml(html: string): string {
  return staticHtml(html, homeContract);
}
/** Transform a trusted Angular prerender of a content page (about, legal, author). */
export function staticPageHtml(html: string, selector: string): string {
  return staticHtml(html, pageContract(selector));
}
async function regular(path: string, kind: 'dir' | 'file'): Promise<void> {
  const stat = await lstat(path);
  if (stat.isSymbolicLink() || (kind === 'file' ? !stat.isFile() : !stat.isDirectory())) fail();
}
async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
      return false;
    fail();
  }
}
async function finalizeFile(
  output: string,
  segments: string[],
  transform: (html: string) => string,
): Promise<void> {
  const browser = resolve(output, 'browser'),
    file = join(browser, ...segments),
    dir = dirname(file),
    pending = join(dir, `.static-page-${randomUUID()}.tmp`);
  try {
    await regular(resolve(output), 'dir');
    await regular(browser, 'dir');
    let current = browser;
    for (const segment of segments.slice(0, -1)) {
      current = join(current, segment);
      await regular(current, 'dir');
    }
    await regular(file, 'file');
    const html = await readFile(file, 'utf8'),
      result = transform(html);
    if (result === html) return;
    await writeFile(pending, result, { flag: 'wx' });
    await rename(pending, file);
  } catch {
    fail();
  } finally {
    if (dirname(pending) !== dir) fail();
    await rm(pending, { force: true });
  }
}
interface StaticTarget {
  route: string;
  segments: string[];
  selector: string;
}
async function staticPageTargets(output: string): Promise<StaticTarget[]> {
  const browser = resolve(output, 'browser'),
    targets: StaticTarget[] = [];
  for (const [name, selector] of [
    ['acerca', 'gd-about-page'],
    ['legal', 'gd-legal-page'],
  ] as const)
    if (await exists(join(browser, name)))
      targets.push({ route: `/${name}`, segments: [name, 'index.html'], selector });
  const authors = join(browser, 'autores');
  if (await exists(authors)) {
    await regular(authors, 'dir');
    for (const entry of await readdir(authors, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) fail();
      if (entry.isDirectory())
        targets.push({
          route: `/autores/${entry.name}`,
          segments: ['autores', entry.name, 'index.html'],
          selector: 'gd-author-page',
        });
    }
  }
  return targets;
}
/** Transforms the home page (required) and each present content page; returns the processed routes. */
export async function finalizeStaticHome(output: string): Promise<string[]> {
  try {
    await finalizeFile(output, ['index.html'], staticHomeHtml);
    const targets = await staticPageTargets(output);
    for (const target of targets)
      await finalizeFile(output, target.segments, (html) => staticPageHtml(html, target.selector));
    return ['/', ...targets.map((target) => target.route)];
  } catch {
    fail();
  }
}
/** The release build must emit about, legal and at least one author page. */
export function assertCompleteStaticRoutes(routes: readonly string[]): void {
  if (
    !routes.includes('/') ||
    !routes.includes('/acerca') ||
    !routes.includes('/legal') ||
    !routes.some((route) => route.startsWith('/autores/'))
  )
    throw new Error('Faltan rutas estáticas obligatorias.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 2) fail();
    const routes = await finalizeStaticHome(resolve('dist/grim-dawn-builds'));
    assertCompleteStaticRoutes(routes);
    console.log(`static-home OK (HTML nativo, sin bootstrap cliente): ${routes.join(', ')}.`);
  } catch {
    console.error('static-home FALLÓ: comprobar contrato estático y output.');
    process.exitCode = 1;
  }
}
