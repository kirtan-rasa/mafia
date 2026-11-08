import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleHelp,
  Crown,
  Eye,
  Fingerprint,
  LockKeyhole,
  Moon,
  Plus,
  Shield,
  Sparkles,
  Sun,
  Users,
  VenetianMask,
  Vote,
  X,
} from "lucide-react";

type Screen = "home" | "lobby";
type EntryMode = "create" | "join";
type Phase = "lobby" | "night" | "day";

type DemoPlayer = {
  id: number;
  name: string;
  initials: string;
  color: string;
  isHost?: boolean;
  isYou?: boolean;
  role?: string;
};

const sampleGuests: DemoPlayer[] = [
  { id: 2, name: "Alex", initials: "A", color: "blue" },
  { id: 3, name: "Mia", initials: "M", color: "rose" },
  { id: 4, name: "Noah", initials: "N", color: "green" },
  { id: 5, name: "Sam", initials: "S", color: "violet" },
  { id: 6, name: "Jamie", initials: "J", color: "orange" },
];

const roleSet = ["Mafia", "Mafia", "Doctor", "Detective", "Civilian", "Civilian"];

const phaseDescriptions: Record<Phase, string> = {
  lobby: "Players gather here before the host starts the game.",
  night: "The Mafia acts in secret while special roles use their abilities.",
  day: "Everyone discusses what happened and tries to identify the Mafia.",
};

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
  const [entryMode, setEntryMode] = useState<EntryMode>("create");
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joinFeedback, setJoinFeedback] = useState(false);
  const [players, setPlayers] = useState<DemoPlayer[]>([]);
  const [rolesDealt, setRolesDealt] = useState(false);
  const [showRole, setShowRole] = useState(false);
  const [activePhase, setActivePhase] = useState<Phase>("lobby");
  const [showRules, setShowRules] = useState(false);

  const currentPlayer = useMemo(
    () => players.find((player) => player.isYou),
    [players],
  );

  const scrollToGameCard = () => {
    setEntryMode("create");
    setJoinFeedback(false);
    document.getElementById("play")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  const switchEntryMode = (mode: EntryMode) => {
    setEntryMode(mode);
    setJoinFeedback(false);
  };

  const handleEntrySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (entryMode === "join") {
      setJoinFeedback(true);
      return;
    }

    const safeName = name.trim().slice(0, 18);
    const host: DemoPlayer = {
      id: 1,
      name: safeName,
      initials: safeName.slice(0, 1).toUpperCase(),
      color: "gold",
      isHost: true,
      isYou: true,
    };

    setPlayers([host, ...sampleGuests]);
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
    setJoinFeedback(false);
  };

  if (screen === "lobby") {
    return (
      <main className="app-shell lobby-shell">
        <header className="topbar">
          <button className="brand brand-button" onClick={leavePreview} aria-label="Back to Mafia home">
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

        <div className="preview-notice" role="status">
          <LockKeyhole size={16} />
          <span><strong>You're exploring a demo.</strong> This room and its sample players exist only in this browser. No one else can join it yet.</span>
        </div>

        <section className="lobby-heading">
          <div>
            <button className="back-link" onClick={leavePreview}><ArrowLeft size={15} /> Back to home</button>
            <div className="eyebrow"><span className="eyebrow-line" /> HOST VIEW · PREVIEW</div>
            <h1>The table is <em>yours.</em></h1>
            <p>Here's what your room could look like before a game begins.</p>
          </div>
          <div className="room-code-card">
            <span className="mini-label">ROOM STATUS</span>
            <strong>NOT LIVE</strong>
            <p>A shareable invite appears when online rooms are enabled.</p>
          </div>
        </section>

        <div className="lobby-grid">
          <section className="panel players-panel">
            <div className="panel-heading">
              <div>
                <div className="section-kicker">SAMPLE GUEST LIST</div>
                <h2>Example roster <span className="count-badge">{players.length} players</span></h2>
              </div>
              <span className="live-label">ILLUSTRATION</span>
            </div>
            <div className="player-list">
              {players.map((player, index) => (
                <div className="player-row" key={player.id}>
                  <span className={"avatar avatar-" + player.color}>{player.initials}</span>
                  <span className="player-name">
                    <strong>{player.name}{player.isYou ? " (you)" : ""}</strong>
                    <small>{player.isHost ? "Room host" : "Sample guest"}</small>
                  </span>
                  {player.isHost ? (
                    <span className="host-tag"><Crown size={12} /> HOST</span>
                  ) : (
                    <span className="sample-tag">DEMO</span>
                  )}
                  <span className="player-number">{String(index + 1).padStart(2, "0")}</span>
                </div>
              ))}
            </div>
            <div className="invite-placeholder">
              <LockKeyhole size={16} />
              <span><strong>Invitations aren't live yet</strong><small>When multiplayer is connected, you'll be able to copy a private room link here.</small></span>
            </div>
          </section>

          <aside className="panel setup-panel">
            <div className="section-kicker">EXAMPLE GAME SETUP</div>
            <h2>A six-player table</h2>
            <p className="muted-copy">A sample role mix for demonstrating the host flow.</p>
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
            <div className="setup-total"><span>ROLES IN THIS PREVIEW</span><strong>06 <small>/ 06</small></strong></div>
            <button className="primary-button full-button" onClick={dealDemoRoles}>
              <Sparkles size={17} /> {rolesDealt ? "Shuffle sample roles" : "Preview role reveal"}
              <ArrowRight size={16} />
            </button>
            <p className="fine-print"><LockKeyhole size={13} /> This is a local demonstration. Real role assignment must happen privately on the server.</p>
          </aside>
        </div>

        {rolesDealt && (
          <section className="panel role-reveal-panel">
            <div className="role-reveal-copy">
              <div className="section-kicker">ROLE REVEAL · PREVIEW</div>
              <h2>Your sample role is ready.</h2>
              <p>This card demonstrates the private reveal step. In a live game, the server will show each player only their own role.</p>
            </div>
            <div className="role-card-wrap">
              <div className={"role-card " + (showRole ? "is-revealed" : "")}>
                <div className="role-card-pattern"><Fingerprint size={38} strokeWidth={1.1} /></div>
                {showRole ? (
                  <>
                    <span className="mini-label">YOUR SAMPLE ROLE</span>
                    <strong>{currentPlayer?.role ?? "Civilian"}</strong>
                    <small>{currentPlayer?.role === "Mafia" ? "Stay calm. Keep your cover." : "Listen closely. Trust carefully."}</small>
                  </>
                ) : (
                  <>
                    <span className="mini-label">ROLE HIDDEN</span>
                    <strong>???</strong>
                    <small>Reveal when you're ready</small>
                  </>
                )}
              </div>
              <button className="reveal-button" onClick={() => setShowRole((value) => !value)} aria-pressed={showRole}>
                <Eye size={15} /> {showRole ? "Hide sample role" : "Reveal sample role"}
              </button>
            </div>
            <div className="phase-switcher">
              <span className="mini-label">EXPLORE THE GAME PHASES</span>
              <div role="group" aria-label="Preview game phases">
                <button className={activePhase === "night" ? "phase-active" : ""} onClick={() => setActivePhase("night")} aria-pressed={activePhase === "night"}><Moon size={14} /> Night</button>
                <button className={activePhase === "day" ? "phase-active" : ""} onClick={() => setActivePhase("day")} aria-pressed={activePhase === "day"}><Sun size={14} /> Day</button>
                <button className={activePhase === "lobby" ? "phase-active" : ""} onClick={() => setActivePhase("lobby")} aria-pressed={activePhase === "lobby"}><Users size={14} /> Lobby</button>
              </div>
              <p className="phase-description" aria-live="polite">{phaseDescriptions[activePhase]}</p>
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
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#roles">Roles</a>
        </nav>
        <div className="topbar-right">
          <span className="topbar-note"><span className="status-dot" /> Free to play</span>
          <button className="nav-cta" onClick={scrollToGameCard}>Create a room <ArrowRight size={15} /></button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> THE CLASSIC GAME. A NEW TABLE.</div>
          <h1>Trust is a<br />dangerous <em>game.</em></h1>
          <p className="hero-description">Bring your people together for a round of secrets, suspicion, and clever lies. Set up your table, then invite your group when live rooms launch.</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={scrollToGameCard}>Start a game <ArrowRight size={17} /></button>
            <a className="text-link" href="#how-it-works">See how it works <ArrowRight size={15} /></a>
          </div>
          <div className="hero-proof">
            <div className="avatar-stack" aria-hidden="true">
              <span className="stack-avatar stack-one">A</span>
              <span className="stack-avatar stack-two">M</span>
              <span className="stack-avatar stack-three">J</span>
              <span className="stack-avatar stack-four">K</span>
            </div>
            <span><strong>Made for your group</strong><small>No downloads. Play right in your browser.</small></span>
          </div>
        </div>

        <div className="hero-art" aria-label="Atmospheric illustration of a city at night and a game table">
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

      <section className="play-section" id="play">
        <div className="play-intro">
          <span className="section-kicker">YOUR NEXT GAME STARTS HERE</span>
          <h2>One room.<br /><em>Everyone invited.</em></h2>
          <p>Create a room for your group, or join one with a room code. Start with a preview of the host flow while online rooms are being built.</p>
          <div className="trust-note"><LockKeyhole size={16} /><span><strong>Secret roles stay secret</strong><small>Live games will use server-side role delivery so no player can inspect someone else's role.</small></span></div>
        </div>

        <div className="create-card">
          <div className="card-topline">
            <span className="section-kicker">GET TO THE TABLE</span>
            <span className="step-label">INTERACTIVE PREVIEW</span>
          </div>
          <div className="card-tabs" role="tablist" aria-label="Choose what you want to do">
            <button
              className={"tab " + (entryMode === "create" ? "active-tab" : "")}
              type="button"
              role="tab"
              aria-selected={entryMode === "create"}
              aria-controls="room-entry-panel"
              onClick={() => switchEntryMode("create")}
            >
              Create a room <Plus size={15} />
            </button>
            <button
              className={"tab " + (entryMode === "join" ? "active-tab" : "")}
              type="button"
              role="tab"
              aria-selected={entryMode === "join"}
              aria-controls="room-entry-panel"
              onClick={() => switchEntryMode("join")}
            >
              Join a room <ArrowRight size={15} />
            </button>
          </div>

          <form id="room-entry-panel" role="tabpanel" onSubmit={handleEntrySubmit}>
            <label className="field-label" htmlFor="nickname">YOUR NICKNAME</label>
            <div className="input-wrap">
              <Users size={17} aria-hidden="true" />
              <input
                id="nickname"
                name="nickname"
                type="text"
                autoComplete="nickname"
                minLength={2}
                maxLength={18}
                required
                placeholder="e.g. Alex"
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-describedby="nickname-help"
              />
              <span className="input-counter">{name.length}/18</span>
            </div>
            <p id="nickname-help" className="field-help">2–18 characters. This is how your friends will see you.</p>

            {entryMode === "join" && (
              <div className="join-code-field">
                <label className="field-label" htmlFor="room-code">ROOM CODE</label>
                <div className="input-wrap code-input-wrap">
                  <LockKeyhole size={17} aria-hidden="true" />
                  <input
                    id="room-code"
                    name="room-code"
                    type="text"
                    autoComplete="off"
                    inputMode="text"
                    minLength={6}
                    maxLength={6}
                    pattern="[A-Za-z0-9]{6}"
                    required
                    placeholder="ABC123"
                    value={roomCode}
                    onChange={(event) => {
                      setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
                      setJoinFeedback(false);
                    }}
                    aria-describedby="room-code-help"
                  />
                  <span className="input-counter">{roomCode.length}/6</span>
                </div>
                <p id="room-code-help" className="field-help">Enter the 6-character code shared by your host.</p>
              </div>
            )}

            <button className="primary-button create-button" type="submit">
              {entryMode === "create" ? "Preview host lobby" : "Check room code"}
              <ArrowRight size={17} />
            </button>
          </form>

          {entryMode === "join" && joinFeedback && (
            <div className="inline-feedback" role="status" aria-live="polite">
              <LockKeyhole size={17} />
              <span><strong>Online rooms aren't connected yet.</strong><small>That code can't be checked in this preview. Once multiplayer is live, this will take you straight into your friends' room.</small></span>
            </div>
          )}
          {entryMode === "create" && (
            <div className="preview-footnote"><LockKeyhole size={13} /> Opens a local demo. It won't create a shareable room yet.</div>
          )}

          <div className="divider-label"><span /> INCLUDED IN THE GAME <span /></div>
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
          <Step number="01" icon={<Plus size={19} />} title="Create your room" text="Choose a nickname and set up a private table for your group." />
          <Step number="02" icon={<Users size={19} />} title="Gather your people" text="Share the room link. Friends join in their browser without installing anything." />
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

function Step({ number, icon, title, text }: { number: string; icon: ReactNode; title: string; text: string }) {
  return (
    <article className="step-card">
      <div className="step-top"><span>{number}</span><div className="step-icon">{icon}</div></div>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function RolePreview({ icon, tone, title, text }: { icon: ReactNode; tone: string; title: string; text: string }) {
  return (
    <article className="role-preview-card">
      <span className={"role-icon role-" + tone}>{icon}</span>
      <div><h3>{title}</h3><p>{text}</p></div>
    </article>
  );
}

function RulesDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <section className="rules-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onClick={(event) => event.stopPropagation()}>
        <button className="dialog-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <span className="dialog-icon"><CircleHelp size={22} /></span>
        <span className="section-kicker">HOW TO PLAY</span>
        <h2 id="dialog-title">A town full of<br /><em>secrets.</em></h2>
        <div className="rules-list">
          <div><Moon size={17} /><span><strong>Night</strong><small>The Mafia chooses a target. Special roles use their abilities in secret.</small></span></div>
          <div><Sun size={17} /><span><strong>Day</strong><small>Everyone discusses the events of the night and shares suspicions.</small></span></div>
          <div><Vote size={17} /><span><strong>Vote</strong><small>The group votes to eliminate a player they believe is Mafia.</small></span></div>
        </div>
        <p className="rules-note">This site is currently an interface preview. Live rooms and shared gameplay are the next milestone.</p>
        <button className="primary-button full-button" onClick={onClose}>Got it <Check size={16} /></button>
      </section>
    </div>
  );
}

export default App;
