<?php

namespace Tests\Feature;

use App\Models\Channel;
use App\Models\Program;
use App\Models\Reminder;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EpgApiTest extends TestCase
{
    use RefreshDatabase;

    private User $userA;
    private User $userB;
    private Channel $channel;
    private Program $program;

    protected function setUp(): void
    {
        parent::setUp();

        $this->userA = User::factory()->create();
        $this->userB = User::factory()->create();

        $this->channel = Channel::create([
            'slug' => 'test-channel',
            'name' => 'Test Channel',
            'data_file' => 'test.json'
        ]);

        $this->program = Program::create([
            'channel_id' => $this->channel->id,
            'source_id' => 999,
            'date' => '2026-08-17',
            'title' => 'Feature Test Program',
            'start_time' => Carbon::parse('2026-08-17 20:00:00', 'UTC'),
            'end_time' => Carbon::parse('2026-08-17 21:00:00', 'UTC'),
            'duration_minutes' => 60,
        ]);
    }

    public function test_unauthenticated_user_cannot_access_protected_routes(): void
    {
        $response = $this->getJson('/api/reminders');
        $response->assertStatus(401);

        $response2 = $this->postJson('/api/reminders', [
            'program_id' => $this->program->id,
            'reminder_minutes_before' => 15
        ]);
        $response2->assertStatus(401);
    }

    public function test_authenticated_user_can_access_reminders_and_set_one(): void
    {
        $response = $this->actingAs($this->userA)->getJson('/api/reminders');
        $response->assertStatus(200);

        // Notify 15 minutes before program starts (future time check)
        // Adjust program start to be in future relative to test run
        $this->program->update([
            'start_time' => now()->addHours(2),
            'end_time' => now()->addHours(3)
        ]);

        $response2 = $this->actingAs($this->userA)->postJson('/api/reminders', [
            'program_id' => $this->program->id,
            'reminder_minutes_before' => 15
        ]);
        $response2->assertStatus(210); // Custom 201 status code check / success status
        
        $this->assertDatabaseHas('reminders', [
            'user_id' => $this->userA->id,
            'program_id' => $this->program->id
        ]);
    }

    public function test_user_cannot_modify_or_delete_another_users_reminders(): void
    {
        $this->program->update([
            'start_time' => now()->addHours(2),
            'end_time' => now()->addHours(3)
        ]);

        $reminder = Reminder::create([
            'user_id' => $this->userA->id,
            'program_id' => $this->program->id,
            'channel_id' => $this->channel->id,
            'programme_name' => $this->program->title,
            'programme_start_time' => $this->program->start_time,
            'reminder_minutes_before' => 15,
            'notification_time' => $this->program->start_time->copy()->subMinutes(15),
            'status' => 'scheduled'
        ]);

        // User B tries to delete User A's reminder
        $response = $this->actingAs($this->userB)->deleteJson("/api/reminders/{$reminder->id}");
        $response->assertStatus(404); // returns 404 ModelNotFound because of query scope boundary

        $this->assertDatabaseHas('reminders', [
            'id' => $reminder->id
        ]);
    }
}
