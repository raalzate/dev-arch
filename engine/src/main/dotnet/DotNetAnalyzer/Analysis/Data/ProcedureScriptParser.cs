using System.Text.RegularExpressions;
using DotNetAnalyzer.Analysis.Vb;

namespace DotNetAnalyzer.Analysis.Data;

/// <summary>A procedure definition found in a script: tables of its body and procedures it executes.</summary>
public sealed record ProcedureDefinition(ProcedureName Name, SortedSet<string> Tables, SortedSet<string> Calls);

/// <summary>
/// Reads <c>CREATE [OR ALTER] PROC[EDURE]</c> / <c>ALTER PROC[EDURE]</c> definitions of a T-SQL script (020,
/// research D6): the body runs to the next header, a <c>GO</c> line or the end; tables come from
/// <see cref="SqlTableParser"/> applied per statement; <c>EXEC[UTE] &lt;ref&gt;</c> are recorded as calls. No
/// regular-expression timeouts (BUG-002): statements longer than the parser bound are ignored.
/// </summary>
public static class ProcedureScriptParser
{
    private const RegexOptions Options = RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Multiline;

    private const string Ref = @"(?<ref>(?:\[[^\]]+\]|""[^""]+""|[A-Za-z_][\w$]*)(?:\s*\.\s*(?:\[[^\]]+\]|""[^""]+""|[A-Za-z_][\w$]*)){0,3})";

    private static readonly Regex Header = new(
        $@"^\s*(?:CREATE(?:\s+OR\s+ALTER)?|ALTER)\s+PROC(?:EDURE)?\s+{Ref}", Options);

    private static readonly Regex Go = new(@"^\s*GO\s*(?:--.*)?$", Options);

    private static readonly Regex Exec = new($@"^\s*EXEC(?:UTE)?\s+(?!\s*\()(?!sp_executesql\b){Ref}", Options);

    private static readonly Regex StatementStart = new(
        @"^\s*(?=(?:SELECT|INSERT|UPDATE|DELETE|MERGE|EXEC|EXECUTE|WITH)\b)", Options);

    private static readonly Regex LineComment = new(@"--[^\r\n]*", RegexOptions.CultureInvariant);

    private static readonly Regex BlockComment = new(@"/\*.*?\*/", RegexOptions.Singleline | RegexOptions.CultureInvariant);

    /// <summary>Definitions of <paramref name="script"/> in order of appearance.</summary>
    public static IReadOnlyList<ProcedureDefinition> Parse(string script)
    {
        var text = BlockComment.Replace(LineComment.Replace(script, string.Empty), string.Empty);
        var definitions = new List<ProcedureDefinition>();
        var headers = Header.Matches(text);
        for (var i = 0; i < headers.Count; i++)
        {
            var header = headers[i];
            var name = ProcedureName.Parse(header.Groups["ref"].Value.Replace(" ", string.Empty));
            if (name == null)
                continue;
            var bodyStart = header.Index + header.Length;
            var bodyEnd = i + 1 < headers.Count ? headers[i + 1].Index : text.Length;
            var body = text[bodyStart..bodyEnd];
            var go = Go.Match(body);
            if (go.Success)
                body = body[..go.Index];
            definitions.Add(new ProcedureDefinition(name, Tables(body), Calls(body)));
        }

        return definitions;
    }

    /// <summary>Statements of a body: split at <c>;</c> and at lines that start a new statement.</summary>
    public static IEnumerable<string> SplitStatements(string body)
    {
        foreach (var chunk in body.Split(';'))
        {
            var starts = StatementStart.Matches(chunk).Select(m => m.Index).Where(i => i > 0).ToList();
            var from = 0;
            foreach (var start in starts)
            {
                var piece = chunk[from..start].Trim();
                if (piece.Length > 0)
                    yield return piece;
                from = start;
            }

            var last = chunk[from..].Trim();
            if (last.Length > 0)
                yield return last;
        }
    }

    private static SortedSet<string> Tables(string body)
    {
        var tables = new SortedSet<string>(StringComparer.Ordinal);
        foreach (var statement in SplitStatements(body))
        {
            var sql = StripToStatement(statement);
            if (sql == null)
                continue;
            foreach (var table in SqlTableParser.Parse(sql))
            {
                if (!tables.Contains(table, StringComparer.OrdinalIgnoreCase))
                    tables.Add(table);
            }
        }

        return tables;
    }

    private static SortedSet<string> Calls(string body)
    {
        var calls = new SortedSet<string>(StringComparer.Ordinal);
        foreach (var statement in SplitStatements(body))
        {
            var exec = Exec.Match(statement);
            if (exec.Success && ProcedureName.Parse(exec.Groups["ref"].Value.Replace(" ", string.Empty)) is { } name)
                calls.Add(name.Key);
        }

        return calls;
    }

    /// <summary>Text from the first SQL keyword of the statement (drops <c>AS</c>, <c>BEGIN</c>, declarations…).</summary>
    private static string? StripToStatement(string statement)
    {
        var match = Regex.Match(statement, @"\b(SELECT|INSERT|UPDATE|DELETE|MERGE)\b", Options);
        return match.Success ? statement[match.Index..] : null;
    }
}
