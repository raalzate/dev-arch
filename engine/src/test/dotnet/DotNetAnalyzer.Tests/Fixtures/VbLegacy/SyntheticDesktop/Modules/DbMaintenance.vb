Imports System.Configuration
Imports System.Data
Imports System.Data.SqlClient

Namespace LegacyShop.Modules

    Public Module DbMaintenance

        Public Sub PurgeImports()
            Using cn As New SqlConnection(ConfigurationManager.ConnectionStrings("ShopDb").ConnectionString)
                Dim cmd As New SqlCommand("DELETE FROM TempImport WHERE Processed = 1", cn)
                cn.Open()
                cmd.ExecuteNonQuery()
            End Using
        End Sub

        Public Sub RunNightly()
            Dim cmd As New SqlCommand()
            cmd.CommandType = CommandType.StoredProcedure
            cmd.CommandText = "usp_NightlyMaintenance"
        End Sub

    End Module

End Namespace
