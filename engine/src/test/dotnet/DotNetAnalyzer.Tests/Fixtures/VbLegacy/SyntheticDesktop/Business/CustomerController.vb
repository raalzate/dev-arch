Imports LegacyShop.DataAccess

Namespace LegacyShop.Business

    Public Class CustomerController

        Private ReadOnly _dataAccess As CustomerDataAccess

        Public Sub New(ByVal dataAccess As CustomerDataAccess)
            _dataAccess = dataAccess
        End Sub

        Public Sub Save(ByVal name As String)
            If String.IsNullOrEmpty(name) Then
                Throw New ArgumentException("Name is required")
            End If
            _dataAccess.Insert(New Customer(name))
        End Sub

        Public Function CountCustomers() As Integer
            Return _dataAccess.GetCustomers().Rows.Count
        End Function

    End Class

End Namespace
