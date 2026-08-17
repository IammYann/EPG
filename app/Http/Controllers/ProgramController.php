<?php

namespace App\Http\Controllers;

use App\Models\Channel;
use App\Models\Program;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ProgramController extends Controller
{
    public function index(Request $request, string $channelIdOrSlug): JsonResponse
    {
        $channel = is_numeric($channelIdOrSlug)
            ? Channel::findOrFail($channelIdOrSlug)
            : Channel::where('slug', $channelIdOrSlug)->firstOrFail();

        $date = $request->input('date');
        if (! $date) {
            // Default to first available date or today
            $date = Program::where('channel_id', $channel->id)
                ->orderBy('date')
                ->value('date')?->format('Y-m-d') ?? now()->format('Y-m-d');
        }

        $programs = Program::forChannelAndDate($channel->id, $date)->get();

        // Include user reminders if logged in
        $userReminderIds = [];
        if (Auth::check()) {
            $userReminderIds = Auth::user()->reminders()
                ->where('channel_id', $channel->id)
                ->pluck('reminder_minutes_before', 'program_id')
                ->toArray();
        }

        $formatted = $programs->map(function (Program $p) use ($userReminderIds) {
            return [
                'id'                => $p->id,
                'source_id'         => $p->source_id,
                'title'             => $p->title,
                'start_time'        => $p->start_time->toIso8601String(),
                'end_time'          => $p->end_time->toIso8601String(),
                'duration_minutes'  => $p->duration_minutes,
                'language'          => $p->language,
                'genre'             => $p->genre,
                'description'       => $p->description,
                'programme_type'    => $p->programme_type,
                'sub_type'          => $p->sub_type,
                'origin_country'    => $p->origin_country,
                'original_air_date' => $p->original_air_date?->format('Y-m-d'),
                'season'            => $p->season,
                'episode'           => $p->episode,
                'source_type'       => $p->source_type,
                'original_network'  => $p->original_network,
                'content_url'       => $p->content_url,
                'lane'              => $p->lane,
                'reminder'          => isset($userReminderIds[$p->id]) ? [
                    'minutes_before' => $userReminderIds[$p->id],
                ] : null,
            ];
        });

        return response()->json([
            'channel'  => $channel,
            'date'     => $date,
            'programs' => $formatted,
        ]);
    }

    public function show(string $id): JsonResponse
    {
        $program = Program::with('channel')->findOrFail($id);

        $reminder = null;
        if (Auth::check()) {
            $reminderModel = Auth::user()->reminders()
                ->where('program_id', $program->id)
                ->first();

            if ($reminderModel) {
                $reminder = [
                    'id'             => $reminderModel->id,
                    'minutes_before' => $reminderModel->reminder_minutes_before,
                    'status'         => $reminderModel->status,
                ];
            }
        }

        return response()->json([
            'program' => [
                'id'                => $program->id,
                'source_id'         => $program->source_id,
                'title'             => $program->title,
                'start_time'        => $program->start_time->toIso8601String(),
                'end_time'          => $program->end_time->toIso8601String(),
                'duration_minutes'  => $program->duration_minutes,
                'language'          => $program->language,
                'genre'             => $program->genre,
                'description'       => $program->description,
                'programme_type'    => $program->programme_type,
                'sub_type'          => $program->sub_type,
                'origin_country'    => $program->origin_country,
                'original_air_date' => $program->original_air_date?->format('Y-m-d'),
                'season'            => $program->season,
                'episode'           => $program->episode,
                'source_type'       => $program->source_type,
                'original_network'  => $program->original_network,
                'content_url'       => $program->content_url,
                'lane'              => $program->lane,
                'channel_name'      => $program->channel->name,
                'channel_slug'      => $program->channel->slug,
            ],
            'reminder' => $reminder,
        ]);
    }
}
