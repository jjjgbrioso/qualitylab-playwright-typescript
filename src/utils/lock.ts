import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * A lock shared by every Playwright worker process on this machine.
 *
 * The tests share one customer on a live site. That customer has one cart and one set of bank
 * balances, so two tests (for example Chromium and WebKit running at the same moment) must not
 * change them at the same time. A test holds a named lock for as long as it touches that state;
 * other tests that need the same lock wait. Everything else still runs in parallel.
 *
 * Creating a directory is atomic, so the first worker to create it holds the lock. A lock left
 * behind by a crashed worker is removed once its process is gone or it is older than STALE_MS.
 * Locks only cover one machine. Sharded CI runs on several machines should not share a customer.
 */

const LOCK_ROOT = path.join(os.tmpdir(), 'qualitylab-playwright-locks');
const POLL_MS = 250;
const STALE_MS = 5 * 60_000;

interface Owner {
  pid: number;
  since: number;
  holder: string;
}

export interface HeldLock {
  name: string;
  waitedMs: number;
  release(): void;
}

function lockPath(name: string): string {
  return path.join(LOCK_ROOT, name.replace(/[^a-zA-Z0-9_-]/g, '_'));
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but belongs to someone else.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function readOwner(dir: string): Owner | undefined {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'owner.json'), 'utf8')) as Owner;
  } catch {
    return undefined;
  }
}

function removeIfStale(dir: string): void {
  let owner = readOwner(dir);
  if (!owner) {
    // The owner file is written right after the directory. Give the owner a moment before
    // treating the lock as abandoned.
    const created = fs.statSync(dir, { throwIfNoEntry: false })?.birthtimeMs ?? Date.now();
    if (Date.now() - created < 5_000) return;
    owner = { pid: -1, since: created, holder: 'unknown' };
  }
  const abandoned = owner.pid > 0 ? !processIsAlive(owner.pid) : true;
  if (abandoned || Date.now() - owner.since > STALE_MS) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export async function acquireLock(name: string, holder: string, timeoutMs: number): Promise<HeldLock> {
  fs.mkdirSync(LOCK_ROOT, { recursive: true });
  const dir = lockPath(name);
  const started = Date.now();

  for (;;) {
    try {
      fs.mkdirSync(dir);
      const owner: Owner = { pid: process.pid, since: Date.now(), holder };
      fs.writeFileSync(path.join(dir, 'owner.json'), JSON.stringify(owner));
      let released = false;
      return {
        name,
        waitedMs: Date.now() - started,
        release() {
          if (released) return;
          released = true;
          fs.rmSync(dir, { recursive: true, force: true });
        },
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }

    removeIfStale(dir);
    if (Date.now() - started > timeoutMs) {
      const owner = readOwner(dir);
      throw new Error(`Waited ${Math.round(timeoutMs / 1000)}s for the "${name}" lock, held by ${owner?.holder ?? 'another test'}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}
