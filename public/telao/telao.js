/**
 * Telão vanilla (ES5) — TVs antigas não rodam React / ES modules.
 * Mesma API da galeria do /games.
 */
(function () {
  'use strict';

  var STORY_MS = 7000;
  var POLL_MS = 5000;

  var playlist = [];
  var currentId = '';
  var meta = {};
  var cinema = false;
  var storyTimer = null;
  var ignoreEscUntil = 0;

  var app = document.getElementById('app');
  var barsEl = document.getElementById('bars');
  var slideEl = document.getElementById('slide');
  var emptyEl = document.getElementById('empty');
  var imgEl = document.getElementById('slide-img');
  var titleEl = document.getElementById('slide-title');
  var guestEl = document.getElementById('slide-guest');
  var btnCinema = document.getElementById('btn-cinema');
  var btnPrev = document.getElementById('btn-prev');
  var btnNext = document.getElementById('btn-next');

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

  function showPhoto(photo) {
    if (!photo) {
      slideEl.style.display = 'none';
      emptyEl.style.display = 'block';
      return;
    }
    emptyEl.style.display = 'none';
    slideEl.style.display = 'block';
    imgEl.src = photo.preview || imageUrl(photo.id);
    imgEl.alt = photo.title || '';
    titleEl.textContent = photo.title || '';
    guestEl.textContent = photo.guestName || '';
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
    if (!currentId || playlist.indexOf(currentId) < 0) {
      setCurrent(playlist[0]);
    } else {
      setCurrent(currentId);
    }
  }

  function parseJson(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  function fetchGallery(cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/desafio/gallery', true);
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
      cb(null, data.photos || []);
    };
    xhr.onerror = function () {
      cb(new Error('network'), null);
    };
    xhr.send(null);
  }

  function poll() {
    fetchGallery(function (err, photos) {
      if (!err && photos) applyLive(photos);
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
    if (cinema) {
      app.className = 'telao is-cinema';
      btnCinema.textContent = 'Sair da tela';
    } else {
      app.className = 'telao';
      btnCinema.textContent = 'Tela cheia';
    }
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
    setCurrent(prevId(currentId));
  };
  btnNext.onclick = function () {
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
    if (key === 'ArrowRight' || key === 39) setCurrent(nextId(currentId));
    if (key === 'ArrowLeft' || key === 37) setCurrent(prevId(currentId));
    if (key === 'f' || key === 'F' || key === 70) toggleCinema();
  };

  poll();
  setInterval(poll, POLL_MS);
})();
