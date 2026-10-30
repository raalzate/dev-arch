using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;

namespace DotNetAnalyzer.Analysis.Vb;

/// <summary>
/// The properties of a <c>.vbproj</c> that feed the analysis (021-desktop-identity-layers, research D1): root
/// namespace, global imports, project-level Option Strict, output type, startup object, project references and
/// report definitions. Read with the BCL XML reader (DTD prohibited); unreadable files yield the defaults.
/// </summary>
public sealed class VbProjectFile
{
    private static readonly Regex QualifiedIdentifier = new(@"^[A-Za-z_]\w*(\.[A-Za-z_]\w*)*$", RegexOptions.CultureInvariant);

    private VbProjectFile(string path)
    {
        Path = path;
    }

    /// <summary>Full path of the project file.</summary>
    public string Path { get; }

    /// <summary>File name of the project (for diagnostics and issue locations).</summary>
    public string FileName => System.IO.Path.GetFileName(Path);

    /// <summary>Directory of the project file.</summary>
    public string Directory => System.IO.Path.GetDirectoryName(Path) ?? ".";

    /// <summary>Validated <c>&lt;RootNamespace&gt;</c>, or null when absent, empty or invalid.</summary>
    public string? RootNamespace { get; private set; }

    /// <summary>Global <c>&lt;Import Include="…"&gt;</c> namespaces, in file order, deduplicated.</summary>
    public IReadOnlyList<string> GlobalImports { get; private set; } = Array.Empty<string>();

    /// <summary>True when <c>&lt;OptionStrict&gt;Off&lt;/OptionStrict&gt;</c>.</summary>
    public bool OptionStrictOff { get; private set; }

    /// <summary>True for <c>Exe</c> and <c>WinExe</c> output types.</summary>
    public bool IsExe { get; private set; }

    /// <summary><c>&lt;StartupObject&gt;</c>, or null.</summary>
    public string? StartupObject { get; private set; }

    /// <summary>Referenced project paths (<c>&lt;ProjectReference Include&gt;</c>), resolved and normalized.</summary>
    public IReadOnlyList<string> ProjectReferences { get; private set; } = Array.Empty<string>();

    /// <summary>Names (without extension, case-insensitive) of the <c>.rdlc</c> report definitions of the project.</summary>
    public IReadOnlySet<string> ReportDefinitions { get; private set; } = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

    /// <summary>Diagnostics produced while reading (empty when the file was read cleanly).</summary>
    public IReadOnlyList<string> Diagnostics { get; private set; } = Array.Empty<string>();

    /// <summary>NuGet package ids of <c>packages.config</c> next to the project, with their versions (022).</summary>
    public IReadOnlyDictionary<string, string?> Packages { get; private set; } = new Dictionary<string, string?>();

    /// <summary>Third-party <c>&lt;Reference Include&gt;</c> simple names with their <c>Version=</c> when given (022).</summary>
    public IReadOnlyDictionary<string, string?> AssemblyReferences { get; private set; } = new Dictionary<string, string?>();

    /// <summary>Service references by folder: name → <c>wcf</c> (Service References) or <c>soap</c> (Web References) (022).</summary>
    public IReadOnlyDictionary<string, string> ServiceReferences { get; private set; } = new Dictionary<string, string>();

    private static readonly string[] FrameworkPrefixes = { "System", "Microsoft.VisualBasic", "Microsoft.CSharp", "mscorlib", "netstandard", "WindowsBase", "PresentationCore", "PresentationFramework", "Accessibility", "UIAutomation", "ReachFramework" };

    /// <summary>True for assemblies that ship with the framework (never external dependencies).</summary>
    public static bool IsFrameworkAssembly(string simpleName) =>
        FrameworkPrefixes.Any(p => simpleName.Equals(p, StringComparison.OrdinalIgnoreCase)
                                   || simpleName.StartsWith(p + ".", StringComparison.OrdinalIgnoreCase));

    /// <summary>Names of the referenced projects whose file is not under <paramref name="analyzedRoot"/> (022, FR-020).</summary>
    public IReadOnlyList<string> MissingProjectReferences(string analyzedRoot)
    {
        var root = System.IO.Path.GetFullPath(analyzedRoot);
        return ProjectReferences
            .Where(r => !VbProjectContext.IsSameOrUnder(System.IO.Path.GetDirectoryName(r) ?? r, root) || !File.Exists(r))
            .Select(r => System.IO.Path.GetFileNameWithoutExtension(r))
            .Distinct(StringComparer.Ordinal)
            .OrderBy(n => n, StringComparer.Ordinal)
            .ToList();
    }

    /// <summary>Reads <paramref name="path"/>; never throws.</summary>
    public static VbProjectFile Load(string path)
    {
        var project = new VbProjectFile(System.IO.Path.GetFullPath(path));
        var diagnostics = new List<string>();
        try
        {
            using var reader = XmlReader.Create(path, new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null });
            var document = XDocument.Load(reader);
            var elements = document.Descendants().ToList();

            string? Property(string name) => elements
                .Where(e => e.Name.LocalName == name && e.Parent?.Name.LocalName == "PropertyGroup")
                .Select(e => e.Value.Trim())
                .FirstOrDefault(v => v.Length > 0);

            var root = Property("RootNamespace");
            if (root != null)
            {
                if (QualifiedIdentifier.IsMatch(root))
                    project.RootNamespace = root;
                else
                    diagnostics.Add($"RootNamespace '{root}' is not a valid qualified identifier; ignored");
            }

            project.OptionStrictOff = string.Equals(Property("OptionStrict"), "Off", StringComparison.OrdinalIgnoreCase);
            var outputType = Property("OutputType");
            project.IsExe = outputType != null
                && (outputType.Equals("Exe", StringComparison.OrdinalIgnoreCase) || outputType.Equals("WinExe", StringComparison.OrdinalIgnoreCase));
            project.StartupObject = Property("StartupObject");

            project.GlobalImports = elements
                .Where(e => e.Name.LocalName == "Import" && e.Parent?.Name.LocalName == "ItemGroup")
                .Select(e => (e.Attribute("Include")?.Value ?? string.Empty).Trim())
                .Where(v => v.Length > 0)
                .Distinct(StringComparer.Ordinal)
                .ToList();

            project.ProjectReferences = elements
                .Where(e => e.Name.LocalName == "ProjectReference")
                .Select(e => (e.Attribute("Include")?.Value ?? string.Empty).Trim().Replace('\\', System.IO.Path.DirectorySeparatorChar))
                .Where(v => v.Length > 0)
                .Select(v => System.IO.Path.GetFullPath(System.IO.Path.Combine(project.Directory, v)))
                .Distinct(StringComparer.Ordinal)
                .ToList();

            project.AssemblyReferences = elements
                .Where(e => e.Name.LocalName == "Reference")
                .Select(e => (e.Attribute("Include")?.Value ?? string.Empty).Trim())
                .Where(v => v.Length > 0)
                .Select(v => (Name: v.Split(',')[0].Trim(), Version: VersionOf(v)))
                .Where(r => r.Name.Length > 0 && !IsFrameworkAssembly(r.Name))
                .GroupBy(r => r.Name, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First().Version, StringComparer.OrdinalIgnoreCase);

            project.Packages = ReadPackages(System.IO.Path.Combine(project.Directory, "packages.config"), diagnostics);
            project.ServiceReferences = ReadServiceReferences(project.Directory);

            project.ReportDefinitions = elements
                .Where(e => e.Parent?.Name.LocalName == "ItemGroup")
                .Select(e => (e.Attribute("Include")?.Value ?? string.Empty).Trim())
                .Where(v => v.EndsWith(".rdlc", StringComparison.OrdinalIgnoreCase))
                .Select(v => System.IO.Path.GetFileNameWithoutExtension(v.Replace('\\', '/')))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
        }
        catch (Exception ex) when (ex is XmlException or IOException or UnauthorizedAccessException)
        {
            diagnostics.Add($"could not read '{project.FileName}': {ex.Message}");
        }

        project.Diagnostics = diagnostics;
        return project;
    }

    private static string? VersionOf(string include)
    {
        foreach (var part in include.Split(','))
        {
            var trimmed = part.Trim();
            if (trimmed.StartsWith("Version=", StringComparison.OrdinalIgnoreCase))
                return trimmed["Version=".Length..].Trim();
        }

        return null;
    }

    private static IReadOnlyDictionary<string, string?> ReadPackages(string path, List<string> diagnostics)
    {
        var packages = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        if (!File.Exists(path))
            return packages;
        try
        {
            using var reader = XmlReader.Create(path, new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null });
            var document = XDocument.Load(reader);
            foreach (var package in document.Descendants().Where(e => e.Name.LocalName == "package"))
            {
                var id = (package.Attribute("id")?.Value ?? string.Empty).Trim();
                if (id.Length > 0 && !packages.ContainsKey(id))
                    packages[id] = package.Attribute("version")?.Value?.Trim();
            }
        }
        catch (Exception ex) when (ex is XmlException or IOException or UnauthorizedAccessException)
        {
            diagnostics.Add($"could not read 'packages.config': {ex.Message}");
        }

        return packages;
    }

    private static IReadOnlyDictionary<string, string> ReadServiceReferences(string directory)
    {
        var references = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var (folder, kind) in new[] { ("Service References", "wcf"), ("Web References", "soap") })
        {
            var path = System.IO.Path.Combine(directory, folder);
            if (!System.IO.Directory.Exists(path))
                continue;
            var names = System.IO.Directory.GetDirectories(path).Select(d => System.IO.Path.GetFileName(d)).ToArray();
            Array.Sort(names, StringComparer.Ordinal);
            foreach (var name in names)
                references.TryAdd(name, kind);
        }

        return references;
    }
}
