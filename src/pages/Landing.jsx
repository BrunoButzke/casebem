import { useLayoutEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signupRequest } from '../lib/session-api.mjs';
import '../landing/style.css';

export default function Landing() {
  const navigate = useNavigate();
  const [plan, setPlan] = useState('basic');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    let cancelled = false;
    let modRef;
    (async () => {
      const mod = await import('../landing/main.js');
      modRef = mod;
      if (cancelled) {
        mod.destroyLandingEffects();
        return;
      }
      await mod.initLandingEffects({ bindPlans: false });
      if (cancelled) mod.destroyLandingEffects();
    })();
    return () => {
      cancelled = true;
      modRef?.destroyLandingEffects();
    };
  }, []);

  async function onSignup(event) {
    event.preventDefault();
    setMessage('');
    if (password.length < 8) {
      setMessage('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    setBusy(true);
    try {
      const res = await signupRequest({
        email: email.trim().toLowerCase(),
        password,
        plan,
      });
      if (res.status === 409) {
        setMessage('Este e-mail já tem conta');
        return;
      }
      if (!res.ok) {
        setMessage('Não foi possível criar a conta. Confira os dados e tente de novo.');
        return;
      }
      navigate('/admin');
    } catch {
      setMessage('Não foi possível criar a conta. Tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="preloader" aria-hidden="true">
        <div className="preloader__inner">
          <span className="preloader__mark">
            Case<em>Bem</em>
          </span>
        </div>
        <div className="preloader__bar">
          <span></span>
        </div>
      </div>

      <div className="scroll-progress" aria-hidden="true">
        <span></span>
      </div>
      <div className="cursor" aria-hidden="true"></div>

      <header className="nav">
        <a href="#topo" className="logo" aria-label="CaseBem, início">
          <span className="logo__word">
            Case<em>Bem</em>
          </span>
        </a>
        <nav className="nav__links" aria-label="Seções">
          <a href="#como-funciona">Como funciona</a>
          <a href="#app">App</a>
          <a href="#planos">Planos</a>
        </nav>
        <div className="nav__actions">
          <Link to="/entrar" className="btn btn--ghost btn--sm magnetic">
            Entrar
          </Link>
          <a href="#cadastro" className="btn btn--sm magnetic">
            Criar conta
          </a>
        </div>
      </header>

      <main id="topo">
        <section className="hero">
          <div className="hero__bg" data-parallax="">
            <img
              src="/images/landing/hero-casal.jpg"
              alt="Casal em ensaio ao ar livre"
              width="1600"
              height="900"
            />
          </div>
          <div className="hero__shade"></div>
          <div className="hero__grid container">
            <div className="hero__copy">
              <p className="eyebrow hero__eyebrow">Para noivos que querem menos stress</p>
              <h1 className="hero__title">
                <span className="line">
                  <span>
                    Case<em>Bem</em>
                  </span>
                </span>
              </h1>
              <p className="hero__lead">
                Site do casamento, convite virtual, presentes que viram Pix e dinâmicas para a
                festa — tudo em um só lugar.
              </p>
              <div className="hero__ctas">
                <a href="#cadastro" className="btn magnetic">
                  Criar conta
                </a>
                <Link to="/casal/dani-carine" className="btn btn--ghost magnetic">
                  Ver exemplo de casal parceiro
                </Link>
              </div>
            </div>
            <div className="hero__phone phone" aria-hidden="true">
              <div className="phone__notch"></div>
              <div className="phone__screen">
                <img src="/images/landing/ui-site.jpg" alt="" />
              </div>
            </div>
          </div>
        </section>

        <div className="marquee" aria-hidden="true">
          <div className="marquee__track">
            <span>Site informativo</span>
            <span>·</span>
            <span>Convite virtual</span>
            <span>·</span>
            <span>Lista → Pix</span>
            <span>·</span>
            <span>Ranking</span>
            <span>·</span>
            <span>Galeria</span>
            <span>·</span>
            <span>Jogos</span>
            <span>·</span>
            <span>Mesas</span>
            <span>·</span>
            <span>Assessor VIP</span>
            <span>·</span>
          </div>
        </div>

        <section className="manifesto" id="manifesto">
          <div className="container manifesto__grid">
            <p className="manifesto__text" data-words="">
              O casamento merece mais do que um <mark>link</mark> perdido no WhatsApp.
            </p>
            <div className="manifesto__stats">
              <div className="stat">
                <span className="stat__num" data-count="" data-from="0" data-to="3">
                  0
                </span>
                <span className="stat__label">planos</span>
              </div>
              <div className="stat">
                <span className="stat__num" data-count="" data-from="0" data-to="12">
                  0
                </span>
                <span className="stat__label">dinâmicas</span>
              </div>
              <div className="stat">
                <span className="stat__num" data-count="" data-from="0" data-to="100">
                  0
                </span>
                <span className="stat__label">% Pix</span>
              </div>
            </div>
          </div>
        </section>

        <section className="app-highlight">
          <div className="container app-highlight__grid">
            <div className="app-highlight__media">
              <img
                src="/images/landing/app-ranking.jpg"
                alt="Preview do app de entretenimento CaseBem"
                width="375"
                height="812"
              />
            </div>
            <div className="app-highlight__content">
              <p className="eyebrow">O diferencial CaseBem</p>
              <h2>
                App de entretenimento
                <br />
                para a festa
              </h2>
              <p className="app-highlight__desc">
                Com o nosso app em desenvolvimento, a ideia é levar experiência para a pista:
                desafios com ranking, galeria ao vivo e jogos de festa que engajam os
                convidados durante a celebração.
              </p>
              <p className="app-highlight__status">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                Em desenvolvimento — nos planos Pro e VIP
              </p>
            </div>
          </div>
        </section>

        <section className="how" id="como-funciona">
          <div className="how__pin">
            <div className="container how__layout">
              <div className="how__copy">
                <p className="eyebrow">Como funciona</p>
                <h2 className="how__title">Do briefing à festa</h2>
                <ul className="how__steps" role="list">
                  <li className="how__step is-active" data-step="0">
                    <span className="how__n">01</span>
                    <div>
                      <strong>Contam a história</strong>
                      <p>Data, local, dress code e o clima do casal.</p>
                    </div>
                  </li>
                  <li className="how__step" data-step="1">
                    <span className="how__n">02</span>
                    <div>
                      <strong>Sai o informativo</strong>
                      <p>Site personalizado + convite virtual para compartilhar.</p>
                    </div>
                  </li>
                  <li className="how__step" data-step="2">
                    <span className="how__n">03</span>
                    <div>
                      <strong>Presentes viram Pix</strong>
                      <p>Lista elegante; o valor cai direto para os noivos.</p>
                    </div>
                  </li>
                  <li className="how__step" data-step="3">
                    <span className="how__n">04</span>
                    <div>
                      <strong>A festa no app</strong>
                      <p>Desafios, ranking, galeria e jogos para os convidados.</p>
                    </div>
                  </li>
                </ul>
              </div>
              <div className="how__visual" aria-hidden="true">
                <figure className="how__frame is-active" data-frame="0">
                  <img src="/images/landing/step-briefing.jpg" alt="" />
                </figure>
                <figure className="how__frame" data-frame="1">
                  <img src="/images/landing/step-site.jpg" alt="" />
                </figure>
                <figure className="how__frame" data-frame="2">
                  <img src="/images/landing/step-pix.jpg" alt="" />
                </figure>
                <figure className="how__frame" data-frame="3">
                  <img src="/images/landing/app-ranking.jpg" alt="" />
                </figure>
              </div>
            </div>
          </div>
        </section>

        <section className="theme" id="personalize">
          <div className="container theme__grid">
            <div className="theme__copy">
              <p className="eyebrow">Personalize</p>
              <h2>O informativo no clima de vocês</h2>
              <p className="theme__lead">
                Troque a paleta e veja o preview mudar — Básico e Pro usam templates; no VIP o
                site nasce do zero.
              </p>
              <div className="theme__swatches" role="group" aria-label="Tema do informativo">
                <button
                  type="button"
                  className="theme__dot is-active"
                  style={{ '--c': '#2f4a40' }}
                  data-theme="lagoon"
                  aria-pressed="true"
                  title="Lagoa"
                >
                  <span className="sr-only">Lagoa</span>
                </button>
                <button
                  type="button"
                  className="theme__dot"
                  style={{ '--c': '#d4846a' }}
                  data-theme="salmon"
                  aria-pressed="false"
                  title="Salmão"
                >
                  <span className="sr-only">Salmão</span>
                </button>
                <button
                  type="button"
                  className="theme__dot"
                  style={{ '--c': '#5c4a3a' }}
                  data-theme="espresso"
                  aria-pressed="false"
                  title="Espresso"
                >
                  <span className="sr-only">Espresso</span>
                </button>
                <button
                  type="button"
                  className="theme__dot"
                  style={{ '--c': '#3a4a5c' }}
                  data-theme="dusk"
                  aria-pressed="false"
                  title="Dusk"
                >
                  <span className="sr-only">Dusk</span>
                </button>
              </div>
            </div>
            <div className="theme__preview" data-theme="lagoon">
              <div className="theme__card">
                <p className="theme__eyebrow">21 · 11 · 2026</p>
                <p className="theme__names">
                  Ana <em>&</em> Leo
                </p>
                <p className="theme__place">Lagoa da Conceição</p>
                <span className="theme__chip">Como chegar</span>
              </div>
            </div>
          </div>
        </section>

        <section className="features" id="app">
          <div className="features__head container">
            <p className="eyebrow">App de dinâmicas</p>
            <h2>A festa também é experiência</h2>
            <p className="features__lead">
              Desafios com ranking, galeria compartilhada, jogos e arrecadação — no Pro e no
              VIP.
            </p>
          </div>
          <div className="features__viewport">
            <div className="features__track">
              <article className="features__card">
                <figure>
                  <img src="/images/landing/app-ranking.jpg" alt="App com ranking de desafios" />
                </figure>
                <h3>Desafios + ranking</h3>
                <p>Missões personalizadas que engajam a mesa inteira.</p>
              </article>
              <article className="features__card">
                <figure>
                  <img src="/images/landing/app-galeria.jpg" alt="Galeria compartilhada na festa" />
                </figure>
                <h3>Galeria ao vivo</h3>
                <p>Convidados enviam fotos; vocês guardam tudo num só lugar.</p>
              </article>
              <article className="features__card">
                <figure>
                  <img src="/images/landing/app-jogos.jpg" alt="Jogos para entreter convidados" />
                </figure>
                <h3>Jogos de festa</h3>
                <p>Quebra-gelo e brincadeiras para arrecadar e entreter.</p>
              </article>
              <article className="features__card">
                <figure>
                  <img
                    src="/images/landing/vip-mesas.jpg"
                    alt="Organização de mesas e convidados"
                  />
                </figure>
                <h3>Mesas & convidados</h3>
                <p>Painel VIP com assessor para distribuir quem senta onde.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="plans" id="planos">
          <div className="container">
            <p className="eyebrow">Planos</p>
            <h2>Escolha o ritmo do casamento</h2>
            <p className="plans__lead">Valores únicos. Sem mensalidade escondida.</p>

            <div className="plans__grid">
              <article className="plan reveal">
                <p className="plan__name">Básico</p>
                <p className="plan__price">Gratuito</p>
                <ul>
                  <li>Site informativo personalizado</li>
                  <li>Convite virtual</li>
                  <li>Lista de presentes → Pix</li>
                </ul>
                <a
                  href="#cadastro"
                  className="btn btn--ghost magnetic"
                  data-plan="basic"
                  onClick={() => setPlan('basic')}
                >
                  Quero o Básico
                </a>
              </article>

              <article className="plan plan--featured reveal">
                <p className="plan__badge">Mais escolhido</p>
                <p className="plan__name">Pro</p>
                <p className="plan__price">R$&nbsp;299</p>
                <ul>
                  <li>Tudo do Básico</li>
                  <li>App de entretenimento e arrecadação</li>
                  <li>Sessões extras no informativo</li>
                  <li>Painel de mesas e convidados</li>
                </ul>
                <a
                  href="#cadastro"
                  className="btn magnetic"
                  data-plan="pro"
                  onClick={() => setPlan('pro')}
                >
                  Quero o Pro
                </a>
              </article>

              <article className="plan reveal">
                <p className="plan__name">VIP</p>
                <p className="plan__price">R$&nbsp;499</p>
                <ul>
                  <li>Tudo do Pro</li>
                  <li>Site exclusivo feito do zero</li>
                  <li>Dinâmicas personalizadas</li>
                  <li>Link personalizado</li>
                  <li>Assessor para mesas e presentes</li>
                </ul>
                <a
                  href="#cadastro"
                  className="btn btn--ghost magnetic"
                  data-plan="vip"
                  onClick={() => setPlan('vip')}
                >
                  Quero o VIP
                </a>
              </article>
            </div>
          </div>
        </section>

        <section className="partner" id="exemplo">
          <div className="partner__bg" data-parallax="">
            <img
              src="/images/hero-casal.jpg"
              alt=""
              aria-hidden="true"
              width="1600"
              height="900"
            />
          </div>
          <div className="partner__shade"></div>
          <div className="container partner__content">
            <p className="eyebrow">Casal parceiro</p>
            <h2>Dani & Carine</h2>
            <p>
              Um informativo real, no clima da Lagoa da Conceição — veja o que o CaseBem
              entrega na prática.
            </p>
            <Link to="/casal/dani-carine" className="btn btn--ghost magnetic">
              Ver exemplo de casal parceiro
            </Link>
          </div>
        </section>

        <section className="waitlist" id="cadastro">
          <div className="container waitlist__inner">
            <p className="eyebrow">Cadastro</p>
            <h2 className="waitlist__title">
              Crie a conta
              <br />
              do casamento de vocês.
            </h2>
            <p className="waitlist__lead">
              Plano Básico é gratuito. Pro e VIP ficam com pagamento em breve.
            </p>

            <form
              id="cadastro-form"
              className="waitlist__form"
              noValidate
              onSubmit={onSignup}
            >
              <div className="waitlist__row">
                <label className="waitlist__field">
                  <span>E-mail</span>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    placeholder="voce@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label className="waitlist__field">
                  <span>Senha</span>
                  <input
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
              </div>
              <fieldset className="waitlist__plans">
                <legend>Plano</legend>
                <label>
                  <input
                    type="radio"
                    name="plan"
                    value="basic"
                    checked={plan === 'basic'}
                    onChange={() => setPlan('basic')}
                  />{' '}
                  Básico
                </label>
                <label>
                  <input
                    type="radio"
                    name="plan"
                    value="pro"
                    checked={plan === 'pro'}
                    onChange={() => setPlan('pro')}
                  />{' '}
                  Pro
                </label>
                <label>
                  <input
                    type="radio"
                    name="plan"
                    value="vip"
                    checked={plan === 'vip'}
                    onChange={() => setPlan('vip')}
                  />{' '}
                  VIP
                </label>
              </fieldset>
              <p className="waitlist__msg" role="status" aria-live="polite">
                {message}
              </p>
              <button type="submit" className="btn magnetic" disabled={busy}>
                {busy ? 'Criando…' : 'Criar conta'}
              </button>
            </form>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p className="footer__mark">
          Case<em>Bem</em>
        </p>
        <p className="footer__note">Produto em construção</p>
        <Link to="/casal/dani-carine" className="footer__link">
          Exemplo Dani & Carine
        </Link>
      </footer>
    </>
  );
}
