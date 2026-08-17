<?php

namespace App\Jobs;

use App\Models\EpgNotification;
use App\Models\Reminder;
use App\Mail\ReminderNotificationMail;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class ProcessDueReminders implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void
    {
        // Select scheduled reminders that are due
        $reminders = Reminder::due()->with(['user', 'channel', 'program'])->get();

        foreach ($reminders as $reminder) {
            // Lock and update to processing state to prevent duplicate delivery
            $affected = DB::table('reminders')
                ->where('id', $reminder->id)
                ->where('status', 'scheduled')
                ->update(['status' => 'processing', 'updated_at' => now()]);

            if ($affected === 0) {
                continue; // Already being processed by another worker
            }

            try {
                // 1. Create In-App notification
                EpgNotification::create([
                    'user_id' => $reminder->user_id,
                    'reminder_id' => $reminder->id,
                    'title' => "🔔 Program Starting Soon",
                    'body' => "{$reminder->programme_name} starts on {$reminder->channel->name} in {$reminder->reminder_minutes_before} minutes.",
                    'type' => 'reminder',
                    'data' => [
                        'channel_slug' => $reminder->channel->slug,
                        'channel_name' => $reminder->channel->name,
                        'program_id' => $reminder->program_id,
                        'content_url' => $reminder->program->content_url,
                        'programme_name' => $reminder->programme_name,
                        'reminder_minutes_before' => $reminder->reminder_minutes_before,
                    ],
                ]);

                // 2. Send email notification
                if ($reminder->user->email) {
                    Mail::to($reminder->user->email)->send(new ReminderNotificationMail($reminder));
                }

                // 3. Mark as sent
                DB::table('reminders')
                    ->where('id', $reminder->id)
                    ->update([
                        'status' => 'sent',
                        'notification_sent_at' => now(),
                        'updated_at' => now()
                    ]);

            } catch (\Throwable $e) {
                Log::error("Failed processing reminder #{$reminder->id}: " . $e->getMessage());

                DB::table('reminders')
                    ->where('id', $reminder->id)
                    ->update([
                        'status' => 'failed',
                        'updated_at' => now()
                    ]);
            }
        }
    }
}
