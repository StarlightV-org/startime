using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.Extensibility.Settings;

namespace StarTime.VisualStudio;

#pragma warning disable VSEXTPREVIEW_SETTINGS

internal static class StarTimeSettingDefinitions
{
    [VisualStudioContribution]
    internal static SettingCategory StarTime { get; } = new("startime", "%StarTime.Settings.Category.DisplayName%")
    {
        Description = "%StarTime.Settings.Category.Description%",
        GenerateObserverClass = true,
    };

    [VisualStudioContribution]
    internal static Setting.String ApiUrl { get; } = new(
        "apiUrl",
        "%StarTime.Settings.ApiUrl.DisplayName%",
        StarTime,
        defaultValue: "https://time.starlightv.dev/")
    {
        Description = "%StarTime.Settings.ApiUrl.Description%",
    };

    [VisualStudioContribution]
    internal static Setting.String Token { get; } = new(
        "token",
        "%StarTime.Settings.Token.DisplayName%",
        StarTime,
        defaultValue: string.Empty)
    {
        Description = "%StarTime.Settings.Token.Description%",
    };

    [VisualStudioContribution]
    internal static Setting.String ProjectOverride { get; } = new(
        "projectOverride",
        "%StarTime.Settings.ProjectOverride.DisplayName%",
        StarTime,
        defaultValue: string.Empty)
    {
        Description = "%StarTime.Settings.ProjectOverride.Description%",
    };
}
