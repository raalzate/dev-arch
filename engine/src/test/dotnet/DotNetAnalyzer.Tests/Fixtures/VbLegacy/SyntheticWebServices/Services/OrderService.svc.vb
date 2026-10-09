Imports System.Configuration
Imports System.Data.SqlClient

Namespace LegacyShop.Services

    Public Class OrderService
        Implements IOrderService

        Public Function GetOrder(ByVal id As String) As OrderDto Implements IOrderService.GetOrder
            Using cn As New SqlConnection(ConfigurationManager.ConnectionStrings("OrdersDb").ConnectionString)
                Dim cmd As New SqlCommand("SELECT OrderId, Status FROM Orders WHERE OrderId = @id", cn)
            End Using
            Return New OrderDto() With {.Id = id}
        End Function

        Public Sub CancelOrder(ByVal orderId As Integer, Optional ByVal reason As String = "") Implements IOrderService.CancelOrder
            Dim cmd As New SqlCommand("UPDATE Orders SET Status = 'Cancelled' WHERE OrderId = @id")
        End Sub

        Public Function UpdateStatus(ByVal id As String, ByVal status As String, ByVal notify As Boolean) As Boolean Implements IOrderService.UpdateStatus
            Return notify
        End Function

        Public Function NotAnOperation() As String Implements IOrderService.NotAnOperation
            Return String.Empty
        End Function

    End Class

End Namespace
