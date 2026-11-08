# Мафия онлайн

Онлайн-игра в «Мафию» для друзей. Интерфейс на русском языке.

## Стек

- React + TypeScript + Vite
- Supabase Auth (анонимные игровые сессии)
- Supabase Postgres + Realtime
- Supabase Edge Functions
- GitHub Actions + GitHub Pages

## Локальный запуск

Нужен Node.js 22 или новее.

\`\`\`bash
npm install
cp .env.example .env.local
npm run dev
\`\`\`

Заполните \`.env.local\` значениями Supabase: URL проекта и Publishable key. Без них приложение честно покажет, что сервер не подключён.

## Подключение Supabase

1. Создайте проект Supabase.
2. В **Authentication → Providers → Anonymous Sign-Ins** включите анонимный вход.
3. Откройте **SQL Editor** и выполните \`supabase/migrations/0001_initial_schema.sql\`.
4. В **Project Settings → API** скопируйте Project URL и Publishable key.
5. Заполните локальный \`.env.local\` переменными \`VITE_SUPABASE_URL\` и \`VITE_SUPABASE_PUBLISHABLE_KEY\`.
6. Установите Supabase CLI, войдите и привяжите проект:
   \`\`\`bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy game
   \`\`\`
7. В GitHub откройте **Settings → Secrets and variables → Actions → Variables** и добавьте переменные с теми же именами:
   - \`VITE_SUPABASE_URL\`
   - \`VITE_SUPABASE_PUBLISHABLE_KEY\`
8. После добавления переменных запустите workflow **Deploy to GitHub Pages** вручную либо отправьте новый коммит.

Edge Function использует серверный secret, который Supabase предоставляет автоматически. Service-role key не нужен в браузере и не должен попадать в GitHub Variables.

## Что уже реализовано в игровом MVP

- Создание комнаты с уникальным шестизначным кодом.
- Вход по коду или пригласительной ссылке.
- Список участников и готовность игроков в реальном времени.
- Случайная раздача ролей на сервере.
- Приватное получение собственной роли.
- Ночные действия мафии, доктора и комиссара.
- Дневное обсуждение в общем чате.
- Голосование и проверка условий победы.
- Передача ведущего, если он покидает комнату.

Для старта требуется минимум 4 игрока. На данный момент в MVP нет голосовой связи, таймеров и расширенных пользовательских ролей.

## Безопасность

- В браузере используется только Publishable key.
- Изменения игрового состояния проходят через Edge Function.
- Таблицы ролей и действий закрыты от прямого клиентского чтения.
- RLS ограничивает публичные данные участниками соответствующей комнаты.
