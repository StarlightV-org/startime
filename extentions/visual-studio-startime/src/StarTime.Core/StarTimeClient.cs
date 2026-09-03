using System;
using System.IO;
using System.Net.Http;
using System.Runtime.Serialization.Json;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace StarTime.Core
{
    public sealed class StarTimeClient : IDisposable
    {
        private readonly HttpClient _httpClient;
        private readonly bool _ownsClient;

        public StarTimeClient()
            : this(new HttpClient(), true)
        {
        }

        public StarTimeClient(HttpClient httpClient)
            : this(httpClient, false)
        {
        }

        private StarTimeClient(HttpClient httpClient, bool ownsClient)
        {
            _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
            _ownsClient = ownsClient;
        }

        public async Task SendEventAsync(StarTimeSettings settings, ActivityEvent activity, CancellationToken cancellationToken)
        {
            EnsureConfigured(settings);
            using (var request = CreateRequest(settings, HttpMethod.Post, "api/users/event-log"))
            {
                request.Content = new StringContent(Serialize(activity), Encoding.UTF8, "application/json");
                using (var response = await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false))
                {
                    await EnsureSuccessAsync(response).ConfigureAwait(false);
                }
            }
        }

        public async Task<string> GetCodeTimeAsync(StarTimeSettings settings, string? project, CancellationToken cancellationToken)
        {
            EnsureConfigured(settings);
            var path = "api/users/self/stats";
            if (!string.IsNullOrWhiteSpace(project))
            {
                path += "?project=" + Uri.EscapeDataString(project!);
            }

            using (var request = CreateRequest(settings, HttpMethod.Get, path))
            using (var response = await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false))
            {
                await EnsureSuccessAsync(response).ConfigureAwait(false);
                using (var stream = await response.Content.ReadAsStreamAsync().ConfigureAwait(false))
                {
                    var serializer = new DataContractJsonSerializer(typeof(CodeTimeResponse));
                    var result = serializer.ReadObject(stream) as CodeTimeResponse;
                    return result?.Time ?? string.Empty;
                }
            }
        }

        public void Dispose()
        {
            if (_ownsClient)
            {
                _httpClient.Dispose();
            }
        }

        private static HttpRequestMessage CreateRequest(StarTimeSettings settings, HttpMethod method, string path)
        {
            var baseUrl = settings.ApiUrl.TrimEnd('/') + "/";
            var request = new HttpRequestMessage(method, new Uri(new Uri(baseUrl), path));
            request.Headers.TryAddWithoutValidation("x-api-key", settings.Token);
            return request;
        }

        private static void EnsureConfigured(StarTimeSettings settings)
        {
            if (settings == null)
            {
                throw new ArgumentNullException(nameof(settings));
            }

            if (!settings.IsConfigured)
            {
                throw new InvalidOperationException("StarTime requires a valid API URL and token.");
            }
        }

        private static string Serialize(ActivityEvent activity)
        {
            var serializer = new DataContractJsonSerializer(typeof(ActivityEvent));
            using (var stream = new MemoryStream())
            {
                serializer.WriteObject(stream, activity);
                return Encoding.UTF8.GetString(stream.ToArray());
            }
        }

        private static async Task EnsureSuccessAsync(HttpResponseMessage response)
        {
            if (response.IsSuccessStatusCode)
            {
                return;
            }

            var body = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            throw new StarTimeApiException(
                response.StatusCode,
                $"StarTime returned {(int)response.StatusCode} {response.ReasonPhrase}: {body}",
                body);
        }
    }
}
