Imports System.Configuration
Imports System.Data
Imports System.Data.SqlClient
Imports LegacyShop.Business

Namespace LegacyShop.DataAccess

    Public Class CustomerDataAccess

        Private ReadOnly _connectionString As String = ConfigurationManager.ConnectionStrings("ShopDb").ConnectionString
        Private _lastError As String

        Public Function GetCustomers() As DataTable
            Dim table As New DataTable()
            Using cn As New SqlConnection(_connectionString)
                Dim cmd As New SqlCommand("SELECT c.Id, c.Name, o.Total FROM dbo.Customers c " & _
                                          "INNER JOIN [Orders] o ON o.CustomerId = c.Id", cn)
                Dim adapter As New SqlDataAdapter(cmd)
                adapter.Fill(table)
            End Using
            Return table
        End Function

        Public Sub Insert(ByVal customer As Customer)
            Using cn As New SqlConnection(_connectionString)
                Dim cmd As SqlCommand = cn.CreateCommand()
                cmd.CommandText = "INSERT INTO Customers (Name) VALUES (@name)"
                cmd.Parameters.AddWithValue("@name", customer.Name)
                Try
                    cn.Open()
                    cmd.ExecuteNonQuery()
                Catch ex As Exception
                    _lastError = ex.Message
                End Try
            End Using
        End Sub

        Public Sub MarkSeen(ByVal auditId As Integer)
            Dim sql As String = "UPDATE AuditLog SET Seen = 1 WHERE Id = " & auditId.ToString()
            Execute(sql)
        End Sub

        Public Sub Archive(ByVal tableName As String)
            Execute("SELECT * FROM " & tableName)
        End Sub

        Private Sub Execute(ByVal sql As String)
            Using cn As New SqlConnection(_connectionString)
                Dim cmd As New SqlCommand(sql, cn)
                Try
                    cn.Open()
                    cmd.ExecuteNonQuery()
                Catch
                End Try
            End Using
        End Sub

        Public Function LastError() As String
            Return _lastError
        End Function

    End Class

End Namespace
