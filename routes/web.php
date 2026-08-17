<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ChannelController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ProgramController;
use App\Http\Controllers\ReminderController;
use Illuminate\Support\Facades\Route;

// SPA Entry point
Route::get('/', function () {
    return view('app');
});

// API Routes
Route::prefix('api')->group(function () {
    // Auth
    Route::post('/auth/login', [AuthController::class, 'login']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);

    // EPG Guide (publicly browseable)
    Route::get('/channels', [ChannelController::class, 'index']);
    Route::get('/channels/{channelId}/programs', [ProgramController::class, 'index']);
    Route::get('/programs/{programId}', [ProgramController::class, 'show']);

    // Protected routes
    Route::middleware('auth')->group(function () {
        // Reminders
        Route::get('/reminders', [ReminderController::class, 'index']);
        Route::post('/reminders', [ReminderController::class, 'store']);
        Route::patch('/reminders/{id}', [ReminderController::class, 'update']);
        Route::delete('/reminders/{id}', [ReminderController::class, 'destroy']);

        // Notifications
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::patch('/notifications/{id}/read', [NotificationController::class, 'markRead']);
        Route::patch('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    });
});

