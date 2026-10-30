using Microsoft.CodeAnalysis;

namespace DotNetAnalyzer.Analysis.Vb;

/// <summary>
/// Locates the directory of a VB project from its compilation and the project files that are not compiled
/// but feed the analysis: application configuration files and typed DataSet definitions (research D3).
/// </summary>
public static class VbProjectContext
{
    private const int MaxLevelsUp = 3;

    private static readonly string[] ConfigFileNames = { "app.config", "web.config" };

    /// <summary>
    /// Common ancestor of the syntax tree paths; when it has no <c>*.vbproj</c>, the nearest ancestor (at most
    /// three levels up) that has one; otherwise the common ancestor. Null when no tree has a path.
    /// </summary>
    public static string? ResolveProjectDirectory(Compilation compilation)
    {
        var dirs = compilation.SyntaxTrees
            .Select(t => t.FilePath)
            .Where(p => !string.IsNullOrEmpty(p))
            .Select(p => Path.GetDirectoryName(Path.GetFullPath(p)))
            .Where(d => !string.IsNullOrEmpty(d))
            .Select(d => d!)
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (dirs.Count == 0)
            return null;

        var common = dirs[0];
        foreach (var dir in dirs.Skip(1))
        {
            while (!IsSameOrUnder(dir, common))
            {
                var parent = Path.GetDirectoryName(common);
                if (parent == null)
                    return null;
                common = parent;
            }
        }

        var candidate = common;
        for (var level = 0; level <= MaxLevelsUp && candidate != null; level++)
        {
            if (Directory.Exists(candidate) && Directory.GetFiles(candidate, "*.vbproj").Length > 0)
                return candidate;
            candidate = Path.GetDirectoryName(candidate);
        }

        return common;
    }

    /// <summary>First <c>*.vbproj</c> (ordinal) directly in <paramref name="directory"/>, or null (021).</summary>
    public static string? FindProjectFile(string? directory)
    {
        if (directory == null || !Directory.Exists(directory))
            return null;
        var files = Directory.GetFiles(directory, "*.vbproj");
        Array.Sort(files, StringComparer.Ordinal);
        return files.Length == 0 ? null : files[0];
    }

    /// <summary><c>*.vbproj</c> files under <paramref name="directory"/> (recursive, without <c>bin/</c> and <c>obj/</c>), ordinal (021).</summary>
    public static IReadOnlyList<string> NestedProjectFiles(string directory)
    {
        if (!Directory.Exists(directory))
            return Array.Empty<string>();
        var files = Directory.GetFiles(directory, "*.vbproj", SearchOption.AllDirectories);
        Array.Sort(files, StringComparer.Ordinal);
        return files.Where(f => !IsBuildOutput(directory, f)).ToList();
    }

    /// <summary><c>app.config</c> / <c>web.config</c> (any case) directly in <paramref name="directory"/>, ordinal by name.</summary>
    public static IReadOnlyList<string> ConfigFiles(string directory)
    {
        if (!Directory.Exists(directory))
            return Array.Empty<string>();
        return Directory.GetFiles(directory)
            .Where(f => ConfigFileNames.Contains(Path.GetFileName(f), StringComparer.OrdinalIgnoreCase))
            .OrderBy(f => Path.GetFileName(f), StringComparer.Ordinal)
            .ToList();
    }

    /// <summary><c>*.xsd</c> files under <paramref name="directory"/> (recursive, without <c>bin/</c> and <c>obj/</c>), ordinal.</summary>
    public static IReadOnlyList<string> TypedDataSetFiles(string directory)
    {
        if (!Directory.Exists(directory))
            return Array.Empty<string>();
        return Directory.GetFiles(directory, "*.xsd", SearchOption.AllDirectories)
            .Where(f => !IsBuildOutput(directory, f))
            .OrderBy(f => f, StringComparer.Ordinal)
            .ToList();
    }

    /// <summary>True when <paramref name="file"/> lies under a <c>bin</c> or <c>obj</c> directory of <paramref name="root"/>.</summary>
    public static bool IsBuildOutput(string root, string file)
    {
        var relative = Path.GetRelativePath(root, file).Replace('\\', '/');
        return relative.Split('/').SkipLast(1)
            .Any(s => s.Equals("bin", StringComparison.OrdinalIgnoreCase) || s.Equals("obj", StringComparison.OrdinalIgnoreCase));
    }

    private static bool IsSameOrUnder(string dir, string ancestor) =>
        dir.Equals(ancestor, StringComparison.Ordinal)
        || dir.StartsWith(ancestor.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.Ordinal);
}
