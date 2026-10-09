using System.Xml;
using System.Xml.Linq;

namespace DotNetAnalyzer.Analysis.Vb;

/// <summary>A typed DataSet class (table adapter or typed data table) and the database table it maps to.</summary>
public sealed record TypedDataSetClass(string ClassName, string Table);

/// <summary>Table adapters and typed data tables declared by a typed DataSet definition (<c>.xsd</c>).</summary>
public sealed record TypedDataSet(string File, IReadOnlyList<TypedDataSetClass> Adapters, IReadOnlyList<TypedDataSetClass> DataTables);

/// <summary>
/// Reads typed DataSet definitions (009-vb-legacy-completion, data-model §DataSet tipado, research D5).
/// DTD processing is disabled; an unreadable file yields a <c>[WARN]</c> diagnostic and is ignored.
/// </summary>
public static class TypedDataSetParser
{
    private const string MsProp = "urn:schemas-microsoft-com:xml-msprop";

    /// <summary>Parses <paramref name="path"/>; null when the file cannot be read.</summary>
    public static TypedDataSet? Parse(string path)
    {
        XDocument document;
        try
        {
            var settings = new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null };
            using var reader = XmlReader.Create(path, settings);
            document = XDocument.Load(reader);
        }
        catch (Exception ex) when (ex is XmlException or IOException or UnauthorizedAccessException)
        {
            Console.Error.WriteLine(
                $"[WARN] VbTableExtractor: could not read typed DataSet '{Path.GetFileName(path)}': {ex.Message}");
            return null;
        }

        var adapters = new List<(string Name, TypedDataSetClass Class)>();
        foreach (var adapter in document.Descendants().Where(e => e.Name.LocalName == "TableAdapter"))
        {
            var name = (string?)adapter.Attribute("Name");
            if (string.IsNullOrWhiteSpace(name))
                continue;
            var className = (string?)adapter.Attribute("GeneratorDataComponentClassName")
                            ?? (string?)adapter.Attribute("DataAccessorName")
                            ?? name + "TableAdapter";
            adapters.Add((name, new TypedDataSetClass(className, AdapterTable(adapter, name))));
        }

        var tables = new List<TypedDataSetClass>();
        foreach (var element in document.Descendants().Where(e => e.Name.LocalName == "element"))
        {
            var className = (string?)element.Attribute(XName.Get("Generator_TableClassName", MsProp));
            if (string.IsNullOrWhiteSpace(className))
                continue;
            var name = (string?)element.Attribute("name") ?? className;
            var table = adapters.FirstOrDefault(a => a.Name.Equals(name, StringComparison.Ordinal)).Class?.Table ?? name;
            tables.Add(new TypedDataSetClass(className, table));
        }

        return new TypedDataSet(Path.GetFileName(path), adapters.Select(a => a.Class).ToList(), tables);
    }

    private static string AdapterTable(XElement adapter, string name)
    {
        var source = adapter.Descendants().FirstOrDefault(e => e.Name.LocalName == "DbSource");
        if (source != null)
        {
            var objectName = (string?)source.Attribute("DbObjectName");
            var normalized = objectName != null ? SqlTableParser.Normalize(objectName) : null;
            if (normalized != null)
                return normalized;

            var commandText = source.Descendants().FirstOrDefault(e => e.Name.LocalName == "CommandText")?.Value;
            var fromCommand = commandText != null ? SqlTableParser.Parse(commandText).FirstOrDefault() : null;
            if (fromCommand != null)
                return fromCommand;
        }

        return name;
    }
}
