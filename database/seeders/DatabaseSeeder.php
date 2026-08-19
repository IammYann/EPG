<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Create Demo User
        User::updateOrCreate(
            ['email' => 'demo@epg.local'],
            [
                'name' => 'Demo User',
                'password' => bcrypt('password'),
            ]
        );

        // Create Channels
        \App\Models\Channel::updateOrCreate(
            ['slug' => 'kantipur'],
            [
                'name' => 'Kantipur',
                'data_file' => 'kantipur.json',
                'logo_color' => '#ef4444',
                'logo_url' => '/assets/kantipur.png',
            ]
        );

        \App\Models\Channel::updateOrCreate(
            ['slug' => 'star-sports-1-hd'],
            [
                'name' => 'Star Sports 1 HD',
                'data_file' => 'Star sports 1 HD.json',
                'logo_color' => '#0ea5e9',
                'logo_url' => '/assets/starsports.png',
            ]
        );

        \App\Models\Channel::updateOrCreate(
            ['slug' => 'sony-sab-hd'],
            [
                'name' => 'Sony SAB HD',
                'data_file' => 'sony-sab-hd.json',
                'logo_color' => '#f97316',
                'logo_url' => '/storage/sonysab.png',
            ]
        );

        \App\Models\Channel::updateOrCreate(
            ['slug' => 'sony-ten-3-hd'],
            [
                'name' => 'Sony Ten 3 HD',
                'data_file' => 'sony-ten-3-hd.json',
                'logo_color' => '#3b82f6',
                'logo_url' => '/storage/sonyten3.png',
            ]
        );

        \App\Models\Channel::updateOrCreate(
            ['slug' => 'star-gold-hd'],
            [
                'name' => 'Star Gold HD',
                'data_file' => 'star-gold-hd.json',
                'logo_color' => '#eab308',
                'logo_url' => '/storage/stargold.png',
            ]
        );

        \App\Models\Channel::updateOrCreate(
            ['slug' => 'star-movies-hd'],
            [
                'name' => 'Star Movies HD',
                'data_file' => 'star-movies-hd.json',
                'logo_color' => '#a855f7',
                'logo_url' => '/storage/starmovieshd.png',
            ]
        );

        \App\Models\Channel::updateOrCreate(
            ['slug' => 'star-plus'],
            [
                'name' => 'Star Plus',
                'data_file' => 'star-plus.json',
                'logo_color' => '#ec4899',
                'logo_url' => '/storage/StarPlus.png',
            ]
        );

        \App\Models\Channel::updateOrCreate(
            ['slug' => 'star-sports-select-2'],
            [
                'name' => 'Star Sports Select 2',
                'data_file' => 'star-sports-select-2.json',
                'logo_color' => '#10b981',
                'logo_url' => '/storage/starsports2.png',
            ]
        );

        // Trigger EPG ingestion command automatically
        $this->command->call('epg:import');
    }
}
