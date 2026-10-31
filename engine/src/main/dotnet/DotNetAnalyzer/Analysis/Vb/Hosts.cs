namespace DotNetAnalyzer.Analysis.Vb;

/// <summary>Host of an address (022, FR-005): no scheme, port, credentials, path or query ever leaves the analysis.</summary>
public static class Hosts
{
    /// <summary>
    /// Host of an absolute URL (<c>scheme://[user[:password]@]host[:port][/path][?query]</c>), or null when
    /// <paramref name="text"/> is not one. Parsed by hand so that non-standard schemes (<c>net.tcp</c>, <c>net.pipe</c>)
    /// with credentials behave like HTTP ones.
    /// </summary>
    public static string? Of(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return null;
        var value = text.Trim();
        var schemeEnd = value.IndexOf("://", StringComparison.Ordinal);
        if (schemeEnd <= 0 || !value[..schemeEnd].All(c => char.IsLetterOrDigit(c) || c is '+' or '-' or '.'))
            return null;
        var authority = value[(schemeEnd + 3)..];
        var end = authority.IndexOfAny(new[] { '/', '?', '#' });
        if (end >= 0)
            authority = authority[..end];
        var at = authority.LastIndexOf('@');
        if (at >= 0)
            authority = authority[(at + 1)..];
        var colon = authority.LastIndexOf(':');
        if (colon >= 0 && !authority.StartsWith("[", StringComparison.Ordinal))
            authority = authority[..colon];
        authority = authority.Trim();
        return authority.Length == 0 || authority.Any(char.IsWhiteSpace) ? null : authority;
    }
}
