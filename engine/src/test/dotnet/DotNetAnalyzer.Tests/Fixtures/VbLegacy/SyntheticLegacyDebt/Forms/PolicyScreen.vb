Namespace Forms

    ' Fictitious screen inheriting a third-party form base (recognized by name).
    Public Class PolicyScreen
        Inherits DevExpress.XtraEditors.XtraForm

        Public Sub Reload()
            Me.Text = "Policies"
        End Sub

    End Class

End Namespace
