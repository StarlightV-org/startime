using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.Extensibility.Editor;

namespace StarTime.VisualStudio;

[VisualStudioContribution]
internal sealed class StarTimeEditorListener : ExtensionPart, ITextViewChangedListener
{
    public TextViewExtensionConfiguration TextViewExtensionConfiguration => new()
    {
        AppliesTo = [DocumentFilter.FromDocumentType(DocumentType.KnownValues.Code)],
    };

    public async Task TextViewChangedAsync(TextViewChangedArgs args, CancellationToken cancellationToken)
    {
        if (!args.AfterTextView.Document.Uri.IsFile)
        {
            return;
        }

        try
        {
            await StarTimeRuntime.SendActivityAsync(args.AfterTextView.Document.Uri.LocalPath, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
        }
        catch (Exception)
        {
        }
    }
}
