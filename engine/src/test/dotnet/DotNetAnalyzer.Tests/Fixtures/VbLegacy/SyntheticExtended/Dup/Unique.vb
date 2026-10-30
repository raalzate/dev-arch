Namespace Dup

    ' A method that is not duplicated anywhere.
    Public Class Unique

        Public Function Total(count As Integer) As Integer
            Dim result As Integer = count
            While result < 100
                result = result * 2 + 1
            End While
            Return result
        End Function

    End Class

End Namespace
