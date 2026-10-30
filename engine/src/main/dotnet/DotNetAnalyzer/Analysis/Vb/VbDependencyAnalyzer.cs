using DotNetAnalyzer.Model;
using Microsoft.CodeAnalysis;

namespace DotNetAnalyzer.Analysis.Vb;

/// <summary>
/// Pass 12c (VB, 022-external-integrations): third-party packages and assembly references of the project as
/// <c>external_dependencies</c>, end-of-life dependencies as <c>EOL_DEPENDENCY</c> issues plus
/// <c>Dependency:eol:&lt;name&gt;</c>, and referenced projects missing from the analyzed sources as
/// <c>project:&lt;name&gt;</c>. Warnings (missing projects) are returned for the analyzer to aggregate.
/// </summary>
public static class VbDependencyAnalyzer
{
    public static bool Enabled(DependenciesOptions options, string language) => options.Enabled switch
    {
        PassMode.On => true,
        PassMode.Off => false,
        _ => language == LanguageNames.VisualBasic,
    };

    public static string StateDiagnostic(DependenciesOptions options, string language) =>
        $"External dependencies: {(Enabled(options, language) ? "on" : "off")} for "
        + $"{(language == LanguageNames.VisualBasic ? "Visual Basic" : "C#")} ({(options.Enabled == PassMode.Auto ? "auto" : "config")})";

    /// <summary>Applies the project's dependencies to its components; returns the missing project names.</summary>
    public static IReadOnlyList<string> Analyze(
        VbTypeIndex index, List<Component> components, VbProjectFile? project, string analyzedRoot, EolCatalog catalog)
    {
        if (project == null)
            return Array.Empty<string>();
        var ids = index.Types.Select(t => t.Id).ToHashSet(StringComparer.Ordinal);
        var targets = components.Where(c => ids.Contains(c.Id)).ToList();

        var dependencies = new SortedDictionary<string, string?>(StringComparer.Ordinal);
        foreach (var (name, version) in project.Packages)
            dependencies[name] = version;
        foreach (var (name, version) in project.AssemblyReferences)
        {
            if (!dependencies.ContainsKey(name))
                dependencies[name] = version;
        }

        var missing = project.MissingProjectReferences(analyzedRoot);
        var eol = dependencies
            .Select(d => (Name: d.Key, Rule: catalog.Match(d.Key, d.Value)))
            .Where(x => x.Rule != null)
            .ToList();

        foreach (var component in targets)
        {
            foreach (var name in dependencies.Keys)
                AddDependency(component, name);
            foreach (var name in missing)
                AddDependency(component, "project:" + name);
            foreach (var (name, rule) in eol)
            {
                var annotation = "Dependency:eol:" + name;
                if (!component.Annotations.Contains(annotation, StringComparer.Ordinal))
                    component.Annotations.Add(annotation);
                component.CodeIssues.Add(new CodeIssue
                {
                    Rule = "EOL_DEPENDENCY",
                    Type = "DEPENDENCY",
                    Severity = "WARNING",
                    Message = $"Dependency '{name}' has reached end of life: {rule!.Reason}. Plan its replacement.",
                    Line = 0,
                    Location = project.FileName,
                });
            }

            component.CodeIssues = component.CodeIssues
                .OrderBy(i => i.Location ?? string.Empty, StringComparer.Ordinal)
                .ThenBy(i => i.Rule, StringComparer.Ordinal)
                .ToList();
        }

        return missing;
    }

    private static void AddDependency(Component component, string name)
    {
        if (!component.ExternalDependencies.Contains(name, StringComparer.Ordinal))
            component.ExternalDependencies.Add(name);
    }
}
