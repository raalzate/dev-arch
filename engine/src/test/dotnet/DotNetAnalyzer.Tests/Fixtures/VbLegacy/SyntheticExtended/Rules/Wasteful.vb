Namespace Rules

    ' CA1806: the result of a pure method call is ignored.
    Public Class Wasteful

        Public Shared Sub Run()
            Dim text As String = "abc"
            text.Replace("a", "b")
            Console.WriteLine(text)
        End Sub

    End Class

End Namespace
