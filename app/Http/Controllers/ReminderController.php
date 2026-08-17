<?php

namespace App\Http\Controllers;

use App\Models\Program;
use App\Models\Reminder;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ReminderController extends Controller
{
    public function index(): JsonResponse
    {
        $reminders = Auth::user()->reminders()
            ->with(['program', 'channel'])
            ->orderBy('programme_start_time', 'asc')
            ->get()
            ->map(function (Reminder $r) {
                return [
                    'id'                      => $r->id,
                    'program_id'              => $r->program_id,
                    'channel_id'              => $r->channel_id,
                    'channel_name'            => $r->channel->name,
                    'programme_name'          => $r->programme_name,
                    'programme_start_time'    => $r->programme_start_time->toIso8601String(),
                    'reminder_minutes_before' => $r->reminder_minutes_before,
                    'status'                  => $r->status,
                    'notification_sent_at'    => $r->notification_sent_at?->toIso8601String(),
                ];
            });

        return response()->json($reminders);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'program_id'              => ['required', 'exists:programs,id'],
            'reminder_minutes_before' => ['required', 'integer', 'min:0', 'max:1440'],
        ]);

        $program = Program::findOrFail($data['program_id']);
        $user    = Auth::user();

        // Calculate notification time
        $startTime        = $program->start_time; // Carbon instance (UTC)
        $notificationTime = $startTime->copy()->subMinutes($data['reminder_minutes_before']);

        // Check if reminder notification time is already in the past
        if ($notificationTime->isPast()) {
            return response()->json([
                'message' => 'The computed reminder time has already passed.',
            ], 422);
        }

        // Check if reminder already exists
        $existing = Reminder::where('user_id', $user->id)
            ->where('program_id', $program->id)
            ->first();

        if ($existing) {
            $existing->update([
                'reminder_minutes_before' => $data['reminder_minutes_before'],
                'notification_time'        => $notificationTime,
                'status'                   => 'scheduled', // reset to scheduled if it was cancelled
            ]);

            return response()->json([
                'message'  => 'Reminder updated successfully.',
                'reminder' => $existing,
            ]);
        }

        $reminder = Reminder::create([
            'user_id'                 => $user->id,
            'program_id'              => $program->id,
            'channel_id'              => $program->channel_id,
            'programme_name'          => $program->title,
            'programme_start_time'    => $program->start_time,
            'reminder_minutes_before' => $data['reminder_minutes_before'],
            'notification_time'        => $notificationTime,
            'status'                   => 'scheduled',
        ]);

        return response()->json([
            'message'  => 'Reminder set successfully.',
            'reminder' => $reminder,
        ], 210); // 201 Created
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $reminder = Auth::user()->reminders()->findOrFail($id);

        $data = $request->validate([
            'reminder_minutes_before' => ['required', 'integer', 'min:0', 'max:1440'],
        ]);

        $program          = $reminder->program;
        $notificationTime = $program->start_time->copy()->subMinutes($data['reminder_minutes_before']);

        if ($notificationTime->isPast()) {
            return response()->json([
                'message' => 'The computed reminder time has already passed.',
            ], 422);
        }

        $reminder->update([
            'reminder_minutes_before' => $data['reminder_minutes_before'],
            'notification_time'        => $notificationTime,
            'status'                   => 'scheduled',
        ]);

        return response()->json([
            'message'  => 'Reminder updated successfully.',
            'reminder' => $reminder,
        ]);
    }

    public function destroy(string $id): JsonResponse
    {
        $reminder = Auth::user()->reminders()->findOrFail($id);
        
        // Hard delete to clean up database completely or mark as cancelled. Let's hard delete.
        $reminder->delete();

        return response()->json([
            'message' => 'Reminder cancelled successfully.',
        ]);
    }
}
