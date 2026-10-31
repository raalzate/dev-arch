namespace DotNetAnalyzer.Analysis.Data;

/// <summary>
/// Optional procedure → tables catalog (020, data-model §Catálogo): a directory of T-SQL scripts or a CSV with the
/// header <c>procedimiento,tabla,operación</c> / <c>procedure,table,operation</c>. Deterministic: files in ordinal
/// path order, duplicate definitions resolved to the lowest path, transitive <c>EXEC</c> resolution with a visited
/// set. Warnings never carry absolute paths or procedure bodies.
/// </summary>
public sealed class ProcedureCatalog
{
    private static readonly string[] SpanishHeader = { "procedimiento", "tabla", "operación" };
    private static readonly string[] EnglishHeader = { "procedure", "table", "operation" };

    private readonly string _label;
    private readonly Dictionary<string, ProcedureDefinition> _definitions = new(StringComparer.Ordinal);
    private readonly SortedSet<string> _duplicates = new(StringComparer.Ordinal);
    private readonly SortedSet<string> _unresolved = new(StringComparer.Ordinal);
    private readonly string? _notLoaded;

    private ProcedureCatalog(string label, string? notLoaded)
    {
        _label = label;
        _notLoaded = notLoaded;
    }

    /// <summary>Display name of the catalog (file or directory name, never the full path).</summary>
    public string Label => _label;

    /// <summary>Reason the catalog could not be loaded, or null.</summary>
    public string? NotLoaded => _notLoaded;

    /// <summary>Procedure keys defined by the catalog.</summary>
    public IReadOnlyCollection<string> Keys => _definitions.Keys.OrderBy(k => k, StringComparer.Ordinal).ToList();

    /// <summary>Loads a directory of scripts or a <c>.csv</c> file; a catalog that failed to load resolves nothing.</summary>
    public static ProcedureCatalog Load(string path)
    {
        var label = Path.GetFileName(path.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar));
        if (string.IsNullOrEmpty(label))
            label = path;
        try
        {
            if (Directory.Exists(path))
                return FromScripts(label, path);
            if (File.Exists(path))
            {
                return path.EndsWith(".csv", StringComparison.OrdinalIgnoreCase)
                    ? FromCsv(label, File.ReadAllText(path))
                    : FromScriptText(label, File.ReadAllText(path), label);
            }

            return new ProcedureCatalog(label, "path not found");
        }
        catch (IOException ex)
        {
            return new ProcedureCatalog(label, "cannot read: " + ex.GetType().Name);
        }
        catch (UnauthorizedAccessException)
        {
            return new ProcedureCatalog(label, "cannot read: access denied");
        }
    }

    /// <summary>Catalog from the scripts of a directory (recursive, ordinal, without <c>bin/</c> and <c>obj/</c>).</summary>
    public static ProcedureCatalog FromScripts(string label, string directory)
    {
        var catalog = new ProcedureCatalog(label, null);
        var files = Directory.GetFiles(directory, "*.sql", SearchOption.AllDirectories);
        Array.Sort(files, StringComparer.Ordinal);
        var root = Path.GetFullPath(directory);
        foreach (var file in files)
        {
            var relative = Path.GetRelativePath(root, file).Replace('\\', '/');
            if (relative.Split('/').Any(s => s.Equals("bin", StringComparison.OrdinalIgnoreCase) || s.Equals("obj", StringComparison.OrdinalIgnoreCase)))
                continue;
            catalog.AddScript(File.ReadAllText(file), relative);
        }

        return catalog;
    }

    /// <summary>Catalog from one script text.</summary>
    public static ProcedureCatalog FromScriptText(string label, string script, string fileName)
    {
        var catalog = new ProcedureCatalog(label, null);
        catalog.AddScript(script, fileName);
        return catalog;
    }

    /// <summary>Catalog from CSV text with the mandatory header.</summary>
    public static ProcedureCatalog FromCsv(string label, string csv)
    {
        var lines = csv.Split('\n').Select(l => l.TrimEnd('\r')).ToList();
        var header = lines.FirstOrDefault(l => !string.IsNullOrWhiteSpace(l));
        var columns = header == null ? Array.Empty<string>() : SplitCsv(header).Select(c => c.Trim().ToLowerInvariant()).ToArray();
        if (!(Matches(columns, SpanishHeader) || Matches(columns, EnglishHeader)))
        {
            return new ProcedureCatalog(label,
                "CSV header must be 'procedimiento,tabla,operación' or 'procedure,table,operation'");
        }

        var catalog = new ProcedureCatalog(label, null);
        var seenHeader = false;
        foreach (var line in lines)
        {
            if (string.IsNullOrWhiteSpace(line))
                continue;
            if (!seenHeader)
            {
                seenHeader = true;
                continue;
            }

            var cells = SplitCsv(line);
            if (cells.Count < 2)
                continue;
            var name = ProcedureName.Parse(cells[0]);
            var table = Vb.SqlTableParser.Normalize(cells[1]);
            if (name == null || table == null)
                continue;
            if (!catalog._definitions.TryGetValue(name.Key, out var definition))
            {
                definition = new ProcedureDefinition(name, new SortedSet<string>(StringComparer.Ordinal), new SortedSet<string>(StringComparer.Ordinal));
                catalog._definitions[name.Key] = definition;
            }

            if (!definition.Tables.Contains(table, StringComparer.OrdinalIgnoreCase))
                definition.Tables.Add(table);
        }

        return catalog;
    }

    /// <summary>
    /// Tables of a procedure (own and transitive through <c>EXEC</c>), ordinal; null when the procedure is not in
    /// the catalog (then it is recorded as unresolved).
    /// </summary>
    public IReadOnlyCollection<string>? Resolve(ProcedureName name)
    {
        if (!_definitions.ContainsKey(name.Key))
        {
            if (_notLoaded == null)
                _unresolved.Add(name.Key);
            return null;
        }

        var tables = new SortedSet<string>(StringComparer.Ordinal);
        var visited = new HashSet<string>(StringComparer.Ordinal);
        var pending = new Stack<string>();
        pending.Push(name.Key);
        while (pending.Count > 0)
        {
            var key = pending.Pop();
            if (!visited.Add(key) || !_definitions.TryGetValue(key, out var definition))
                continue;
            foreach (var table in definition.Tables)
            {
                if (!tables.Contains(table, StringComparer.OrdinalIgnoreCase))
                    tables.Add(table);
            }

            foreach (var call in definition.Calls)
                pending.Push(call);
        }

        return tables;
    }

    /// <summary>User warnings of the catalog (ordered by the caller).</summary>
    public IEnumerable<string> Warnings()
    {
        if (_notLoaded != null)
        {
            yield return $"Procedure catalog '{_label}' not loaded: {_notLoaded}; procedures are reported as sp:<name> only";
            yield break;
        }

        if (_unresolved.Count > 0)
            yield return $"Procedure catalog '{_label}': {_unresolved.Count} procedure(s) not found: {string.Join(", ", _unresolved)}";
        foreach (var duplicate in _duplicates)
            yield return $"Procedure catalog '{_label}': {duplicate}";
    }

    private void AddScript(string script, string fileName)
    {
        foreach (var definition in ProcedureScriptParser.Parse(script))
        {
            var key = definition.Name.Key;
            if (_definitions.TryGetValue(key, out var existing))
            {
                _duplicates.Add($"duplicate definition of {key} in {fileName}; {_files[key]} used");
                continue;
            }

            _definitions[key] = definition;
            _files[key] = fileName;
        }
    }

    private readonly Dictionary<string, string> _files = new(StringComparer.Ordinal);

    private static bool Matches(string[] columns, string[] expected) =>
        columns.Length >= expected.Length && expected.Zip(columns).All(p => p.First == p.Second);

    private static List<string> SplitCsv(string line)
    {
        var cells = new List<string>();
        var current = new System.Text.StringBuilder();
        var quoted = false;
        foreach (var c in line)
        {
            if (c == '"')
            {
                quoted = !quoted;
            }
            else if (c == ',' && !quoted)
            {
                cells.Add(current.ToString().Trim());
                current.Clear();
            }
            else
            {
                current.Append(c);
            }
        }

        cells.Add(current.ToString().Trim());
        return cells;
    }
}
