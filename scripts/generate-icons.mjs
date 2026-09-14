// Rasterises the master logo SVGs into the favicon and PWA icon set (see
// foundational/DESIGN.md → Branding). Run with `npm run assets:generate`; outputs are committed.
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const INK = '#1D2640';
const LIGHT = '#E6EAF2';
const PAPER = '#F4F6FA';

const root = new URL('../', import.meta.url);
const path = (p) => new URL(p, root);

/**
 * Pins the master's currentColor to `color` and drops <style> blocks (the favicon's
 * dark-scheme media query), which librsvg would otherwise misapply.
 */
function tinted(svg, color) {
	const pinned = svg
		.replace(/<style[\s\S]*?<\/style>/g, '')
		.replace(/(<svg\b[^>]*?)\scolor="[^"]*"/, `$1 color="${color}"`);
	return Buffer.from(pinned);
}

/** Renders `svg` to a `size`px square PNG, artwork scaled to `scale` and centred on `background`. */
async function png(svg, size, { background, scale = 1 } = {}) {
	const inner = Math.round(size * scale);
	const art = await sharp(svg, { density: Math.max(72, (72 * inner * 2) / 32) })
		.resize(inner, inner)
		.png()
		.toBuffer();
	const offset = Math.floor((size - inner) / 2);
	return sharp({
		create: {
			width: size,
			height: size,
			channels: 4,
			background: background ?? { r: 0, g: 0, b: 0, alpha: 0 }
		}
	})
		.composite([{ input: art, left: offset, top: offset }])
		.png()
		.toBuffer();
}

/** Minimal ICO container holding PNG-encoded images (supported by every current browser). */
function ico(images) {
	const header = Buffer.alloc(6);
	header.writeUInt16LE(0, 0);
	header.writeUInt16LE(1, 2);
	header.writeUInt16LE(images.length, 4);
	const directory = Buffer.alloc(16 * images.length);
	let offset = header.length + directory.length;
	images.forEach(({ size, data }, i) => {
		const at = i * 16;
		directory.writeUInt8(size >= 256 ? 0 : size, at);
		directory.writeUInt8(size >= 256 ? 0 : size, at + 1);
		directory.writeUInt16LE(1, at + 4);
		directory.writeUInt16LE(32, at + 6);
		directory.writeUInt32LE(data.length, at + 8);
		directory.writeUInt32LE(offset, at + 12);
		offset += data.length;
	});
	return Buffer.concat([header, directory, ...images.map((image) => image.data)]);
}

async function write(relative, data) {
	await writeFile(path(relative), data);
	console.log(`wrote ${relative}`);
}

async function main() {
	const mark = await readFile(path('src/lib/assets/logo-mark.svg'), 'utf8');
	const glyph = await readFile(path('src/lib/assets/favicon-glyph.svg'), 'utf8');
	await mkdir(path('static/icons'), { recursive: true });

	// Tab icon: the SVG keeps its dark-scheme style; the ICO is the fallback.
	await copyFile(path('src/lib/assets/favicon-glyph.svg'), path('static/favicon.svg'));
	console.log('wrote static/favicon.svg');
	const glyphInk = tinted(glyph, INK);
	await write(
		'static/favicon.ico',
		ico(
			await Promise.all(
				[16, 32, 48].map(async (size) => ({ size, data: await png(glyphInk, size) }))
			)
		)
	);

	const markInk = tinted(mark, INK);
	const markLight = tinted(mark, LIGHT);
	await write(
		'static/apple-touch-icon.png',
		await png(markInk, 180, { background: PAPER, scale: 0.78 })
	);
	for (const size of [192, 512]) {
		await write(
			`static/icons/icon-${size}.png`,
			await png(markInk, size, { background: PAPER, scale: 0.8 })
		);
		// Maskable: platforms may crop to a circle, so keep the art inside the central ~60%.
		await write(
			`static/icons/icon-maskable-${size}.png`,
			await png(markLight, size, { background: INK, scale: 0.6 })
		);
	}
	// Transparent mark for the xlsx export's title band (placed on the ink band, so light).
	// Lives under src/lib/assets, not static/, so the exporter can bundle it at build time via
	// a Vite `?inline` import instead of reading a source-tree path at server runtime — a path
	// like `static/...` isn't guaranteed to exist relative to the process cwd once deployed.
	await write('src/lib/assets/logo-mark-light.png', await png(markLight, 256));
}

main();
