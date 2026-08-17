<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Program Starting Soon</title>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0a0a0f; color: #e2e8f0; margin: 0; padding: 20px; }
        .card { max-width: 600px; margin: 0 auto; background: #181825; border-radius: 12px; padding: 30px; border: 1px solid #2d2d44; }
        h1 { color: #f8fafc; font-size: 24px; margin-top: 0; }
        .highlight { color: #6366f1; font-weight: bold; }
        .meta { margin: 20px 0; border-top: 1px solid #2d2d44; border-bottom: 1px solid #2d2d44; padding: 15px 0; }
        .meta-item { margin-bottom: 10px; font-size: 16px; }
        .meta-label { color: #94a3b8; font-weight: 500; }
        .btn { display: inline-block; background-color: #6366f1; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 15px; }
        .btn:hover { background-color: #4f46e5; }
    </style>
</head>
<body>
    <div class="card">
        <h1>🔔 Program Starting Soon</h1>
        <p>Your scheduled program is about to begin.</p>
        
        <div class="meta">
            <div class="meta-item">
                <span class="meta-label">Program:</span>
                <span class="highlight">{{ $reminder->programme_name }}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Channel:</span>
                <span>{{ $reminder->channel->name }}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Starts In:</span>
                <span>{{ $reminder->reminder_minutes_before }} minutes</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Start Time:</span>
                <span>{{ $reminder->programme_start_time->setTimezone('Asia/Kathmandu')->format('h:i A') }} (Asia/Kathmandu)</span>
            </div>
        </div>

        @if($reminder->program->content_url)
            <a href="{{ $reminder->program->content_url }}" class="btn">Watch Now</a>
        @else
            <a href="{{ url('/#/epg') }}" class="btn">View EPG Guide</a>
        @endif
    </div>
</body>
</html>
