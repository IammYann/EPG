<?php

namespace App\Mail;

use App\Models\Reminder;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ReminderNotificationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Reminder $reminder) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "{$this->reminder->programme_name} starts in {$this->reminder->reminder_minutes_before} minutes",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.reminder',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
