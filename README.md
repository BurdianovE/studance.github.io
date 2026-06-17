# Studance — Школа танца

Astro web app for the Studance dance school.

## Stack

- **Framework**: [Astro](https://astro.build) 4.x
- **Styling**: Pure CSS with custom properties (no build-time CSS framework)
- **Fonts**: Unbounded (display) + Golos Text (body) via Google Fonts
- **Scripting**: Vanilla TypeScript (inside `<script>` blocks in `.astro` files)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321)

## Build for Production

```bash
npm run build
npm run preview
```

## База данных и авторизация (SQLite)

- **Файл БД**: `data/studance.db` (создаётся при первом запросе)
- **Таблицы**: `users`, `sessions`, `leads`
- **Пароли**: `scrypt` с солью на пользователя
- **Сессии**: таблица `sessions` + cookie `studance_session` (`HttpOnly`)
- **UI**: страница [/account](http://localhost:4321/account) — вход, регистрация, профиль
- **Требования**: Node.js ≥ 22.5 (встроенный `node:sqlite`)

### API

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/auth/register` | Регистрация + сессия |
| POST | `/api/auth/login` | Вход + сессия |
| GET | `/api/auth/me` | Текущий пользователь |
| POST | `/api/auth/logout` | Выход |
| POST | `/api/leads` | Заявка с главной (в `leads`) |

Тело запроса для регистрации: `{ "email", "password", "name?" }`. Для входа: `{ "email", "password" }`.

## Project Structure

```
src/
  components/
    Nav.astro          — Sticky navigation with mobile burger menu
    Hero.astro         — Hero section (yellow card + photo grid)
    Directions.astro   — Age-based direction tabs with carousel
    Teachers.astro     — Teacher cards grid
    Signup.astro       — Sign-up form with validation
    Footer.astro       — Footer with links and contacts
  layouts/
    Layout.astro       — Base HTML layout (head, nav, footer)
  lib/
    db.ts              — SQLite (users, sessions, leads)
    auth-db.ts         — Регистрация, вход, сессии
    leads-db.ts        — Заявки с формы
  pages/
    index.astro        — Home page
    account.astro      — Личный кабинет (вход / регистрация)
  styles/
    global.css         — Design tokens and base styles
public/
  favicon.svg
```

## Design System

| Token          | Value       |
|----------------|-------------|
| `--yellow`     | `#F5C800`   |
| `--teal`       | `#1A3A4A`   |
| `--teal-light` | `#2A5060`   |
| `--font-display` | Unbounded |
| `--font-body`  | Golos Text  |

## Customisation

- **Real photos**: Replace the CSS placeholder shapes in `Hero.astro` and `Directions.astro` with `<img>` tags pointing to your photos.
- **Teacher photos**: Add real headshots in `Teachers.astro`.
- **Form backend**: Wire up the `signup__form` submit handler in `Signup.astro` to your backend or a service like Formspree / EmailJS.
- **Schedule**: Build out the `#schedule` section using your real timetable data.
