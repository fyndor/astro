import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadFixture as baseLoadFixture } from '../../../astro/test/test-utils.js';

export { fixLineEndings } from '../../../astro/test/test-utils.js';

/**
 * @typedef {{ ready: Promise<void>, stop: Promise<void> }} WranglerCLI
 * @typedef {import('../../../astro/test/test-utils').Fixture} Fixture
 */

export function loadFixture(config) {
	if (config?.root) {
		config.root = new URL(config.root, import.meta.url);
	}
	return baseLoadFixture(config);
}

const wranglerPath = fileURLToPath(
	new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url)
);

/**
 * @returns {WranglerCLI}
 */
export function runCLI(basePath, { silent, port = 8787 }) {
	const script = fileURLToPath(new URL(`${basePath}/dist/_worker.js`, import.meta.url));
	const p = spawn('node', [wranglerPath, 'dev', '-l', script, '--port', port]);

	p.stderr.setEncoding('utf-8');
	p.stdout.setEncoding('utf-8');

	const timeout = 10000;

	const ready = new Promise(async (resolve, reject) => {
		const failed = setTimeout(
			() => reject(new Error(`Timed out starting the wrangler CLI`)),
			timeout
		);

		(async function () {
			for (const msg of p.stderr) {
				if (!silent) {
					console.error(msg);
				}
			}
		})();

		for await (const msg of p.stdout) {
			if (!silent) {
				console.log(msg);
			}
			if (msg.includes(`Listening on`)) {
				break;
			}
		}

		clearTimeout(failed);
		resolve();
	});

	return {
		ready,
		stop() {
			return new Promise((resolve, reject) => {
				p.on('close', () => resolve());
				p.on('error', (err) => reject(err));
				p.kill();
			});
		},
	};
}
