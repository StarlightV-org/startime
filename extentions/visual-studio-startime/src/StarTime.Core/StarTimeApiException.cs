using System.Net;
using System.Net.Http;

namespace StarTime.Core
{
    public sealed class StarTimeApiException : HttpRequestException
    {
        public StarTimeApiException(HttpStatusCode statusCode, string message, string responseBody)
            : base(message)
        {
            StatusCode = statusCode;
            ResponseBody = responseBody;
        }

        public HttpStatusCode StatusCode { get; }
        public string ResponseBody { get; }
    }
}
