using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.Extensibility.Editor;
using StarTime.Core;
using StarTime.VisualStudio.Settings;

namespace StarTime.VisualStudio;

#pragma warning disable VSEXTPREVIEW_SETTINGS

[VisualStudioContribution]
internal sealed class StarTimeEditorListener : ExtensionPart, ITextViewChangedListener, IDisposable
{
    private readonly ActivityThrottle activityThrottle = new(TimeSpan.FromSeconds(5));
    private readonly StarTimeClient client = new();
    private readonly CancellationTokenSource shutdown = new();
    private readonly SemaphoreSlim statsLock = new(1, 1);
    private readonly Timer statsTimer;
    private StarTimeSettings settings = new("https://time.starlightv.dev/", string.Empty);

    public StarTimeEditorListener(StarTimeObserver settingsObserver)
    {
        settingsObserver.Changed += this.OnSettingsChangedAsync;
        this.statsTimer = new Timer(
            _ => _ = this.FetchCodeTimeAsync(),
            null,
            Timeout.InfiniteTimeSpan,
            Timeout.InfiniteTimeSpan);
    }

    public TextViewExtensionConfiguration TextViewExtensionConfiguration => new()
    {
        AppliesTo = [DocumentFilter.FromDocumentType(DocumentType.KnownValues.Code)],
    };

    public async Task TextViewChangedAsync(TextViewChangedArgs args, CancellationToken cancellationToken)
    {
        if (!args.AfterTextView.Document.Uri.IsFile || !this.activityThrottle.TryAcquire(DateTimeOffset.UtcNow))
        {
            return;
        }

        var currentSettings = this.settings;
        if (!currentSettings.IsConfigured)
        {
            return;
        }

        var activity = ActivityEventFactory.Create(
            args.AfterTextView.Document.Uri.LocalPath,
            solutionFile: null,
            currentSettings.ProjectOverride,
            DateTimeOffset.UtcNow);
        await this.client.SendEventAsync(currentSettings, activity, cancellationToken);
    }

    private Task OnSettingsChangedAsync(StarTimeSnapshot snapshot)
    {
        this.settings = new StarTimeSettings(
            snapshot.ApiUrl.ValueOrDefault(StarTimeSettingDefinitions.ApiUrl.DefaultValue),
            snapshot.Token.ValueOrDefault(StarTimeSettingDefinitions.Token.DefaultValue),
            snapshot.ProjectOverride.ValueOrDefault(StarTimeSettingDefinitions.ProjectOverride.DefaultValue));
        this.statsTimer.Change(TimeSpan.Zero, TimeSpan.FromMinutes(1));
        return Task.CompletedTask;
    }

    private async Task FetchCodeTimeAsync()
    {
        if (!await this.statsLock.WaitAsync(0, this.shutdown.Token).ConfigureAwait(false))
        {
            return;
        }

        try
        {
            var currentSettings = this.settings;
            if (currentSettings.IsConfigured)
            {
                await this.client.GetCodeTimeAsync(
                    currentSettings,
                    currentSettings.ProjectOverride,
                    this.shutdown.Token).ConfigureAwait(false);
            }
        }
        catch (OperationCanceledException) when (this.shutdown.IsCancellationRequested)
        {
        }
        finally
        {
            this.statsLock.Release();
        }
    }
}
