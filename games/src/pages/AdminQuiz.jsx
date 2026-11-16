import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminAuthError, listAdminQuestions, setQuestionCorrectIndex } from '../admin-api.js';
import { logoutGamesAdmin } from '../admin-auth.js';

const LETTERS = ['A', 'B', 'C', 'D'];
const AVATARS = ['🕵️', '👰', '🤵', '❓', '💕', '🥂'];

export default function AdminQuiz() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [pending, setPending] = useState('');

  function kickOut() {
    logoutGamesAdmin();
    navigate('/admin', { replace: true });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await listAdminQuestions();
        if (!cancelled) setQuestions(next);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof AdminAuthError) {
          kickOut();
          return;
        }
        setError(err.message || 'Não deu para carregar o quiz');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const open = questions.find((q) => q.id === openId) || null;
  const openPos = open ? questions.findIndex((q) => q.id === open.id) : -1;

  async function pick(i) {
    if (!open || pending) return;
    const previous = open.correctIndex;
    setPending(open.id);
    setError('');
    setQuestions((list) => list.map((q) => (q.id === open.id ? { ...q, correctIndex: i } : q)));
    try {
      const saved = await setQuestionCorrectIndex(open.id, i);
      setQuestions((list) => list.map((q) => (q.id === saved.id ? saved : q)));
    } catch (err) {
      if (err instanceof AdminAuthError) {
        kickOut();
        return;
      }
      setQuestions((list) => list.map((q) => (q.id === open.id ? { ...q, correctIndex: previous } : q)));
      setError(err.message || 'Não deu para salvar a resposta');
    } finally {
      setPending('');
    }
  }

  return (
    <div className="play-page">
      <h1 className="play-script">Quiz</h1>
      <p className="play-sub">Toquem na alternativa certa de cada pergunta</p>
      {error ? <p className="hub-error">{error}</p> : null}
      {!questions.length && !error ? <p className="hub-empty">Carregando perguntas…</p> : null}
      <div className="mission-list">
        {questions.map((q, i) => (
          <article key={q.id} className="mission-card">
            <button type="button" className="mission-card__row" onClick={() => setOpenId(q.id)}>
              <span className="mission-card__avatar" aria-hidden="true">
                {AVATARS[i % AVATARS.length]}
              </span>
              <span className="mission-card__body">
                <strong>{q.prompt}</strong>
                <em>Gabarito · {q.points} pts</em>
              </span>
              <span className="mission-card__badge">Resposta {LETTERS[q.correctIndex] || '?'}</span>
            </button>
          </article>
        ))}
      </div>

      {open ? (
        <div className="quiz-modal" role="dialog" aria-modal="true" aria-labelledby="admin-quiz-title">
          <button type="button" className="quiz-modal__backdrop" aria-label="Fechar" onClick={() => setOpenId(null)} />
          <div className="quiz-modal__panel">
            <p className="quiz-modal__kicker">
              Pergunta {openPos + 1} de {questions.length}
            </p>
            <h2 id="admin-quiz-title">{open.prompt}</h2>
            <div className="quiz-modal__options">
              {open.options.map((opt, i) => {
                const picked = open.correctIndex === i;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`hub-option${picked ? ' is-picked is-right' : ''}`}
                    disabled={pending === open.id}
                    onClick={() => pick(i)}
                  >
                    <em>{LETTERS[i] || i + 1}</em>
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
            <p className="quiz-modal__result is-right">
              {Number.isInteger(open.correctIndex)
                ? `Certa: ${LETTERS[open.correctIndex]}`
                : 'Escolham a alternativa correta'}
            </p>
            <div className="quiz-modal__nav">
              <button type="button" className="desafio__cta" onClick={() => setOpenId(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
