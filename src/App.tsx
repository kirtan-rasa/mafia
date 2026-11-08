import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, Clipboard, Crown, Eye, EyeOff,
  LoaderCircle, LockKeyhole, LogOut, MessageCircle, Moon, Send, Shield,
  Sun, Users, VenetianMask, Vote, Wifi, WifiOff,
} from "lucide-react";
import { callGame, isSupabaseConfigured, supabase } from "./lib/supabase";

type HCaptchaWidgetId = number;
type HCaptchaOptions = {
  sitekey: string;
  theme?: "light" | "dark";
  callback: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
};
declare global {
  interface Window {
    hcaptcha?: {
      render: (container: HTMLElement, options: HCaptchaOptions) => HCaptchaWidgetId;
      reset: (widgetId?: HCaptchaWidgetId) => void;
      remove?: (widgetId: HCaptchaWidgetId) => void;
    };
  }
}

const HCAPTCHA_SITE_KEY = "210c0f1e-b12e-485a-b072-d6deae1e73ca";

type Phase = "waiting" | "night" | "day" | "voting" | "finished";
type Player = {
  id: string; nickname: string; is_alive: boolean; is_ready: boolean;
  is_host: boolean; revealed_role: string | null;
};
type Room = {
  id: string; code: string; status: Phase; winner: "mafia" | "town" | null;
  round_number: number; settings: { max_players: number };
};
type Message = { id: string; nickname: string; body: string; created_at: string };
type Role = {
  role: "mafia" | "doctor" | "detective" | "civilian" | null;
  team: string[];
  investigation: { nickname: string; is_mafia: boolean } | null;
};
type RoomData = { room: Room; players: Player[]; messages: Message[]; my_role?: Role };

const roleNames: Record<string, string> = {
  mafia: "Мафия", doctor: "Доктор", detective: "Комиссар", civilian: "Мирный житель",
};
const roleDescriptions: Record<string, string> = {
  mafia: "Ночью выберите игрока, которого хотите вывести из игры. Действуйте сообща.",
  doctor: "Ночью выберите игрока, которого хотите защитить.",
  detective: "Ночью проверьте одного игрока. Результат увидите только вы.",
  civilian: "У вас нет ночного действия. Обсуждайте события днём и ищите мафию.",
};
const phaseNames: Record<Phase, string> = {
  waiting: "Сбор игроков", night: "Ночь", day: "Обсуждение",
  voting: "Голосование", finished: "Игра завершена",
};

function App() {
  const [boot, setBoot] = useState<"loading" | "ready" | "captcha" | "config" | "error">("loading");
  const [bootMessage, setBootMessage] = useState("");
  const [screen, setScreen] = useState<"home" | "room">("home");
  const [mode, setMode] = useState<"create" | "join">(
    new URLSearchParams(window.location.search).has("room") ? "join" : "create",
  );
  const [nickname, setNickname] = useState(() => localStorage.getItem("mafia:nickname") ?? "");
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get("room")?.toUpperCase() ?? "");
  const [maxPlayers, setMaxPlayers] = useState("10");
  const [data, setData] = useState<RoomData | null>(null);
  const [myRole, setMyRole] = useState<Role | null>(null);
  const [roleShown, setRoleShown] = useState(false);
  const [target, setTarget] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const captchaContainerRef = useRef<HTMLDivElement>(null);
  const captchaWidgetIdRef = useRef<HCaptchaWidgetId | null>(null);

  const room = data?.room ?? null;
  const players = data?.players ?? [];
  const messages = data?.messages ?? [];
  const me = players.find((p) => p.nickname.toLocaleLowerCase() === nickname.trim().toLocaleLowerCase());
  const isHost = Boolean(me?.is_host);
  const alive = players.filter((p) => p.is_alive);
  const readyCount = players.filter((p) => p.is_ready).length;

  const applyData = useCallback((next: RoomData) => {
    setData(next);
    if (next.my_role) setMyRole(next.my_role);
    if (next.room.status === "waiting") setMyRole(null);
    if (next.room.status === "finished") setRoleShown(true);
    setTarget("");
    setError("");
  }, []);

  const refresh = useCallback(async (roomCode?: string) => {
    const lookup = roomCode ?? room?.code;
    if (!lookup) return;
    const next = await callGame<RoomData>("get_room", { code: lookup });
    if (next.room.status !== "waiting") {
      next.my_role = await callGame<Role>("get_my_role", { code: lookup });
    }
    applyData(next);
  }, [applyData, room?.code]);

  const restoreRoom = useCallback(async (isActive: () => boolean) => {
    const invite = new URLSearchParams(window.location.search).get("room");
    if (invite) {
      const inviteCode = invite.toUpperCase().slice(0, 6);
      setMode("join");
      setCode(inviteCode);
      try {
        const restored = await callGame<RoomData>("get_room", { code: inviteCode });
        if (restored.room.status !== "waiting") {
          restored.my_role = await callGame<Role>("get_my_role", { code: inviteCode });
        }
        if (!isActive()) return;
        applyData(restored);
        setScreen("room");
        localStorage.setItem("mafia:last-room", inviteCode);
      } catch {
        // This is a new invitee, not a returning member. Keep the join form open.
      }
      return;
    }

    const remembered = localStorage.getItem("mafia:last-room");
    if (remembered) {
      try {
        const next = await callGame<RoomData>("get_room", { code: remembered });
        if (next.room.status !== "waiting") next.my_role = await callGame<Role>("get_my_role", { code: remembered });
        if (!isActive()) return;
        applyData(next);
        setScreen("room");
      } catch {
        localStorage.removeItem("mafia:last-room");
      }
    }
  }, [applyData]);

  useEffect(() => {
    let active = true;
    const init = async () => {
      if (!isSupabaseConfigured || !supabase) {
        if (active) setBoot("config");
        return;
      }
      try {
        const { data: session, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!active) return;
        if (!session.session) {
          setBoot("captcha");
          return;
        }
        setBoot("ready");
        await restoreRoom(() => active);
      } catch (cause) {
        if (!active) return;
        setBoot("error");
        setBootMessage(cause instanceof Error ? cause.message : "Не удалось восстановить гостевую сессию.");
      }
    };
    void init();
    return () => { active = false; };
  }, [restoreRoom]);

  const handleCaptchaVerified = useCallback(async (captchaToken: string) => {
    if (!supabase) return;
    setBusy(true);
    setBootMessage("");
    setError("");
    try {
      const { error: authError } = await supabase.auth.signInAnonymously({
        options: { captchaToken },
      });
      if (authError) throw authError;
      setBoot("ready");
      await restoreRoom(() => true);
    } catch (cause) {
      setBootMessage(cause instanceof Error ? cause.message : "Не удалось создать гостевую сессию.");
      if (captchaWidgetIdRef.current !== null) {
        window.hcaptcha?.reset(captchaWidgetIdRef.current);
      }
    } finally {
      setBusy(false);
    }
  }, [restoreRoom]);

  useEffect(() => {
    if (boot !== "captcha") return;
    let cancelled = false;
    let attempts = 0;
    let pollId: number | undefined;

    const renderWidget = () => {
      const api = window.hcaptcha;
      const container = captchaContainerRef.current;
      if (cancelled || !api || !container || captchaWidgetIdRef.current !== null) return false;
      try {
        captchaWidgetIdRef.current = api.render(container, {
          sitekey: HCAPTCHA_SITE_KEY,
          theme: "dark",
          callback: (token) => { void handleCaptchaVerified(token); },
          "expired-callback": () => setBootMessage("Срок проверки истёк. Подтвердите ещё раз."),
          "error-callback": () => setBootMessage("Не удалось загрузить CAPTCHA. Проверьте соединение и блокировщики."),
        });
        return true;
      } catch {
        setBootMessage("Не удалось запустить CAPTCHA. Обновите страницу и попробуйте снова.");
        return false;
      }
    };

    if (!renderWidget()) {
      pollId = window.setInterval(() => {
        attempts += 1;
        if (renderWidget() || attempts >= 100) {
          if (pollId !== undefined) window.clearInterval(pollId);
          if (attempts >= 100 && captchaWidgetIdRef.current === null) {
            setBootMessage("Виджет hCaptcha не загрузился. Проверьте блокировщик рекламы или расширения браузера.");
          }
        }
      }, 100);
    }

    return () => {
      cancelled = true;
      if (pollId !== undefined) window.clearInterval(pollId);
      if (captchaWidgetIdRef.current !== null) {
        window.hcaptcha?.remove?.(captchaWidgetIdRef.current);
        captchaWidgetIdRef.current = null;
      }
    };
  }, [boot, handleCaptchaVerified]);

  useEffect(() => {
    const client = supabase;
    if (!room || !client) return;
    const channel = client.channel("mafia-room-" + room.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: "id=eq." + room.id }, () => { void refresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: "room_id=eq." + room.id }, () => { void refresh(); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages", filter: "room_id=eq." + room.id }, () => { void refresh(); })
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [room?.id, refresh]);

  const run = async <T,>(action: string, payload: Record<string, unknown> = {}): Promise<T | null> => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      return await callGame<T>(action, payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось выполнить действие.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const openRoom = (next: RoomData, cleanName: string) => {
    applyData(next);
    setNickname(cleanName);
    localStorage.setItem("mafia:nickname", cleanName);
    localStorage.setItem("mafia:last-room", next.room.code);
    setScreen("room");
    setRoleShown(false);
    const url = new URL(window.location.href);
    url.searchParams.set("room", next.room.code);
    window.history.replaceState({}, "", url.toString());
  };

  const enter = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = nickname.trim();
    if (cleanName.length < 2 || cleanName.length > 18) {
      setError("Никнейм должен содержать от 2 до 18 символов.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const next = mode === "create"
        ? await callGame<RoomData>("create_room", { nickname: cleanName, max_players: Number(maxPlayers) })
        : await callGame<RoomData>("join_room", { nickname: cleanName, code: code.trim().toUpperCase() });
      openRoom(next, cleanName);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось открыть комнату.");
    } finally {
      setBusy(false);
    }
  };

  const roomAction = async (action: string, payload: Record<string, unknown> = {}) => {
    if (!room) return null;
    const result = await run<RoomData>(action, { code: room.code, ...payload });
    if (result && result.room) applyData(result);
    return result;
  };

  const leave = async () => {
    if (!room) return;
    const result = await run<{ left: boolean }>("leave_room", { code: room.code });
    if (!result) return;
    localStorage.removeItem("mafia:last-room");
    const url = new URL(window.location.href);
    url.searchParams.delete("room");
    window.history.replaceState({}, "", url.toString());
    setData(null); setMyRole(null); setScreen("home");
    setNotice("Вы покинули комнату.");
  };

  const copyInvite = async () => {
    if (!room) return;
    const url = new URL(window.location.href);
    url.searchParams.set("room", room.code);
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1700);
    } catch {
      setError("Не удалось скопировать ссылку. Скопируйте адрес из строки браузера.");
    }
  };

  const selectedTargets = useMemo(() => alive.filter((p) => {
    if (p.id === me?.id && myRole?.role === "mafia") return false;
    if (room?.status === "voting" && p.id === me?.id) return false;
    return true;
  }), [alive, me?.id, myRole?.role, room?.status]);

  const nightAction = async () => {
    if (!myRole?.role || !target) return;
    const action = myRole.role === "mafia" ? "night_kill"
      : myRole.role === "doctor" ? "protect"
      : myRole.role === "detective" ? "investigate" : null;
    if (!action) return;
    const next = await roomAction("night_action", { action, target_player_id: target });
    if (next) setNotice("Действие принято. Ожидаем завершения ночи ведущим.");
  };

  const submitMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!message.trim()) return;
    const next = await roomAction("send_message", { message: message.trim() });
    if (next) setMessage("");
  };

  if (boot === "loading") {
    return <main className="app-shell loading-screen"><LoaderCircle className="spin" size={30} /><p>Подключаемся к игре…</p></main>;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => { if (screen === "room") void leave(); else window.scrollTo({ top: 0, behavior: "smooth" }); }}>
          <span className="brand-mark"><VenetianMask size={21} /></span><span>Мафия<span className="brand-period">.</span></span>
        </button>
        <div className="topbar-right">
          {screen === "room" && room ? (
            <>
              <span className="room-code-top">КОМНАТА {room.code}</span>
              <button className="icon-button" onClick={copyInvite} aria-label="Скопировать приглашение">{copied ? <Check size={18} /> : <Clipboard size={18} />}</button>
              <button className="icon-button" onClick={() => void leave()} disabled={busy} aria-label="Покинуть комнату"><LogOut size={18} /></button>
            </>
          ) : (
            <span className={boot === "ready" ? "connection-state online" : "connection-state offline"}>
              {boot === "ready" ? <><Wifi size={15} /> Сервер подключён</> : <><WifiOff size={15} /> Нет подключения</>}
            </span>
          )}
        </div>
      </header>

      {screen === "home" ? (
        <section className="home-layout">
          <div className="welcome-copy">
            <span className="eyebrow"><span className="eyebrow-line" /> ОНЛАЙН · БЕСПЛАТНО</span>
            <h1>Соберите друзей.<br /><em>Найдите мафию.</em></h1>
            <p>Создайте комнату, отправьте ссылку друзьям и играйте прямо в браузере. Без установки приложений.</p>
            <div className="quick-facts">
              <span><Users size={17} /> 4–50 игроков</span>
              <span><LockKeyhole size={17} /> Личные роли</span>
              <span><Wifi size={17} /> Живые обновления</span>
            </div>
          </div>

          <section className="entry-card panel">
            <span className="section-kicker">НАЧАТЬ ИГРУ</span>
            <h2>{mode === "create" ? "Создать комнату" : "Войти по приглашению"}</h2>
            <div className="entry-tabs" role="tablist" aria-label="Действие">
              <button type="button" role="tab" aria-selected={mode === "create"} className={mode === "create" ? "selected" : ""} onClick={() => { setMode("create"); setError(""); }}><span className="plus-mark">+</span> Создать</button>
              <button type="button" role="tab" aria-selected={mode === "join"} className={mode === "join" ? "selected" : ""} onClick={() => { setMode("join"); setError(""); }}><ArrowRight size={17} /> Войти по коду</button>
            </div>
            <form className="entry-form" onSubmit={enter}>
              <label htmlFor="nickname">Ваш никнейм</label>
              <input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} minLength={2} maxLength={18} required placeholder="Например, Алекс" autoComplete="nickname" />
              {mode === "create" ? (
                <>
                  <label htmlFor="max-players">Размер комнаты</label>
                  <select id="max-players" value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)}>
                    {Array.from({ length: 47 }, (_, index) => index + 4).map((count) => <option key={count} value={count}>До {count} игроков</option>)}
                  </select>
                </>
              ) : (
                <>
                  <label htmlFor="room-code">Код комнаты</label>
                  <input id="room-code" className="code-field" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} minLength={6} maxLength={6} pattern="[A-Z0-9]{6}" required placeholder="A7K9QP" autoComplete="off" />
                </>
              )}
              <button className="primary-button submit-button" type="submit" disabled={busy || boot !== "ready"}>
                {busy ? <LoaderCircle className="spin" size={19} /> : mode === "create" ? <Users size={19} /> : <ArrowRight size={19} />}
                {busy ? "Подождите…" : mode === "create" ? "Создать комнату" : "Присоединиться"}
              </button>
            </form>

            {boot === "config" && <div className="setup-notice"><AlertCircle size={19} /><div><strong>Сервер ещё не подключён</strong><p>Настройте Supabase: адрес проекта, Publishable key, базу данных и игровую функцию. После этого здесь появятся настоящие комнаты.</p></div></div>}
            {boot === "captcha" && <div className="captcha-gate" role="group" aria-label="Проверка hCaptcha"><div><strong>Подтвердите, что вы не робот</strong><p>Проверка защищает создание гостевых игровых сессий.</p></div><div ref={captchaContainerRef} className="captcha-widget" />{bootMessage && <p className="captcha-error" role="alert">{bootMessage}</p>}</div>}
            {boot === "error" && <div className="setup-notice error-notice"><AlertCircle size={19} /><div><strong>Не удалось подключиться</strong><p>{bootMessage}</p></div></div>}
            {error && <div className="error-message" role="alert"><AlertCircle size={17} />{error}</div>}
            {notice && <div className="success-message" role="status"><Check size={17} />{notice}</div>}
            <p className="privacy-note"><LockKeyhole size={14} /> Достаточно никнейма. Аккаунт создавать не нужно.</p>
          </section>
        </section>
      ) : room ? (
        <section className="room-screen">
          <div className="room-heading">
            <div>
              <button className="back-link" onClick={() => void leave()}><ArrowLeft size={16} /> На главную</button>
              <span className="eyebrow"><span className="eyebrow-line" /> КОМНАТА {room.code}</span>
              <h1>{room.status === "waiting" ? "Собираем игроков" : room.status === "finished" ? "Партия завершена" : "Раунд " + room.round_number + " · " + phaseNames[room.status]}</h1>
              <p>{room.status === "waiting" ? "Отправьте приглашение и дождитесь готовности игроков." : alive.length + " игроков осталось в игре."}</p>
            </div>
            <div className="invite-card"><span>КОД ПРИГЛАШЕНИЯ</span><strong>{room.code}</strong><button onClick={copyInvite}><Clipboard size={16} /> {copied ? "Ссылка скопирована" : "Скопировать ссылку"}</button></div>
          </div>

          {error && <div className="error-message room-alert" role="alert"><AlertCircle size={17} />{error}</div>}
          {notice && <div className="success-message room-alert" role="status"><Check size={17} />{notice}</div>}

          <div className="room-grid">
            <section className="panel players-panel">
              <div className="panel-title"><div><span className="section-kicker">УЧАСТНИКИ</span><h2>Игроки <small>{players.length}/{room.settings.max_players}</small></h2></div><span className="phase-chip">{phaseNames[room.status]}</span></div>
              <div className="player-list">
                {players.map((player, index) => (
                  <div className={"player-row" + (!player.is_alive ? " player-dead" : "")} key={player.id}>
                    <span className={"player-avatar avatar-" + (index % 6)}>{player.nickname.slice(0, 1).toUpperCase()}</span>
                    <span className="player-name"><strong>{player.nickname}{player.id === me?.id ? " (вы)" : ""}</strong><small>{player.is_host ? "Ведущий" : !player.is_alive ? "Выбыл из игры" : room.status === "waiting" ? "Участник" : "В игре"}</small></span>
                    {player.is_host ? <span className="host-label"><Crown size={14} /> ВЕДУЩИЙ</span>
                      : player.revealed_role ? <span className="dead-role">{roleNames[player.revealed_role] ?? player.revealed_role}</span>
                      : room.status === "waiting" ? <span className={player.is_ready ? "ready-label" : "waiting-label"}>{player.is_ready ? <><Check size={14} /> ГОТОВ</> : "ОЖИДАЕТ"}</span> : null}
                  </div>
                ))}
              </div>
              {room.status === "waiting" && (
                <div className="lobby-actions">
                  <div className="ready-summary"><strong>{readyCount} из {players.length}</strong><span>игроков готовы</span></div>
                  <button className={me?.is_ready ? "secondary-button" : "primary-button"} onClick={() => void roomAction("set_ready")} disabled={busy}>{me?.is_ready ? <><Check size={18} /> Вы готовы</> : <>Отметиться готовым <ArrowRight size={17} /></>}</button>
                  {isHost && <button className="start-button" onClick={() => void roomAction("start_game")} disabled={busy || players.length < 4 || readyCount !== players.length}>Начать игру <ArrowRight size={18} /></button>}
                  {isHost && <p className="hint-copy">{players.length < 4 ? "Для начала нужно минимум 4 игрока." : readyCount !== players.length ? "Дождитесь готовности всех игроков." : "Все готовы. Можно начинать!"}</p>}
                </div>
              )}
            </section>

            <section className="panel game-panel">
              {room.status === "waiting" ? (
                <>
                  <span className="section-kicker">ПЕРЕД НАЧАЛОМ</span><h2>Как начать партию</h2>
                  <div className="instructions-list">
                    <div><span>1</span><p>Скопируйте ссылку и отправьте её друзьям.</p></div>
                    <div><span>2</span><p>Каждый вводит никнейм и нажимает «Готов».</p></div>
                    <div><span>3</span><p>Когда соберутся минимум 4 игрока, ведущий запускает игру.</p></div>
                  </div>
                  <div className="role-count-hint"><Shield size={19} /><p>Роли раздаются случайно. Каждый видит только собственную роль.</p></div>
                </>
              ) : room.status === "finished" ? (
                <div className="finished-state"><span className="section-kicker">ПОБЕДИТЕЛЬ</span><div className="winner-icon">{room.winner === "mafia" ? <VenetianMask size={32} /> : <Shield size={32} />}</div><h2>{room.winner === "mafia" ? "Победила мафия" : "Победили мирные жители"}</h2><p>Партия завершена. Можно покинуть комнату и создать новую.</p></div>
              ) : (
                <div className="active-game">
                  <div className="phase-heading"><span className="section-kicker">ТЕКУЩАЯ ФАЗА</span><span className="phase-chip">{room.status === "night" ? <><Moon size={14} /> Ночь</> : room.status === "day" ? <><Sun size={14} /> День</> : <><Vote size={14} /> Голосование</>}</span></div>
                  <div className="my-role-card">
                    <div className="role-card-top"><span>ВАША РОЛЬ</span><button onClick={() => setRoleShown((v) => !v)} aria-label={roleShown ? "Скрыть роль" : "Показать роль"}>{roleShown ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
                    <div className="role-card-content">{roleShown ? <strong>{myRole?.role ? roleNames[myRole.role] : "Загрузка роли…"}</strong> : <strong className="hidden-role">••••••••</strong>}<p>{roleShown && myRole?.role ? roleDescriptions[myRole.role] : "Нажмите на значок глаза, чтобы посмотреть свою роль."}</p></div>
                    {roleShown && myRole?.role === "mafia" && myRole.team.length > 0 && <div className="team-note">Ваша команда: {myRole.team.join(", ")}</div>}
                    {myRole?.investigation && <div className="investigation-result">Проверка: <strong>{myRole.investigation.nickname}</strong> — {myRole.investigation.is_mafia ? "мафия" : "не мафия"}.</div>}
                  </div>

                  {room.status === "night" && myRole?.role && ["mafia", "doctor", "detective"].includes(myRole.role) && me?.is_alive && (
                    <div className="action-box"><h3>{myRole.role === "mafia" ? "Выберите цель" : myRole.role === "doctor" ? "Кого защитить?" : "Кого проверить?"}</h3><p>{roleDescriptions[myRole.role]}</p>
                      <div className="target-list">{selectedTargets.map((p) => <button key={p.id} className={target === p.id ? "target-button target-selected" : "target-button"} onClick={() => setTarget(p.id)}><span className="player-avatar small-avatar">{p.nickname.slice(0,1).toUpperCase()}</span>{p.nickname}{target === p.id && <Check size={17} />}</button>)}</div>
                      <button className="primary-button action-submit" disabled={busy || !target} onClick={() => void nightAction()}>Подтвердить действие <ArrowRight size={17} /></button>
                    </div>
                  )}
                  {room.status === "night" && (!me?.is_alive || myRole?.role === "civilian") && <p className="phase-message">Этой ночью у вас нет действия. Дождитесь утра.</p>}
                  {room.status === "day" && <><div className="day-message"><Sun size={21} /><div><strong>Время обсуждения</strong><p>Обсудите события ночи и попробуйте определить, кто играет за мафию.</p></div></div>{isHost ? <button className="primary-button phase-button" disabled={busy} onClick={() => void roomAction("advance_phase")}>Перейти к голосованию <ArrowRight size={17} /></button> : <p className="phase-message">Ведущий начнёт голосование, когда обсуждение закончится.</p>}</>}
                  {room.status === "voting" && me?.is_alive && <div className="action-box"><h3>За кого голосуете?</h3><p>Свой голос можно изменить до завершения голосования.</p><div className="target-list">{selectedTargets.map((p) => <button key={p.id} className={target === p.id ? "target-button target-selected" : "target-button"} onClick={() => setTarget(p.id)}><span className="player-avatar small-avatar">{p.nickname.slice(0,1).toUpperCase()}</span>{p.nickname}{target === p.id && <Check size={17} />}</button>)}</div><button className="primary-button action-submit" disabled={busy || !target} onClick={() => void roomAction("vote", { target_player_id: target })}>Отдать голос <Vote size={17} /></button></div>}
                  {room.status === "voting" && !me?.is_alive && <p className="phase-message">Вы выбыли и больше не можете голосовать.</p>}
                  {(room.status === "night" || room.status === "voting") && isHost && <button className="primary-button phase-button" disabled={busy} onClick={() => void roomAction("advance_phase")}>{room.status === "night" ? "Завершить ночь" : "Подвести итоги голосования"} <ArrowRight size={17} /></button>}
                  {(room.status === "night" || room.status === "voting") && !isHost && <p className="phase-message">Ожидаем ведущего: он завершит текущую фазу.</p>}
                </div>
              )}
            </section>
          </div>

          {room.status === "day" && <section className="panel chat-panel">
            <div className="panel-title"><div><span className="section-kicker">ОБЩИЙ ЧАТ</span><h2><MessageCircle size={20} /> Обсуждение</h2></div><span className="chat-limit">До 500 символов</span></div>
            <div className="message-list" aria-live="polite">{messages.length === 0 ? <p className="empty-copy">Чат пока пуст. Начните обсуждение.</p> : messages.map((m) => <div className="chat-message" key={m.id}><strong>{m.nickname}</strong><span>{m.body}</span><time>{new Date(m.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</time></div>)}</div>
            {me?.is_alive ? <form className="chat-form" onSubmit={submitMessage}><input value={message} maxLength={500} onChange={(e) => setMessage(e.target.value)} placeholder="Напишите сообщение…" /><button className="primary-button" disabled={busy || !message.trim()}><Send size={18} /> Отправить</button></form> : <p className="phase-message">Вы выбыли и больше не можете писать.</p>}
          </section>}
        </section>
      ) : null}

      <footer className="footer"><span>Мафия онлайн</span><span>Играйте честно. Гасите всех.</span></footer>
    </main>
  );
}

export default App;
