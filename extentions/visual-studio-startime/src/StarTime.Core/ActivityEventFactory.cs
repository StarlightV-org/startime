using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace StarTime.Core
{
    public static class ActivityEventFactory
    {
        public static ActivityEvent Create(
            string absoluteFile,
            string? solutionFile,
            string? projectOverride,
            DateTimeOffset eventTime)
        {
            if (string.IsNullOrWhiteSpace(absoluteFile))
            {
                throw new ArgumentException("A file path is required.", nameof(absoluteFile));
            }

            var fullFile = Path.GetFullPath(absoluteFile);
            var projectRoot = GetProjectRoot(solutionFile);

            return new ActivityEvent
            {
                Editor = "Visual Studio",
                Language = GetLanguage(fullFile),
                Project = GetProject(projectRoot, projectOverride),
                EventTime = eventTime.UtcDateTime.ToString("O"),
                FileHash = HashPath(fullFile),
                Platform = "Windows 11",
            };
        }

        public static string HashPath(string path)
        {
            using (var sha256 = SHA256.Create())
            {
                var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(Path.GetFullPath(path).ToLowerInvariant()));
                var result = new StringBuilder(bytes.Length * 2);
                foreach (var value in bytes)
                {
                    result.Append(value.ToString("x2"));
                }

                return result.ToString();
            }
        }

        private static string? GetProjectRoot(string? solutionFile)
        {
            return string.IsNullOrWhiteSpace(solutionFile)
                ? null
                : Path.GetDirectoryName(Path.GetFullPath(solutionFile));
        }

        private static string GetProject(string? projectRoot, string? projectOverride)
        {
            if (!string.IsNullOrWhiteSpace(projectOverride))
            {
                return projectOverride!.Trim();
            }

            return string.IsNullOrWhiteSpace(projectRoot)
                ? "Unknown"
                : new DirectoryInfo(projectRoot).Name;
        }


        private static string GetLanguage(string file)
        {
            var extension = Path.GetExtension(file).TrimStart('.').ToLowerInvariant();
            switch (extension)
            {
                case "cs": return "csharp";
                case "fs": return "fsharp";
                case "vb": return "visual-basic";
                case "js": return "javascript";
                case "ts": return "typescript";
                case "cpp":
                case "cc":
                case "cxx": return "cpp";
                case "h":
                case "hpp": return "cpp-header";
                case "json": return "json";
                case "xml":
                case "xaml": return "xml";
                case "md": return "markdown";
                default: return string.IsNullOrWhiteSpace(extension) ? "plaintext" : extension;
            }
        }
    }
}
