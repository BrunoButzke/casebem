import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { galleryImageUrl, listGallery, prefetchGalleryImage } from '../gallery-api.js';
import { getGuestName } from '../guest.js';
import { mergePlaylist, nextId } from '../telao-queue.js';

const STORY_MS = 7000;
const POLL_MS = 5000;

function prevId(playlist, currentId) {
  if (!playlist?.length) return '';
  const i = playlist.indexOf(currentId);
  if (i < 0) return playlist[0];
  return playlist[(i - 1 + playlist.length) % playlist.length];
}

function markOrientation(img) {
  if (!img) return;
  const ready = img.naturalWidth > 0 && img.naturalHeight > 0;
  const portrait = ready && img.naturalHeight > img.naturalWidth;
  img.classList.toggle('is-portrait', portrait);
  img.classList.toggle('is-landscape', ready && !portrait);
}

function fullscreenEl() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function enterFullscreen(el) {
  const fn = el?.requestFullscreen || el?.webkitRequestFullscreen;
  return fn ? fn.call(el) : Promise.reject(new Error('unsupported'));
}

function leaveFullscreen() {
  const fn = document.exitFullscreen || document.webkitExitFullscreen;
  return fn ? fn.call(document) : Promise.resolve();
}

export default function Telao() {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const cinemaRef = useRef(false);
  const ignoreEscRef = useRef(0);
  const [playlist, setPlaylist] = useState([]);
  const [currentId, setCurrentId] = useState('');
  const [photo, setPhoto] = useState(null);
  const [tick, setTick] = useState(0);
  const [cinema, setCinema] = useState(false);
  const playlistRef = useRef([]);
  const currentIdRef = useRef('');
  const metaRef = useRef({});

  function setCinemaMode(on) {
    cinemaRef.current = on;
    setCinema(on);
  }

  function setCurrent(id) {
    currentIdRef.current = id;
    setCurrentId(id);
    setTick((n) => n + 1);
  }

  function applyLive(photos) {
    metaRef.current = Object.fromEntries((photos || []).map((p) => [p.id, p]));
    const next = mergePlaylist(
      playlistRef.current,
      currentIdRef.current,
      photos.map((p) => p.id)
    );
    playlistRef.current = next;
    setPlaylist(next);
    if (!next.length) {
      setCurrent('');
      setPhoto(null);
      return;
    }
    if (!currentIdRef.current || !next.includes(currentIdRef.current)) {
      setCurrent(next[0]);
    } else {
      const current = metaRef.current[currentIdRef.current];
      if (current) setPhoto({ ...current, preview: galleryImageUrl(current.id) });
    }
    const upcoming = nextId(next, currentIdRef.current);
    if (upcoming) prefetchGalleryImage(upcoming);
  }

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const photos = await listGallery();
        if (!cancelled) applyLive(photos);
      } catch {
        /* keep looping */
      }
    }
    void poll();
    const t = window.setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (!currentId) {
      setPhoto(null);
      return;
    }
    const current = metaRef.current[currentId];
    setPhoto(current ? { ...current, preview: galleryImageUrl(current.id) } : { id: currentId, preview: galleryImageUrl(currentId) });
    prefetchGalleryImage(nextId(playlistRef.current, currentId));
  }, [currentId]);

  useEffect(() => {
    if (!currentId) return undefined;
    const t = window.setTimeout(() => {
      setCurrent(nextId(playlistRef.current, currentIdRef.current));
    }, STORY_MS);
    return () => window.clearTimeout(t);
  }, [currentId, tick]);

  function toggleCinema() {
    if (cinemaRef.current || fullscreenEl()) {
      setCinemaMode(false);
      if (fullscreenEl()) void leaveFullscreen().catch(() => {});
      return;
    }
    setCinemaMode(true);
    void enterFullscreen(rootRef.current || document.documentElement).catch(() => {
      /* iOS / blocked API: keep CSS cinema */
    });
  }

  useEffect(() => {
    function onFsChange() {
      if (fullscreenEl()) {
        setCinemaMode(true);
        return;
      }
      if (cinemaRef.current) {
        ignoreEscRef.current = Date.now() + 400;
        setCinemaMode(false);
      }
    }
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  function leaveTelao() {
    if (fullscreenEl()) void leaveFullscreen().catch(() => {});
    setCinemaMode(false);
    // Sem convidado (TV/projetor) permanece no telão público; com sessão volta à galeria.
    if (getGuestName()) navigate('/galeria');
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        if (cinemaRef.current || fullscreenEl() || Date.now() < ignoreEscRef.current) {
          toggleCinema();
          return;
        }
        leaveTelao();
      }
      if (e.key === 'ArrowRight') setCurrent(nextId(playlistRef.current, currentIdRef.current));
      if (e.key === 'ArrowLeft') setCurrent(prevId(playlistRef.current, currentIdRef.current));
      if (e.key === 'f' || e.key === 'F') toggleCinema();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const currentIndex = Math.max(0, playlist.indexOf(currentId));

  return (
    <div ref={rootRef} className={`telao${cinema ? ' is-cinema' : ''}`}>
      <div className="telao-bars" aria-hidden="true">
        {playlist.map((id, i) => (
          <span key={id} className={`telao-bar${i < currentIndex ? ' is-done' : i === currentIndex ? ' is-active' : ''}`}>
            <i style={{ animationDuration: `${STORY_MS}ms` }} />
          </span>
        ))}
      </div>
      <header className="telao-top">
        <p>Dani &amp; Carine</p>
        <div className="telao-top__actions">
          <button type="button" onClick={toggleCinema}>
            {cinema ? 'Sair da tela' : 'Tela cheia'}
          </button>
          {getGuestName() ? (
            <button type="button" onClick={leaveTelao}>
              Sair
            </button>
          ) : null}
        </div>
      </header>
      <div className="telao-stage">
        {photo?.preview ? (
          <figure className="telao-slide">
            <img
              src={photo.preview}
              alt={photo.title}
              onLoad={(e) => markOrientation(e.currentTarget)}
              ref={(el) => {
                if (el?.complete) markOrientation(el);
              }}
            />
            <figcaption>
              <strong>{photo.title}</strong>
              <span>{photo.guestName}</span>
            </figcaption>
          </figure>
        ) : (
          <p className="telao-empty">Aguardando fotos da festa…</p>
        )}
        <button type="button" className="telao-hit telao-hit--left" aria-label="Anterior" onClick={() => setCurrent(prevId(playlist, currentId))} />
        <button type="button" className="telao-hit telao-hit--right" aria-label="Próxima" onClick={() => setCurrent(nextId(playlist, currentId))} />
      </div>
    </div>
  );
}
