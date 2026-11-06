/**
 * @file Integration test: execute D1 migrations with real SQLite
 * Validates SQL syntax, column presence, and binding compatibility
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

test('D1 migrations execute successfully with SQLite and match service bindings', async () => {
  const result = await new Promise((resolve, reject) => {
    const proc = spawn('python3', [join(__dirname, 'sqlite-runner.py')], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script exited with code ${code}\nstderr: ${stderr}\nstdout: ${stdout}`));
      } else {
        resolve({ stdout, stderr });
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn python3: ${err.message}`));
    });
  });

  const output = JSON.parse(result.stdout.trim());
  
  assert.ok(output.success, `SQLite migration failed: ${output.error || 'unknown'}`);
  
  // Verify exact 13 columns (no manage_token_encrypted)
  const expectedColumns = [
    'id', 'wedding_key', 'guest_name', 'attending',
    'adults_count', 'children_count', 'observations',
    'consent_given', 'manage_token_hash', 'created_at', 'updated_at',
    'idempotency_key', 'idempotency_fingerprint'
  ];
  
  assert.deepStrictEqual(
    output.columns,
    expectedColumns,
    'Migration columns must match service INSERT statement exactly'
  );
  
  assert.strictEqual(output.row_count, 1, 'INSERT with 13 bindings must succeed');
});
