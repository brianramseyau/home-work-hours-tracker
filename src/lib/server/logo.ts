// The logo mark's PNG bytes, for the export's Summary title band. Isolated from `export.ts` so
// the workbook builder itself stays a pure function of its inputs (see AGENTS.md layering).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let cached: Buffer | null = null;

export function loadLogoBuffer(): Buffer {
	if (!cached) {
		cached = readFileSync(join(process.cwd(), 'static', 'brand', 'logo-mark-light.png'));
	}
	return cached;
}
