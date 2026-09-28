using StarTime.Core;

namespace StarTime.Core.Tests;

public sealed class ActivityEventFactoryTests
{
    [Fact]
    public void Create_UsesProjectOverrideAndRequiredProtocolFields()
    {
        var root = Path.Combine(Path.GetTempPath(), "StarTimeFactoryTests");
        var solution = Path.Combine(root, "Sample.sln");
        var file = Path.Combine(root, "src", "Program.cs");
        var time = new DateTimeOffset(2026, 8, 28, 10, 30, 0, TimeSpan.FromHours(2));

        var activity = ActivityEventFactory.Create(file, solution, "Custom Project", time);
        
        Assert.Equal("Visual Studio", activity.Editor);
        Assert.Equal("csharp", activity.Language);
        Assert.Equal("Custom Project", activity.Project);
        Assert.Equal("2026-08-28T08:30:00.0000000Z", activity.EventTime);
        Assert.Equal("Windows 11", activity.Platform);
        Assert.Equal(64, activity.FileHash.Length);

    }

    [Fact]
    public void HashPath_IsStableRegardlessOfPathCase()
    {
        var path = Path.Combine(Path.GetTempPath(), "Project", "File.cs");

        Assert.Equal(
            ActivityEventFactory.HashPath(path.ToUpperInvariant()),
            ActivityEventFactory.HashPath(path.ToLowerInvariant()));
    }
}
