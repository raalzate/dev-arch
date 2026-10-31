Namespace Dup

    ' Identical method body to its sibling (DUPLICATED_CODE).
    Public Class CopyA

        Public Function Total(count As Integer) As Integer
            Dim sum As Integer = 0
            For index As Integer = 1 To count
                If index Mod 2 = 0 Then
                    sum += index * 2
                ElseIf index Mod 3 = 0 Then
                    sum += index * 3
                Else
                    sum += index
                End If
            Next
            Return sum + count
        End Function

    End Class

End Namespace
