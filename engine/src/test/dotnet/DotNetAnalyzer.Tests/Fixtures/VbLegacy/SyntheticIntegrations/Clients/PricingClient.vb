Namespace Clients

    Public Interface IPricing
        Function Quote(ByVal product As String) As Decimal
    End Interface

    ' Fictitious hand-written WCF client.
    Public Class PricingClient
        Inherits System.ServiceModel.ClientBase(Of IPricing)

        Public Function Quote(ByVal product As String) As Decimal
            Return Channel.Quote(product)
        End Function

    End Class

End Namespace
