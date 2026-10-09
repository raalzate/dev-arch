Imports System.Configuration
Imports System.Web.Services
Imports System.Web.Services.Protocols

Namespace LegacyShop.Services

    <WebService(Namespace:="http://tempuri.org/")> _
    <WebServiceBinding(ConformsTo:=WsiProfiles.BasicProfile1_1)> _
    Public Class CustomerWebService
        Inherits System.Web.Services.WebService

        <WebMethod()> _
        Public Function GetCustomerCount(ByVal region As String) As Integer
            Return If(String.IsNullOrEmpty(region), 0, region.Length)
        End Function

        <WebMethod(Description:="Health check")> _
        Public Sub Ping()
        End Sub

        Public Function PartnerToken() As String
            Return ConfigurationManager.AppSettings("PartnerApiToken")
        End Function

        <WebMethod()> _
        Private Function Hidden() As String
            Return "hidden"
        End Function

    End Class

End Namespace
