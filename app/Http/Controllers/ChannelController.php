<?php

namespace App\Http\Controllers;

use App\Models\Channel;
use App\Services\Epg\EpgIngestionService;
use Illuminate\Http\JsonResponse;

class ChannelController extends Controller
{
    public function index(EpgIngestionService $epgService): JsonResponse
    {
        $channels = Channel::all()->map(function (Channel $channel) use ($epgService) {
            return [
                'id'         => $channel->id,
                'slug'       => $channel->slug,
                'name'       => $channel->name,
                'logo_color' => $channel->logo_color,
                'logo_url'   => $channel->logo_url,
                'dates'      => $epgService->availableDates($channel),
            ];
        });

        return response()->json($channels);
    }
}
