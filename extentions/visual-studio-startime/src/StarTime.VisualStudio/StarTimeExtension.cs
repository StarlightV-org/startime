using Microsoft.Extensions.DependencyInjection;
using Microsoft.VisualStudio.Extensibility;

namespace StarTime.VisualStudio;

[VisualStudioContribution]
public sealed class StarTimeExtension : Extension
{
    public override ExtensionConfiguration ExtensionConfiguration => new()
    {
        Metadata = new(
            id: "StarTime.VisualStudio.8f7f5329-4510-44f6-ab92-ea6b9ed096f1",
            version: this.ExtensionAssemblyVersion,
            publisherName: "StarlightV Org",
            displayName: "StarTime for Visual Studio",
            description: "Tracks coding activity in Visual Studio with StarTime."),
    };

    protected override void InitializeServices(IServiceCollection serviceCollection)
    {
        serviceCollection.AddSettingsObservers();
        base.InitializeServices(serviceCollection);
    }
}
