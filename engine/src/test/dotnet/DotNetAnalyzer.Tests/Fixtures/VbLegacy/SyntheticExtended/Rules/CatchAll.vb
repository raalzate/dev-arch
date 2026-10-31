Namespace Rules

    ' CA1031: catching the general exception type.
    Public Class CatchAll

        Public Shared Sub Run()
            Try
                Console.WriteLine("risky")
            Catch ex As Exception
                Console.WriteLine(ex.Message)
            End Try
        End Sub

    End Class

End Namespace
