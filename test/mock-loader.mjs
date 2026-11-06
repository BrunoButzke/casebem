export async function resolve(specifier, context, nextResolve) {
  if (specifier.includes('_lib/mercadopago.mjs')) {
    return {
      url: new URL('../functions/_lib/mercadopago.mjs', import.meta.url).href + '?mocked',
      shortCircuit: true
    };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.includes('mercadopago.mjs?mocked')) {
    return {
      format: 'module',
      shortCircuit: true,
      source: 'export const createPlanPreference = globalThis.__testCreatePlanPreference;'
    };
  }
  return nextLoad(url, context);
}
