using System;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using StarTime.Core;
using StarTime.VisualStudio.Settings;

namespace StarTime.VisualStudio;

#pragma warning disable VSEXTPREVIEW_SETTINGS

internal static class StarTimeRuntime
{
    private static readonly ActivityThrottle ActivityThrottle = new(TimeSpan.FromSeconds(5));
    private static readonly StarTimeClient Client = new();
    private static readonly SemaphoreSlim StatsLock = new(1, 1);
    private static readonly Timer StatsTimer = new(_ => _ = FetchCodeTimeAsync(), null, Timeout.InfiniteTimeSpan, Timeout.InfiniteTimeSpan);
    private static StarTimeSettings settings = new("https://time.starlightv.dev/", string.Empty);
    private static int isStarted;

    internal static StarTimeStatusData Status { get; } = new();

    internal static void Start(StarTimeObserver settingsObserver)
    {
        if (Interlocked.Exchange(ref isStarted, 1) != 0)
        {
            return;
        }

        settingsObserver.Changed += OnSettingsChangedAsync;
    }

    internal static async Task SendActivityAsync(string filePath, CancellationToken cancellationToken)
    {
        if (!ActivityThrottle.TryAcquire(DateTimeOffset.UtcNow))
        {
            return;
        }

        var currentSettings = settings;
        if (!currentSettings.IsConfigured)
        {
            return;
        }

        var activity = ActivityEventFactory.Create(
            filePath,
            solutionFile: null,
            currentSettings.ProjectOverride,
            DateTimeOffset.UtcNow);
        await Client.SendEventAsync(currentSettings, activity, cancellationToken);
    }

    private static Task OnSettingsChangedAsync(StarTimeSnapshot snapshot)
    {
        settings = new StarTimeSettings(
            snapshot.ApiUrl.ValueOrDefault(StarTimeSettingDefinitions.ApiUrl.DefaultValue),
            snapshot.Token.ValueOrDefault(StarTimeSettingDefinitions.Token.DefaultValue),
            snapshot.ProjectOverride.ValueOrDefault(StarTimeSettingDefinitions.ProjectOverride.DefaultValue));
        StatsTimer.Change(TimeSpan.Zero, TimeSpan.FromMinutes(1));
        return Task.CompletedTask;
    }

    private static async Task FetchCodeTimeAsync()
    {
        if (!await StatsLock.WaitAsync(0).ConfigureAwait(false))
        {
            return;
        }

        try
        {
            var currentSettings = settings;
            if (!currentSettings.IsConfigured)
            {
                Status.Text = string.Empty;
                return;
            }

            var project = currentSettings.ProjectOverride;
            var time = await Client.GetCodeTimeAsync(currentSettings, project, CancellationToken.None).ConfigureAwait(false);
            Status.Text = (string.IsNullOrWhiteSpace(project) ? "All projects" : project) + ": " +
                (string.IsNullOrWhiteSpace(time) ? "0m" : time);
        }
        catch (StarTimeApiException exception) when (
            exception.StatusCode == HttpStatusCode.Unauthorized ||
            exception.StatusCode == HttpStatusCode.Forbidden)
        {
            Status.Text = "StarTime | Invalid token";
        }
        catch (Exception)
        {
            Status.Text = string.Empty;
        }
        finally
        {
            StatsLock.Release();
        }
    }
}
