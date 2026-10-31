namespace DotNetAnalyzer.Analysis.Data;

/// <summary>A recognized stored procedure invocation.</summary>
public sealed record ProcedureCall(ProcedureName Name, int Line, string Form);

/// <summary>Result of the rules over one type.</summary>
public sealed record ProcedureMatch(IReadOnlyList<ProcedureCall> Calls, IReadOnlyList<int> NonLiteralLines);

/// <summary>
/// The four recognition rules of 020 (data-model §Reglas, research D4), purely over
/// <see cref="IProcedureCallSyntax"/> candidates:
/// R1 Enterprise Library <c>GetStoredProcCommand(literal)</c>; R2 <c>ExecuteDataSet|ExecuteNonQuery|ExecuteScalar|
/// ExecuteReader(db, literal, …)</c>; R3 ADO.NET <c>CommandType.StoredProcedure</c> in the type plus an
/// identifier-shaped <c>CommandText</c>; R4 Dapper <c>Query*/Execute*(…, commandType: StoredProcedure)</c>.
/// </summary>
public static class ProcedureCallMatcher
{
    private static readonly HashSet<string> ExecuteMethods = new(StringComparer.Ordinal)
    {
        "ExecuteDataSet", "ExecuteNonQuery", "ExecuteScalar", "ExecuteReader",
    };

    public static ProcedureMatch Match(IProcedureCallSyntax type)
    {
        var calls = new List<ProcedureCall>();
        var nonLiteral = new SortedSet<int>();

        foreach (var call in type.Invocations())
        {
            if (IsDapper(call))
            {
                var literal = call.Arguments.Count > 0 && call.Arguments[0] != null ? call.Arguments[0]
                    : call.Arguments.Count > 1 ? call.Arguments[1] : null;
                Add(calls, nonLiteral, literal, call.Line, "dapper", warnWhenNotLiteral: true);
            }
            else if (call.MethodName == "GetStoredProcCommand" && call.Arguments.Count >= 1)
            {
                Add(calls, nonLiteral, call.Arguments[0], call.Line, "entlib", warnWhenNotLiteral: true);
            }
            else if (ExecuteMethods.Contains(call.MethodName) && call.Arguments.Count >= 2
                     && call.Arguments[0] == null && call.Arguments[1] != null)
            {
                Add(calls, nonLiteral, call.Arguments[1], call.Line, "entlib-execute", warnWhenNotLiteral: false);
            }
        }

        if (type.UsesStoredProcedureCommandType())
        {
            foreach (var text in type.CommandTexts())
            {
                if (text.Literal == null)
                    nonLiteral.Add(text.Line);
                else if (ProcedureName.Parse(text.Literal) is { } name)
                    calls.Add(new ProcedureCall(name, text.Line, "ado"));
            }
        }

        return new ProcedureMatch(calls, nonLiteral.ToList());
    }

    private static bool IsDapper(CallCandidate call) =>
        (call.MethodName.StartsWith("Query", StringComparison.Ordinal) || call.MethodName.StartsWith("Execute", StringComparison.Ordinal))
        && call.NamedArguments.TryGetValue("commandType", out var value)
        && value.EndsWith("StoredProcedure", StringComparison.Ordinal);

    private static void Add(List<ProcedureCall> calls, SortedSet<int> nonLiteral, string? literal, int line, string form, bool warnWhenNotLiteral)
    {
        if (literal == null)
        {
            if (warnWhenNotLiteral)
                nonLiteral.Add(line);
            return;
        }

        if (ProcedureName.Parse(literal) is { } name)
            calls.Add(new ProcedureCall(name, line, form));
    }
}
