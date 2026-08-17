<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reminders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('program_id')->constrained()->cascadeOnDelete();
            $table->foreignId('channel_id')->constrained()->cascadeOnDelete();
            // Snapshot fields for historical integrity
            $table->string('programme_name');
            $table->dateTime('programme_start_time');
            $table->unsignedTinyInteger('reminder_minutes_before')->default(15);
            $table->dateTime('notification_time'); // programme_start_time - reminder_minutes_before
            $table->enum('status', ['scheduled', 'processing', 'sent', 'cancelled', 'failed'])->default('scheduled');
            $table->dateTime('notification_sent_at')->nullable();
            $table->timestamps();

            // Prevent duplicate reminders for same user+program
            $table->unique(['user_id', 'program_id'], 'reminders_user_program_unique');
            $table->index(['status', 'notification_time']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reminders');
    }
};

