using System.Net;
using System.Text;
using StarTime.Core;

namespace StarTime.Core.Tests;

public sealed class StarTimeClientTests
{
    [Fact]
    public async Task SendEventAsync_UsesApiKeyAndRequiredEndpoint()
    {
        var handler = new RecordingHandler("{\"success\":true}");
        using var httpClient = new HttpClient(handler);
        using var client = new StarTimeClient(httpClient);
        var settings = new StarTimeSettings("https://example.test/base/", "secret-token");
        var activity = ActivityEventFactory.Create(
            Path.Combine(Path.GetTempPath(), "Program.cs"),
            null,
            null,
            DateTimeOffset.UtcNow);

        await client.SendEventAsync(settings, activity, CancellationToken.None);

        Assert.NotNull(handler.Request);
        Assert.Equal(HttpMethod.Post, handler.Request.Method);
        Assert.Equal("https://example.test/base/api/users/event-log", handler.Request.RequestUri!.ToString());
        Assert.Equal("secret-token", handler.Request.Headers.GetValues("x-api-key").Single());
        Assert.Contains("\"fileHash\":", handler.Body);
        Assert.DoesNotContain("eventType", handler.Body);
        Assert.DoesNotContain("absoluteFile", handler.Body);
    }

    [Fact]
    public async Task GetCodeTimeAsync_UsesProjectQueryAndReadsTime()
    {
        var handler = new RecordingHandler("{\"time\":\"1h 23m\"}");
        using var httpClient = new HttpClient(handler);
        using var client = new StarTimeClient(httpClient);
        var settings = new StarTimeSettings("https://example.test", "token");

        var result = await client.GetCodeTimeAsync(settings, "My Project", CancellationToken.None);

        Assert.Equal("1h 23m", result);
        Assert.Equal("https://example.test/api/users/self/stats?project=My Project", handler.Request!.RequestUri!.ToString());
    }

    [Fact]
    public async Task GetCodeTimeAsync_ExposesUnauthorizedStatus()
    {
        var handler = new RecordingHandler("{\"error\":\"Invalid API key\"}", HttpStatusCode.Unauthorized);
        using var httpClient = new HttpClient(handler);
        using var client = new StarTimeClient(httpClient);
        var settings = new StarTimeSettings("https://example.test", "invalid-token");

        var exception = await Assert.ThrowsAsync<StarTimeApiException>(
            () => client.GetCodeTimeAsync(settings, "My Project", CancellationToken.None));

        Assert.Equal(HttpStatusCode.Unauthorized, exception.StatusCode);
    }

    private sealed class RecordingHandler : HttpMessageHandler
    {
        private readonly string _response;
        private readonly HttpStatusCode _statusCode;

        public RecordingHandler(string response, HttpStatusCode statusCode = HttpStatusCode.OK)
        {
            _response = response;
            _statusCode = statusCode;
        }

        public HttpRequestMessage? Request { get; private set; }
        public string Body { get; private set; } = string.Empty;

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Request = request;
            if (request.Content != null)
            {
                Body = await request.Content.ReadAsStringAsync(cancellationToken);
            }

            return new HttpResponseMessage(_statusCode)
            {
                Content = new StringContent(_response, Encoding.UTF8, "application/json"),
            };
        }
    }
}
