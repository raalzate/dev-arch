Imports System.Windows.Forms

Namespace LegacyShop.Forms

    Public Class MainWindow
        Inherits System.Windows.Forms.Form

        Private Sub OpenCustomers()
            Dim form As New CustomerForm()
            form.Show()
        End Sub

    End Class

End Namespace
