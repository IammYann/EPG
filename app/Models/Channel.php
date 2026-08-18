<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Channel extends Model
{
    protected $fillable = ['slug', 'name', 'data_file', 'logo_color', 'logo_url'];


    public function programs(): HasMany
    {
        return $this->hasMany(Program::class);
    }

    public function reminders(): HasMany
    {
        return $this->hasMany(Reminder::class);
    }
}
