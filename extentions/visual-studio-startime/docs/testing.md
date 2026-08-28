# Testing the Visual Studio extension

## 1. Install the required workload

Open Visual Studio Installer, modify Visual Studio 2026, and install **Visual Studio extension development**. Confirm that the .NET Framework 4.7.2 targeting pack is also installed.

## 2. Run unit tests

1. Open `StarTime.VisualStudio.sln`.
2. Choose **Test > Run All Tests**.
3. Confirm that all tests in `StarTime.Core.Tests` pass.

The tests cover the five-second throttle, path hashing, project and language metadata, authentication header, endpoint paths, request JSON, and code-time response parsing.

You can also run this from a Developer PowerShell prompt:

```powershell
dotnet test .\tests\StarTime.Core.Tests\StarTime.Core.Tests.csproj
```

## 3. Start an experimental Visual Studio instance

1. Set `StarTime.VisualStudio` as the startup project.
2. Choose the **Debug** configuration.
3. Press `F5`.
4. Visual Studio launches `devenv.exe /rootsuffix Exp`, which uses a separate experimental profile.

If `F5` does not launch Visual Studio, open the project properties and set the external program to the Visual Studio 2026 `devenv.exe`. Keep `/rootsuffix Exp` as the command-line argument.

## 4. Configure StarTime

In the experimental instance:

1. Open **Tools > Options > All Settings > StarTime > General**.
2. Set **API URL** to `https://time.starlightv.dev/` or your test server.
3. Paste an API key from the StarTime dashboard into **Token**.
4. Set **Project override** only if you do not want to use the solution name.
5. Click **OK**.

The token is saved by Visual Studio's standard options storage for this extension. Use a test API key when testing locally.

## 5. Verify activity tracking

1. Open a solution and edit a source file.
2. Save the file and switch between documents.
3. Wait at least five seconds between actions that you want to inspect separately.
4. Confirm that the server receives `POST /api/users/event-log` with an `x-api-key` header.
5. Confirm that the payload contains only `editor`, `language`, `project`, `eventTime`, `fileHash`, and `platform`.

The extension deliberately drops activity inside the five-second window.

## 6. Verify today's code time

After configuration, the Visual Studio status bar should show `<project>: <time>`. The extension fetches immediately at startup, then no more than once per minute. An invalid token shows `StarTime | Invalid token`.

## 7. View StarTime debug logs

For live logs, open **View > Output** and choose **StarTime** in **Show output from**. The pane logs extension startup, settings reloads, activity sends, code-time fetches, API responses, and failures. It records whether a token is configured, but never prints the token or absolute file paths.

For a persistent log file, launch the experimental instance with:

```powershell
devenv.exe /rootsuffix Exp /log
```

Then inspect `%APPDATA%\Microsoft\VisualStudio\<experimental-instance>\ActivityLog.xml` for entries whose source is `StarTime`.

## 8. Test the packaged VSIX

1. Build `StarTime.VisualStudio` in **Release**.
2. Close the experimental instance.
3. Open `build/StarTime.VisualStudio.<version>.vsix`.
4. Select Visual Studio 2026 in VSIX Installer.
5. Start Visual Studio normally and repeat the configuration and activity checks above.

Uninstall it from **Extensions > Manage Extensions > Installed** when finished.
