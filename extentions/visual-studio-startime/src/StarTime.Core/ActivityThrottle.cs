using System;

namespace StarTime.Core
{
    public sealed class ActivityThrottle
    {
        private readonly object _sync = new object();
        private readonly TimeSpan _minimumInterval;
        private DateTimeOffset? _lastActivity;

        public ActivityThrottle(TimeSpan minimumInterval)
        {
            if (minimumInterval < TimeSpan.Zero)
            {
                throw new ArgumentOutOfRangeException(nameof(minimumInterval));
            }

            _minimumInterval = minimumInterval;
        }

        public bool TryAcquire(DateTimeOffset now)
        {
            lock (_sync)
            {
                if (_lastActivity.HasValue && now - _lastActivity.Value < _minimumInterval)
                {
                    return false;
                }

                _lastActivity = now;
                return true;
            }
        }
    }
}
