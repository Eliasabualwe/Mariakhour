/* Souriana Hero Shelf — curved, draggable, auto-scrolling product row. Vanilla JS, no dependencies. */
(function () {
	'use strict';

	var root = document.getElementById('shs');
	if (!root) { return; }

	// Fallback placement: move the section right under the site header.
	if (root.getAttribute('data-move') === '1') {
		var wrap = document.querySelector('.main-page-wrapper');
		if (wrap) {
			wrap.insertBefore(root, wrap.firstChild);
		} else {
			var hdr = document.querySelector('header');
			if (hdr && hdr.parentNode) { hdr.parentNode.insertBefore(root, hdr.nextSibling); }
		}
		root.style.display = '';
		var aislesEl = document.getElementById('sha');
		if (aislesEl && root.parentNode) { root.parentNode.insertBefore(aislesEl, root.nextSibling); }
	}

	// Homepage order: 1) the first banner (egg slider), 2) categories, 3) product shelf.
	// The banner section is moved (not edited) into a wrapper that keeps Elementor's classes,
	// so its own styles and the slider keep working.
	(function reorder() {
		var parent = root.parentNode;
		var banner = document.querySelector('.elementor .elementor-element-636f584');
		if (!parent || !banner) { return; }
		var holder = document.createElement('div');
		holder.className = 'elementor elementor-1146 shs-banner-top';
		holder.appendChild(banner);
		parent.insertBefore(holder, root);
		var aisles = document.getElementById('sha');
		if (aisles) { parent.insertBefore(aisles, root); }
	})();

	var row = root.querySelector('.shs-row');
	var cards = Array.prototype.slice.call(row.querySelectorAll('.shs-card'));
	if (!cards.length) { return; }
	var inners = cards.map(function (c) { return c.querySelector('.shs-in'); });

	var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	// ---- geometry constants (frame units) ----
	var C = 720, D = 706, PITCH = 196, CY = 607;
	var N = cards.length, L = N * PITCH;
	var AUTO = reduce ? 0 : 50;            // u per second, right -> left
	var DECAY = 0.05;                      // velocity keeps 5% after one second (decays ~95%/s)

	var k = 1, ox = 0, oy = 0, rowW = 0, mobile = false;

	function layout() {
		var W = root.clientWidth || window.innerWidth;
		mobile = W <= 820;
		if (mobile) {
			rowW = row.clientWidth || W;
			k = rowW / 640;
			ox = rowW / 2 - C * k;
			oy = 125 - CY * k;              // centre of the 250px band
		} else {
			var u = Math.min(W / 1440, window.innerHeight / 960);
			root.style.setProperty('--u', u + 'px');
			k = u;
			ox = 0;
			oy = 0;
			rowW = 1440 * u;
		}
		row.style.setProperty('--k', k + 'px');
		// Lets the CSS move Woodmart's open category list below the hero.
		setMenuShift();
	}

	// Woodmart's open category list should start where our sections end (beside the first banner).
	function setMenuShift() {
		var hdrEl = document.querySelector('.whb-header');
		var last = document.getElementById('sha') || root;
		var shift = 0;
		if (hdrEl) {
			shift = last.getBoundingClientRect().bottom - hdrEl.getBoundingClientRect().bottom;
		}
		if (!(shift > 0)) { shift = root.offsetHeight; }
		document.documentElement.style.setProperty('--shs-h', Math.round(shift) + 'px');
	}
	window.addEventListener('load', setMenuShift);
	if (document.fonts && document.fonts.ready) { document.fonts.ready.then(setMenuShift); }

	function f(n) { return Math.round(n * 10) / 10; }

	// Rounded polygon path (quadratic corners).
	function roundedPath(p, r) {
		var n = p.length, s = '';
		for (var i = 0; i < n; i++) {
			var a = p[(i + n - 1) % n], b = p[i], c = p[(i + 1) % n];
			var v1x = a[0] - b[0], v1y = a[1] - b[1], v2x = c[0] - b[0], v2y = c[1] - b[1];
			var l1 = Math.sqrt(v1x * v1x + v1y * v1y) || 1, l2 = Math.sqrt(v2x * v2x + v2y * v2y) || 1;
			var rr = Math.min(r, l1 / 2, l2 / 2);
			var p1x = b[0] + v1x / l1 * rr, p1y = b[1] + v1y / l1 * rr;
			var p2x = b[0] + v2x / l2 * rr, p2y = b[1] + v2y / l2 * rr;
			s += (i ? 'L' : 'M') + f(p1x) + ' ' + f(p1y) + 'Q' + f(b[0]) + ' ' + f(b[1]) + ' ' + f(p2x) + ' ' + f(p2y);
		}
		return s + 'Z';
	}

	var s = 0;          // scroll offset in frame units (grows -> cards move left)
	var vel = 0;        // extra velocity from flinging, u/s

	function render() {
		var half = L / 2;
		for (var i = 0; i < N; i++) {
			var t = i * PITCH - s;
			t = ((t + half) % L + L) % L - half;
			var x = C + t * (1 + 0.083 * Math.pow(t / D, 2));
			var d = Math.abs(x - C) / D;
			var w = 170 + 48 * d * d;
			var xl = x - w / 2, xr = x + w / 2;

			var leftPx = ox + xl * k, wPx = w * k;
			var el = cards[i];
			if (leftPx > rowW + 4 || leftPx + wPx < -4) {
				if (el.style.visibility !== 'hidden') { el.style.visibility = 'hidden'; }
				continue;
			}

			var qL = Math.abs(xl - C) / D, qR = Math.abs(xr - C) / D;
			var hL = 280 + 92 * Math.pow(qL, 2.6), hR = 280 + 92 * Math.pow(qR, 2.6);
			var cy = CY - 12 * d * d;
			var H = Math.max(hL, hR);

			var topPx = oy + (cy - H / 2) * k, hPx = H * k;
			var yTL = (H - hL) / 2 * k, yTR = (H - hR) / 2 * k;
			var yBL = (H + hL) / 2 * k, yBR = (H + hR) / 2 * k;

			el.style.visibility = 'visible';
			el.style.width = f(wPx) + 'px';
			el.style.height = f(hPx) + 'px';
			el.style.transform = 'translate3d(' + f(leftPx) + 'px,' + f(topPx) + 'px,0)';
			var path = 'path("' + roundedPath([[0, yTL], [wPx, yTR], [wPx, yBR], [0, yBL]], 15 * k) + '")';
			el.style.clipPath = path;
			el.style.webkitClipPath = path;

			var inn = inners[i];
			inn.style.top = f(Math.max(yTL, yTR)) + 'px';
			inn.style.bottom = f(hPx - Math.min(yBL, yBR)) + 'px';
		}
	}

	// ---- time source: one long-running Web Animations clock ----
	var clock = null;
	try { clock = document.documentElement.animate([], { duration: 1e9 }); } catch (e) { clock = null; }
	function now() {
		if (clock && clock.currentTime != null) { return clock.currentTime / 1000; }
		return (window.performance ? performance.now() : Date.now()) / 1000;
	}

	// ---- dragging ----
	var dragging = false, pid = null, lastX = 0, lastT = 0, moved = 0, dragVel = 0;

	row.addEventListener('pointerdown', function (e) {
		if (e.button !== undefined && e.button !== 0) { return; }
		dragging = true;
		pid = e.pointerId;
		lastX = e.clientX;
		lastT = now();
		moved = 0;
		dragVel = 0;
		vel = 0;
		row.classList.add('is-dragging');
		// Pointer capture waits for a real drag, so a plain click still opens the product.
	});

	row.addEventListener('pointermove', function (e) {
		if (!dragging || e.pointerId !== pid) { return; }
		var dx = e.clientX - lastX;
		var tNow = now();
		var dt = Math.max(tNow - lastT, 0.001);
		lastX = e.clientX;
		lastT = tNow;
		moved += Math.abs(dx);
		if (moved > 6 && !row.hasPointerCapture(pid)) { try { row.setPointerCapture(pid); } catch (err) { /* ignore */ } }
		var du = dx / k;
		s -= du;                                   // follow the pointer 1:1
		var inst = -du / dt;
		dragVel = dragVel * 0.6 + inst * 0.4;      // smoothed release velocity
	});

	function endDrag(e) {
		if (!dragging || (e && e.pointerId !== pid)) { return; }
		dragging = false;
		row.classList.remove('is-dragging');
		try { row.releasePointerCapture(pid); } catch (err) { /* ignore */ }
		if (now() - lastT > 0.08) { dragVel = 0; }   // held still before release
		vel = Math.max(-4000, Math.min(4000, dragVel - AUTO));
	}
	row.addEventListener('pointerup', endDrag);
	row.addEventListener('pointercancel', endDrag);
	window.addEventListener('pointerup', endDrag);      // release outside the carousel
	window.addEventListener('pointercancel', endDrag);
	row.addEventListener('lostpointercapture', function () { if (dragging) { endDrag(null); } });

	// A drag must not open the product; a clean tap/click still does.
	row.addEventListener('click', function (e) {
		if (moved > 6) { e.preventDefault(); e.stopPropagation(); }
	}, true);
	row.addEventListener('dragstart', function (e) { e.preventDefault(); });

	// ---- images fade in when ready ----
	cards.forEach(function (c) {
		var img = c.querySelector('img');
		if (!img) { return; }
		var ready = function () { img.classList.add('is-ready'); };
		if (img.complete && img.naturalWidth) { ready(); } else {
			img.addEventListener('load', ready);
			img.addEventListener('error', ready);
		}
	});

	// ---- main loop (paused while the hero is off-screen) ----
	var visible = true, last = now(), raf = 0;
	function tick() {
		raf = 0;
		var t = now();
		var dt = Math.min(Math.max(t - last, 0), 0.05);
		last = t;
		if (!dragging) {
			vel *= Math.pow(DECAY, dt);
			if (Math.abs(vel) < 0.5) { vel = 0; }
			s += (AUTO + vel) * dt;
		}
		render();
		if (visible) { raf = requestAnimationFrame(tick); }
	}
	if ('IntersectionObserver' in window) {
		new IntersectionObserver(function (entries) {
			visible = entries[0].isIntersecting;
			if (visible && !raf) { last = now(); raf = requestAnimationFrame(tick); }
		}).observe(root);
	}

	var rz = 0;
	window.addEventListener('resize', function () {
		cancelAnimationFrame(rz);
		rz = requestAnimationFrame(function () { layout(); render(); });
	});

	layout();
	render();
	raf = requestAnimationFrame(tick);

	// ---- first homepage banner: fill the full content width (desktop only) ----
	// CSS removes the space Elementor reserved for the old category list. The slider keeps its
	// picture at its designed size, so the whole slider is scaled up evenly until the picture
	// spans the section. Nothing inside the slider is edited. Phones are left untouched.
	(function fitBanner() {
		var widget = document.querySelector('.elementor-element-636f584 .elementor-widget-slider_revolution');
		if (!widget) { return; }
		var inner = widget.firstElementChild;
		var mod = widget.querySelector('sr7-module, rs-module');
		if (!inner || !mod) { return; }
		var gridW = 0, applied = '';

		function measureGrid() {
			// Widest picture layer in ANY slide, at its designed (unscaled) size. Layers of slides
			// that are not on screen have no layout, so their inline width is read as well.
			var layers = mod.querySelectorAll('sr7-img, rs-img');
			for (var i = 0; i < layers.length; i++) {
				var w = Math.max(layers[i].offsetWidth, parseFloat(layers[i].style.width) || 0);
				if (w > gridW && w < 3000) { gridW = w; }
			}
		}

		function reset() {
			inner.style.transform = '';
			widget.style.height = '';
			widget.classList.remove('shs-fit-wrap');
			applied = '';
		}

		// One scale for every slide, so the banner keeps the same size when it changes slide.
		function apply() {
			if (window.innerWidth <= 820) { reset(); return; }
			measureGrid();
			var W = widget.offsetWidth, H = mod.offsetHeight;
			if (!gridW || !H) { return; }
			var s = W / gridW;
			if (!(s > 1.01 && s < 3)) { reset(); return; }
			var key = s.toFixed(4) + '|' + H;
			if (key === applied) { return; }
			applied = key;
			widget.classList.add('shs-fit-wrap');
			inner.style.transformOrigin = '50% 0';
			inner.style.transform = 'scale(' + s.toFixed(4) + ')';
			widget.style.height = Math.round(H * s) + 'px';
		}

		var t = 0;
		function later() { clearTimeout(t); t = setTimeout(apply, 120); }
		window.addEventListener('resize', function () { gridW = 0; applied = ''; inner.style.transform = ''; later(); });
		window.addEventListener('load', later);
		// The slider builds its layers late (when it scrolls into view) and swaps slides: re-check
		// on every change. Once the scale is set, re-checks change nothing.
		if (window.MutationObserver) {
			new MutationObserver(later).observe(mod, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-current'] });
		}
		var tries = 0;
		var poll = setInterval(function () {
			apply();
			if (applied || ++tries > 90) { clearInterval(poll); }
		}, 700);
	})();

	// ---- one-time entrance ----
	if (reduce || !root.animate) { return; }
	var ease = 'cubic-bezier(.2,.8,.2,1)';
	function play(sel, frames, delay, dur) {
		var list = root.querySelectorAll(sel);
		Array.prototype.forEach.call(list, function (el, i) {
			el.animate(frames, { duration: dur || 800, delay: delay + i * 90, easing: ease, fill: 'backwards' });
		});
	}
	var badgeT = mobile ? 'none' : 'translateX(-50%)';
	play('.shs-badge', [
		{ opacity: 0, transform: badgeT + ' scale(.7)' },
		{ opacity: 1, transform: badgeT + ' scale(1)' }
	], 100, 600);
	play('.shs-h1 span', [
		{ opacity: 0, transform: 'translateY(36px)', filter: 'blur(14px)' },
		{ opacity: 1, transform: 'none', filter: 'blur(0)' }
	], 260, 950);
	play('.shs-sub', [
		{ opacity: 0, transform: 'translateY(18px)' },
		{ opacity: 1, transform: 'none' }
	], 560, 800);
	play('.shs-row', [
		{ opacity: 0, transform: 'translateY(70px)' },
		{ opacity: 1, transform: 'none' }
	], 700, 1100);
	play('.shs-cta', [
		{ opacity: 0, transform: 'scale(.6)' },
		{ opacity: 1, transform: 'scale(1)' }
	], 1050, 650);
	play('.shs-draw', [
		{ strokeDashoffset: 1 },
		{ strokeDashoffset: 0 }
	], 1300, 900);
	var noteA = root.querySelector('.shs-note-a'), noteB = root.querySelector('.shs-note-b');
	if (noteA) { noteA.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 1250, fill: 'backwards' }); }
	if (noteB) { noteB.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 1450, fill: 'backwards' }); }
})();
