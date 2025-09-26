# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React Native Expo project called "mochi-live" that uses file-based routing with expo-router. The project is built with TypeScript and follows modern React Native development practices.

## Key Architecture

- **Framework**: Expo SDK 54 with React Native 0.81.4
- **Routing**: File-based routing using expo-router (~6.0.8)
- **Navigation**: React Navigation v7 with bottom tabs
- **Platform Support**: iOS, Android, and Web
- **TypeScript**: Strict TypeScript configuration with path mapping (`@/*` -> `./*`)
- **Runtime & Package Manager**: This project uses [Bun](https://bun.sh/) as its JavaScript runtime and package manager.


## Development Commands

### Core Commands
- `npm start` or `npx expo start` - Start development server
- `npm run android` - Start Android emulator
- `npm run ios` - Start iOS simulator
- `npm run web` - Start web development server
- `npm run lint` - Run ESLint with expo config

### Project Reset
- `npm run reset-project` - Moves starter code to app-example/ and creates blank app/ directory

## Project Structure

- `app/` - Main application source (currently minimal with index.tsx and _layout.tsx)
- `app-example/` - Example implementation with components, hooks, constants, and tabs layout
- `assets/` - Images, icons, and static assets
- `expo-env.d.ts` - Expo environment type definitions

## Configuration Files

- `app.json` - Expo configuration with plugins for splash screen and router
- `tsconfig.json` - TypeScript configuration extending expo/tsconfig.base
- `eslint.config.js` - ESLint configuration using eslint-config-expo/flat
- `.vscode/settings.json` - VS Code settings for auto-fix on save
- `.vscode/extensions.json` - Recommends expo.vscode-expo-tools extension

## Key Features Enabled

- **New Architecture**: React Native's new architecture enabled
- **Typed Routes**: Experimental typed routes feature enabled
- **React Compiler**: Experimental React compiler enabled
- **Edge-to-Edge**: Android edge-to-edge display enabled
- **Web Output**: Static web output configuration

## Dependencies & Libraries

**Core**: expo-router, @react-navigation/*, react-native-safe-area-context, react-native-screens
**UI**: expo-image, expo-symbols, @expo/vector-icons
**Platform**: expo-haptics, expo-web-browser, expo-linking
**Animation**: react-native-reanimated, react-native-gesture-handler, react-native-worklets