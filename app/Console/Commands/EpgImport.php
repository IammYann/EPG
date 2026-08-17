<?php

namespace App\Console\Commands;

use App\Models\Channel;
use App\Services\Epg\EpgIngestionService;
use Illuminate\Console\Command;

class EpgImport extends Command
{
    protected $signature   = 'epg:import {--channel= : Slug of a specific channel to import}';
    protected $description = 'Import / refresh EPG program data from JSON source files';

    public function handle(EpgIngestionService $service): int
    {
        $channelSlug = $this->option('channel');

        if ($channelSlug) {
            $channel = Channel::where('slug', $channelSlug)->first();
            if (! $channel) {
                $this->error("Channel not found: {$channelSlug}");
                return self::FAILURE;
            }
            $results = [$service->importChannel($channel)];
        } else {
            $results = $service->importAll();
        }

        foreach ($results as $r) {
            if (isset($r['error'])) {
                $this->warn("  {$r['channel']}: {$r['error']}");
            } else {
                $this->info("  {$r['channel']}: {$r['inserted']} inserted, {$r['updated']} updated");
            }
        }

        $this->newLine();
        $this->info('EPG import complete.');
        return self::SUCCESS;
    }
}
