export default function Splash() {
  return (
    <div className="desafio desafio--splash" aria-busy="true" aria-label="Carregando">
      <div className="desafio__sparkles" aria-hidden="true" />
      <div className="desafio__deco" aria-hidden="true">
        {'♥ ❀ ❀ ❀ ♥ ❀ ❀ ❀ ♥ ❀ ❀ ❀ ♥'.split(' ').map((ch, i) => (
          <span key={`${ch}-${i}`}>{ch}</span>
        ))}
      </div>

      <div className="desafio__wreath-wrap">
        <img
          className="desafio__wreath desafio__wreath--spin"
          src="/images/desafio/wreath.png"
          alt=""
          width="512"
          height="512"
          decoding="async"
        />
        <div className="desafio__wreath-copy">
          <span className="desafio__ring" aria-hidden="true">
            💍
          </span>
          <p className="desafio__kicker">O casamento de</p>
          <h1 className="desafio__names">
            <span>Dani</span>
            <span className="desafio__amp">&amp;</span>
            <span>Carine</span>
          </h1>
        </div>
      </div>
    </div>
  );
}
