# Testing the Visual Studio extension

## 1. Install the required workload

Open Visual Studio Installer, modify Visual Studio 2026, and install **Visual Studio extension development**.

## 2. Run unit tests

```powershell
dotnet test .\tests\StarTime.Core.Tests\StarTime.Core.Tests.csproj --configuration Debug
```

The tests cover the five-second throttle, path hashing, project and language metadata, authentication header, endpoint paths, request JSON, and code-time response parsing.

## 3. Build the Extensibility SDK extension

```powershell
dotnet build .\src\StarTime.VisualStudio\StarTime.VisualStudio.csproj --configuration Debug
```

Install the generated VSIX from:

```text
src/StarTime.VisualStudio/bin/Debug/net8.0-windows8.0/StarTime.VisualStudio.vsix
```

## 4. Configure StarTime

The extension uses the Visual Studio Extensibility settings API. It does not read **Tools > Options > All Settings** or any legacy option page.

In Visual Studio, open **Extensions > Extension Settings (experimental) > User Scope**. Add these settings, then save:

```json
{
	"startime.apiUrl": "https://time.starlightv.dev/",
	"startime.token": "your-api-key",
	"startime.projectOverride": "staitime"
}
```

The settings file includes the API key. Use a test key for local testing and do not commit the file.

## 5. Verify activity tracking

1. Open a code file and edit it.
2. Wait at least five seconds and edit it again.
3. Confirm the server receives `POST /api/users/event-log` with the `x-api-key` header.
4. Confirm the payload contains `editor`, `language`, `project`, `eventTime`, `fileHash`, and `platform`.
5. Confirm `project` is `staitime`, or the value currently configured in `startime.projectOverride`.

The extension deliberately drops activity inside the five-second window.

## 6. Verify code-time requests

When Visual Studio creates a code editor view, the typed settings observer receives the current settings and queues a code-time request immediately. It then requests code time no more than once per minute.

Confirm the request uses:

```text
GET /api/users/self/stats?project=staitime
```

The extension shows `<project>: <time>` in the active code editor's status bar. An HTTP `401` or `403` shows `StarTime | Invalid token` instead. Other configuration and network failures clear the StarTime text.
