Namespace Dead

    ' Every public member is referenced from Program.
    Public Class Helpers

        Public Shared Function FormatAmount(amount As Integer) As String
            Return "$" & amount.ToString(System.Globalization.CultureInfo.InvariantCulture)
        End Function

    End Class

End Namespace
