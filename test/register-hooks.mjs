import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const mockSource = `
export const createPlanPreference = globalThis.__testCreatePlanPreference;
`;

register('./test/mock-loader.mjs', pathToFileURL('./'));
