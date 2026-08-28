# StarTime for Visual Studio

A Visual Studio 2026 extension that reports editor activity to StarTime and displays today's code time in the status bar.

## What it does

- Reports edits, saves, and document activation as coding activity.
- Limits activity requests to one every five seconds.
- Authenticates with the `x-api-key` header.
- Hashes absolute file paths with SHA-256.
- Reads today's code time at most once per minute.
- Provides `apiUrl`, `token`, and `projectOverride` under `Tools > Options > All Settings > StarTime > General`.

The event payload matches the server's `fileHash` schema: `editor`, `language`, `project`, `eventTime`, `fileHash`, and `platform`.

## Code-time indicator

The Visual Studio status bar refreshes at most once per minute:

- A valid token shows `<project>: <time>`.
- An invalid token shows `StarTime | Invalid token`.
- Missing settings and network failures do not add status-bar text.

Changes to `apiUrl`, `token`, or `projectOverride` reload the sender and stats configuration after a 500 ms debounce. The stats request uses `projectOverride` when set.

## Requirements

- Visual Studio 2026 with the Visual Studio extension development workload
- .NET Framework 4.7.2 targeting pack
- .NET 8 SDK for unit tests

## Build

Open `StarTime.VisualStudio.sln` in Visual Studio 2026 and build the solution. Debug and Release builds write the package to `build/StarTime.VisualStudio.<version>.vsix`, using the version from `source.extension.vsixmanifest`.

See `docs/testing.md` for the full test procedure.
