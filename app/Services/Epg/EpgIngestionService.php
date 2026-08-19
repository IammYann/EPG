<?php

namespace App\Services\Epg;

use App\Models\Channel;
use App\Models\Program;
use App\Services\Epg\Adapters\KantipurAdapter;
use App\Services\Epg\Adapters\StarSportsAdapter;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class EpgIngestionService
{
    /**
     * Import EPG data for all configured channels.
     * Operation is idempotent — safe to run multiple times.
     *
     * @return array{channel: string, inserted: int, updated: int}[]
     */
    public function importAll(): array
    {
        $results = [];

        foreach (Channel::all() as $channel) {
            $results[] = $this->importChannel($channel);
        }

        return $results;
    }

    public function importChannel(Channel $channel): array
    {
        $jsonPath = public_path("epg/{$channel->data_file}");

        if (! file_exists($jsonPath)) {
            Log::warning("EPG file not found: {$jsonPath}");
            return ['channel' => $channel->slug, 'inserted' => 0, 'updated' => 0, 'error' => 'File not found'];
        }

        $programs = match ($channel->slug) {
            'kantipur' => (new KantipurAdapter())->parse($jsonPath),
            default    => (new StarSportsAdapter())->parse($jsonPath),
        };

        $inserted = 0;
        $updated  = 0;

        DB::beginTransaction();
        try {
            $processed = []; // track composite keys in memory: channel_id:date:source_id:lane

            foreach ($programs as $p) {
                $key = "{$channel->id}:{$p->date}:{$p->sourceId}:{$p->lane}";
                if (isset($processed[$key])) {
                    continue; // Skip duplicate parsed item in the same dataset
                }
                $processed[$key] = true;

                $exists = Program::where('channel_id', $channel->id)
                    ->whereDate('date', $p->date)
                    ->where('source_id', $p->sourceId)
                    ->where('lane', $p->lane)
                    ->first();

                $data = [
                    'channel_id'       => $channel->id,
                    'source_id'        => $p->sourceId,
                    'date'             => $p->date,
                    'title'            => $p->title,
                    'start_time'       => $p->startTimeUtc,
                    'end_time'         => $p->endTimeUtc,
                    'duration_minutes' => $p->durationMinutes,
                    'language'         => $p->language,
                    'genre'            => $p->genre,
                    'description'      => $p->description,
                    'programme_type'   => $p->programmeType,
                    'sub_type'         => $p->subType,
                    'origin_country'   => $p->originCountry,
                    'original_air_date'=> $p->originalAirDate,
                    'season'           => $p->season,
                    'episode'          => $p->episode,
                    'source_type'      => $p->sourceType,
                    'original_network' => $p->originalNetwork,
                    'content_url'      => $p->contentUrl,
                    'lane'             => $p->lane,
                ];

                if ($exists) {
                    $exists->update($data);
                    $updated++;
                } else {
                    Program::create($data);
                    $inserted++;
                }
            }
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error("EPG import failed for {$channel->slug}: " . $e->getMessage());
            throw $e;
        }

        return ['channel' => $channel->slug, 'inserted' => $inserted, 'updated' => $updated];
    }

    /**
     * Return available dates for a channel (from DB, sorted).
     */
    public function availableDates(Channel $channel): array
    {
        return Program::where('channel_id', $channel->id)
            ->distinct()
            ->orderBy('date')
            ->pluck('date')
            ->map(fn($d) => $d->format('Y-m-d'))
            ->toArray();
    }
}
