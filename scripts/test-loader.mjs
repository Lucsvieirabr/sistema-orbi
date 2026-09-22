// Exercise the actual TypeScript modules without bundling or remote Deno imports.
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) specifier = new URL(`../src/${specifier.slice(2)}`, import.meta.url).href;
  try { return await nextResolve(specifier, context); }
  catch (error) {
    if (!specifier.startsWith('.') && !specifier.startsWith('file:')) throw error;
    const url = new URL(specifier, context.parentURL);
    for (const suffix of ['.ts', '.tsx', '/index.ts']) {
      const path = fileURLToPath(url) + suffix;
      try { await access(path); return { url: pathToFileURL(path).href, shortCircuit: true }; }
      catch { /* try the next supported extension */ }
    }
    throw error;
  }
}

export async function load(url, context, nextLoad) {
  if (!/\.tsx?$/.test(url)) return nextLoad(url, context);
  const source = await readFile(new URL(url), 'utf8');
  return {
    format: 'module', shortCircuit: true,
    source: ts.transpileModule(source, {
      fileName: fileURLToPath(url),
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText,
  };
}
