/* Souriana Aisles — category carousel: steps card by card, drag/flick, arrows, chips, keyboard. */
(function () {
	'use strict';

	var root = document.getElementById('sha');
	if (!root) { return; }

	var stage = root.querySelector('.sha-stage');
	var cards = Array.prototype.slice.call(stage.querySelectorAll('.sha-card'));
	var chips = Array.prototype.slice.call(root.querySelectorAll('.sha-chip'));
	var chipBox = root.querySelector('.sha-chips');
	var countEl = root.querySelector('.sha-count b');
	var bar = root.querySelector('.sha-bar i');
	var N = cards.length;
	if (!N) { return; }

	var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	var GAP = 22, STEP_MS = 3200;

	var widths = [], centers = [], T = 0;
	function measure() {
		var gap = window.innerWidth <= 820 ? 14 : GAP;
		T = 0;
		for (var i = 0; i < N; i++) {
			widths[i] = cards[i].offsetWidth || 220;
			centers[i] = T + widths[i] / 2;
			T += widths[i] + gap;
		}
	}
	function wrap(x) { return ((x + T / 2) % T + T) % T - T / 2; }

	var o = 0, target = 0, active = 0, dragging = false;

	function render() {
		var W = stage.clientWidth, half = W / 2;
		var pitch = T / N;
		var best = 0, bestD = Infinity;
		for (var i = 0; i < N; i++) {
			var x = wrap(centers[i] - o);
			var ax = Math.abs(x);
			if (ax < bestD) { bestD = ax; best = i; }
			var el = cards[i];
			var left = half + x - widths[i] / 2;
			if (left > W + 40 || left + widths[i] < -40) {
				if (el.style.visibility !== 'hidden') { el.style.visibility = 'hidden'; }
				continue;
			}
			var d = Math.min(ax / pitch, 2.2);
			var sc = 1.06 - 0.09 * Math.min(d, 1.4);
			var op = 1 - 0.22 * Math.min(d, 2.2) / 2.2;
			var lift = Math.max(0, 1 - d) * -8;
			el.style.visibility = 'visible';
			el.style.opacity = op.toFixed(3);
			el.style.transform = 'translate3d(' + left.toFixed(1) + 'px,' + lift.toFixed(1) + 'px,0) scale(' + sc.toFixed(3) + ')';
			el.style.zIndex = String(100 - Math.round(d * 10));
		}
		if (best !== active) { setActive(best); }
	}

	function setActive(i) {
		if (cards[active]) { cards[active].classList.remove('is-active'); }
		if (chips[active]) { chips[active].classList.remove('is-active'); }
		active = i;
		cards[i].classList.add('is-active');
		if (chips[i]) {
			chips[i].classList.add('is-active');
			var c = chips[i];
			var want = c.offsetLeft - (chipBox.clientWidth - c.offsetWidth) / 2;
			chipBox.scrollTo ? chipBox.scrollTo({ left: want, behavior: reduce ? 'auto' : 'smooth' }) : (chipBox.scrollLeft = want);
		}
		if (countEl) { countEl.textContent = (i + 1 < 10 ? '0' : '') + (i + 1); }
	}

	function goTo(i) {
		i = ((i % N) + N) % N;
		target = o + wrap(centers[i] - o);
		restartTimer();
	}
	function nearestTo(pos) {
		var best = 0, bestD = Infinity;
		for (var i = 0; i < N; i++) {
			var d = Math.abs(wrap(centers[i] - pos));
			if (d < bestD) { bestD = d; best = i; }
		}
		return best;
	}

	// ---- auto-advance with a progress bar ----
	var timerStart = 0, paused = false, visible = true;
	function restartTimer() { timerStart = performance.now(); }
	function tickTimer(now) {
		if (reduce || paused || dragging || !visible) { timerStart = now - (bar ? (parseFloat(bar.dataset.p || 0) * STEP_MS) : 0); return; }
		var p = (now - timerStart) / STEP_MS;
		if (bar) { bar.style.transform = 'scaleX(' + Math.min(p, 1).toFixed(3) + ')'; bar.dataset.p = Math.min(p, 1); }
		if (p >= 1) { goTo(active + 1); }
	}

	// ---- pointer: drag + flick + tap-to-select ----
	var pid = null, lastX = 0, lastT = 0, moved = 0, vel = 0;
	stage.addEventListener('pointerdown', function (e) {
		if (e.button !== undefined && e.button !== 0) { return; }
		dragging = true; pid = e.pointerId; lastX = e.clientX; lastT = performance.now(); moved = 0; vel = 0;
		target = o;
		stage.classList.add('is-dragging');
		// Pointer capture waits for a real drag, so a plain click still opens the link.
	});
	stage.addEventListener('pointermove', function (e) {
		if (!dragging || e.pointerId !== pid) { return; }
		var now = performance.now(), dx = e.clientX - lastX, dt = Math.max(now - lastT, 1);
		lastX = e.clientX; lastT = now; moved += Math.abs(dx);
		if (moved > 6 && !stage.hasPointerCapture(pid)) { try { stage.setPointerCapture(pid); } catch (err) { /* ignore */ } }
		o -= dx; target = o;
		vel = vel * 0.6 + (-dx / dt) * 0.4;     // px per ms
	});
	function endDrag(e) {
		if (!dragging || (e && e.pointerId !== pid)) { return; }
		dragging = false;
		stage.classList.remove('is-dragging');
		try { stage.releasePointerCapture(pid); } catch (err) { /* ignore */ }
		if (performance.now() - lastT > 90) { vel = 0; }
		vel = Math.max(-2.2, Math.min(2.2, vel)); // px/ms, so a flick moves at most ~2 cards
		var projected = o + vel * 240;
		goTo(nearestTo(projected));
	}
	stage.addEventListener('pointerup', endDrag);
	stage.addEventListener('pointercancel', endDrag);
	window.addEventListener('pointerup', endDrag);      // release outside the carousel
	window.addEventListener('pointercancel', endDrag);
	stage.addEventListener('lostpointercapture', function () { if (dragging) { endDrag(null); } });

	// Tap a side card = bring it to the centre. Tap the centre card = open the category.
	stage.addEventListener('click', function (e) {
		var card = e.target.closest ? e.target.closest('.sha-card') : null;
		if (moved > 6) { e.preventDefault(); return; }
		if (card && !card.classList.contains('is-active')) {
			e.preventDefault();
			goTo(cards.indexOf(card));
		}
	}, true);
	stage.addEventListener('dragstart', function (e) { e.preventDefault(); });

	// ---- arrows, chips, keyboard, hover pause ----
	var prev = root.querySelector('.sha-prev'), next = root.querySelector('.sha-next');
	if (prev) { prev.addEventListener('click', function () { goTo(active - 1); }); }
	if (next) { next.addEventListener('click', function () { goTo(active + 1); }); }
	chips.forEach(function (c, i) { c.addEventListener('click', function () { goTo(i); }); });
	stage.addEventListener('keydown', function (e) {
		if (e.key === 'ArrowRight') { e.preventDefault(); goTo(active + 1); }
		if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(active - 1); }
	});
	root.addEventListener('mouseenter', function () { paused = true; });
	root.addEventListener('mouseleave', function () { paused = false; restartTimer(); });

	// ---- loop ----
	var raf = 0, last = performance.now();
	function loop(now) {
		raf = 0;
		var dt = Math.min(now - last, 50) / 1000; last = now;
		if (!dragging) {
			var k = reduce ? 1 : 1 - Math.exp(-dt * 9);   // smooth spring-like glide
			o += (target - o) * k;
			if (Math.abs(target - o) < 0.3) { o = target; }
		}
		render();
		tickTimer(now);
		if (visible) { raf = requestAnimationFrame(loop); }
	}
	if ('IntersectionObserver' in window) {
		new IntersectionObserver(function (en) {
			visible = en[0].isIntersecting;
			if (visible && !raf) { last = performance.now(); restartTimer(); raf = requestAnimationFrame(loop); }
		}).observe(root);
	}
	window.addEventListener('resize', function () {
		measure();
		target = o + wrap(centers[active] - o);
	});

	measure();
	o = target = centers[0];
	setActive(0);
	render();
	restartTimer();
	raf = requestAnimationFrame(loop);

	// ---- entrance: cards rise in one after another when first seen ----
	if (!reduce && root.animate && 'IntersectionObserver' in window) {
		var shown = false;
		new IntersectionObserver(function (en, obs) {
			if (shown || !en[0].isIntersecting) { return; }
			shown = true; obs.disconnect();
			var order = cards.slice().sort(function (a, b) {
				return a.getBoundingClientRect().left - b.getBoundingClientRect().left;
			});
			order.forEach(function (c, i) {
				var inner = c.querySelector('.sha-blob');
				if (inner) {
					inner.animate([{ opacity: 0, transform: 'translateX(-50%) translateY(40px) scale(.7)' }, { opacity: 1, transform: 'translateX(-50%)' }],
						{ duration: 800, delay: 120 + i * 70, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
				}
			});
			var head = root.querySelector('.sha-head');
			if (head) { head.animate([{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: 700, easing: 'ease-out', fill: 'backwards' }); }
		}, { threshold: 0.25 }).observe(root);
	}
})();
