<?php

namespace App\Services\Epg\Adapters;

use App\Services\Epg\NormalizedProgram;
use Carbon\Carbon;

class StarSportsAdapter
{
    private const TIMEZONE = 'Asia/Kathmandu';

    /**
     * @return NormalizedProgram[]
     */
    public function parse(string $jsonPath): array
    {
        $raw    = json_decode(file_get_contents($jsonPath), true, 512, JSON_THROW_ON_ERROR);
        $result = $raw['result'] ?? [];

        $programs = [];

        foreach ($result as $date => $entries) {
            if (empty($entries)) {
                continue;
            }

            // Sort by time to ensure correct order
            usort($entries, fn($a, $b) => strcmp($a['time'], $b['time']));

            $count = count($entries);
            $parsedEntries = [];

            // First pass: Calculate start & end times
            for ($i = 0; $i < $count; $i++) {
                $entry = $entries[$i];
                $timeKey = $entry['time'];

                $startCarbon = Carbon::parse("{$date} {$entry['time']}", self::TIMEZONE);

                // Determine duration
                $durationMinutes = null;
                if (isset($entry['duration']) && is_int($entry['duration']) && $entry['duration'] > 0) {
                    $durationMinutes = $entry['duration'];
                }

                if ($durationMinutes !== null) {
                    $endCarbon = $startCarbon->copy()->addMinutes($durationMinutes);
                } else {
                    $nextEntry = null;
                    for ($j = $i + 1; $j < $count; $j++) {
                        if ($entries[$j]['time'] !== $timeKey) {
                            $nextEntry = $entries[$j];
                            break;
                        }
                    }

                    if ($nextEntry !== null) {
                        $endCarbon = Carbon::parse("{$date} {$nextEntry['time']}", self::TIMEZONE);
                        if ($endCarbon->lte($startCarbon)) {
                            $endCarbon->addDay();
                        }
                    } else {
                        $endCarbon = $startCarbon->copy()->addMinutes(30);
                    }

                    $durationMinutes = (int) $startCarbon->diffInMinutes($endCarbon);
                }

                $description = $entry['description'] ?? null;
                if ($description === '' || $description === null) {
                    $description = null;
                } else {
                    $description = trim($description);
                }

                $originalAirDate = $this->nullify($entry['original_air_date'] ?? null);
                if ($originalAirDate !== null) {
                    try {
                        Carbon::parse($originalAirDate);
                    } catch (\Throwable) {
                        $originalAirDate = null;
                    }
                }

                $parsedEntries[] = [
                    'entry' => $entry,
                    'start' => $startCarbon,
                    'end' => $endCarbon,
                    'duration' => max(1, $durationMinutes),
                    'desc' => $description,
                    'original_air_date' => $originalAirDate
                ];
            }

            // Second pass: Calculate lanes based on interval overlapping
            // We track end times of active programs in each lane
            $laneEndTimes = []; // [lane_index => Carbon end_time]

            foreach ($parsedEntries as $pe) {
                $assignedLane = 0;
                
                // Find first lane where the program doesn't overlap (i.e. start_time >= active program's end_time)
                $found = false;
                for ($lane = 0; $lane < count($laneEndTimes); $lane++) {
                    if ($pe['start']->gte($laneEndTimes[$lane])) {
                        $assignedLane = $lane;
                        $laneEndTimes[$lane] = $pe['end'];
                        $found = true;
                        break;
                    }
                }

                // If all active lanes overlap, create a new lane
                if (!$found) {
                    $assignedLane = count($laneEndTimes);
                    $laneEndTimes[$assignedLane] = $pe['end'];
                }

                $entry = $pe['entry'];
                $programs[] = new NormalizedProgram(
                    sourceId:        (int) $entry['id'],
                    date:            $date,
                    title:           trim($entry['programme_name']),
                    startTimeUtc:    $pe['start']->utc()->format('Y-m-d H:i:s'),
                    endTimeUtc:      $pe['end']->utc()->format('Y-m-d H:i:s'),
                    durationMinutes: $pe['duration'],
                    language:        $this->nullify($entry['language'] ?? null),
                    genre:           $this->nullify($entry['genre'] ?? null),
                    description:     $pe['desc'],
                    programmeType:   $this->nullify($entry['programme_type'] ?? null),
                    subType:         $this->nullify($entry['sub_type'] ?? null),
                    originCountry:   $this->nullify($entry['origin_country'] ?? null),
                    originalAirDate: $pe['original_air_date'],
                    season:          $this->nullify($entry['season'] ?? null),
                    episode:         $this->nullify($entry['episode'] ?? null),
                    sourceType:      $this->nullify($entry['source_type'] ?? null),
                    originalNetwork: $this->nullify($entry['original_network'] ?? null),
                    contentUrl:      null,
                    lane:            $assignedLane,
                );
            }
        }

        return $programs;
    }

    private function nullify(?string $value): ?string
    {
        if ($value === null || trim($value) === '') {
            return null;
        }
        return trim($value);
    }
}
