Namespace Jobs

    ' Fictitious batch process: entry point with a UI call outside the presentation layer.
    Module NightlyProcess

        Sub Main()
            Dim archived As Integer = Facades.PolicyFacade.ArchiveExpired()
            MsgBox("Archived " & archived.ToString())
        End Sub

    End Module

End Namespace
