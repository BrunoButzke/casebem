import { usePlay } from '../PlayContext.jsx';

export default function Ranking() {
  const { guestName, scores } = usePlay();

  return (
    <div className="play-page">
      <h1 className="play-script">Ranking</h1>
      <p className="play-sub">Os pontos do quiz e das fotos sobem neste placar</p>
      <ol className="rank-list">
        <li className="rank-row is-you">
          <span className="rank-row__pos">1</span>
          <span className="rank-row__name">{guestName}</span>
          <span className="rank-row__pts">{scores.points} pts</span>
        </li>
      </ol>
      <p className="hub-empty">O placar ao vivo com todo mundo entra na festa.</p>
    </div>
  );
}
