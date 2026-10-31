using System.Threading;
using System.Threading.Tasks;
using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.Extensibility.Editor;
using Microsoft.VisualStudio.Extensibility.UI;
using Microsoft.VisualStudio.RpcContracts.RemoteUI;
using StarTime.VisualStudio.Settings;

namespace StarTime.VisualStudio;

#pragma warning disable VSEXTPREVIEW_SETTINGS

[VisualStudioContribution]
internal sealed class StarTimeStatusMargin : ExtensionPart, ITextViewMarginProvider
{
    public StarTimeStatusMargin(StarTimeObserver settingsObserver)
    {
        StarTimeRuntime.Start(settingsObserver);
    }

    public TextViewExtensionConfiguration TextViewExtensionConfiguration => new()
    {
        AppliesTo = [DocumentFilter.FromDocumentType(DocumentType.KnownValues.Code)],
    };

    public TextViewMarginProviderConfiguration TextViewMarginProviderConfiguration =>
        new(marginContainer: ContainerMarginPlacement.KnownValues.BottomRightCorner)
        {
            Before = [MarginPlacement.KnownValues.RowMargin],
        };

    public Task<IRemoteUserControl> CreateVisualElementAsync(
        ITextViewSnapshot textView,
        CancellationToken cancellationToken)
    {
        return Task.FromResult<IRemoteUserControl>(new StarTimeStatusMarginContent(StarTimeRuntime.Status));
    }
}

internal sealed class StarTimeStatusMarginContent : RemoteUserControl
{
    public StarTimeStatusMarginContent(StarTimeStatusData dataContext)
        : base(dataContext)
    {
    }
}
