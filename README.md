# Multi-Channel EPG Timeline & Reminder System — Technical Documentation

## Executive Overview
This application is a production-quality Electronic Program Guide (EPG) web application built using **Laravel 13**, **SQLite**, **Vite**, and **Vanilla ES6 JavaScript**. It allows authenticated users to view 24-hour program schedules for multiple channels, switch dates dynamically, inspect detailed program metadata, set custom time-based reminders, and receive in-app notifications when shows are about to air.

---

## 1. Project Architecture & Stack

- **Backend Framework**: Laravel 13 (PHP 8.2+)
- **Database**: SQLite (`database/database.sqlite`)
- **Frontend Stack**: Vanilla JavaScript (ES6 SPA) + Tailwind CSS v4 + FontAwesome 6
- **Build Tool**: Vite (`npm run dev` / `npm run build`)
- **Primary Timezone**: `Asia/Kathmandu` (NPT, UTC +5:45)

---

## 2. Environment & Database Configuration (`.env`)

### Important `.env` Key Configurations
- `APP_TIMEZONE=Asia/Kathmandu`: Sets Laravel's default execution timezone to NPT.
- `DB_CONNECTION=sqlite`: Configures database engine to use SQLite.
- `QUEUE_CONNECTION=database`: Configures database-backed queues for background processing.

---

## 3. Database Schema

The database contains 5 core tables defined across `database/migrations/`:

```
┌─────────────────┐       ┌─────────────────┐       ┌────────────────────────┐
│    channels     │ 1───* │    programs     │ 1───* │       reminders        │
├─────────────────┤       ├─────────────────┤       ├────────────────────────┤
│ id              │       │ id              │       │ id                     │
│ name            │       │ channel_id (FK) │       │ user_id (FK)           │
│ slug            │       │ source_id       │       │ program_id (FK)        │
│ data_file       │       │ title           │       │ reminder_minutes_before│
│ logo_color      │       │ description     │       │ status (pending/fired) │
└─────────────────┘       │ start_time (UTC)│       └────────────────────────┘
                          │ end_time (UTC)  │                   │
                          │ duration_minutes│                   │ 1
                          │ date            │                   │
                          │ lane            │                   │ *
                          └─────────────────┘       ┌────────────────────────┐
                                                    │   epg_notifications    │
                                                    ├────────────────────────┤
                                                    │ id                     │
                                                    │ user_id (FK)           │
                                                    │ reminder_id (FK)       │
                                                    │ title / body           │
                                                    │ read_at (null/datetime)│
                                                    └────────────────────────┘
```

### Unique Indexing & Constraints
- `programs` table uses a composite unique constraint `(channel_id, date, source_id, lane)` to guarantee idempotent re-imports without duplicate entries.

---

## 4. EPG Data Ingestion (Adapter Pattern)

The system ingests raw JSON files placed in `storage/app/epg/` using the **Adapter Design Pattern**.

- **Interface**: `App\Services\Epg\Adapters\ChannelEpgAdapterInterface`
- **Adapters**:
  - `KantipurAdapter`: Parses `kantipur.json` (nested schedule schema).
  - `StarSportsAdapter`: Parses `Star sports 1 HD.json` (flat array with duration calculations and interval-overlapping lane assignment).
- **Ingestion Service**: `App\Services\Epg\EpgIngestionService` uses `updateOrCreate` to process and upsert normalized program records into SQLite.
- **Artisan Command**:
  ```bash
  php artisan epg:import
  ```

---

## 5. Background Scheduler & Reminder Delivery

In-app notifications are processed asynchronously via Laravel's command scheduler:

1. **Artisan Command**: `php artisan epg:check-reminders`
2. **Logic**:
   - Queries `reminders` table for entries where `status = 'pending'`.
   - Checks if `program_start_time - reminder_minutes_before <= now()`.
   - Creates a new `EpgNotification` record for the user.
   - Marks the reminder as `triggered`.
3. **Running the Scheduler**:
   ```bash
   php artisan schedule:work
   ```

---

## 6. REST API Reference

All API routes are defined in `routes/api.php` and return JSON responses:

### Authentication
- `POST /api/auth/login`: Authenticate user credentials.
- `POST /api/auth/logout`: Invalidate current session.
- `GET /api/auth/me`: Get current logged-in user profile.

### EPG Guide & Schedules
- `GET /api/channels`: Returns list of all channels with available dates.
- `GET /api/channels/{slug}/programs?date=YYYY-MM-DD`: Returns channel programs for a specific date.
- `GET /api/programs/{id}`: Returns program details and current user reminder status.

### Reminders & Alerts
- `GET /api/reminders`: List all active user reminders.
- `POST /api/reminders`: Create/update a program reminder (`program_id`, `reminder_minutes_before`).
- `DELETE /api/reminders/{id}`: Cancel an existing reminder.

### In-App Notifications
- `GET /api/notifications`: Retrieve user notifications & unread count.
- `PATCH /api/notifications/{id}/read`: Mark single notification as read.
- `PATCH /api/notifications/read-all`: Mark all notifications as read.

---

## 7. Frontend SPA Architecture (`resources/js/app.js`)

The frontend is a single-page application built in Vanilla JS:

1. **NPT Time Arithmetic**: Uses explicit UTC minute offsets (`UTC + 5:45` = 345 minutes) to ensure deterministic rendering across all browser locales.
2. **Timeline Layout**:
   - Total width: `4320px` (24 hours × 60 mins × 3px/min).
   - Channel headers (left) remain sticky on horizontal scrolling.
   - Time axis (top) remains sticky on vertical scrolling.
   - Red vertical bar tracks real-time current position.
3. **Features**:
   - **"Now" Button**: Immediately switches to **Today's date** (if viewing a past/future date) and smoothly scrolls to current time.
   - **Real-Time Polling**: Polls `/api/notifications` every 15 seconds to update the notification bell badge dynamically.

---

## 8. How to Run & Deploy

### Development Setup
```bash
# 1. Install PHP dependencies
composer install

# 2. Install Node dependencies
npm install

# 3. Initialize database & seed initial EPG data
php artisan migrate:fresh --seed

# 4. Build frontend assets
npm run build

# 5. Start development server
php artisan serve
```

### Running Automated Tests
```bash
./vendor/bin/phpunit
```

---

## 9. Extending the System (Adding New Channels)

To add a new channel in the future:

1. Place the channel's EPG JSON file in `storage/app/epg/`.
2. Create a new adapter in `app/Services/Epg/Adapters/` implementing `ChannelEpgAdapterInterface`.
3. Register the adapter in `app/Services/Epg/EpgIngestionService::$adapters`.
4. Add the channel entry in `database/seeders/DatabaseSeeder.php`.
5. Run `php artisan db:seed`.
