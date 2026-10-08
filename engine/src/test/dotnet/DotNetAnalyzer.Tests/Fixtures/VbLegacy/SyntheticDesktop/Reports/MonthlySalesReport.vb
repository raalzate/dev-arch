Imports System.Configuration

Namespace LegacyShop.Reports

    Public Class MonthlySalesReport

        Private ReadOnly _folder As String = ConfigurationManager.AppSettings("ReportsFolder")

        Public Function Build(ByVal month As Integer, ByVal region As String, ByVal detailed As Boolean) As String
            Dim sql As String = "SELECT InvoiceId, Total FROM Invoices WHERE MONTH(IssuedOn) = @month"
            Dim label As String = ""
            If month < 1 OrElse month > 12 Then Return ""
            If region = "N" Then
                label = "North"
            ElseIf region = "S" Then
                label = "South"
            ElseIf region = "E" Then
                label = "East"
            ElseIf region = "W" Then
                label = "West"
            Else
                label = "All"
            End If
            Select Case month
                Case 1, 2, 3
                    label &= " Q1"
                Case 4, 5, 6
                    label &= " Q2"
                Case Else
                    label &= " H2"
            End Select
            If detailed AndAlso label.Length > 0 Then
                label &= " (detailed)"
            End If
            Return If(detailed, label & ";" & sql, label)
        End Function

        Public Function ConnectionName() As String
            Return ConfigurationManager.ConnectionStrings("ReportsDb").Name
        End Function

    End Class

End Namespace
