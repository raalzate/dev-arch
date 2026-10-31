Imports System.Data

Namespace LegacyShop.DataAccess

    ''' <summary>
    ''' Synthetic data access through stored procedures (feature 020): Enterprise Library style
    ''' (GetStoredProcCommand, ExecuteDataSet/ExecuteScalar with the procedure name), ADO.NET
    ''' CommandType.StoredProcedure and a Dapper-style call. Fictitious procedures and tables.
    ''' The non-literal name in RunNamed must stay on line 34 (specs/020 TS-040).
    ''' </summary>
    Public Class PolicyAdapter

        Private ReadOnly _db As Object

        Public Sub New(ByVal db As Object)
            _db = db
        End Sub

        Public Function ReadPolicy(ByVal id As Integer) As DataSet
            Dim cmd = _db.GetStoredProcCommand("usp_Policy_Read")
            Return _db.ExecuteDataSet(cmd)
        End Function

        Public Function ListPolicies() As DataSet
            Return _db.ExecuteDataSet(_db, "usp_Policy_" & _
                                            "List")
        End Function

        Public Function CountPolicies() As Integer
            Return CInt(_db.ExecuteScalar(_db, "[dbo].[usp_Policy_Count]"))
        End Function

        Public Sub RunNamed(ByVal procedureName As String)
            Dim cmd = _db.GetStoredProcCommand(procedureName)
            _db.ExecuteNonQuery(cmd)
        End Sub

        Public Sub SavePolicy(ByVal cmd As IDbCommand)
            cmd.CommandType = CommandType.StoredProcedure
            cmd.CommandText = "dbo.usp_Policy_Save"
            cmd.ExecuteNonQuery()
        End Sub

        Public Sub ArchivePolicy(ByVal conn As Object)
            conn.Execute("usp_Policy_Archive", New With {.Id = 1}, commandType:=CommandType.StoredProcedure)
            conn.Execute("usp_Policy_Touch", commandType:=CommandType.StoredProcedure)
        End Sub

        Public Sub Wait(ByVal cmd As IDbCommand)
            cmd.CommandType = CommandType.Text
            cmd.CommandText = "WAITFOR DELAY '00:00:01'"
            cmd.ExecuteNonQuery()
        End Sub

    End Class

End Namespace
