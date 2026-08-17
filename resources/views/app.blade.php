<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="h-full bg-slate-950 text-slate-100 dark">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <title>{{ config('app.name', 'EPG TV Guide') }}</title>

    <!-- Google Fonts: Inter -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">

    <!-- FontAwesome for Premium Icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer" />

    <!-- Axios CDN -->
    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>

    @vite(['resources/css/app.css', 'resources/js/app.js'])

    <style>
        body {
            font-family: 'Inter', sans-serif;
            background-color: #0a0a0f;
            overflow-x: hidden;
        }
        /* Custom scrollbar for premium aesthetic */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        ::-webkit-scrollbar-track {
            background: #0d0d15;
        }
        ::-webkit-scrollbar-thumb {
            background: #252538;
            border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #3b3b54;
        }
    </style>
</head>
<body class="h-full flex flex-col antialiased">
    <!-- Top-level Mount Point for SPA -->
    <div id="app" class="flex flex-col min-h-screen">
        <!-- Loader / Fallback while App JS is initializing -->
        <div class="flex-1 flex flex-col items-center justify-center space-y-4">
            <div class="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p class="text-slate-400 font-medium animate-pulse">Loading EPG Guide...</p>
        </div>
    </div>

    <!-- Global Toast Container -->
    <div id="toast-container" class="fixed bottom-5 right-5 z-50 flex flex-col gap-2"></div>
</body>
</html>
