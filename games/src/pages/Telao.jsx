import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { galleryImageUrl, listGallery, prefetchGalleryImage } from '../gallery-api.js';
import { getGuestName } from '../guest.js';
import { mergePlaylist, nextId } from '../telao-queue.js';
import { fetchDrawBroadcast } from '../draw-broadcast-api.js';
import { reelDisplayAt, tickIntervalMs } from '../draw-reel.mjs';
import { fetchRanking } from '../ranking-api.js';
import { sortRankingRows } from '../ranking-board.mjs';

const STORY_MS = 7000;
const POLL_MS = 2000;
const RANK_EVERY_MS = 5 * 60 * 1000;
const RANK_SHOW_MS = 12 * 1000;
const RANK_TOP = 8;
const CONFETTI_COLORS = ['#ffffff', '#ffe4ec', '#ffb7c5', '#f472b6', '#ec4899', '#db2777', '#fdf2f8'];

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

function DrawConfetti({ active }) {
  const pieces = useMemo(() => {
    if (!active) return [];
    return Array.from({ length: 56 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 56 + (i % 3) * 0.12;
      const dist = 120 + (i % 7) * 40;
      return {
        id: i,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        dx: `${Math.cos(angle) * dist}px`,
        dy: `${Math.sin(angle) * dist - 60}px`,
        rot: `${(i % 2 === 0 ? 1 : -1) * (260 + (i % 8) * 40)}deg`,
        delay: `${(i % 12) * 0.02}s`,
        round: i % 3 === 0,
      };
    });
  }, [active]);
  if (!pieces.length) return null;
  return (
    <div className="telao-draw__confetti" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className={`telao-draw__confetti-piece${p.round ? ' is-round' : ''}`}
          style={{
            background: p.color,
            '--dx': p.dx,
            '--dy': p.dy,
            '--rot': p.rot,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  );
}

/** @param {{ standalone?: boolean }} props — clone indexável em /telao (sem voltar à galeria) */
export default function Telao({ standalone = false } = {}) {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const cinemaRef = useRef(false);
  const ignoreEscRef = useRef(0);
  const [playlist, setPlaylist] = useState([]);
  const [currentId, setCurrentId] = useState('');
  const [photo, setPhoto] = useState(null);
  const [tick, setTick] = useState(0);
  const [cinema, setCinema] = useState(false);
  const [broadcast, setBroadcast] = useState({ phase: 'gallery' });
  const [reelNumber, setReelNumber] = useState('—');
  const [confetti, setConfetti] = useState(false);
  const [rankBreak, setRankBreak] = useState(false);
  const [rankRows, setRankRows] = useState([]);
  const playlistRef = useRef([]);
  const currentIdRef = useRef('');
  const metaRef = useRef({});
  const confettiKeyRef = useRef('');
  const reelTimerRef = useRef(null);
  const rankHideRef = useRef(null);
  const drawActiveRef = useRef(false);

  const phase = broadcast?.phase || 'gallery';
  const drawActive = phase === 'soon' || phase === 'spinning' || phase === 'winner';
  drawActiveRef.current = drawActive;
  const galleryPaused = drawActive || rankBreak;

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
        const [photos, nextBroadcast] = await Promise.all([listGallery(), fetchDrawBroadcast()]);
        if (cancelled) return;
        applyLive(photos);
        setBroadcast(nextBroadcast || { phase: 'gallery' });
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
    if (galleryPaused || !currentId) return undefined;
    const t = window.setTimeout(() => {
      setCurrent(nextId(playlistRef.current, currentIdRef.current));
    }, STORY_MS);
    return () => window.clearTimeout(t);
  }, [currentId, tick, galleryPaused]);

  useEffect(() => {
    if (drawActive) {
      if (rankHideRef.current) {
        window.clearTimeout(rankHideRef.current);
        rankHideRef.current = null;
      }
      setRankBreak(false);
    }
  }, [drawActive]);

  useEffect(() => {
    async function showRankBreak() {
      if (drawActiveRef.current) return;
      try {
        const rows = sortRankingRows(await fetchRanking()).slice(0, RANK_TOP);
        setRankRows(rows);
      } catch {
        setRankRows([]);
      }
      if (drawActiveRef.current) return;
      setRankBreak(true);
      if (rankHideRef.current) window.clearTimeout(rankHideRef.current);
      rankHideRef.current = window.setTimeout(() => {
        setRankBreak(false);
        rankHideRef.current = null;
        setTick((n) => n + 1);
      }, RANK_SHOW_MS);
    }

    const interval = window.setInterval(() => {
      void showRankBreak();
    }, RANK_EVERY_MS);

    return () => {
      window.clearInterval(interval);
      if (rankHideRef.current) window.clearTimeout(rankHideRef.current);
    };
  }, []);

  useEffect(() => {
    if (reelTimerRef.current) {
      window.clearTimeout(reelTimerRef.current);
      reelTimerRef.current = null;
    }

    if (phase === 'winner') {
      const n = Number(broadcast.winnerNumber);
      setReelNumber(Number.isInteger(n) ? String(n).padStart(2, '0') : '—');
      const key = String(broadcast.startedAt || broadcast.winnerNumber || '');
      if (key && confettiKeyRef.current !== key) {
        confettiKeyRef.current = key;
        setConfetti(true);
      }
      return undefined;
    }

    if (phase !== 'spinning') {
      setConfetti(false);
      setReelNumber('—');
      return undefined;
    }

    function tickReel() {
      const snap = reelDisplayAt({
        pool: broadcast.pool || [],
        startedAt: broadcast.startedAt,
        durationMs: broadcast.durationMs,
        winnerNumber: broadcast.winnerNumber,
        now: Date.now(),
      });
      setReelNumber(snap.displayNumber);
      if (snap.done) {
        const key = String(broadcast.startedAt || broadcast.winnerNumber || '');
        if (key && confettiKeyRef.current !== key) {
          confettiKeyRef.current = key;
          setConfetti(true);
        }
        return;
      }
      reelTimerRef.current = window.setTimeout(tickReel, tickIntervalMs(snap.progress));
    }
    tickReel();
    return () => {
      if (reelTimerRef.current) window.clearTimeout(reelTimerRef.current);
    };
  }, [phase, broadcast.startedAt, broadcast.durationMs, broadcast.winnerNumber, broadcast.pool]);

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
    if (standalone) return;
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
      if (drawActive || rankBreak) return;
      if (e.key === 'ArrowRight') setCurrent(nextId(playlistRef.current, currentIdRef.current));
      if (e.key === 'ArrowLeft') setCurrent(prevId(playlistRef.current, currentIdRef.current));
      if (e.key === 'f' || e.key === 'F') toggleCinema();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, drawActive, rankBreak]);

  const currentIndex = Math.max(0, playlist.indexOf(currentId));

  return (
    <div
      ref={rootRef}
      className={`telao${cinema ? ' is-cinema' : ''}${drawActive ? ' is-draw' : ''}${rankBreak && !drawActive ? ' is-rank' : ''}`}
    >
      {!galleryPaused ? (
        <div className="telao-bars" aria-hidden="true">
          {playlist.map((id, i) => (
            <span key={id} className={`telao-bar${i < currentIndex ? ' is-done' : i === currentIndex ? ' is-active' : ''}`}>
              <i style={{ animationDuration: `${STORY_MS}ms` }} />
            </span>
          ))}
        </div>
      ) : null}
      <header className="telao-top">
        <p>Dani &amp; Carine</p>
        <div className="telao-top__actions">
          <button type="button" onClick={toggleCinema}>
            {cinema ? 'Sair da tela' : 'Tela cheia'}
          </button>
          {!standalone && getGuestName() ? (
            <button type="button" onClick={leaveTelao}>
              Sair
            </button>
          ) : null}
        </div>
      </header>

      {phase === 'soon' ? (
        <div className="telao-draw telao-draw--soon" role="status">
          <p className="telao-draw__eyebrow">Dani &amp; Carine</p>
          <p className="telao-draw__soon">Sorteio em breve</p>
        </div>
      ) : null}

      {phase === 'spinning' || phase === 'winner' ? (
        <div className={`telao-draw telao-draw--reel${phase === 'winner' ? ' is-winner' : ' is-spinning'}`} role="status">
          <DrawConfetti active={confetti && phase === 'winner'} />
          <p className="telao-draw__label">{phase === 'winner' ? 'Ganhador' : 'Sorteando'}</p>
          <div className="telao-draw__reel-window" aria-hidden={phase !== 'winner'}>
            <p key={`${phase}-${reelNumber}`} className="telao-draw__number">
              {reelNumber}
            </p>
          </div>
          {phase === 'winner' ? (
            <>
              <p className="telao-draw__name">
                {broadcast.winnerName ? broadcast.winnerName : 'Sem comprador'}
              </p>
              <p className="telao-draw__sub">Número {broadcast.winnerNumber}</p>
            </>
          ) : (
            <p className="telao-draw__hint">A roleta está girando…</p>
          )}
        </div>
      ) : null}

      {rankBreak && !drawActive ? (
        <div className="telao-rank" role="status">
          <p className="telao-rank__eyebrow">Placar ao vivo</p>
          <h2 className="telao-rank__title">Ranking</h2>
          {rankRows.length ? (
            <ol className="telao-rank__list">
              {rankRows.map((row, i) => (
                <li key={`${row.guestName}-${i}`} className="telao-rank__row">
                  <span className="telao-rank__pos">{i + 1}</span>
                  <span className="telao-rank__name">{row.guestName}</span>
                  <span className="telao-rank__pts">
                    {row.points} pts
                    {row.stamps ? ` · ${row.stamps} selos` : ''}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="telao-rank__empty">Ainda sem pontuação — joguem nos desafios!</p>
          )}
        </div>
      ) : null}

      {!galleryPaused ? (
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
            <div className="telao-empty telao-empty--qr">
              <img
                className="telao-empty__qr"
                src="/telao/qr-games.png"
                alt="QR code para abrir o games"
                width={280}
                height={280}
              />
              <p className="telao-empty__title">Entre no desafio</p>
              <p className="telao-empty__sub">
                Escaneie e abra <strong>casebem.com/games</strong> para jogar e enviar fotos
              </p>
            </div>
          )}
          <button type="button" className="telao-hit telao-hit--left" aria-label="Anterior" onClick={() => setCurrent(prevId(playlist, currentId))} />
          <button type="button" className="telao-hit telao-hit--right" aria-label="Próxima" onClick={() => setCurrent(nextId(playlist, currentId))} />
        </div>
      ) : null}
    </div>
  );
}
