Namespace Forms

    ' Form (Layer:Presentación): excluded from dead-code detection, event handlers via Handles.
    Public Class MainForm
        Inherits System.Windows.Forms.Form

        Public Event Refreshed As EventHandler

        Private Sub MainForm_Load(sender As Object, e As EventArgs) Handles MyBase.Load
            Me.Text = "Policies"
        End Sub

        Public Sub ShowPolicies()
            RaiseEvent Refreshed(Me, EventArgs.Empty)
        End Sub

    End Class

End Namespace
