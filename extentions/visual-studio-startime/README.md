# StarTime for Visual Studio

A Visual Studio 2026 extension that reports code-editor activity to StarTime.

## What it does

- Uses the Visual Studio Extensibility SDK, not a VSSDK `AsyncPackage` or legacy option page.
- Defines typed `apiUrl`, `token`, and `projectOverride` extension settings.
- Reports code-editor changes as StarTime activity, limited to one event every five seconds.
- Requests code time when the settings observer receives its initial snapshot, then at most once per minute.
- Sends `projectOverride` for both activity and code-time requests when it is set.
- Authenticates with `x-api-key` and hashes local file paths with SHA-256.

The event payload matches the server's `fileHash` schema: `editor`, `language`, `project`, `eventTime`, `fileHash`, and `platform`.

## Configure StarTime

Visual Studio's Extensibility settings API is currently experimental. It stores extension values in `extensibility.settings.json`, not **Tools > Options > All Settings**.

Open **Extensions > Extension Settings (experimental) > User Scope** and add:

```json
{
	"startime.apiUrl": "https://time.starlightv.dev/",
	"startime.token": "your-api-key",
	"startime.projectOverride": "staitime"
}
```

Save the file. The typed settings observer reloads the values without restarting Visual Studio. Treat the settings file as sensitive because it contains the API key.

## Requirements

- Visual Studio 2026 with the Visual Studio extension development workload
- .NET 8 SDK

## Build

```powershell
dotnet build .\src\StarTime.VisualStudio\StarTime.VisualStudio.csproj --configuration Debug
```

The debug VSIX is written to `src/StarTime.VisualStudio/bin/Debug/net8.0-windows8.0/StarTime.VisualStudio.vsix`. The build also writes the versioned distributable to `build/StarTime.VisualStudio.0.1.3.vsix`.

See `docs/testing.md` for the test procedure.
