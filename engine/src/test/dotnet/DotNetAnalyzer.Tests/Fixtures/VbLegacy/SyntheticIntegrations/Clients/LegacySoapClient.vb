Namespace Clients

    ' Fictitious hand-written SOAP client.
    Public Class LegacySoapClient
        Inherits System.Web.Services.Protocols.SoapHttpClientProtocol

        Public Sub New()
            Me.Url = "http://legacy.example.invalid/Rates.asmx"
        End Sub

    End Class

End Namespace
