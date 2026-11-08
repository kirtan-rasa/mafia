import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  Clipboard,
  Crown,
  Eye,
  Fingerprint,
  LockKeyhole,
  Moon,
  Plus,
  Radio,
  Shield,
  Sparkles,
  Sun,
  Users,
  VenetianMask,
  Vote,
  X,
} from "lucide-react";

type Screen = "home" | "lobby";
type DemoPlayer = {
  id: number;
  name: string;
  initials: string;
  color: string;
  isHost?: boolean;
  isYou?: boolean;
  role?: string;
};

const initialPlayers: DemoPlayer[] = [
  { id: 1, name: "You", initials: "Y", color: "gold", isHost: true, isYou: true },
  { id: 2, name: "Alex", initials: "A", color: "blue" },
  { id: 3, name: "Mia", initials: "M", color: "rose" },
  { id: 4, name: "Noah", initials: "N", color: "green" },
  { id: 5, name: "Sam", initials: "S", color: "violet" },
  { id: 6, name: "Jamie", initials: "J", color: "orange" },
];

const roleSet = ["Mafia", "Mafia", "Doctor", "Detective", "Civilian", "Civilian"];

function shuffle<T,>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const j = random[0] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [name, setName] = useState("");
  const [players, setPlayers] = useState<DemoPlayer[]>(initialPlayers);
  const [rolesDealt, setRolesDealt] = useState(false);
  const [showRole, setShowRole] = useState(false);
  const [activePhase, setActivePhase] = useState<"lobby" | "night" | "day">("lobby");
  const [copied, setCopied] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const currentPlayer = useMemo(
    () => players.find((player) => player.isYou),
    [players],
  );

  const openPreview = () => {
    const safeName = name.trim().slice(0, 18) || "You";
    setPlayers([
      { id: 1, name: safeName, initials: safeName.slice(0, 1).toUpperCase(), color: "gold", isHost: true, isYou: true },
      ...initialPlayers.slice(1),
    ]);
    setRolesDealt(false);
    setShowRole(false);
    setActivePhase("lobby");
    setScreen("lobby");
  };

  const dealDemoRoles = () => {
    const assigned = shuffle(roleSet).map((role, index) => ({
      ...players[index],
      role,
    }));
    setPlayers(assigned);
    setRolesDealt(true);
    setShowRole(false);
    setActivePhase("night");
  };

  const leavePreview = () => {
    setScreen("home");
    setRolesDealt(false);
    setShowRole(false);
    setActivePhase("lobby");
  };

  const handleCopyPreview = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  if (screen === "lobby") {
    return (
      <main className="app-shell lobby-shell">
        <header className="topbar">
          <button className="brand brand-button" onClick={leavePreview} aria-label="Back to home">
            <span className="brand-mark"><VenetianMask size={19} strokeWidth={1.8} /></span>
            <span>mafia<span className="brand-period">.</span></span>
          </button>
          <div className="topbar-right">
            <span className="preview-pill"><span className="status-dot" /> Local preview</span>
            <button className="icon-button" onClick={() => setShowRules(true)} aria-label="How to play">
              <CircleHelp size={18} />
            </button>
          </div>
        </header>

        <div className="preview-notice">
          <LockKeyhole size={15} />
          <span><strong>Preview mode.</strong> This room only exists in this browser. Live invitations and cross-device play are not connected yet.</span>
          <button onClick={leavePreview} aria-label="Close preview notice"><X size={15} /></button>
        </div>

        <section className="lobby-heading">
          <div>
            <button className="back-link" onClick={leavePreview}><ArrowLeft size={15} /> Back to home</button>
            <div className="eyebrow"><span className="eyebrow-line" /> PRIVATE GAME ROOM</div>
            <h1>The table is <em>yours.</em></h1>
            <p>Gather your players, set the roles, and let the night begin.</p>
          </div>
          <div className="room-code-card">
            <span className="mini-label">ROOM CODE · PREVIEW</span>
            <strong>DEMO-42</strong>
            <button onClick={handleCopyPreview} className="copy-button">
              {copied ? <Check size={14} /> : <Clipboard size={14} />}
              {copied ? "Copied page link" : "Copy page link"}
            </button>
          </div>
        </section>

        <div className="lobby-grid">
          <section className="panel players-panel">
            <div className="panel-heading">
              <div>
                <div className="section-kicker">THE GUEST LIST</div>
                <h2>Players <span className="count-badge">{players.length}/10</span></h2>
              </div>
              <span className="live-label"><span className="status-dot" /> Preview only</span>
            </div>
            <div className="player-list">
              {players.map((player, index) => (
                <div className="player-row" key={player.id}>
                  <span className={`avatar avatar-${player.color}`}>{player.initials}</span>
                  <span className="player-name">
                    <strong>{player.name}{player.isYou ? " (you)" : ""}</strong>
                    <small>{player.isHost ? "Room host" : "Joined the room"}</small>
                  </span>
                  {player.isHost ? <span className="host-tag"><Crown size={12} /> HOST</span> : <span className="ready-tag"><Check size={13} /> READY</span>}
                  <span className="player-number">{String(index + 1).padStart(2, "0")}</span>
                </div>
              ))}
            </div>
            <button className="invite-button" onClick={handleCopyPreview}>
              <Plus size={16} /> {copied ? "Link copied" : "Invite players"}
              <span>Preview link only</span>
            </button>
          </section>

          <aside className="panel setup-panel">
            <div className="section-kicker">GAME SETTINGS</div>
            <h2>Build your table</h2>
            <p className="muted-copy">A balanced starting setup for a six-player game.</p>
            <div className="role-settings">
              <div className="role-setting">
                <span className="role-icon role-mafia"><VenetianMask size={16} /></span>
                <span><strong>Mafia</strong><small>Secret team</small></span>
                <b>2</b>
              </div>
              <div className="role-setting">
                <span className="role-icon role-doctor"><Shield size={16} /></span>
                <span><strong>Doctor</strong><small>Protect one player</small></span>
                <b>1</b>
              </div>
              <div className="role-setting">
                <span className="role-icon role-detective"><Eye size={16} /></span>
                <span><strong>Detective</strong><small>Investigate a player</small></span>
                <b>1</b>
              </div>
              <div className="role-setting">
                <span className="role-icon role-civilian"><Users size={16} /></span>
                <span><strong>Civilian</strong><small>Find the Mafia</small></span>
                <b>2</b>
              </div>
            </div>
            <div className="setup-total"><span>PLAYERS IN SETUP</span><strong>06 <small>/ 06</small></strong></div>
            <button className="primary-button full-button" onClick={dealDemoRoles}>
              <Sparkles size={17} /> {rolesDealt ? "Shuffle roles again" : "Deal roles"}
              <ArrowRight size={16} />
            </button>
            <p className="fine-print"><LockKeyhole size={12} /> Role dealing here is a local visual demo, not secure game logic.</p>
          </aside>
        </div>

        {rolesDealt && (
          <section className="panel role-reveal-panel">
            <div className="role-reveal-copy">
              <div className="section-kicker">THE NIGHT IS FALLING</div>
              <h2>Your role is ready.</h2>
              <p>Only reveal this card to yourself. In a real game, roles will be delivered privately by the server.</p>
            </div>
            <div className="role-card-wrap">
              <div className={`role-card ${showRole ? "is-revealed" : ""}`}>
                <div className="role-card-pattern"><Fingerprint size={38} strokeWidth={1.1} /></div>
                {showRole ? (
                  <>
                    <span className="mini-label">YOUR SECRET ROLE</span>
                    <strong>{currentPlayer?.role ?? "Civilian"}</strong>
                    <small>{currentPlayer?.role === "Mafia" ? "Work together. Stay hidden." : "Watch closely. Trust carefully."}</small>
                  </>
                ) : (
                  <>
                    <span className="mini-label">YOUR ROLE IS HIDDEN</span>
                    <strong>???</strong>
                    <small>Tap below when you're ready</small>
                  </>
                )}
              </div>
              <button className="reveal-button" onClick={() => setShowRole((value) => !value)}>
                <Eye size={15} /> {showRole ? "Hide my role" : "Reveal my role"}
              </button>
            </div>
            <div className="phase-switcher">
              <span className="mini-label">PREVIEW PHASE</span>
              <div>
                <button className={activePhase === "night" ? "phase-active" : ""} onClick={() => setActivePhase("night")}><Moon size={14} /> Night</button>
                <button className={activePhase === "day" ? "phase-active" : ""} onClick={() => setActivePhase("day")}><Sun size={14} /> Day</button>
                <button className={activePhase === "lobby" ? "phase-active" : ""} onClick={() => setActivePhase("lobby")}><Users size={14} /> Lobby</button>
              </div>
            </div>
          </section>
        )}
        {showRules && <RulesDialog onClose={() => setShowRules(false)} />}
      </main>
    );
  }

  return (
    <main className="app-shell home-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Mafia home">
          <span className="brand-mark"><VenetianMask size={19} strokeWidth={1.8} /></span>
          <span>mafia<span className="brand-period">.</span></span>
        </a>
        <nav className="main-nav">
          <a href="#how-it-works">How it works</a>
          <a href="#roles">Roles</a>
        </nav>
        <div className="topbar-right">
          <span className="topbar-note"><span className="status-dot" /> Free to play</span>
          <button className="nav-cta" onClick={openPreview}>Open preview <ArrowUpRightIcon /></button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> THE CLASSIC GAME. A NEW TABLE.</div>
          <h1>Trust is a<br />dangerous <em>game.</em></h1>
          <p className="hero-description">Bring your people together for a round of secrets, suspicion, and clever lies. One link gets everyone to the table.</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={openPreview}>Explore the preview <ArrowRight size={17} /></button>
            <a className="text-link" href="#how-it-works">See how it works <ArrowRight size={15} /></a>
          </div>
          <div className="hero-proof">
            <div className="avatar-stack">
              <span className="stack-avatar stack-one">A</span>
              <span className="stack-avatar stack-two">M</span>
              <span className="stack-avatar stack-three">J</span>
              <span className="stack-avatar stack-four">K</span>
            </div>
            <span><strong>Made for your group</strong><small>No downloads. No accounts planned.</small></span>
          </div>
        </div>

        <div className="hero-art" aria-label="Atmospheric game room illustration">
          <div className="art-glow" />
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="moon-disc" />
          <div className="city-silhouette city-back">
            <i /><i /><i /><i /><i /><i /><i />
          </div>
          <div className="city-silhouette city-front">
            <i /><i /><i /><i /><i /><i /><i /><i />
          </div>
          <div className="art-table">
            <div className="table-top" />
            <div className="table-leg" />
            <div className="table-glass" />
          </div>
          <div className="art-caption"><span>01 / 04</span><span>THE CITY NEVER SLEEPS</span></div>
          <div className="art-corner-mark"><VenetianMask size={24} /></div>
        </div>
      </section>

      <section className="play-section">
        <div className="play-intro">
          <span className="section-kicker">YOUR NEXT GAME STARTS HERE</span>
          <h2>One room.<br /><em>Everyone invited.</em></h2>
          <p>Create a room for your group, or join one with a room code. The host keeps the game moving.</p>
          <div className="trust-note"><LockKeyhole size={16} /><span><strong>Private by design</strong><small>Secret roles should stay secret. Server-side role privacy is part of the live-game build.</small></span></div>
        </div>

        <div className="create-card">
          <div className="card-topline"><span className="section-kicker">GET TO THE TABLE</span><span className="step-label">01 — START</span></div>
          <div className="card-tabs">
            <button className="tab active-tab" type="button">Create a room <Plus size={15} /></button>
            <button className="tab" type="button" onClick={() => setShowRules(true)}>Join a room <ArrowRight size={15} /></button>
          </div>
          <label className="field-label" htmlFor="nickname">YOUR NICKNAME</label>
          <div className="input-wrap">
            <Users size={17} />
            <input id="nickname" maxLength={18} placeholder="How should we call you?" value={name} onChange={(event) => setName(event.target.value)} />
            <span className="input-counter">{name.length}/18</span>
          </div>
          <button className="primary-button create-button" onClick={openPreview}>Open interactive preview <ArrowRight size={17} /></button>
          <div className="preview-footnote"><Radio size={13} /> Live multiplayer is the next build step</div>
          <div className="divider-label"><span /> WHAT YOU GET <span /></div>
          <div className="feature-mini-grid">
            <div><VenetianMask size={16} /><span>Secret roles</span></div>
            <div><Vote size={16} /><span>Group voting</span></div>
            <div><Moon size={16} /><span>Day & night</span></div>
            <div><LockKeyhole size={16} /><span>Private rooms</span></div>
          </div>
        </div>
      </section>

      <section className="steps-section" id="how-it-works">
        <div className="section-heading">
          <span className="section-kicker">A FEW SIMPLE STEPS</span>
          <h2>From link to <em>last one standing.</em></h2>
        </div>
        <div className="steps-grid">
          <Step number="01" icon={<Plus size={19} />} title="Create your room" text="Pick a nickname, set the table, and get a private room link." />
          <Step number="02" icon={<Users size={19} />} title="Gather your people" text="Send the invite. Friends join from any browser, no install needed." />
          <Step number="03" icon={<VenetianMask size={19} />} title="Let the game begin" text="Deal secret roles, move through day and night, and vote together." />
        </div>
      </section>

      <section className="roles-section" id="roles">
        <div>
          <span className="section-kicker">KNOW YOUR PART</span>
          <h2>Every role has<br /><em>a story to tell.</em></h2>
        </div>
        <div className="role-preview-grid">
          <RolePreview icon={<VenetianMask size={18} />} tone="mafia" title="Mafia" text="Stay hidden. Outnumber the town." />
          <RolePreview icon={<Shield size={18} />} tone="doctor" title="Doctor" text="Protect one player each night." />
          <RolePreview icon={<Eye size={18} />} tone="detective" title="Detective" text="Investigate and uncover the truth." />
          <RolePreview icon={<Users size={18} />} tone="town" title="Civilian" text="Discuss, vote, and find the Mafia." />
        </div>
      </section>

      <footer className="footer">
        <a className="brand" href="#top"><span className="brand-mark"><VenetianMask size={17} /></span><span>mafia<span className="brand-period">.</span></span></a>
        <span>Made for friends, powered by suspicion.</span>
        <a href="https://github.com/kirtan-rasa/mafia" target="_blank" rel="noreferrer">Open source on GitHub <ArrowRight size={14} /></a>
      </footer>
      {showRules && <RulesDialog onClose={() => setShowRules(false)} />}
    </main>
  );
}

function ArrowUpRightIcon() {
  return <ArrowRight size={15} className="diagonal-arrow" />;
}

function Step({ number, icon, title, text }: { number: string; icon: ReactNode; title: string; text: string }) {
  return (
    <article className="step-card">
      <div className="step-top"><span>{number}</span><div className="step-icon">{icon}</div></div>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function RolePreview({ icon, tone, title, text }: { icon: React.ReactNode; tone: string; title: string; text: string }) {
  return (
    <article className="role-preview-card">
      <span className={`role-icon role-${tone}`}>{icon}</span>
      <div><h3>{title}</h3><p>{text}</p></div>
      <ChevronDown size={15} />
    </article>
  );
}

function RulesDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <section className="rules-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onClick={(event) => event.stopPropagation()}>
        <button className="dialog-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <span className="dialog-icon"><CircleHelp size={22} /></span>
        <span className="section-kicker">A QUICK NOTE</span>
        <h2 id="dialog-title">The live table is<br /><em>coming together.</em></h2>
        <p>This first build is an interactive interface preview. Room codes, real invitations, shared player lists, and live game actions will arrive with the realtime backend.</p>
        <button className="primary-button full-button" onClick={onClose}>Got it <Check size={16} /></button>
      </section>
    </div>
  );
}

export default App;
