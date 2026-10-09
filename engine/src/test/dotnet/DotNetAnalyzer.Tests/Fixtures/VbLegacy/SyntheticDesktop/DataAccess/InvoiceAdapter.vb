Namespace LegacyShop.DataAccess

    Public Class InvoiceAdapter

        Private ReadOnly _invoices As New SalesDataSetTableAdapters.InvoicesTableAdapter()
        Private ReadOnly _lines As New SalesDataSetTableAdapters.InvoiceLinesTableAdapter()

        Public Function LoadInvoices() As SalesDataSet.InvoicesDataTable
            Return _invoices.GetData()
        End Function

        Public Function CountLines(ByVal invoiceId As Integer) As Integer
            Dim lines As SalesDataSet.InvoiceLinesDataTable = _lines.GetData()
            Dim total As Integer = 0
            For Each row In lines
                If row IsNot Nothing AndAlso invoiceId > 0 Then
                    total += 1
                End If
            Next
            Return total
        End Function

    End Class

End Namespace
