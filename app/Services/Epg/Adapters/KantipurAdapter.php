<?php

namespace App\Services\Epg\Adapters;

use App\Services\Epg\NormalizedProgram;
use Carbon\Carbon;

/**
 * Parses kantipur.json
 *
 * Schema: { result: { "YYYY-MM-DD": [ {id, programme_name, time, ...} ] } }
 * Kantipur programs are at hourly intervals; no duration field is populated.
 * End time is inferred from the next program's start; last program of day gets +60 min.
 */
class KantipurAdapter
{
    private const TIMEZONE = 'Asia/Kathmandu';

    /**
     * @return NormalizedProgram[]
     */
    public function parse(string $jsonPath): array
    {
        $raw = json_decode(file_get_contents($jsonPath), true, 512, JSON_THROW_ON_ERROR);
        $result = $raw['result'] ?? [];

        $programs = [];

        foreach ($result as $date => $entries) {
            if (empty($entries)) {
                continue;
            }

            // Sort by time to ensure correct order
            usort($entries, fn($a, $b) => strcmp($a['time'], $b['time']));

            $count = count($entries);

            for ($i = 0; $i < $count; $i++) {
                $entry    = $entries[$i];
                $nextEntry = $entries[$i + 1] ?? null;

                $startCarbon = Carbon::parse("{$date} {$entry['time']}", self::TIMEZONE);

                if ($nextEntry !== null) {
                    $endCarbon = Carbon::parse("{$date} {$nextEntry['time']}", self::TIMEZONE);
                    // Handle midnight rollover: next day starts at 00:00
                    if ($endCarbon->lte($startCarbon)) {
                        $endCarbon->addDay();
                    }
                } else {
                    // Last program: assume 60-minute duration
                    $endCarbon = $startCarbon->copy()->addMinutes(60);
                }

                $durationMinutes = (int) $startCarbon->diffInMinutes($endCarbon);

                $programs[] = new NormalizedProgram(
                    sourceId:        (int) $entry['id'],
                    date:            $date,
                    title:           trim($entry['programme_name']),
                    startTimeUtc:    $startCarbon->utc()->format('Y-m-d H:i:s'),
                    endTimeUtc:      $endCarbon->utc()->format('Y-m-d H:i:s'),
                    durationMinutes: max(1, $durationMinutes),
                    language:        $this->nullify($entry['language'] ?? null, ['N/A', 'n/a']),
                    genre:           $this->nullify($entry['genre'] ?? null),
                    description:     null,
                    programmeType:   $this->nullify($entry['programme_type'] ?? null),
                    subType:         $this->nullify($entry['sub_type'] ?? null),
                    originCountry:   $this->nullify($entry['origin_country'] ?? null),
                    originalAirDate: $this->nullify($entry['original_air_date'] ?? null),
                    season:          $this->nullify($entry['season'] ?? null),
                    episode:         $this->nullify($entry['episode'] ?? null),
                    sourceType:      $this->nullify($entry['source_type'] ?? null),
                    originalNetwork: $this->nullify($entry['original_network'] ?? null),
                    contentUrl:      null,
                    lane:            0,
                );
            }
        }

        return $programs;
    }

    private function nullify(?string $value, array $empties = []): ?string
    {
        if ($value === null || trim($value) === '') {
            return null;
        }
        if (in_array(trim($value), $empties, true)) {
            return null;
        }
        return trim($value);
    }
}
