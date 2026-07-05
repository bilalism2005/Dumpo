# CLAUDE.md — Dumpo

## What is Dumpo
Dumpo is an AI-powered mobile productivity app. Users dump raw thoughts, ideas, tasks, and anything on their mind into a chat interface. The AI automatically reads, formats, classifies, and organises everything into structured buckets on a dashboard. No manual sorting. No folders. No effort from the user.

## Core Philosophy
People do not organise. They dump. Dumpo organises automatically.

## Tech Stack
* **Frontend**: Expo (React Native), TypeScript, Zustand state management.
* **Backend**: FastAPI (Python), Groq API (Llama 3.1 8B) for classification, Supabase (Auth + Postgres + Realtime).

## System Architecture & Folders
* `/app`: Expo React Native frontend.
* `/backend`: FastAPI Python backend.

## Design Rules
1. **No Save Buttons**: Autosave on type, debounced by 500ms.
2. **No Delete Buttons**: Clear all text to delete an item.
3. **No Direct Client API Calls**: Frontend only calls FastAPI backend; backend handles database and LLM calls.
4. **Fitts's Law**: All tappable elements minimum 48px height.
5. **Doherty Threshold**: Keep interactions fast (<400ms), show optimistic UI immediately.
