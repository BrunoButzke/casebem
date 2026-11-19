import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useDemo } from '../DemoContext.jsx';

const LETTERS = ['A', 'B', 'C', 'D'];
const AVATARS = ['🕵️', '👰', '🤵', '❓', '💕', '🥂'];
const STAMP_MS = 1100;

export default function Quiz() {
  const { catalog, progress, scores, answerQuestion } = useDemo();
  const questions = catalog.questions;
  const [openId, setOpenId] = useState(null);
  const [listHeadId, setListHeadId] = useState(null);
  const [stamp, setStamp] = useState(null);
  const topCardRef = useRef(null);
  const answersRef = useRef(progress.answers);
  answersRef.current = progress.answers;

  const ordered = useMemo(() => {
    const unanswered = questions.filter((q) => !progress.answers[q.id]);
    const answered = questions.filter((q) => progress.answers[q.id]);
    if (!listHeadId) return [...unanswered, ...answered];
    const start = unanswered.findIndex((q) => q.id === listHeadId);
    if (start <= 0) return [...unanswered, ...answered];
    return [...unanswered.slice(start), ...unanswered.slice(0, start), ...answered];
  }, [questions, progress.answers, listHeadId]);

  function originalIndex(id) {
    return questions.findIndex((q) => q.id === id);
  }

  function nextUnansweredAfter(id) {
    const known = answersRef.current;
    const from = Math.max(0, originalIndex(id));
    const rotated = id
      ? [...questions.slice(from + 1), ...questions.slice(0, from + 1)]
      : questions;
    return rotated.find((q) => !known[q.id])?.id ?? null;
  }

  function settleList(fromId) {
    const known = answersRef.current;
    const head = fromId && !known[fromId] ? fromId : nextUnansweredAfter(fromId);
    setListHeadId(head);
  }

  function close() {
    const from = openId;
    setStamp(null);
    setOpenId(null);
    settleList(from);
  }

  useLayoutEffect(() => {
    if (openId != null) return;
    topCardRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [openId, listHeadId]);

  useEffect(() => {
    if (stamp == null || !openId) return undefined;
    const fromId = openId;
    const t = window.setTimeout(() => {
      setStamp(null);
      const nextId = nextUnansweredAfter(fromId);
      if (nextId) setOpenId(nextId);
      else {
        setOpenId(null);
        settleList(fromId);
      }
    }, STAMP_MS);
    return () => window.clearTimeout(t);
  }, [stamp, openId]);

  const open = questions.find((q) => q.id === openId) || null;
  const answer = open ? progress.answers[open.id] : null;
  const openPos = open ? originalIndex(open.id) : -1;

  function pick(i) {
    if (!open || answer || stamp) return;
    const result = answerQuestion(open, i);
    answersRef.current = { ...answersRef.current, [open.id]: result };
    setStamp(result.correct);
  }

  return (
    <div className="play-page">
      <h1 className="play-script">Quiz</h1>
      <p className="play-sub">
        {scores.answeredQuiz} de {questions.length} respondidas · pontos se acertar
      </p>
      <div className="mission-list">
        {ordered.map((q, i) => {
          const done = progress.answers[q.id];
          const orig = originalIndex(q.id);
          return (
            <article
              key={q.id}
              ref={i === 0 ? topCardRef : undefined}
              className={`mission-card${done ? ' is-done' : ''}`}
            >
              <button type="button" className="mission-card__row" onClick={() => setOpenId(q.id)}>
                <span className="mission-card__avatar" aria-hidden="true">
                  {AVATARS[(orig < 0 ? i : orig) % AVATARS.length]}
                </span>
                <span className="mission-card__body">
                  <strong>{q.prompt}</strong>
                  <em>
                    ? Quiz · {q.points} {q.points === 1 ? 'pt' : 'pts'} se acertar
                  </em>
                </span>
                {done ? (
                  <span className={`mission-card__badge${done.correct ? '' : ' is-wrong'}`}>
                    {done.correct ? 'Acertou' : 'Errou'}
                  </span>
                ) : (
                  <span className="mission-card__chevron" aria-hidden="true">
                    ›
                  </span>
                )}
              </button>
            </article>
          );
        })}
      </div>

      {open ? (
        <div className="quiz-modal" role="dialog" aria-modal="true" aria-labelledby="quiz-modal-title">
          <button type="button" className="quiz-modal__backdrop" aria-label="Fechar" onClick={close} />
          <div className="quiz-modal__panel">
            <p className="quiz-modal__kicker">
              Pergunta {openPos + 1} de {questions.length}
            </p>
            <h2 id="quiz-modal-title">{open.prompt}</h2>
            <div className="quiz-modal__options">
              {open.options.map((opt, i) => {
                const picked = answer?.selectedIndex === i;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`hub-option${picked ? ' is-picked' : ''}${picked && answer?.correct ? ' is-right' : ''}${picked && answer && !answer.correct ? ' is-wrong' : ''}`}
                    disabled={Boolean(answer) || stamp != null}
                    onClick={() => pick(i)}
                  >
                    <em>{LETTERS[i] || i + 1}</em>
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
            {answer && stamp == null ? (
              <p className={`quiz-modal__result${answer.correct ? ' is-right' : ' is-wrong'}`}>
                {answer.correct ? `Acertou · +${answer.points} pts` : 'Errou nesta'}
              </p>
            ) : null}
            <div className="quiz-modal__nav">
              <button type="button" className="desafio__cta desafio__cta--ghost" onClick={close}>
                Fechar
              </button>
            </div>
            {stamp != null ? (
              <div className={`quiz-stamp${stamp ? ' is-right' : ' is-wrong'}`} aria-live="polite">
                <span>{stamp ? 'Acertou!' : 'Errou!'}</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
