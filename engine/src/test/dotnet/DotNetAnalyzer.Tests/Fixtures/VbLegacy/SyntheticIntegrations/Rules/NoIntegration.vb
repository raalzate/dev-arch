Namespace Rules

    ' Fictitious business rule without integrations.
    Public Class NoIntegration

        Public Function Allowed(ByVal amount As Decimal) As Boolean
            Return amount > 0
        End Function

    End Class

End Namespace
