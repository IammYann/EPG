# Comprehensive Visual & Architecture Guide: EPG Timeline System

This document provides a visual and technical breakdown of the entire Electronic Program Guide (EPG) application — covering everything from UI/UX design, state management, routes, database design, ingestion pipelines, reminder schedulers, and unit/feature testing.

---

## 1. High-Level System Architecture Diagram

```
                             ┌────────────────────────────────────────────────┐
                             │               BROWSER (CLIENT)                 │
                             │  Vanilla JS Single Page Application (app.js)   │
                             └───────────────────────┬────────────────────────┘
                                                     │ HTTP / REST API (Axios)
                                                     ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       LARAVEL BACKEND APPLICATION                                      │
│                                                                                                        │
│  ┌───────────────────────┐   ┌───────────────────────────────────┐   ┌──────────────────────────────┐  │
│  │   Routes & Controllers│   │     Services & Adapter Pattern    │   │  Background Scheduler & Job  │  │
│  │ (routes/web.php API)  │──►│ (EpgIngestionService / Adapters)  │──►│ (epg:check-reminders cmd)    │  │
│  └───────────────────────┘   └───────────────────────────────────┘   └──────────────────────────────┘  │
└────────────────────────────────────────────┬───────────────────────────────────────────────────────────┘
                                             │ Eloquent ORM
                                             ▼
                             ┌────────────────────────────────────────────────┐
                             │            SQLITE DATABASE ENGINE              │
                             │  (users, channels, programs, reminders, etc.) │
                             └────────────────────────────────────────────────┘
```

---

## 2. Comprehensive Feature Walkthrough (UI / UX)

### Feature A: Dynamic Multi-Channel Timeline Guide (`#/epg`)

```
 ┌─────────────────────────────────────────────────────────────────────────────────────────────┐
 │ EPG [Timeline Guide] [My Alerts]                          (🔔 2)  Demo User  [Logout]       │
 ├─────────────────────────────────────────────────────────────────────────────────────────────┤
 │ TV GUIDE — KANTIPUR · STAR SPORTS 1 HD                   [<] [Today (Aug 17)] [>] [📍 Now] │
 ├──────────────┬──────────────────────────────────────────────────────────────────────────────┤
 │              │ 00:00        01:00        02:00        03:00   │(Now Line)  04:00            │
 ├──────────────┼────────────────────────────────────────────────┼─────────────────────────────┤
 │ 🔴 Kantipur  │ [ Show A (00:00-01:30) ] [ Show B (01:30-03:00) ]│ [ Live News ] [ Show C ]    │
 ├──────────────┼────────────────────────────────────────────────┼─────────────────────────────┤
 │ 🔵 StarSports│ [ Match 1 (00:00-02:00) ]   [ Highlight Reel ]  │ [ Live Cricket Match ] 🔔   │
 └──────────────┴────────────────────────────────────────────────┴─────────────────────────────┘
```

- **Sticky Controls**: Left channel bar stays locked during horizontal scrolling; time headers stay locked during vertical scrolling.
- **Current Time Bar (📍 Now)**: A vertical red line dynamically moves across the grid based on Nepal Standard Time (`Asia/Kathmandu`).
- **"Now" Button Action**: Clicking **Now** automatically shifts the selected date dropdown to **Today** and smoothly scrolls the viewport to center on the current time marker.

---

### Feature B: Program Details & Reminder Setup Modal

Clicking any program card on the timeline opens a detailed slide-up modal:

```
 ┌─────────────────────────────────────────────────────────┐
 │ [Kantipur]                                          [X] │
 │ Kantipur Samachar (Live Evening News)                   │
 │ [News] [Nepali] [Live Broadcast]                         │
 ├─────────────────────────────────────────────────────────┤
 │ DATE          TIME (NPT)           DURATION             │
 │ Mon, Aug 17   07:00 PM – 08:00 PM  60 min               │
 ├─────────────────────────────────────────────────────────┤
 │ Complete daily coverage of national and international   │
 │ headlines, politics, and current affairs.               │
 ├─────────────────────────────────────────────────────────┤
 │                                     [🔔 Set Reminder]   │
 └─────────────────────────────────────────────────────────┘
```

When setting a reminder:
- Options: `At start time`, `5 min before`, `15 min before` (default), `30 min before`, `1 hour before`, or **Custom minute input**.

---

### Feature C: Notification Bell & Alert System

```
 ┌───────────────────────────┐
 │ Notifications      [Read] │
 ├───────────────────────────┤
 │ 🔔 Live Cricket Match     │
 │ Show starts in 15 min on  │
 │ Star Sports 1 HD.         │
 ├───────────────────────────┤
 │ 🔔 Kantipur Samachar      │
 │ Show is starting now!     │
 └───────────────────────────┘
```

- **Polling Engine**: Every 15 seconds, the JS SPA polls `/api/notifications` silently in the background.
- **Badge Counter**: The bell icon displays a glowing red counter whenever new unread notifications exist.

---

## 3. Backend Routes & Controller Map (`routes/web.php`)

All API routes are served under the `/api` prefix and return standardized JSON responses:

```
            Client Request
                  │
                  ▼
         ┌─────────────────┐
         │ routes/web.php  │
         └────────┬────────┘
                  │
        ┌─────────┴─────────────────────────────────────────┐
        │                                                   │
        ▼ (Public Routes)                                   ▼ (Protected Middleware 'auth')
┌───────────────────────────────┐                  ┌─────────────────────────────────┐
│ POST /api/auth/login          │                  │ GET    /api/reminders           │
│ POST /api/auth/logout         │                  │ POST   /api/reminders           │
│ GET  /api/auth/me             │                  │ PATCH  /api/reminders/{id}      │
│ GET  /api/channels            │                  │ DELETE /api/reminders/{id}      │
│ GET  /api/channels/{id}/progs │                  │ GET    /api/notifications       │
│ GET  /api/programs/{id}       │                  │ PATCH  /api/notifications/{id}  │
└───────────────────────────────┘                  └─────────────────────────────────┘
```

---

## 4. EPG Ingestion Engine & Adapter Pattern

Different TV channels export their schedule data in varying JSON formats. The system uses an **Adapter Pattern** to ingest any schema into a clean, normalized database structure.

```
                   ┌──────────────────────────────────────┐
                   │       storage/app/epg/*.json         │
                   └──────────────────┬───────────────────┘
                                      │
                                      ▼
                   ┌──────────────────────────────────────┐
                   │         EpgIngestionService          │
                   └──────────────────┬───────────────────┘
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
┌───────────────────────────┐                   ┌───────────────────────────┐
│      KantipurAdapter      │                   │     StarSportsAdapter     │
├───────────────────────────┤                   ├───────────────────────────┤
│ • Parses nested structure │                   │ • Parses flat program list│
│ • Converts times to UTC   │                   │ • Interval-based lane     │
│ • Computes durations      │                   │   overlap packing algorithm│
└─────────────┬─────────────┘                   └─────────────┬─────────────┘
              │                                               │
              └───────────────────────┬───────────────────────┘
                                      │ Normalized Data Arrays
                                      ▼
                        ┌───────────────────────────┐
                        │   Program::updateOrCreate │
                        │  (Saved to SQLite database│
                        └───────────────────────────┘
```

---

## 5. Background Notification Scheduler Engine

Reminders run autonomously on the server via Laravel's Artisan command scheduler.

```
           ┌──────────────────────────────────────────────┐
           │ Every Minute (Cron / php artisan schedule)   │
           └──────────────────────┬───────────────────────┘
                                  │
                                  ▼
           ┌──────────────────────────────────────────────┐
           │     php artisan epg:check-reminders          │
           └──────────────────────┬───────────────────────┘
                                  │
                                  ▼
           ┌──────────────────────────────────────────────┐
           │ Query Pending Reminders:                     │
           │ `start_time - minutes_before <= now()`       │
           └──────────────────────┬───────────────────────┘
                                  │
                                  ▼
           ┌──────────────────────────────────────────────┐
           │ Create EpgNotification Record & Set          │
           │ reminder status = 'triggered'                │
           └──────────────────────────────────────────────┘
```

---

## 6. Directory Map & Key Files

| Category | File Path | Description |
|---|---|---|
| **Frontend Logic** | [resources/js/app.js](file:///home/bananaman/TV_notif2/resources/js/app.js) | Full Vanilla ES6 SPA logic (routing, timeline rendering, modal controls, API calls, time math). |
| **Frontend View** | [resources/views/app.blade.php](file:///home/bananaman/TV_notif2/resources/views/app.blade.php) | Minimal HTML container that mounts the JS SPA application. |
| **CSS Styling** | [resources/css/app.css](file:///home/bananaman/TV_notif2/resources/css/app.css) | Custom scrollbars, glassmorphism styles, and typography setup. |
| **Database Migrations** | `database/migrations/*` | Table definitions for `users`, `channels`, `programs`, `reminders`, `epg_notifications`. |
| **EPG Ingestion** | [app/Services/Epg/EpgIngestionService.php](file:///home/bananaman/TV_notif2/app/Services/Epg/EpgIngestionService.php) | Data import service that orchestrates channel adapters. |
| **Ingestion Adapters** | `app/Services/Epg/Adapters/*` | Adapters for Kantipur (`KantipurAdapter`) and Star Sports (`StarSportsAdapter`). |
| **Console Command** | [app/Console/Commands/CheckEpgRemindersCommand.php](file:///home/bananaman/TV_notif2/app/Console/Commands/CheckEpgRemindersCommand.php) | Command to process due reminders and generate notifications. |
| **API Controllers** | `app/Http/Controllers/*` | Controllers handling Auth, Channels, Programs, Reminders, and Notifications. |
| **Automated Tests** | `tests/Unit/*` & `tests/Feature/*` | PHPUnit test suite covering API endpoints, adapters, and reminder calculations. |

---

## 7. Verification & Automated Test Suite

The system includes a 100% passing test suite across both feature and unit tests.

### Running Tests
```bash
./vendor/bin/phpunit
```

### Test Coverage Highlights
- `EpgParserTest`: Verifies JSON parsing, duration calculations, UTC conversions, and overlap lane assignments.
- `ReminderTest`: Verifies reminder notification offset calculation logic and scope queries.
- `EpgApiTest`: Verifies auth permissions, guest access restrictions, creating/modifying reminders, and user privacy constraints.
