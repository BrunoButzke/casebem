import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  DEMO_GUEST,
  MOCK_BASE_POINTS,
  MOCK_PHOTO_MISSIONS,
  MOCK_QUESTIONS,
  MOCK_STAMP_CARD,
  MOCK_STAMPS,
} from './mock-data.js';

const DemoContext = createContext(null);
const STORAGE_KEY = 'casebem_demo_game_v1';

function loadProgress() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { answers: {}, photos: {} };
    const parsed = JSON.parse(raw);
    return {
      answers: parsed.answers && typeof parsed.answers === 'object' ? parsed.answers : {},
      photos: parsed.photos && typeof parsed.photos === 'object' ? parsed.photos : {},
    };
  } catch {
    return { answers: {}, photos: {} };
  }
}

function saveProgress(progress) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

export function DemoProvider({ children }) {
  const [progress, setProgress] = useState(loadProgress);

  const persist = useCallback((next) => {
    setProgress(next);
    saveProgress(next);
  }, []);

  const answerQuestion = useCallback(
    (question, selectedIndex) => {
      const correct = selectedIndex === question.correctIndex;
      const points = correct ? Number(question.points) || 0 : 0;
      const result = { selectedIndex, correct, points };
      persist({
        ...progress,
        answers: { ...progress.answers, [question.id]: result },
      });
      return result;
    },
    [persist, progress]
  );

  const setPhoto = useCallback(
    (mission, previewDataUrl) => {
      persist({
        ...progress,
        photos: {
          ...progress.photos,
          [mission.id]: { done: true, preview: previewDataUrl },
        },
      });
      return true;
    },
    [persist, progress]
  );

  const getPhoto = useCallback(
    (missionId) => {
      const local = progress.photos[missionId];
      if (local) return local;
      const seed = MOCK_PHOTO_MISSIONS.find((m) => m.id === missionId);
      if (seed?.done && seed.preview) return { done: true, preview: seed.preview };
      return null;
    },
    [progress.photos]
  );

  const scores = useMemo(() => {
    const quizPts = Object.values(progress.answers).reduce(
      (sum, a) => sum + (Number(a?.points) || 0),
      0
    );
    const photoPts = MOCK_PHOTO_MISSIONS.reduce((sum, m) => {
      const shot = progress.photos[m.id] || (m.done ? { done: true } : null);
      return shot?.done ? sum + (Number(m.points) || 0) : sum;
    }, 0);
    const answeredQuiz = Object.keys(progress.answers).length;
    const donePhotos = MOCK_PHOTO_MISSIONS.filter((m) => {
      if (progress.photos[m.id]?.done) return true;
      return Boolean(m.done);
    }).length;
    const stampBonus = MOCK_PHOTO_MISSIONS.filter((m) => {
      const done = progress.photos[m.id]?.done || m.done;
      return done && m.awardsStamp;
    }).length;
    const stamps = Math.min(
      Number(MOCK_STAMP_CARD.stampsRequired) || 8,
      MOCK_STAMPS + Math.max(0, stampBonus - 2)
    );
    return {
      points: MOCK_BASE_POINTS + quizPts + Math.max(0, photoPts - 35),
      stamps,
      answeredQuiz,
      donePhotos,
      done: answeredQuiz + donePhotos,
    };
  }, [progress]);

  const value = useMemo(
    () => ({
      guestName: DEMO_GUEST,
      catalog: {
        questions: MOCK_QUESTIONS,
        photoMissions: MOCK_PHOTO_MISSIONS,
        stampCards: [MOCK_STAMP_CARD],
      },
      progress,
      scores,
      pending: null,
      error: '',
      answerQuestion,
      setPhoto,
      getPhoto,
    }),
    [answerQuestion, getPhoto, progress, scores, setPhoto]
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error('useDemo fora do DemoProvider');
  return ctx;
}
