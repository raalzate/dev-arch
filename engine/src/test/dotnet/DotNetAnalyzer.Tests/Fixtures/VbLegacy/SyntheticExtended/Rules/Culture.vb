Namespace Rules

    ' CA1305: formatting and parsing without an IFormatProvider.
    Public Class Culture

        Public Shared Sub Run()
            Dim text = String.Format("{0}", 42)
            Dim value = Integer.Parse("42")
            Console.WriteLine(text & value.ToString())
        End Sub

    End Class

End Namespace
