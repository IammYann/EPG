<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Reminder extends Model
{
    protected $fillable = [
        'user_id', 'program_id', 'channel_id', 'programme_name',
        'programme_start_time', 'reminder_minutes_before',
        'notification_time', 'status', 'notification_sent_at',
    ];

    protected function casts(): array
    {
        return [
            'programme_start_time' => 'datetime',
            'notification_time'    => 'datetime',
            'notification_sent_at' => 'datetime',
            'reminder_minutes_before' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class);
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(EpgNotification::class);
    }

    /** Reminders due to be sent right now */
    public function scopeDue(Builder $query): Builder
    {
        return $query->where('status', 'scheduled')
                     ->where('notification_time', '<=', now());
    }

    /** Only scheduled reminders */
    public function scopeScheduled(Builder $query): Builder
    {
        return $query->where('status', 'scheduled');
    }

    /** Only active (not cancelled/sent/failed) */
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereIn('status', ['scheduled', 'processing']);
    }
}
