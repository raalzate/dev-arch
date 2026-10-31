Namespace Dead

    ' Public API: two members are never referenced anywhere else (UNUSED_PUBLIC_MEMBER), one is.
    Public Class Orphans

        Public Sub NeverCalled()
            Console.WriteLine("never")
        End Sub

        Public Function NeverRead() As Integer
            Return 42
        End Function

        Public Sub Used()
            Console.WriteLine("used from Program")
        End Sub

    End Class

End Namespace
