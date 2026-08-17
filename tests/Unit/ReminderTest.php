<?php

namespace Tests\Unit;

use App\Models\Channel;
use App\Models\Program;
use App\Models\Reminder;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReminderTest extends TestCase
{
    use RefreshDatabase;

    public function test_reminder_notification_time_subtraction(): void
    {
        $user = User::factory()->create();
        $channel = Channel::create([
            'slug' => 'test-channel',
            'name' => 'Test Channel',
            'data_file' => 'test.json'
        ]);

        $program = Program::create([
            'channel_id' => $channel->id,
            'source_id' => 123,
            'date' => '2026-08-17',
            'title' => 'Test Program',
            'start_time' => Carbon::parse('2026-08-17 10:00:00', 'UTC'),
            'end_time' => Carbon::parse('2026-08-17 11:00:00', 'UTC'),
            'duration_minutes' => 60,
        ]);

        // Option: 15 minutes before
        $reminderMinutes = 15;
        $notificationTime = $program->start_time->copy()->subMinutes($reminderMinutes);

        $reminder = Reminder::create([
            'user_id' => $user->id,
            'program_id' => $program->id,
            'channel_id' => $channel->id,
            'programme_name' => $program->title,
            'programme_start_time' => $program->start_time,
            'reminder_minutes_before' => $reminderMinutes,
            'notification_time' => $notificationTime,
            'status' => 'scheduled'
        ]);

        $this->assertEquals('2026-08-17 09:45:00', $reminder->notification_time->format('Y-m-d H:i:s'));
    }

    public function test_due_reminders_scope(): void
    {
        $user = User::factory()->create();
        $channel = Channel::create([
            'slug' => 'test-channel',
            'name' => 'Test Channel',
            'data_file' => 'test.json'
        ]);

        $program = Program::create([
            'channel_id' => $channel->id,
            'source_id' => 123,
            'date' => '2026-08-17',
            'title' => 'Test Program',
            'start_time' => Carbon::parse('2026-08-17 10:00:00', 'UTC'),
            'end_time' => Carbon::parse('2026-08-17 11:00:00', 'UTC'),
            'duration_minutes' => 60,
        ]);

        // Create a reminder that is due (notification_time is in the past)
        Reminder::create([
            'user_id' => $user->id,
            'program_id' => $program->id,
            'channel_id' => $channel->id,
            'programme_name' => $program->title,
            'programme_start_time' => $program->start_time,
            'reminder_minutes_before' => 15,
            'notification_time' => now()->subMinutes(5), // 5 minutes ago
            'status' => 'scheduled'
        ]);

        $program2 = Program::create([
            'channel_id' => $channel->id,
            'source_id' => 124,
            'date' => '2026-08-17',
            'title' => 'Test Program 2',
            'start_time' => Carbon::parse('2026-08-17 12:00:00', 'UTC'),
            'end_time' => Carbon::parse('2026-08-17 13:00:00', 'UTC'),
            'duration_minutes' => 60,
        ]);

        // Create a reminder that is NOT due (notification_time is in the future)
        Reminder::create([
            'user_id' => $user->id,
            'program_id' => $program2->id,
            'channel_id' => $channel->id,
            'programme_name' => $program2->title,
            'programme_start_time' => $program2->start_time,
            'reminder_minutes_before' => 15,
            'notification_time' => now()->addMinutes(15), // 15 minutes from now
            'status' => 'scheduled'
        ]);

        $dueReminders = Reminder::due()->get();
        $this->assertCount(1, $dueReminders);
    }
}
