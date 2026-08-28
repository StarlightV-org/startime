using System;
using System.ComponentModel.Design;
using System.Net;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using EnvDTE;
using EnvDTE80;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using Microsoft.VisualStudio.Utilities.UnifiedSettings;
using StarTime.Core;
using Task = System.Threading.Tasks.Task;

namespace StarTime.VisualStudio
{
    [PackageRegistration(UseManagedResourcesOnly = true, AllowsBackgroundLoading = true)]
    [InstalledProductRegistration("StarTime", "Tracks coding activity with StarTime.", StarTimeVersion.Value)]
    [ProvideAutoLoad(UIContextGuids80.NoSolution, PackageAutoLoadFlags.BackgroundLoad)]
    [ProvideAutoLoad(UIContextGuids80.SolutionExists, PackageAutoLoadFlags.BackgroundLoad)]
    [ProvideOptionPage(typeof(StarTimeOptions), "StarTime", "General", 0, 0, true, IsInUnifiedSettings = true)]
    [ProvideSettingsManifest]
    [Guid(PackageGuidString)]
    public sealed class StarTimePackage : AsyncPackage
    {
        public const string PackageGuidString = "8f7f5329-4510-44f6-ab92-ea6b9ed096f1";
        private static readonly Guid OutputPaneGuid = new Guid("E8F56593-7D56-4BBE-97F8-9D16B7A78096");

        private readonly ActivityThrottle _activityThrottle = new ActivityThrottle(TimeSpan.FromSeconds(5));
        private readonly StarTimeClient _client = new StarTimeClient();
        private readonly CancellationTokenSource _shutdown = new CancellationTokenSource();
        private readonly SemaphoreSlim _statsLock = new SemaphoreSlim(1, 1);

        private DTE2? _dte;
        private TextEditorEvents? _textEditorEvents;
        private DocumentEvents? _documentEvents;
        private WindowEvents? _windowEvents;
        private IVsStatusbar? _statusBar;
        private IVsOutputWindowPane? _outputPane;
        private ISettingsReader? _settingsReader;
        private IDisposable? _settingsSubscription;
        private Timer? _settingsDebounceTimer;
        private Timer? _statsTimer;
        private StarTimeSettings _settings = new StarTimeSettings("https://time.starlightv.dev/", string.Empty);
        private DateTimeOffset? _lastStatsRequest;
        private bool _hasStatusText;

        protected override async Task InitializeAsync(CancellationToken cancellationToken, IProgress<ServiceProgressData> progress)
        {
            await JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);

            _dte = await GetServiceAsync(typeof(DTE)) as DTE2;
            _statusBar = await GetServiceAsync(typeof(SVsStatusbar)) as IVsStatusbar;
            var outputWindow = await GetServiceAsync(typeof(SVsOutputWindow)) as IVsOutputWindow;
            if (outputWindow != null)
            {
                var paneGuid = OutputPaneGuid;
                ErrorHandler.ThrowOnFailure(outputWindow.CreatePane(ref paneGuid, "StarTime", 1, 0));
                ErrorHandler.ThrowOnFailure(outputWindow.GetPane(ref paneGuid, out _outputPane));
            }

            LogDebug("Extension initialization started.");
            LogDebug(_statusBar == null ? "Status bar service is unavailable." : "Status bar service acquired.");
            try
            {
                var serviceType = typeof(AsyncPackage).Assembly.GetType(
                    "Microsoft.VisualStudio.Shell.Interop.SVsUnifiedSettingsManager",
                    throwOnError: false);
                if (serviceType == null)
                {
                    throw new InvalidOperationException("Visual Studio does not expose the Unified Settings service marker.");
                }

                var settingsManager = await GetServiceAsync(serviceType) as ISettingsManager;
                if (settingsManager == null)
                {
                    throw new InvalidOperationException("Visual Studio did not provide the Unified Settings service.");
                }

                _settingsReader = settingsManager.GetWriter("StarTime");
            }
            catch (Exception exception)
            {
                LogError("Could not acquire Unified Settings. StarTime is disabled until the service is available.", exception);
                _settingsReader = null;
            }
            if (_dte == null)
            {
                LogError("Could not acquire the Visual Studio automation service.");
                return;
            }

            _settings = ReadSettings();
            LogSettings("Settings loaded");
            _settingsDebounceTimer = new Timer(
                _ => _ = JoinableTaskFactory.RunAsync(ReloadSettingsAsync),
                null,
                Timeout.InfiniteTimeSpan,
                Timeout.InfiniteTimeSpan);
            _settingsSubscription = _settingsReader?.SubscribeToChanges(
                OnSettingsChanged,
                new[] { "startime.general.*" });
            LogDebug(_settingsReader == null
                ? "Unified Settings service is unavailable. StarTime will not use legacy settings."
                : "Unified Settings reader acquired and change subscription registered.");

            var events = (Events2)_dte.Events;
            _textEditorEvents = events.get_TextEditorEvents(null);
            _documentEvents = events.DocumentEvents;
            _windowEvents = events.WindowEvents;

            _textEditorEvents.LineChanged += OnLineChanged;
            _documentEvents.DocumentSaved += OnDocumentSaved;
            _windowEvents.WindowActivated += OnWindowActivated;

            _statsTimer = new Timer(
                _ => OnStatsTimerTick(),
                null,
                TimeSpan.FromMinutes(1),
                TimeSpan.FromMinutes(1));
            LogDebug("Stats scheduler started. Queueing initial code-time fetch now.");
            QueueStatsFetch("startup");
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                LogDebug("Extension shutdown started.");
                _shutdown.Cancel();
                _settingsSubscription?.Dispose();
                _settingsDebounceTimer?.Dispose();
                _statsTimer?.Dispose();

                ThreadHelper.JoinableTaskFactory.Run(async delegate
                {
                    await JoinableTaskFactory.SwitchToMainThreadAsync();
                    if (_textEditorEvents != null)
                    {
                        _textEditorEvents.LineChanged -= OnLineChanged;
                    }

                    if (_documentEvents != null)
                    {
                        _documentEvents.DocumentSaved -= OnDocumentSaved;
                    }

                    if (_windowEvents != null)
                    {
                        _windowEvents.WindowActivated -= OnWindowActivated;
                    }
                });

                _statsLock.Dispose();
                _shutdown.Dispose();
                _client.Dispose();
            }

            base.Dispose(disposing);
        }

        private void OnLineChanged(TextPoint startPoint, TextPoint endPoint, int hint)
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            QueueActivity(startPoint.Parent?.Parent);
        }

        private void OnDocumentSaved(Document document)
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            QueueActivity(document);
        }

        private void OnWindowActivated(Window gotFocus, Window lostFocus)
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            QueueActivity(gotFocus?.Document);
        }

        private void QueueActivity(Document? document)
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            if (document == null || string.IsNullOrWhiteSpace(document.FullName))
            {
                return;
            }

            var now = DateTimeOffset.UtcNow;
            if (!_activityThrottle.TryAcquire(now))
            {
                return;
            }

            var settings = _settings;
            if (!settings.IsConfigured)
            {
                LogDebug("Activity event skipped because StarTime is not configured.");
                return;
            }

            var solutionFile = _dte?.Solution?.FullName;
            var activity = ActivityEventFactory.Create(
                document.FullName,
                solutionFile,
                settings.ProjectOverride,
                now);

            LogDebug("Sending activity event. Project=" + activity.Project + ", language=" + activity.Language + ".");
            _ = JoinableTaskFactory.RunAsync(async delegate
            {
                try
                {
                    await _client.SendEventAsync(settings, activity, _shutdown.Token).ConfigureAwait(false);
                    LogDebug("Activity event sent successfully.");
                }
                catch (OperationCanceledException) when (_shutdown.IsCancellationRequested)
                {
                }
                catch (Exception exception)
                {
                    LogError("Activity event failed.", exception);
                }
            });
        }

        private void OnStatsTimerTick()
        {
            QueueStatsFetch("one-minute timer");
        }

        private void QueueStatsFetch(string source)
        {
            LogDebug("Code-time fetch queued by " + source + ".");
            _ = JoinableTaskFactory.RunAsync(UpdateCodeTimeAsync);
        }

        private async Task UpdateCodeTimeAsync()
        {
            LogDebug("Code-time fetch worker started.");
            if (!await _statsLock.WaitAsync(0).ConfigureAwait(false))
            {
                LogDebug("Code-time fetch skipped because another fetch is already running.");
                return;
            }

            try
            {
                await JoinableTaskFactory.SwitchToMainThreadAsync(_shutdown.Token);
                var settings = _settings;
                if (!settings.IsConfigured)
                {
                    LogDebug("Code-time fetch skipped because StarTime is not configured.");
                    ClearStatusText();
                    return;
                }

                var project = !string.IsNullOrWhiteSpace(settings.ProjectOverride)
                    ? settings.ProjectOverride
                    : GetSolutionProjectName();
                var projectLabel = string.IsNullOrWhiteSpace(project) ? "All projects" : project;
                _lastStatsRequest = DateTimeOffset.UtcNow;
                LogDebug("Fetching code time. Project=" + projectLabel + ".");

                var time = await _client.GetCodeTimeAsync(settings, project, _shutdown.Token).ConfigureAwait(false);

                await JoinableTaskFactory.SwitchToMainThreadAsync(_shutdown.Token);
                var displayTime = string.IsNullOrWhiteSpace(time) ? "0m" : time;
                _hasStatusText = true;
                _statusBar?.SetText(projectLabel + ": " + displayTime);
                LogDebug("Code-time fetch completed. Project=" + projectLabel + ", time=" + displayTime + ".");
            }
            catch (OperationCanceledException) when (_shutdown.IsCancellationRequested)
            {
            }
            catch (StarTimeApiException exception) when (
                exception.StatusCode == HttpStatusCode.Unauthorized ||
                exception.StatusCode == HttpStatusCode.Forbidden)
            {
                LogError("Code-time fetch failed because the API token was rejected.", exception);
                await JoinableTaskFactory.SwitchToMainThreadAsync();
                _hasStatusText = true;
                _statusBar?.SetText("StarTime | Invalid token");
            }
            catch (Exception exception)
            {
                LogError("Code-time fetch failed.", exception);
                await JoinableTaskFactory.SwitchToMainThreadAsync();
                ClearStatusText();
            }
            finally
            {
                _statsLock.Release();
            }
        }

        private void OnSettingsChanged(SettingsUpdate update)
        {
            LogDebug("Settings changed. Reload scheduled after 500 ms.");
            _settingsDebounceTimer?.Change(TimeSpan.FromMilliseconds(500), Timeout.InfiniteTimeSpan);
        }

        private async Task ReloadSettingsAsync()
        {
            await JoinableTaskFactory.SwitchToMainThreadAsync(_shutdown.Token);
            _settings = ReadSettings();
            LogSettings("Settings reloaded");
            ClearStatusText();

            var dueTime = TimeSpan.Zero;
            if (_lastStatsRequest.HasValue)
            {
                var elapsed = DateTimeOffset.UtcNow - _lastStatsRequest.Value;
                if (elapsed < TimeSpan.FromMinutes(1))
                {
                    dueTime = TimeSpan.FromMinutes(1) - elapsed;
                }
            }

            _statsTimer?.Change(dueTime, TimeSpan.FromMinutes(1));
            LogDebug("Stats fetch rescheduled after settings reload. Next fetch in " + dueTime.TotalSeconds.ToString("0") + " seconds.");
        }

        private void ClearStatusText()
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            if (!_hasStatusText)
            {
                return;
            }

            _hasStatusText = false;
            _statusBar?.SetText(string.Empty);
        }

        private void LogSettings(string action)
        {
            LogDebug(
                action + ". ApiUrl=" + _settings.ApiUrl +
                ", projectOverride=" + (string.IsNullOrWhiteSpace(_settings.ProjectOverride) ? "<none>" : _settings.ProjectOverride) +
                ", hasToken=" + (!string.IsNullOrWhiteSpace(_settings.Token)).ToString() + ".");
        }

        private void LogDebug(string message)
        {
            ActivityLog.LogInformation(nameof(StarTime), message);
            WriteOutput(message);
        }

        private void LogError(string message, Exception? exception = null)
        {
            var fullMessage = exception == null ? message : message + Environment.NewLine + exception;
            ActivityLog.LogError(nameof(StarTime), fullMessage);
            WriteOutput("ERROR: " + fullMessage);
        }

        private void WriteOutput(string message)
        {
            var outputPane = _outputPane;
            if (outputPane == null)
            {
                return;
            }

            _ = JoinableTaskFactory.RunAsync(async delegate
            {
                await JoinableTaskFactory.SwitchToMainThreadAsync();
                outputPane.OutputStringThreadSafe(
                    "[" + DateTimeOffset.Now.ToString("HH:mm:ss.fff") + "] " + message + Environment.NewLine);
            });
        }

        private StarTimeSettings ReadSettings()
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            if (_settingsReader != null)
            {
                try
                {
                    return new StarTimeSettings(
                        _settingsReader.GetValueOrThrow<string>("startime.general.apiUrl"),
                        _settingsReader.GetValueOrThrow<string>("startime.general.token"),
                        _settingsReader.GetValueOrThrow<string>("startime.general.projectOverride"));
                }
                catch (Exception exception)
                {
                    LogError("Could not read Unified Settings. StarTime is disabled until the values can be read.", exception);
                }
            }

            return new StarTimeSettings("https://time.starlightv.dev/", string.Empty);
        }

        private string? GetSolutionProjectName()
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            var solutionFile = _dte?.Solution?.FullName;
            return string.IsNullOrWhiteSpace(solutionFile)
                ? null
                : System.IO.Path.GetFileNameWithoutExtension(solutionFile);
        }
    }
}
