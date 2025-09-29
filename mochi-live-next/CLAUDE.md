# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Next.js 15 application using React 19 that integrates ElevenLabs conversational AI agents. Built with TypeScript, Tailwind CSS, and Three.js/VRM for 3D character rendering.

## Development Commands

```bash
# Start development server with Turbopack
bun run dev

# Build for production (uses Turbopack)
bun run build

# Start production server
bun start

# Lint codebase
bun run lint
```

Development server runs at http://localhost:3000

## Architecture

### App Router Structure
- Uses Next.js App Router (`src/app/`)
- Main page: `src/app/page.tsx` - renders the ElevenLabs conversation interface
- Layout: `src/app/layout.tsx` - configures Geist fonts and metadata
- Components: `src/app/components/` - shared React components

### Key Technologies
- **ElevenLabs Integration**: Uses `@elevenlabs/react` package with `useConversation` hook for voice agent interactions
- **3D Rendering**: Three.js (`three`) and VRM (`@pixiv/three-vrm`) for 3D character rendering
- **Styling**: Tailwind CSS v4 with PostCSS
- **TypeScript**: Strict mode enabled, path alias `@/*` maps to `./src/*`

### Component Patterns
- Client components use `'use client'` directive (e.g., `conversation.tsx`)
- ElevenLabs conversation requires:
  - Microphone permissions via `navigator.mediaDevices.getUserMedia`
  - Agent ID configuration in `startSession()`
  - WebSocket connection type

## Configuration Notes

- **Package Manager**: Uses Bun as the package manager and runtime
- **TypeScript**: Strict mode, target ES2017, path alias `@/*` for `./src/*`
- **ESLint**: Uses Next.js core-web-vitals and TypeScript presets, ignores `.next/`, `out/`, `build/`
- **Build**: Turbopack enabled for both dev and production builds