Namespace Clients

    ' Fictitious gateway over the generated WCF client of the Ofac service reference.
    Public Class OfacGateway

        Public Function IsListed(ByVal name As String) As Boolean
            Dim client As New Ofac.OfacClient()
            Return client.IsListed(name)
        End Function

    End Class

End Namespace
