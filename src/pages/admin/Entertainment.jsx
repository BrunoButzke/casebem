import { useEffect, useState } from 'react';
import {
  createQuestionAdmin,
  deleteQuestionAdmin,
  listQuestionsAdmin,
  shouldFetchAdminResource,
} from '../../lib/admin-api.mjs';
import AdminSection from './AdminSection.jsx';
import UpgradeCta from './UpgradeCta.jsx';
import { useAdminAccount } from './use-admin-account.js';

export default function Entertainment() {
  const { account, status, reload } = useAdminAccount();
  const [questions, setQuestions] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const locked = account ? !shouldFetchAdminResource(account.plan, 'entretenimento') : false;

  useEffect(() => {
    if (!account || locked) return;
    listQuestionsAdmin()
      .then((res) => res.json().catch(() => ({})))
      .then((body) => setQuestions(Array.isArray(body.questions) ? body.questions : []))
      .catch(() => setError('Não foi possível carregar os desafios.'));
  }, [account, locked]);

  if (status === 'loading' || !account) return <p>Carregando…</p>;
  if (locked) return <UpgradeCta title="Entretenimento" onUpgraded={reload} />;

  async function onAdd(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await createQuestionAdmin({
        prompt: prompt.trim(),
        options: [optionA.trim(), optionB.trim()],
        correctIndex: 0,
        points: 10,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError('Não foi possível criar a pergunta.');
        return;
      }
      setQuestions(Array.isArray(body.questions) ? body.questions : []);
      setPrompt('');
      setOptionA('');
      setOptionB('');
    } catch {
      setError('Não foi possível criar a pergunta.');
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(id) {
    const res = await deleteQuestionAdmin(id);
    const body = await res.json().catch(() => ({}));
    if (res.ok) setQuestions(Array.isArray(body.questions) ? body.questions : []);
  }

  return (
    <AdminSection
      eyebrow="Entretenimento"
      title="Perguntas dos desafios"
      lead="Quiz do casamento. Contas novas começam sem perguntas próprias."
    >
      {error ? (
        <p className="hub-msg" role="alert">
          {error}
        </p>
      ) : null}
      {questions.length === 0 ? (
        <p className="hub-empty">Nenhuma pergunta ainda.</p>
      ) : (
        <ul className="hub-list">
          {questions.map((item) => (
            <li key={item.id}>
              <span>{item.prompt}</span>
              <button type="button" className="hub-top__logout" onClick={() => onRemove(item.id)}>
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="hub-form" onSubmit={onAdd}>
        <label className="hub-field">
          <span>Pergunta</span>
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)} required minLength={2} />
        </label>
        <label className="hub-field">
          <span>Resposta certa</span>
          <input value={optionA} onChange={(e) => setOptionA(e.target.value)} required minLength={1} />
        </label>
        <label className="hub-field">
          <span>Outra opção</span>
          <input value={optionB} onChange={(e) => setOptionB(e.target.value)} required minLength={1} />
        </label>
        <button type="submit" className="hub-btn" disabled={busy}>
          {busy ? 'Salvando…' : 'Adicionar'}
        </button>
      </form>
    </AdminSection>
  );
}
