using System.Collections.Immutable;
using System.Globalization;
using System.Reflection;
using DotNetAnalyzer.Model;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.Diagnostics;

namespace DotNetAnalyzer.Analysis.Vb;

/// <summary>
/// 024 (FR-010): runs the official analyzers of <c>Microsoft.CodeAnalysis.NetAnalyzers</c> (Visual Basic) over the
/// compilation with exactly the rules of the versioned list and maps each diagnostic to a <see cref="CodeIssue"/>
/// of the closed contract enum (type by category, severity from the list, message prefixed with the category and
/// the CWE). Analyzer assemblies are loaded from the <c>analyzers</c> folder next to the analyzer binary.
/// </summary>
public static class VbExtendedAnalyzer
{
    public static bool Enabled(AnalysisSection options, string language) => options.Extended switch
    {
        PassMode.On => true,
        PassMode.Off => false,
        _ => language == LanguageNames.VisualBasic,
    };

    public static string StateDiagnostic(AnalysisSection options, string language)
    {
        var state = Enabled(options, language) ? "on" : "off";
        var reason = options.Extended == PassMode.Auto
            ? $"auto: {(language == LanguageNames.VisualBasic ? "Visual Basic" : "C#")} compilation"
            : "config";
        return $"Extended analysis: {state} ({reason})";
    }

    /// <summary>Folder with the analyzer assemblies (copied by the project file).</summary>
    public static string AnalyzersDirectory => Path.Combine(AppContext.BaseDirectory, "analyzers");

    public static void Analyze(Compilation compilation, VbTypeIndex index, List<Component> components, ExtendedRuleSet ruleSet)
    {
        if (ruleSet.Rules.Count == 0)
            return;
        var analyzers = LoadAnalyzers(compilation.Language);
        if (analyzers.IsEmpty)
        {
            Console.Error.WriteLine($"[WARN] VbExtendedAnalyzer: no analyzer assembly found in '{AnalyzersDirectory}'; official rules skipped.");
            return;
        }

        var specific = ruleSet.Rules.ToImmutableDictionary(r => r.Id, _ => ReportDiagnostic.Warn, StringComparer.Ordinal);
        var configured = compilation.WithOptions(compilation.Options.WithSpecificDiagnosticOptions(specific));
        var withAnalyzers = new CompilationWithAnalyzers(configured, analyzers, new CompilationWithAnalyzersOptions(
            new AnalyzerOptions(ImmutableArray<AdditionalText>.Empty),
            onAnalyzerException: (ex, analyzer, _) => Console.Error.WriteLine(
                $"[WARN] VbExtendedAnalyzer: analyzer '{analyzer.GetType().Name}' failed: {ex.Message}"),
            concurrentAnalysis: false,
            logAnalyzerExecutionTime: false,
            reportSuppressedDiagnostics: false));
        var diagnostics = withAnalyzers.GetAnalyzerDiagnosticsAsync(CancellationToken.None).GetAwaiter().GetResult();

        var byId = components.ToDictionary(c => c.Id, c => c, StringComparer.Ordinal);
        foreach (var diagnostic in diagnostics
                     .Where(d => d.Location.IsInSource && ruleSet.Contains(d.Id))
                     .OrderBy(d => d.Location.SourceTree?.FilePath ?? string.Empty, StringComparer.Ordinal)
                     .ThenBy(d => d.Location.SourceSpan.Start)
                     .ThenBy(d => d.Id, StringComparer.Ordinal))
        {
            var tree = diagnostic.Location.SourceTree!;
            var node = tree.GetRoot().FindNode(diagnostic.Location.SourceSpan);
            var owner = index.Owner(node);
            if (owner == null || !byId.TryGetValue(owner.Id, out var component))
                continue;
            var rule = ruleSet.Get(diagnostic.Id)!;
            var line = diagnostic.Location.GetLineSpan().StartLinePosition.Line + 1;
            var file = string.IsNullOrEmpty(tree.FilePath) ? "unknown" : Path.GetFileName(tree.FilePath);
            var prefix = "[" + rule.Category.ToLowerInvariant() + "]" + (rule.Cwe == null ? "" : "[" + rule.Cwe + "]");
            component.CodeIssues.Add(new CodeIssue
            {
                Rule = rule.Id,
                Type = ExtendedRuleSet.TypeOf(rule.Category),
                Severity = rule.Severity,
                Message = prefix + " " + diagnostic.GetMessage(CultureInfo.InvariantCulture),
                Line = line,
                Location = $"{file}:{line}",
            });
        }
    }

    private static ImmutableArray<DiagnosticAnalyzer> LoadAnalyzers(string language)
    {
        var directory = AnalyzersDirectory;
        if (!Directory.Exists(directory))
            return ImmutableArray<DiagnosticAnalyzer>.Empty;
        var builder = ImmutableArray.CreateBuilder<DiagnosticAnalyzer>();
        foreach (var path in Directory.GetFiles(directory, "*.dll").OrderBy(p => p, StringComparer.Ordinal))
        {
            var reference = new AnalyzerFileReference(path, AssemblyLoader.Instance);
            builder.AddRange(reference.GetAnalyzers(language));
        }
        return builder.ToImmutable();
    }

    private sealed class AssemblyLoader : IAnalyzerAssemblyLoader
    {
        public static readonly AssemblyLoader Instance = new();

        public void AddDependencyLocation(string fullPath)
        {
        }

        public Assembly LoadFromPath(string fullPath) => Assembly.LoadFrom(fullPath);
    }
}
