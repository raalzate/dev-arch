Namespace Rules

    ' Fictitious validator (business layer by name).
    Public Class PolicyValidator

        Public Function IsValid(ByVal number As String) As Boolean
            Return Not String.IsNullOrEmpty(number)
        End Function

    End Class

End Namespace
