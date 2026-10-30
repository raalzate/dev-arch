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
}
