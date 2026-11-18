import { useMemo } from 'react';
import { MOCK_RANKING } from '../mock-data.js';
import { useDemo } from '../DemoContext.jsx';

export default function Ranking() {
  const { guestName, scores } = useDemo();
  const youKey = String(guestName || '').trim().toLowerCase();

  const board = useMemo(() => {
    const rows = MOCK_RANKING.map((row) => {
      if (row.guestName.trim().toLowerCase() !== youKey) return { ...row };
      return {
        ...row,
        points: Math.max(row.points, scores.points),
        stamps: Math.max(row.stamps, scores.stamps),
      };
    });
    return rows.sort((a, b) => {
      const pts = (Number(b.points) || 0) - (Number(a.points) || 0);
      if (pts) return pts;
      return (Number(b.stamps) || 0) - (Number(a.stamps) || 0);
    });
  }, [guestName, scores.points, scores.stamps, youKey]);

  return (
    <div className="play-page">
      <h1 className="play-script">Ranking</h1>
      <p className="play-sub">Placar ilustrativo da demo</p>
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
    </div>
  );
}
