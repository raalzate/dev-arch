Namespace Reports

    ' Fictitious report class with a report definition file next to it.
    Public Class PolicyListing
        Inherits DataDynamics.ActiveReports.ActiveReport3

        Public Sub Run()
            Me.Document.Name = "Policies"
        End Sub

    End Class

End Namespace
