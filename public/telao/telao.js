/**
 * Telão vanilla (ES5) — TVs antigas não rodam React / ES modules.
 * Mesma API da galeria do /games.
 */
(function () {
  'use strict';

  var STORY_MS = 7000;
  var POLL_MS = 2000;
  var DEFAULT_DURATION_MS = 8000;

  var playlist = [];
  var currentId = '';
  var meta = {};
  var cinema = false;
  var storyTimer = null;
  var ignoreEscUntil = 0;
  var broadcast = { phase: 'gallery' };
  var reelTimer = null;
  var confettiKey = '';

  var app = document.getElementById('app');
  var barsEl = document.getElementById('bars');
  var stageEl = document.getElementById('stage');
  var slideEl = document.getElementById('slide');
  var emptyEl = document.getElementById('empty');
  var imgEl = document.getElementById('slide-img');
  var titleEl = document.getElementById('slide-title');
  var guestEl = document.getElementById('slide-guest');
  var btnCinema = document.getElementById('btn-cinema');
  var btnPrev = document.getElementById('btn-prev');
  var btnNext = document.getElementById('btn-next');
  var drawSoonEl = document.getElementById('draw-soon');
  var drawReelEl = document.getElementById('draw-reel');
  var drawLabelEl = document.getElementById('draw-label');
  var drawNumberEl = document.getElementById('draw-number');
  var drawNameEl = document.getElementById('draw-name');
  var drawSubEl = document.getElementById('draw-sub');
  var drawConfettiEl = document.getElementById('draw-confetti');

  function pad2(n) {
    var s = String(n);
    return s.length < 2 ? '0' + s : s;
  }

  function drawActive() {
    var p = broadcast && broadcast.phase;
    return p === 'soon' || p === 'spinning' || p === 'winner';
  }

  function syncAppClass() {
    var cls = 'telao';
    if (cinema) cls += ' is-cinema';
    if (drawActive()) cls += ' is-draw';
    app.className = cls;
  }

  function clearReelTimer() {
    if (reelTimer) {
      clearTimeout(reelTimer);
      reelTimer = null;
    }
  }

  function easeOutCubic(t) {
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    return 1 - Math.pow(1 - t, 3);
  }

  function tickIntervalMs(progress) {
    return Math.round(45 + easeOutCubic(progress) * 220);
  }

  function reelDisplayAt(nowMs) {
    var pool = (broadcast && broadcast.pool) || [];
    var winnerNumber = Math.floor(Number(broadcast && broadcast.winnerNumber));
    var durationMs = Math.max(1000, Number(broadcast && broadcast.durationMs) || DEFAULT_DURATION_MS);
    var started = Date.parse((broadcast && broadcast.startedAt) || '');
    if (!(winnerNumber >= 1)) {
      return { displayNumber: '—', done: false, progress: 0 };
    }
    if (!isFinite(started)) {
      return { displayNumber: pad2(winnerNumber), done: true, progress: 1 };
    }
    var elapsed = Math.max(0, nowMs - started);
    var progress = Math.min(1, elapsed / durationMs);
    if (progress >= 1 || !pool.length) {
      return { displayNumber: pad2(winnerNumber), done: true, progress: 1 };
    }
    var interval = tickIntervalMs(progress);
    var slot = Math.floor(elapsed / interval);
    var idx = Math.abs((slot * 2654435761) ^ (winnerNumber * 97)) % pool.length;
    var sample = pool[idx];
    var num = sample && sample.number ? Number(sample.number) : winnerNumber;
    return { displayNumber: pad2(num), done: false, progress: progress };
  }

  function burstConfetti(key) {
    var i;
    var html;
    var colors;
    var angle;
    var dist;
    var dx;
    var dy;
    if (!drawConfettiEl) return;
    if (key && confettiKey === key) return;
    if (key) confettiKey = key;
    colors = ['#ffffff', '#ffe4ec', '#ffb7c5', '#f472b6', '#ec4899', '#db2777'];
    html = '';
    for (i = 0; i < 40; i++) {
      angle = ((Math.PI * 2 * i) / 40) + (i % 3) * 0.12;
      dist = 100 + (i % 6) * 36;
      dx = Math.cos(angle) * dist;
      dy = Math.sin(angle) * dist - 50;
      html +=
        '<span class="telao-draw__confetti-piece" style="background:' +
        colors[i % colors.length] +
        ';--dx:' +
        dx +
        'px;--dy:' +
        dy +
        'px;animation-delay:' +
        (i % 10) * 0.02 +
        's"></span>';
    }
    drawConfettiEl.innerHTML = html;
  }

  function renderDraw() {
    var phase = (broadcast && broadcast.phase) || 'gallery';
    var snap;
    syncAppClass();
    if (barsEl) barsEl.style.display = drawActive() ? 'none' : '';
    if (stageEl) stageEl.style.display = drawActive() ? 'none' : '';
    if (drawSoonEl) drawSoonEl.style.display = phase === 'soon' ? '' : 'none';
    if (drawReelEl) drawReelEl.style.display = phase === 'spinning' || phase === 'winner' ? '' : 'none';

    if (phase === 'soon') {
      clearReelTimer();
      clearStoryTimer();
      if (drawConfettiEl) drawConfettiEl.innerHTML = '';
      return;
    }

    if (phase === 'winner') {
      clearReelTimer();
      clearStoryTimer();
      if (drawReelEl) {
        drawReelEl.className = 'telao-draw telao-draw--reel is-winner';
      }
      if (drawLabelEl) drawLabelEl.textContent = 'Ganhador';
      if (drawNumberEl) {
        drawNumberEl.textContent = pad2(broadcast.winnerNumber || 0);
      }
      if (drawNameEl) {
        drawNameEl.style.display = '';
        drawNameEl.textContent = broadcast.winnerName || 'Sem comprador';
      }
      if (drawSubEl) {
        drawSubEl.style.display = '';
        drawSubEl.textContent = 'Número ' + (broadcast.winnerNumber || '');
      }
      burstConfetti(String(broadcast.startedAt || broadcast.winnerNumber || ''));
      return;
    }

    if (phase === 'spinning') {
      clearStoryTimer();
      if (drawReelEl) drawReelEl.className = 'telao-draw telao-draw--reel is-spinning';
      if (drawLabelEl) drawLabelEl.textContent = 'Sorteando';
      if (drawNameEl) drawNameEl.style.display = 'none';
      if (drawSubEl) drawSubEl.style.display = 'none';
      if (drawConfettiEl) drawConfettiEl.innerHTML = '';

      function tickReel() {
        snap = reelDisplayAt(Date.now());
        if (drawNumberEl) drawNumberEl.textContent = snap.displayNumber;
        if (snap.done) {
          clearReelTimer();
          if (drawReelEl) drawReelEl.className = 'telao-draw telao-draw--reel is-winner';
          if (drawLabelEl) drawLabelEl.textContent = 'Ganhador';
          if (drawNameEl) {
            drawNameEl.style.display = '';
            drawNameEl.textContent = broadcast.winnerName || 'Sem comprador';
          }
          if (drawSubEl) {
            drawSubEl.style.display = '';
            drawSubEl.textContent = 'Número ' + (broadcast.winnerNumber || '');
          }
          burstConfetti(String(broadcast.startedAt || broadcast.winnerNumber || ''));
          return;
        }
        reelTimer = setTimeout(tickReel, tickIntervalMs(snap.progress));
      }
      clearReelTimer();
      tickReel();
      return;
    }

    clearReelTimer();
    if (drawConfettiEl) drawConfettiEl.innerHTML = '';
    confettiKey = '';
    scheduleNext();
  }

  function imageUrl(id) {
    return '/api/desafio/gallery/' + encodeURIComponent(id) + '/image';
  }

  function indexOfId(id) {
    var i;
    for (i = 0; i < playlist.length; i++) {
      if (playlist[i] === id) return i;
    }
    return -1;
  }

  function nextId(id) {
    if (!playlist.length) return '';
    var i = indexOfId(id);
    if (i < 0) return playlist[0];
    return playlist[(i + 1) % playlist.length];
  }

  function prevId(id) {
    if (!playlist.length) return '';
    var i = indexOfId(id);
    if (i < 0) return playlist[0];
    return playlist[(i - 1 + playlist.length) % playlist.length];
  }

  function mergePlaylist(currentList, current, incomingIds) {
    var seen = {};
    var out = [];
    var i;
    var id;
    for (i = 0; i < currentList.length; i++) {
      id = currentList[i];
      if (incomingIds.indexOf(id) >= 0 && !seen[id]) {
        seen[id] = true;
        out.push(id);
      }
    }
    for (i = 0; i < incomingIds.length; i++) {
      id = incomingIds[i];
      if (!seen[id]) {
        seen[id] = true;
        out.push(id);
      }
    }
    if (current && out.indexOf(current) < 0 && incomingIds.indexOf(current) >= 0) {
      out.unshift(current);
    }
    return out;
  }

  function clearStoryTimer() {
    if (storyTimer) {
      clearTimeout(storyTimer);
      storyTimer = null;
    }
  }

  function scheduleNext() {
    clearStoryTimer();
    if (drawActive()) return;
    if (!currentId) return;
    storyTimer = setTimeout(function () {
      setCurrent(nextId(currentId));
    }, STORY_MS);
  }

  function renderBars() {
    var html = '';
    var i;
    var cls;
    var idx = indexOfId(currentId);
    for (i = 0; i < playlist.length; i++) {
      cls = 'telao-bar';
      if (i < idx) cls += ' is-done';
      else if (i === idx) cls += ' is-active';
      html +=
        '<span class="' +
        cls +
        '"><i style="animation-duration:' +
        STORY_MS +
        'ms;-webkit-animation-duration:' +
        STORY_MS +
        'ms"></i></span>';
    }
    barsEl.innerHTML = html;
  }

  function markOrientation(img) {
    if (!img) return;
    var w = img.naturalWidth || 0;
    var h = img.naturalHeight || 0;
    var ready = w > 0 && h > 0;
    var portrait = ready && h > w;
    img.className = portrait ? 'is-portrait' : ready ? 'is-landscape' : '';
  }

  function showPhoto(photo) {
    if (!photo) {
      slideEl.style.display = 'none';
      emptyEl.style.display = 'block';
      return;
    }
    emptyEl.style.display = 'none';
    slideEl.style.display = 'block';
    imgEl.onload = function () {
      markOrientation(imgEl);
    };
    imgEl.src = photo.preview || imageUrl(photo.id);
    imgEl.alt = photo.title || '';
    titleEl.textContent = photo.title || '';
    guestEl.textContent = photo.guestName || '';
    if (imgEl.complete) markOrientation(imgEl);
  }

  function setCurrent(id) {
    currentId = id || '';
    renderBars();
    if (!currentId) {
      showPhoto(null);
      clearStoryTimer();
      return;
    }
    var photo = meta[currentId];
    if (photo) {
      showPhoto({
        id: photo.id,
        title: photo.title,
        guestName: photo.guestName,
        preview: imageUrl(photo.id),
      });
    } else {
      showPhoto({ id: currentId, title: '', guestName: '', preview: imageUrl(currentId) });
    }
    scheduleNext();
  }

  function refreshCaption() {
    var photo = meta[currentId];
    if (!photo) return;
    titleEl.textContent = photo.title || '';
    guestEl.textContent = photo.guestName || '';
  }

  function applyLive(photos) {
    var ids = [];
    var i;
    var p;
    meta = {};
    for (i = 0; i < photos.length; i++) {
      p = photos[i];
      if (!p || !p.id) continue;
      meta[p.id] = p;
      ids.push(p.id);
    }
    playlist = mergePlaylist(playlist, currentId, ids);
    if (!playlist.length) {
      setCurrent('');
      return;
    }
    // Não chamar setCurrent no poll se a foto atual segue válida —
    // senão o timer de 7s é resetado a cada 5s e a história nunca avança.
    if (!currentId || playlist.indexOf(currentId) < 0) {
      setCurrent(playlist[0]);
      return;
    }
    refreshCaption();
  }

  function parseJson(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  function fetchJson(url, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status < 200 || xhr.status >= 300) {
        cb(new Error('HTTP ' + xhr.status), null);
        return;
      }
      var data = parseJson(xhr.responseText);
      if (!data || !data.ok) {
        cb(new Error('bad payload'), null);
        return;
      }
      cb(null, data);
    };
    xhr.onerror = function () {
      cb(new Error('network'), null);
    };
    xhr.send(null);
  }

  function poll() {
    fetchJson('/api/desafio/gallery', function (err, data) {
      if (!err && data && data.photos) applyLive(data.photos);
    });
    fetchJson('/api/desafio/raffle/draw-broadcast', function (err, data) {
      var next;
      if (err || !data) return;
      next = data.broadcast || { phase: 'gallery' };
      if (
        next.phase === broadcast.phase &&
        next.startedAt === broadcast.startedAt &&
        next.winnerNumber === broadcast.winnerNumber &&
        next.updatedAt === broadcast.updatedAt
      ) {
        return;
      }
      broadcast = next;
      renderDraw();
    });
  }

  function fullscreenEl() {
    return (
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement ||
      null
    );
  }

  function enterFullscreen(el) {
    if (el.requestFullscreen) return el.requestFullscreen();
    if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
    if (el.msRequestFullscreen) return el.msRequestFullscreen();
    return null;
  }

  function leaveFullscreen() {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
    if (document.msExitFullscreen) return document.msExitFullscreen();
    return null;
  }

  function setCinema(on) {
    cinema = !!on;
    syncAppClass();
    btnCinema.textContent = cinema ? 'Sair da tela' : 'Tela cheia';
  }

  function toggleCinema() {
    if (cinema || fullscreenEl()) {
      setCinema(false);
      try {
        leaveFullscreen();
      } catch (e) {}
      return;
    }
    setCinema(true);
    try {
      enterFullscreen(app);
    } catch (e) {}
  }

  btnCinema.onclick = function () {
    toggleCinema();
  };
  btnPrev.onclick = function () {
    if (drawActive()) return;
    setCurrent(prevId(currentId));
  };
  btnNext.onclick = function () {
    if (drawActive()) return;
    setCurrent(nextId(currentId));
  };

  document.addEventListener('fullscreenchange', function () {
    if (fullscreenEl()) {
      setCinema(true);
      return;
    }
    if (cinema) {
      ignoreEscUntil = Date.now() + 400;
      setCinema(false);
    }
  });
  document.addEventListener('webkitfullscreenchange', function () {
    if (fullscreenEl()) {
      setCinema(true);
      return;
    }
    if (cinema) {
      ignoreEscUntil = Date.now() + 400;
      setCinema(false);
    }
  });

  document.onkeydown = function (e) {
    e = e || window.event;
    var key = e.key || e.keyCode;
    if (key === 'Escape' || key === 27) {
      if (cinema || fullscreenEl() || Date.now() < ignoreEscUntil) {
        toggleCinema();
      }
      return;
    }
    if (drawActive()) {
      if (key === 'f' || key === 'F' || key === 70) toggleCinema();
      return;
    }
    if (key === 'ArrowRight' || key === 39) setCurrent(nextId(currentId));
    if (key === 'ArrowLeft' || key === 37) setCurrent(prevId(currentId));
    if (key === 'f' || key === 'F' || key === 70) toggleCinema();
  };

  poll();
  setInterval(poll, POLL_MS);
})();
