import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export type StateRecord = Record<string, unknown>;

/** A half-written or invalid state file must not break the entire dashboard. */
export function readStateRecords(directory: string, dateField: string): StateRecord[] {
  try {
    return readdirSync(directory, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
      .flatMap(entry => {
        try {
          const record: unknown = JSON.parse(readFileSync(join(directory, entry.name), 'utf8'));
          return record && typeof record === 'object' && !Array.isArray(record)
            ? [record as StateRecord]
            : [];
        } catch { return []; }
      })
      .sort((a, b) => recordTime(b[dateField]) - recordTime(a[dateField]));
  } catch { return []; }
}

function recordTime(value: unknown): number {
  if (typeof value !== 'string') return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

export function readGitBranch(projectDirectory: string): string {
  try {
    let gitDirectory = join(projectDirectory, '.git');
    if (statSync(gitDirectory).isFile()) {
      const match = /^gitdir:\s*(.+)\s*$/m.exec(readFileSync(gitDirectory, 'utf8'));
      if (!match) return 'unknown';
      gitDirectory = resolve(projectDirectory, match[1].trim());
    }
    const head = readFileSync(join(gitDirectory, 'HEAD'), 'utf8').trim();
    return head.startsWith('ref: refs/heads/') ? head.slice('ref: refs/heads/'.length) : head.slice(0, 8);
  } catch { return 'unknown'; }
}

export function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

/** Only dashboard state belongs in the snapshot; backups and captures can be large. */
export function snapshotState(directory: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const folder of ['', 'plans', 'changes', 'events']) {
    try {
      for (const entry of readdirSync(join(directory, folder), { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
        try {
          const stat = statSync(join(directory, folder, entry.name));
          result.set([folder, entry.name].filter(Boolean).join('/'), `${stat.mtimeMs}:${stat.size}`);
        } catch { /* File may have been renamed while scanning. */ }
      }
    } catch { /* State directories are optional and may be recreated. */ }
  }
  return result;
}
