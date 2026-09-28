using StarTime.Core;

namespace StarTime.Core.Tests;

public sealed class ActivityThrottleTests
{
    [Fact]
    public void TryAcquire_AllowsOneEventEveryFiveSeconds()
    {
        var throttle = new ActivityThrottle(TimeSpan.FromSeconds(5));
        var start = new DateTimeOffset(2026, 1, 1, 12, 0, 0, TimeSpan.Zero);

        Assert.True(throttle.TryAcquire(start));
        Assert.False(throttle.TryAcquire(start.AddSeconds(4)));
        Assert.True(throttle.TryAcquire(start.AddSeconds(5)));
    }
}
