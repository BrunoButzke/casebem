import { useEffect, useMemo, useRef, useState } from 'react';
import { usePlay } from '../PlayContext.jsx';
import { fetchRanking, reportRankingScore } from '../ranking-api.js';
import { mergeRankingRows } from '../ranking-board.mjs';

export default function Ranking() {
  const { guestName, scores } = usePlay();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const remote = await fetchRanking();
        if (!cancelled) {
          setRows(remote);
          setError('');
        }
      } catch {
        if (!cancelled) setError('Não deu para carregar o ranking ao vivo.');
      }
    }
    load();
    const id = window.setInterval(load, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const rankingPosted = useRef(false);

  useEffect(() => {
    if (!guestName) return undefined;
    const empty = !scores.points && !scores.stamps && !scores.done;
    if (empty && !rankingPosted.current) return undefined;
    rankingPosted.current = true;
    const t = window.setTimeout(() => {
      reportRankingScore({
        guestName,
        points: scores.points,
        stamps: scores.stamps,
      })
        .then((next) => setRows(next))
        .catch(() => {});
    }, 200);
    return () => window.clearTimeout(t);
  }, [guestName, scores.done, scores.points, scores.stamps]);

  const board = useMemo(
    () => mergeRankingRows(rows, { guestName, points: scores.points, stamps: scores.stamps }),
    [guestName, rows, scores.points, scores.stamps]
  );
  const youKey = String(guestName || '').trim().toLowerCase();

  return (
    <div className="play-page">
      <h1 className="play-script">Ranking</h1>
      <p className="play-sub">Placar dos convidados nota 10!</p>
      {error ? (
        <p className="hub-empty" role="status">
          {error}
        </p>
      ) : null}
      {board.length ? (
        <ol className="rank-list">
          {board.map((row, index) => {
            const isYou = row.guestName.trim().toLowerCase() === youKey;
            return (
              <li key={row.guestName} className={isYou ? 'rank-row is-you' : 'rank-row'}>
                <span className="rank-row__pos">{index + 1}</span>
                <span className="rank-row__name">
                  {row.guestName}
                  {isYou ? ' (você)' : ''}
                </span>
                <span className="rank-row__pts">{row.points} pts</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="hub-empty">Ainda não tem ninguém no placar. Responda o quiz ou mande uma foto.</p>
      )}
    </div>
  );
}
