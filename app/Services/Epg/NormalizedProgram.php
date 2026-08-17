<?php

namespace App\Services\Epg;

/**
 * Immutable DTO representing a single normalized EPG program
 * after adapter processing.
 */
final class NormalizedProgram
{
    public function __construct(
        public readonly int    $sourceId,
        public readonly string $date,          // Y-m-d
        public readonly string $title,
        public readonly string $startTimeUtc,  // Y-m-d H:i:s UTC
        public readonly string $endTimeUtc,    // Y-m-d H:i:s UTC
        public readonly int    $durationMinutes,
        public readonly ?string $language       = null,
        public readonly ?string $genre          = null,
        public readonly ?string $description    = null,
        public readonly ?string $programmeType  = null,
        public readonly ?string $subType        = null,
        public readonly ?string $originCountry  = null,
        public readonly ?string $originalAirDate = null,
        public readonly ?string $season         = null,
        public readonly ?string $episode        = null,
        public readonly ?string $sourceType     = null,
        public readonly ?string $originalNetwork = null,
        public readonly ?string $contentUrl     = null,
        public readonly int    $lane            = 0,
    ) {}
}
