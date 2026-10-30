using System.Xml;
using System.Xml.Linq;

namespace DotNetAnalyzer.Analysis.Vb;

/// <summary>
/// Reads the application configuration files (<c>app.config</c>, <c>web.config</c>) of a VB legacy project
/// (009-vb-legacy-completion, data-model §Configuración). DTD processing is disabled; a malformed file yields a
/// diagnostic naming the file and the analysis continues (FR-035). Values are never emitted in the output.
/// </summary>
public static class AppConfigParser
{
    /// <summary>A <c>system.serviceModel/client/endpoint</c> reduced to contract, host, binding and name (022).</summary>
    public sealed record ClientEndpoint(string Contract, string? Host, string? Binding, string? Name);

    /// <summary>Client endpoints of the configuration files of <paramref name="projectDirectory"/>, ordinal by contract then name.</summary>
    public static IReadOnlyList<ClientEndpoint> ClientEndpoints(string? projectDirectory)
    {
        var endpoints = new List<ClientEndpoint>();
        if (projectDirectory == null)
            return endpoints;
        foreach (var file in VbProjectContext.ConfigFiles(projectDirectory))
        {
            try
            {
                using var reader = System.Xml.XmlReader.Create(file, new System.Xml.XmlReaderSettings { DtdProcessing = System.Xml.DtdProcessing.Prohibit, XmlResolver = null });
                var document = System.Xml.Linq.XDocument.Load(reader);
                foreach (var endpoint in document.Descendants("endpoint").Where(e => e.Parent?.Name.LocalName == "client"))
                {
                    var contract = endpoint.Attribute("contract")?.Value?.Trim();
                    if (string.IsNullOrEmpty(contract))
                        continue;
                    endpoints.Add(new ClientEndpoint(contract, Hosts.Of(endpoint.Attribute("address")?.Value),
                        endpoint.Attribute("binding")?.Value?.Trim(), endpoint.Attribute("name")?.Value?.Trim()));
                }
            }
            catch (Exception ex) when (ex is System.Xml.XmlException or IOException or UnauthorizedAccessException)
            {
                Console.Error.WriteLine($"[WARN] AppConfigParser: could not read client endpoints of '{Path.GetFileName(file)}': {ex.Message}");
            }
        }

        return endpoints.OrderBy(e => e.Contract, StringComparer.Ordinal).ThenBy(e => e.Name ?? string.Empty, StringComparer.Ordinal).ToList();
    }

    private static readonly string[] SecretKeyMarkers =
    {
        "password", "passwd", "secret", "apikey", "api_key", "token", "accesstoken", "access_token",
    };

    /// <summary>Loads the configuration files found directly in <paramref name="projectDirectory"/>.</summary>
    public static AppConfiguration Load(string projectDirectory)
    {
        var files = new List<string>();
        var connectionStrings = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var settings = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var connectionStringFiles = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var settingFiles = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var diagnostics = new List<string>();

        foreach (var path in VbProjectContext.ConfigFiles(projectDirectory))
        {
            var fileName = Path.GetFileName(path);
            XDocument document;
            try
            {
                var readerSettings = new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null };
                using var reader = XmlReader.Create(path, readerSettings);
                document = XDocument.Load(reader);
            }
            catch (Exception ex) when (ex is XmlException or IOException or UnauthorizedAccessException)
            {
                var diagnostic = $"[WARN] AppConfigParser: could not read configuration file '{fileName}': {ex.Message}";
                Console.Error.WriteLine(diagnostic);
                diagnostics.Add(diagnostic);
                continue;
            }

            files.Add(fileName);
            var root = document.Root;
            if (root == null)
                continue;

            foreach (var add in Children(root, "connectionStrings").SelectMany(s => Children(s, "add")))
            {
                var name = (string?)add.Attribute("name");
                if (!string.IsNullOrEmpty(name) && connectionStrings.TryAdd(name, (string?)add.Attribute("connectionString") ?? ""))
                    connectionStringFiles[name] = fileName;
            }

            foreach (var add in Children(root, "appSettings").SelectMany(s => Children(s, "add")))
            {
                var key = (string?)add.Attribute("key");
                if (!string.IsNullOrEmpty(key) && settings.TryAdd(key, (string?)add.Attribute("value") ?? ""))
                    settingFiles[key] = fileName;
            }

            var typedSettings = Children(root, "applicationSettings").Concat(Children(root, "userSettings"))
                .SelectMany(g => g.Elements()).SelectMany(s => Children(s, "setting"));
            foreach (var setting in typedSettings)
            {
                var name = (string?)setting.Attribute("name");
                var value = Children(setting, "value").FirstOrDefault()?.Value ?? "";
                if (!string.IsNullOrEmpty(name) && settings.TryAdd(name, value))
                    settingFiles[name] = fileName;
            }
        }

        return new AppConfiguration
        {
            Files = files,
            ConnectionStrings = connectionStrings,
            Settings = settings,
            ConnectionStringFiles = connectionStringFiles,
            SettingFiles = settingFiles,
            Diagnostics = diagnostics,
        };
    }

    /// <summary>True when the connection string has a non-empty <c>Password</c>/<c>Pwd</c> pair.</summary>
    public static bool HasPlaintextPassword(string connectionString)
    {
        foreach (var pair in connectionString.Split(';'))
        {
            var equals = pair.IndexOf('=');
            if (equals <= 0)
                continue;
            var key = pair[..equals].Trim();
            var value = pair[(equals + 1)..].Trim();
            if ((key.Equals("Password", StringComparison.OrdinalIgnoreCase) || key.Equals("Pwd", StringComparison.OrdinalIgnoreCase))
                && value.Length > 0)
                return true;
        }

        return false;
    }

    /// <summary>True when the setting <paramref name="key"/> holds a plaintext credential.</summary>
    public static bool IsPlaintextSetting(string key, string value)
    {
        if (key.Contains("connectionstring", StringComparison.OrdinalIgnoreCase))
            return HasPlaintextPassword(value);
        return value.Trim().Length > 0
               && SecretKeyMarkers.Any(marker => key.Contains(marker, StringComparison.OrdinalIgnoreCase));
    }

    private static IEnumerable<XElement> Children(XElement parent, string localName) =>
        parent.Elements().Where(e => e.Name.LocalName == localName);
}

/// <summary>Connection strings and settings of a project; values are never emitted in the analysis output.</summary>
public sealed class AppConfiguration
{
    public static readonly AppConfiguration Empty = new();

    /// <summary>Names of the configuration files read, ordinal order.</summary>
    public IReadOnlyList<string> Files { get; init; } = Array.Empty<string>();

    /// <summary>Connection strings by name (first file wins, case-insensitive).</summary>
    public IReadOnlyDictionary<string, string> ConnectionStrings { get; init; } = new Dictionary<string, string>();

    /// <summary>appSettings entries and typed settings by key (first file wins, case-insensitive).</summary>
    public IReadOnlyDictionary<string, string> Settings { get; init; } = new Dictionary<string, string>();

    /// <summary>File name that declares each connection string.</summary>
    public IReadOnlyDictionary<string, string> ConnectionStringFiles { get; init; } = new Dictionary<string, string>();

    /// <summary>File name that declares each setting.</summary>
    public IReadOnlyDictionary<string, string> SettingFiles { get; init; } = new Dictionary<string, string>();

    /// <summary>Diagnostics of unreadable files (each names the file).</summary>
    public IReadOnlyList<string> Diagnostics { get; init; } = Array.Empty<string>();
}
