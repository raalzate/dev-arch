using System.Text.RegularExpressions;

namespace DotNetAnalyzer.Analysis.Data;

/// <summary>
/// Canonical form of a stored procedure name (020, research D5): last part without schema or delimiters,
/// spelling of the source kept, compared through a lower-case invariant key. Emitted as <c>sp:&lt;Canonical&gt;</c>.
/// </summary>
public sealed record ProcedureName(string Canonical)
{
    /// <summary>Prefix of a procedure entry in <c>tables_used</c>.</summary>
    public const string Prefix = "sp:";

    /// <summary>Longest literal considered (same bound as <see cref="Vb.SqlTableParser.MaxLiteralLength"/>).</summary>
    public const int MaxLength = Vb.SqlTableParser.MaxLiteralLength;

    private static readonly Regex Identifier = new(@"^[\w$]+$", RegexOptions.CultureInvariant);

    /// <summary>Comparison key (schema-insensitive, case-insensitive).</summary>
    public string Key => Canonical.ToLowerInvariant();

    /// <summary><c>sp:</c> entry of <c>tables_used</c>.</summary>
    public string Entry => Prefix + Canonical;

    /// <summary>
    /// Parses <paramref name="text"/> (<c>[dbo].[usp_X]</c>, <c>dbo.usp_X</c>, <c>"usp_X"</c>, <c>usp_X</c>); null when it
    /// is empty, too long, contains spaces or is not a dotted identifier of at most four parts.
    /// </summary>
    public static ProcedureName? Parse(string? text)
    {
        if (string.IsNullOrWhiteSpace(text) || text.Length > MaxLength)
            return null;
        var parts = SplitParts(text.Trim());
        if (parts == null || parts.Count == 0 || parts.Count > 4)
            return null;
        var last = parts[^1];
        return Identifier.IsMatch(last) ? new ProcedureName(last) : null;
    }

    /// <summary>True when <paramref name="text"/> has the shape of a procedure name (used by the ADO.NET rule).</summary>
    public static bool LooksLikeIdentifier(string? text) => Parse(text) != null;

    private static List<string>? SplitParts(string text)
    {
        var parts = new List<string>();
        var i = 0;
        while (i < text.Length)
        {
            string part;
            var c = text[i];
            if (c is '[' or '"' or '`')
            {
                var close = c == '[' ? ']' : c;
                var end = text.IndexOf(close, i + 1);
                if (end < 0)
                    return null;
                part = text[(i + 1)..end].Trim();
                i = end + 1;
            }
            else
            {
                var end = text.IndexOf('.', i);
                if (end < 0)
                    end = text.Length;
                part = text[i..end].Trim();
                i = end;
            }

            if (part.Length == 0 || !Identifier.IsMatch(part))
                return null;
            parts.Add(part);
            if (i < text.Length)
            {
                if (text[i] != '.')
                    return null;
                i++;
                if (i == text.Length)
                    return null;
            }
        }

        return parts;
    }
}
