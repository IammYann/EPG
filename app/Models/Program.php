<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Program extends Model
{
    protected $fillable = [
        'channel_id', 'source_id', 'date', 'title', 'start_time', 'end_time',
        'duration_minutes', 'language', 'genre', 'description', 'programme_type',
        'sub_type', 'origin_country', 'original_air_date', 'season', 'episode',
        'source_type', 'original_network', 'content_url', 'lane',
    ];

    protected function casts(): array
    {
        return [
            'date'              => 'date',
            'start_time'        => 'datetime',
            'end_time'          => 'datetime',
            'original_air_date' => 'date',
            'duration_minutes'  => 'integer',
            'lane'              => 'integer',
        ];
    }

    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class);
    }

    public function reminders(): HasMany
    {
        return $this->hasMany(Reminder::class);
    }

    public function scopeForChannelAndDate(Builder $query, int $channelId, string $date): Builder
    {
        return $query->where('channel_id', $channelId)->whereDate('date', $date)->orderBy('start_time')->orderBy('lane');
    }
}
