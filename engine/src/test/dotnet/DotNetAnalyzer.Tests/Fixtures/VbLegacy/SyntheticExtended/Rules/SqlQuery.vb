Namespace Rules

    ' CA2100 (SQL injection review) fires only when System.Data types resolve (reference assemblies, 025).
    Public Class SqlQuery

        Public Shared Function Count(table As String) As Integer
            Dim text As String = "SELECT COUNT(*) FROM " & table
            Using connection As New System.Data.SqlClient.SqlConnection("Server=.;Database=Demo;Integrated Security=true")
                Using command As New System.Data.SqlClient.SqlCommand(text, connection)
                    connection.Open()
                    Return CInt(command.ExecuteScalar())
                End Using
            End Using
        End Function

    End Class

End Namespace
