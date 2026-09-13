// Deletes the throwaway E2E database so every Playwright run starts from an empty,
// freshly migrated schema (migrations run on server boot).
import { rmSync } from 'node:fs';

for (const suffix of ['', '-wal', '-shm', '-journal']) {
	rmSync(`data/e2e.db${suffix}`, { force: true });
}
