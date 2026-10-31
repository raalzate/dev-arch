Namespace Clients

    ' Fictitious REST client: literal URL and configuration key.
    Public Class RatesClient

        Public Function Today() As String
            Dim request = System.Net.WebRequest.Create("http://rates.example.invalid/today")
            Dim client As New RestClient(ConfigurationManager.AppSettings("BisiBaseURL"))
            Return request.Method & client.ToString()
        End Function

    End Class

End Namespace
