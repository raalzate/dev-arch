Namespace Rules

    ' A business controller with a method above the complexity threshold (no suppression applies).
    Public Class BusyController

        Public Shared Function Classify(value As Integer) As String
            Select Case value
                Case 1 : Return "one"
                Case 2 : Return "two"
                Case 3 : Return "three"
                Case 4 : Return "four"
                Case 5 : Return "five"
                Case 6 : Return "six"
                Case 7 : Return "seven"
                Case 8 : Return "eight"
                Case 9 : Return "nine"
                Case 10 : Return "ten"
                Case 11 : Return "eleven"
                Case 12 : Return "twelve"
                Case 13 : Return "thirteen"
                Case 14 : Return "fourteen"
                Case 15 : Return "fifteen"
                Case 16 : Return "sixteen"
                Case 17 : Return "seventeen"
                Case Else : Return "many"
            End Select
        End Function

    End Class

End Namespace
