namespace DotNetAnalyzer.Analysis.Data;

/// <summary>
/// Language-neutral view of one type for the stored procedure rules (020, research D2): the syntax adapters
/// (<see cref="CSharpProcedureCallSyntax"/>, <see cref="VisualBasicProcedureCallSyntax"/>) read the trees; the
/// <see cref="ProcedureCallMatcher"/> decides.
/// </summary>
public interface IProcedureCallSyntax
{
    /// <summary>Component id of the type.</summary>
    string ComponentId { get; }

    /// <summary>File name (no directory) of the type's first declaration.</summary>
    string FileName { get; }

    /// <summary>Method invocations owned by the type.</summary>
    IEnumerable<CallCandidate> Invocations();

    /// <summary>True when the type mentions the member <c>StoredProcedure</c> (ADO.NET <c>CommandType</c>).</summary>
    bool UsesStoredProcedureCommandType();

    /// <summary>
    /// Command texts of the type: assignments to a <c>CommandText</c> member, object initializers and the first
    /// argument of <c>New *Command(...)</c>. <c>Literal</c> is null for non-literal values.
    /// </summary>
    IEnumerable<TextCandidate> CommandTexts();
}

/// <summary>An invocation: method name, positional arguments (folded literal or null) and named arguments.</summary>
public sealed record CallCandidate(
    string MethodName,
    IReadOnlyList<string?> Arguments,
    IReadOnlyDictionary<string, string> NamedArguments,
    int Line);

/// <summary>A command text candidate.</summary>
public sealed record TextCandidate(string? Literal, int Line);
