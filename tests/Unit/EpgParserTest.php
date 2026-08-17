<?php

namespace Tests\Unit;

use App\Services\Epg\Adapters\KantipurAdapter;
use App\Services\Epg\Adapters\StarSportsAdapter;
use Tests\TestCase;

class EpgParserTest extends TestCase
{
    public function test_kantipur_adapter_parses_json_and_calculates_duration(): void
    {
        $adapter = new KantipurAdapter();
        $jsonPath = public_path('epg/kantipur.json');

        if (! file_exists($jsonPath)) {
            $this->markTestSkipped('kantipur.json not found in public/epg');
        }

        $programs = $adapter->parse($jsonPath);
        
        $this->assertNotEmpty($programs);
        $first = $programs[0];

        // Should have normalized fields
        $this->assertNotNull($first->title);
        $this->assertNotNull($first->startTimeUtc);
        $this->assertNotNull($first->endTimeUtc);
        $this->assertGreaterThan(0, $first->durationMinutes);
        
        // Since Kantipur has no explicit duration, it is calculated from next program start time
        // E.g. Show 1 at 00:00:00 and Show 2 at 01:00:00 = 60 minutes duration
        $this->assertEquals(60, $first->durationMinutes);
    }

    public function test_star_sports_adapter_parses_json_with_durations_and_overlapping_lanes(): void
    {
        $adapter = new StarSportsAdapter();
        $jsonPath = public_path('epg/Star sports 1 HD.json');

        if (! file_exists($jsonPath)) {
            $this->markTestSkipped('Star sports 1 HD.json not found in public/epg');
        }

        $programs = $adapter->parse($jsonPath);

        $this->assertNotEmpty($programs);

        // Find programs on Aug 7
        $aug7Progs = array_filter($programs, fn($p) => $p->date === '2026-08-07');
        $this->assertNotEmpty($aug7Progs);

        // Check if overlaps are correctly assigned different lanes
        // e.g. multiple entries at 06:15:00 should have lane 0, 1 etc.
        $timeLanes = [];
        foreach ($aug7Progs as $p) {
            $time = substr($p->startTimeUtc, 11); // HH:MM:SS
            $timeLanes[$time][] = $p->lane;
        }

        foreach ($timeLanes as $time => $lanes) {
            // lanes should be distinct
            $this->assertEquals(count($lanes), count(array_unique($lanes)), "Duplicate lanes detected at {$time}");
        }
    }
}
