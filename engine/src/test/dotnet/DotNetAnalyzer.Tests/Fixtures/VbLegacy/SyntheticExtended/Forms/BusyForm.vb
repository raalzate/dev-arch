Namespace Forms

    ' Form with a high-complexity method; suppressed by analysis.layerSuppressions for Presentación.
    Public Class BusyForm
        Inherits System.Windows.Forms.Form

        Public Function Caption(state As Integer) As String
            Select Case state
                Case 1 : Return "a"
                Case 2 : Return "b"
                Case 3 : Return "c"
                Case 4 : Return "d"
                Case 5 : Return "e"
                Case 6 : Return "f"
                Case 7 : Return "g"
                Case 8 : Return "h"
                Case 9 : Return "i"
                Case 10 : Return "j"
                Case 11 : Return "k"
                Case 12 : Return "l"
                Case 13 : Return "m"
                Case 14 : Return "n"
                Case 15 : Return "o"
                Case 16 : Return "p"
                Case 17 : Return "q"
                Case Else : Return "z"
            End Select
        End Function

    End Class

End Namespace
