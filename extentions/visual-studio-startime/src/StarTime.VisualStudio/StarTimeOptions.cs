using System.ComponentModel;
using System.Runtime.InteropServices;
using Microsoft.VisualStudio.Shell;

namespace StarTime.VisualStudio
{
    [Guid("D93AC2D5-02CB-4648-9FE4-24C1CB9C5580")]
    public sealed class StarTimeOptions : DialogPage
    {
        [Category("Connection")]
        [DisplayName("API URL")]
        [Description("Base URL for the StarTime API.")]
        [DefaultValue("https://time.starlightv.dev/")]
        public string ApiUrl { get; set; } = "https://time.starlightv.dev/";

        [Category("Connection")]
        [DisplayName("Token")]
        [Description("API key from the StarTime dashboard.")]
        [PasswordPropertyText(true)]
        public string Token { get; set; } = string.Empty;

        [Category("Project")]
        [DisplayName("Project override")]
        [Description("Optional project name sent instead of the solution directory name.")]
        public string ProjectOverride { get; set; } = string.Empty;
    }
}
