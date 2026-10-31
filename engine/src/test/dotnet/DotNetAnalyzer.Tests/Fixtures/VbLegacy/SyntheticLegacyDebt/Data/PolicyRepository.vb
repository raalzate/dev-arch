Namespace Data

    ' Fictitious repository: concatenated SQL and two transaction models.
    Public Class PolicyRepository

        Public Function Load(ByVal cn As System.Data.SqlClient.SqlConnection, ByVal id As String) As System.Data.DataTable
            Dim cmd As New System.Data.SqlClient.SqlCommand()
            cmd.Connection = cn
            cmd.CommandText = "SELECT Id, Number FROM Policies WHERE Id = " & id
            Dim table As New System.Data.DataTable()
            Try
                table.Load(cmd.ExecuteReader())
            Catch ex As Exception
                System.Diagnostics.Trace.WriteLine(ex.Message)
            End Try
            Return table
        End Function

        Public Sub Archive(ByVal cn As System.Data.SqlClient.SqlConnection)
            Dim tx As System.Data.SqlClient.SqlTransaction = cn.BeginTransaction()
            Using scope As New System.Transactions.TransactionScope()
                scope.Complete()
            End Using
            tx.Commit()
        End Sub

    End Class

End Namespace
