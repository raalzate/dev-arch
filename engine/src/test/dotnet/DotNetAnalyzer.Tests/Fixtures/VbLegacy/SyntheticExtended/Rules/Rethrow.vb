Namespace Rules

    ' CA2200: rethrowing with the variable loses the stack trace.
    Public Class Rethrow

        Public Shared Sub Run()
            Try
                Console.WriteLine("work")
            Catch ex As Exception
                Throw ex
            End Try
        End Sub

    End Class

End Namespace
