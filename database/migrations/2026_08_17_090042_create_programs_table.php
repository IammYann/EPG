<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('programs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('channel_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('source_id'); // original id from JSON
            $table->date('date');
            $table->string('title');
            $table->dateTime('start_time'); // stored as UTC
            $table->dateTime('end_time');   // stored as UTC
            $table->unsignedSmallInteger('duration_minutes');
            $table->string('language', 20)->nullable();
            $table->string('genre', 200)->nullable();
            $table->text('description')->nullable();
            $table->string('programme_type', 100)->nullable();
            $table->string('sub_type', 100)->nullable();
            $table->string('origin_country', 100)->nullable();
            $table->date('original_air_date')->nullable();
            $table->string('season', 20)->nullable();
            $table->string('episode', 20)->nullable();
            $table->string('source_type', 100)->nullable();
            $table->string('original_network', 100)->nullable();
            $table->string('content_url')->nullable();
            $table->tinyInteger('lane')->default(0); // 0=primary, 1+=overlap lane
            $table->timestamps();

            // Composite unique: channel + date + source_id + lane (handle overlaps)
            $table->unique(['channel_id', 'date', 'source_id', 'lane'], 'programs_composite_unique');
            $table->index(['channel_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('programs');
    }
};

