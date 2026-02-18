# Core PWA Notes App

Core is a sleek, dark-themed PWA notes application built with Next.js, Tailwind CSS, Supabase, and Gemini AI.

## Features

- **Dark Mode UI**: Minimalist aesthetic with #0a0a0a background.
- **Offline First**: PWA support with service worker caching.
- **Real-time Sync**: Notes update instantly across devices using Supabase Realtime.
- **AI Powered**: Auto-tagging and summarization using Google Gemini Flash.
- **Rich Capture**: Floating formatting toolbar, auto-save, and easy formatting.
- **Gestures**: Swipe to pin or archive notes on the home screen.

## Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   Create a `.env.local` file with the following:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   GEMINI_API_KEY=your_gemini_api_key
   ```

3. **Database Setup**:
   Run the SQL script found in `supabase/schema.sql` in your Supabase SQL Editor to create the necessary tables and policies.

4. **Run Locally**:
   ```bash
   npm run dev
   ```

5. **Build for Production**:
   ```bash
   npm run build
   ```

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS v4
- **Database**: Supabase (PostgreSQL)
- **AI**: Google Gemini (generative-ai)
- **Editor**: Tiptap
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **PWA**: next-pwa

## License

MIT
