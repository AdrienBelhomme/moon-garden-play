// Filled by tools/export_web.py. One immutable cache per exported build.
const CACHE_PREFIX = 'Moon Garden-sw-cache-';
const CACHE_NAME = CACHE_PREFIX + "5ec36d88c4cdbbfc43bf";
const SHELL_FILES = ["index.144x144.png", "index.180x180.png", "index.512x512.png", "index.apple-touch-icon.png", "index.audio.position.worklet.js", "index.audio.worklet.js", "index.html", "index.icon.png", "index.js", "index.manifest.json", "index.offline.html", "index.png"];
const GAME_FILES = ['index.wasm', 'index.pck'];
const FILES = new Set([...SHELL_FILES, ...GAME_FILES]);
const BASE = new URL('./', self.location.href);

self.addEventListener('install', event => {
	// Large files are cached from the game's own requests, never downloaded twice.
	// Updates wait until existing game windows close, keeping builds consistent.
	event.waitUntil(caches.open(CACHE_NAME).then(cache =>
		cache.addAll(SHELL_FILES.map(file => new Request(new URL(file, BASE), {cache: 'reload'})))));
});

self.addEventListener('activate', event => {
	event.waitUntil((async () => {
		const keys = await caches.keys();
		await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
			.map(key => caches.delete(key)));
		// On first install, control the current page before it requests the game.
		await self.clients.claim();
	})());
});

self.addEventListener('fetch', event => {
	const url = new URL(event.request.url);
	if (event.request.method !== 'GET' || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
	let file = url.pathname.slice(BASE.pathname.length);
	if (file === '') file = 'index.html';
	if (!FILES.has(file)) return;

	const key = new URL(file, BASE).href;
	let cacheWrite = Promise.resolve();
	const response = (async () => {
		const cache = await caches.open(CACHE_NAME).catch(() => null);
		const cached = cache && await cache.match(key);
		if (cached) return cached;
		try {
			const result = await fetch(event.request);
			if (result.ok && cache) {
				// Keep the worker alive until disk writes finish, but stream to the
				// engine immediately. Storage denial must not prevent online play.
				cacheWrite = cache.put(key, result.clone()).catch(error =>
					console.warn('Moon Garden could not save an offline copy:', error));
			}
			return result;
		} catch (error) {
			if (event.request.mode === 'navigate' && cache) {
				const offline = await cache.match(new URL('index.offline.html', BASE).href);
				if (offline) return offline;
			}
			throw error;
		}
	})();
	event.respondWith(response);
	event.waitUntil(response.then(() => cacheWrite).catch(() => {}));
});
