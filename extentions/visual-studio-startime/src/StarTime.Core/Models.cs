using System;
using System.Runtime.Serialization;

namespace StarTime.Core
{
    public sealed class StarTimeSettings
    {
        public StarTimeSettings(string apiUrl, string token, string? projectOverride = null)
        {
            ApiUrl = apiUrl ?? throw new ArgumentNullException(nameof(apiUrl));
            Token = token ?? throw new ArgumentNullException(nameof(token));
            ProjectOverride = projectOverride;
        }

        public string ApiUrl { get; }
        public string Token { get; }
        public string? ProjectOverride { get; }
        public bool IsConfigured => Uri.TryCreate(ApiUrl, UriKind.Absolute, out _) && !string.IsNullOrWhiteSpace(Token);
    }

    [DataContract]
    public sealed class ActivityEvent
    {
        [DataMember(Name = "editor", Order = 1)]
        public string Editor { get; set; } = string.Empty;

        [DataMember(Name = "language", Order = 2)]
        public string Language { get; set; } = string.Empty;

        [DataMember(Name = "project", Order = 3)]
        public string Project { get; set; } = string.Empty;

        [DataMember(Name = "eventTime", Order = 4)]
        public string EventTime { get; set; } = string.Empty;

        [DataMember(Name = "fileHash", Order = 5)]
        public string FileHash { get; set; } = string.Empty;

        [DataMember(Name = "platform", Order = 6)]
        public string Platform { get; set; } = string.Empty;
    }

    [DataContract]
    internal sealed class CodeTimeResponse
    {
        [DataMember(Name = "time")]
        public string Time { get; set; } = string.Empty;
    }
}
