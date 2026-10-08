Option Strict Off
Option Explicit On

Imports LegacyShop.Business

Namespace LegacyShop.Forms

    Public Class CustomerForm

        Private ReadOnly _controller As New CustomerController(New LegacyShop.DataAccess.CustomerDataAccess())

        Private Sub btnSave_Click(ByVal sender As Object, ByVal e As EventArgs) Handles btnSave.Click
            On Error Resume Next
            _controller.Save(txtName.Text)
        End Sub

        Private Sub btnExport_Click(ByVal sender As Object, ByVal e As EventArgs) Handles btnExport.Click
            Dim excel As Object = CreateObject("Excel.Application")
            excel.Visible = True
            excel.Workbooks.Add()
        End Sub

        Private Sub ShowStatus(ByVal code As Integer)
            Select Case code
                Case 0
                    lblStatus.Text = "Ready"
                Case 1
                    lblStatus.Text = "Saved"
            End Select
        End Sub

    End Class

End Namespace
