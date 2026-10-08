using System.Text.RegularExpressions;

namespace DotNetAnalyzer.Analysis.Vb;

/// <summary>
/// Recognizes table-producing SQL in a folded literal and returns the table names in order of appearance
/// (009-vb-legacy-completion, data-model §SQL). Strict grammar: free text, procedure calls, temporary tables,
/// table variables and table-valued functions never produce tables.
/// </summary>
public static class SqlTableParser
{
    private const RegexOptions Options =
        RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.CultureInvariant;

    private const string Part = @"(?:\[[^\]]+\]|""[^""]+""|`[^`]+`|[A-Za-z_][A-Za-z0-9_$]*)";

    private static readonly string TableRef = $@"(?>(?<ref>{Part}(?:\.{Part}){{0,3}}))";

    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(1);

    private static readonly Regex Select = new(@"^SELECT\s+(?<list>.+?)\s+FROM\s", Options, Timeout);

    private static readonly Regex Insert = new(
        $@"^INSERT\s+INTO\s+{TableRef}\s*(?:\(|VALUES\b|SELECT\b|DEFAULT\s+VALUES\b|$)", Options, Timeout);

    private static readonly Regex Update = new($@"^UPDATE\s+{TableRef}\s+SET\s", Options, Timeout);

    private static readonly Regex Delete = new(
        $@"^DELETE\s+(?:TOP\s*\(\s*\d+\s*\)\s+)?FROM\s+{TableRef}\s*(?:WHERE\b|OUTPUT\b|;|$)", Options, Timeout);

    private static readonly Regex Merge = new(
        $@"^MERGE\s+(?:TOP\s*\(\s*\d+\s*\)\s+)?(?:INTO\s+)?{TableRef}(?:\s+(?:AS\s+)?\w+)?\s+USING\s+", Options, Timeout);

    private static readonly Regex FromOrJoin = new($@"\b(?:FROM|JOIN)\s+{TableRef}(?<next>\s*\()?", Options, Timeout);

    private static readonly Regex Using = new($@"\bUSING\s+{TableRef}(?<next>\s*\()?", Options, Timeout);

    private static readonly Regex Whole = new($@"^\s*{TableRef}\s*$", Options, Timeout);

    private static readonly Regex Parts = new(Part, Options, Timeout);

    private static readonly HashSet<string> Reserved = new(StringComparer.OrdinalIgnoreCase)
    {
        "SELECT", "WHERE", "SET", "VALUES", "ON", "AS", "JOIN", "INNER", "LEFT", "RIGHT", "OUTER", "CROSS", "FULL",
        "GROUP", "ORDER", "BY", "HAVING", "UNION", "INTO", "FROM", "USING", "WITH", "TOP", "DISTINCT",
    };

    /// <summary>Tables of <paramref name="text"/> in order of appearance, deduplicated ignoring case.</summary>
    public static IReadOnlyList<string> Parse(string text)
    {
        var tables = new List<string>();
        if (string.IsNullOrWhiteSpace(text))
            return tables;

        var sql = text.Trim();
        try
        {
            if (IsSelect(sql))
            {
                AddAll(FromOrJoin, sql, tables);
            }
            else if (Insert.Match(sql) is { Success: true } insert)
            {
                Add(insert.Groups["ref"].Value, followedByParenthesis: false, tables);
                AddAll(FromOrJoin, sql, tables);
            }
            else if (Update.Match(sql) is { Success: true } update)
            {
                Add(update.Groups["ref"].Value, followedByParenthesis: false, tables);
                AddAll(FromOrJoin, sql, tables);
            }
            else if (Delete.Match(sql) is { Success: true } delete)
            {
                Add(delete.Groups["ref"].Value, followedByParenthesis: false, tables);
                AddAll(FromOrJoin, sql, tables);
            }
            else if (Merge.Match(sql) is { Success: true } merge)
            {
                Add(merge.Groups["ref"].Value, followedByParenthesis: false, tables);
                AddAll(Using, sql, tables);
                AddAll(FromOrJoin, sql, tables);
            }
        }
        catch (RegexMatchTimeoutException)
        {
            Console.Error.WriteLine("[WARN] SqlTableParser: literal too complex to analyze; ignored.");
            tables.Clear();
        }

        return tables;
    }

    /// <summary>
    /// Last part of a table reference without delimiters (<c>[sales].[Invoices]</c> → <c>Invoices</c>), or null
    /// when <paramref name="tableRef"/> is not a table reference.
    /// </summary>
    public static string? Normalize(string tableRef)
    {
        if (string.IsNullOrWhiteSpace(tableRef) || !Whole.IsMatch(tableRef))
            return null;
        var last = Parts.Matches(tableRef.Trim()).Last().Value;
        if (last.Length >= 2 && (last[0] == '[' || last[0] == '"' || last[0] == '`'))
            last = last[1..^1];
        last = last.Trim();
        return last.Length == 0 ? null : last;
    }

    private static bool IsSelect(string sql)
    {
        var match = Select.Match(sql);
        if (!match.Success)
            return false;
        var list = match.Groups["list"].Value.Trim();
        return list == "*"
               || list.IndexOfAny(new[] { ',', '.', '(', '*' }) >= 0
               || Regex.IsMatch(list, @"\sAS\s", Options, Timeout)
               || Regex.IsMatch(list, @"^(?:TOP|DISTINCT)\b", Options, Timeout)
               || !list.Any(char.IsWhiteSpace);
    }

    private static void AddAll(Regex regex, string sql, List<string> tables)
    {
        foreach (Match match in regex.Matches(sql))
        {
            Add(match.Groups["ref"].Value, match.Groups["next"].Success, tables);
        }
    }

    private static void Add(string tableRef, bool followedByParenthesis, List<string> tables)
    {
        if (followedByParenthesis)
            return;
        var parts = Parts.Matches(tableRef);
        if (parts.Count == 1 && Reserved.Contains(parts[0].Value))
            return;
        var name = Normalize(tableRef);
        if (name != null && !tables.Contains(name, StringComparer.OrdinalIgnoreCase))
            tables.Add(name);
    }
}
