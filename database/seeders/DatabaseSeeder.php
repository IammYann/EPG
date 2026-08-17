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
        $kantipur = \App\Models\Channel::updateOrCreate(
            ['slug' => 'kantipur'],
            [
                'name' => 'Kantipur',
                'data_file' => 'kantipur.json',
                'logo_color' => '#ef4444', // Red
            ]
        );

        $starSports = \App\Models\Channel::updateOrCreate(
            ['slug' => 'star-sports-1-hd'],
            [
                'name' => 'Star Sports 1 HD',
                'data_file' => 'Star sports 1 HD.json',
                'logo_color' => '#0ea5e9', // Blue/Sky
            ]
        );

        // Trigger EPG ingestion command automatically
        $this->command->call('epg:import');

    }
}
