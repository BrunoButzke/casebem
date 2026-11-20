import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { galleryImageUrl, listGallery, publishGalleryPhoto, unpublishGalleryPhoto } from './gallery-api.js';
import { loadProgress, photoEntry, saveProgress } from './progress.js';
import { fetchProgress, pushProgress } from './progress-api.js';
import { reportRankingScore } from './ranking-api.js';

const PlayContext = createContext(null);

function progressHasData(p) {
  if (!p) return false;
  return Object.keys(p.answers || {}).length > 0 || Object.keys(p.photos || {}).length > 0;
}

function mergeGalleryIntoPhotos(photos, galleryRows, guestName) {
  const name = String(guestName || '').trim().toLowerCase();
  const next = { ...(photos || {}) };
  for (const row of galleryRows || []) {
    if (String(row.guestName || '').trim().toLowerCase() !== name) continue;
    const missionId = row.missionId;
    if (!missionId) continue;
    const prev = photoEntry(next[missionId]) || {};
    next[missionId] = {
      done: true,
      title: prev.title || row.title || '',
      awardsStamp: prev.awardsStamp,
      galleryId: row.id,
      preview: prev.preview || galleryImageUrl(row.id),
    };
  }
  return next;
}

export function PlayProvider({ guestName, children }) {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(() => loadProgress(guestName));
  const [pending, setPending] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const rankingPosted = useRef(false);
  const pushTimer = useRef(0);
  const progressRef = useRef(progress);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/desafio/challenges');
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          if (!cancelled) setError(data.message || data.error || 'Não deu para carregar as missões');
          return;
        }
        if (!cancelled) {
          setCatalog({
            questions: data.questions || [],
            photoMissions: data.photoMissions || [],
            stampCards: data.stampCards || [],
          });
        }
      } catch {
        if (!cancelled) setError('Não deu para carregar as missões');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!guestName) {
      setHydrated(true);
      return undefined;
    }
    let cancelled = false;
    rankingPosted.current = false;
    setHydrated(false);
    (async () => {
      const local = loadProgress(guestName);
      let next = local;
      let shouldUploadLocal = false;
      try {
        const remote = await fetchProgress(guestName);
        if (cancelled) return;
        if (remote && !remote.empty && progressHasData(remote)) {
          next = {
            answers: remote.answers || {},
            photos: remote.photos || {},
          };
        } else if (progressHasData(local)) {
          shouldUploadLocal = true;
        }
      } catch {
        /* offline / API — mantém local */
      }

      try {
        const gallery = await listGallery();
        if (!cancelled) {
          next = {
            ...next,
            photos: mergeGalleryIntoPhotos(next.photos, gallery, guestName),
          };
        }
      } catch {
        /* galeria opcional no restore */
      }

      if (cancelled) return;
      try {
        saveProgress(guestName, next);
      } catch {
        /* ignore quota */
      }
      setProgress(next);
      progressRef.current = next;
      setHydrated(true);

      if (shouldUploadLocal) {
        pushProgress({
          guestName,
          answers: next.answers,
          photos: next.photos,
        }).catch(() => {});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [guestName]);

  const schedulePush = useCallback(
    (next) => {
      if (!guestName) return;
      window.clearTimeout(pushTimer.current);
      pushTimer.current = window.setTimeout(() => {
        pushProgress({
          guestName,
          answers: next.answers,
          photos: next.photos,
        }).catch(() => {});
      }, 400);
    },
    [guestName]
  );

  useEffect(
    () => () => {
      window.clearTimeout(pushTimer.current);
    },
    []
  );

  const persist = useCallback(
    (next) => {
      try {
        saveProgress(guestName, next);
        setProgress(next);
        progressRef.current = next;
        schedulePush(next);
        return true;
      } catch {
        setError('A foto ficou grande demais para salvar neste aparelho. Tente outra.');
        return false;
      }
    },
    [guestName, schedulePush]
  );

  const answerQuestion = useCallback(
    async (question, selectedIndex) => {
      if (progress.answers[question.id] || pending) return null;
      setPending(question.id);
      setError('');
      try {
        const res = await fetch('/api/desafio/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId: question.id, selectedIndex }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          setError(data.message || data.error || 'Não deu para corrigir');
          return null;
        }
        const entry = {
          selectedIndex,
          correct: Boolean(data.correct),
          points: Number(data.points) || 0,
        };
        persist({
          ...progress,
          answers: { ...progress.answers, [question.id]: entry },
        });
        return entry;
      } catch {
        setError('Não deu para corrigir');
        return null;
      } finally {
        setPending('');
      }
    },
    [pending, persist, progress]
  );

  const setPhoto = useCallback(
    async (mission, image) => {
      const file = image?.blob || image?.file;
      const preview = typeof image === 'string' ? image : image?.preview;
      const thumb = typeof image === 'string' ? image : image?.thumb || (typeof preview === 'string' ? preview : '');
      setError('');
      const ok = persist({
        ...progress,
        photos: {
          ...progress.photos,
          [mission.id]: {
            done: true,
            preview: thumb,
            title: mission.title,
            awardsStamp: mission.awardsStamp,
          },
        },
      });
      if (!ok) return false;
      try {
        const photo = await publishGalleryPhoto({
          guestName,
          missionId: mission.id,
          title: mission.title,
          file,
          preview: file ? undefined : preview,
        });
        if (photo?.id) {
          const current = progressRef.current;
          persist({
            ...current,
            photos: {
              ...current.photos,
              [mission.id]: {
                ...photoEntry(current.photos[mission.id]),
                done: true,
                galleryId: photo.id,
                preview: thumb || galleryImageUrl(photo.id),
                title: mission.title,
                awardsStamp: mission.awardsStamp,
              },
            },
          });
        }
      } catch (err) {
        /* a foto continua no aparelho, mas a galeria compartilhada não recebeu */
        setError(err.message || 'Foto salva neste aparelho, mas não entrou na galeria');
      }
      return true;
    },
    [guestName, persist, progress]
  );

  const removePhoto = useCallback(
    (mission) => {
      const photos = { ...progress.photos };
      delete photos[mission.id];
      setError('');
      persist({ ...progress, photos });
      void unpublishGalleryPhoto({ guestName, missionId: mission.id }).catch(() => {});
    },
    [guestName, persist, progress]
  );

  const scores = useMemo(() => {
    const photos = catalog?.photoMissions || [];
    const questions = catalog?.questions || [];
    const quizPoints = Object.values(progress.answers).reduce((sum, a) => sum + Number(a?.points || 0), 0);
    const photoPoints = photos.reduce((sum, m) => {
      const shot = photoEntry(progress.photos[m.id]);
      return shot?.done ? sum + Number(m.points || 0) : sum;
    }, 0);
    const stamps = photos.reduce((sum, m) => {
      const shot = photoEntry(progress.photos[m.id]);
      return m.awardsStamp && shot?.done ? sum + 1 : sum;
    }, 0);
    const answeredQuiz = questions.filter((q) => progress.answers[q.id]).length;
    const donePhotos = photos.filter((m) => photoEntry(progress.photos[m.id])?.done).length;
    return {
      points: quizPoints + photoPoints,
      stamps,
      answeredQuiz,
      donePhotos,
      total: questions.length + photos.length,
      done: answeredQuiz + donePhotos,
    };
  }, [catalog, progress]);

  useEffect(() => {
    if (!guestName || !hydrated) return undefined;
    const empty = !scores.points && !scores.stamps && !scores.done;
    if (empty && !rankingPosted.current) return undefined;
    rankingPosted.current = true;
    const t = window.setTimeout(() => {
      reportRankingScore({
        guestName,
        points: scores.points,
        stamps: scores.stamps,
      }).catch(() => {});
    }, 400);
    return () => window.clearTimeout(t);
  }, [guestName, hydrated, scores.done, scores.points, scores.stamps]);

  const value = useMemo(
    () => ({
      guestName,
      catalog,
      error,
      progress,
      pending,
      hydrated,
      scores,
      answerQuestion,
      setPhoto,
      removePhoto,
      getPhoto(id) {
        return photoEntry(progress.photos[id]);
      },
      isPhotoDone(id) {
        return Boolean(photoEntry(progress.photos[id])?.done);
      },
    }),
    [answerQuestion, catalog, error, guestName, hydrated, pending, progress, removePhoto, scores, setPhoto]
  );

  return <PlayContext.Provider value={value}>{children}</PlayContext.Provider>;
}

export function usePlay() {
  const ctx = useContext(PlayContext);
  if (!ctx) throw new Error('usePlay precisa do PlayProvider');
  return ctx;
}
