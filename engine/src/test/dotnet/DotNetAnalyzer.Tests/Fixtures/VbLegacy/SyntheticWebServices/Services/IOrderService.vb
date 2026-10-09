Imports System.ServiceModel
Imports System.ServiceModel.Web

Namespace LegacyShop.Services

    <ServiceContract()> _
    Public Interface IOrderService

        <OperationContract()> _
        <WebGet(UriTemplate:="orders/{id}")> _
        Function GetOrder(ByVal id As String) As OrderDto

        <OperationContract()> _
        Sub CancelOrder(ByVal orderId As Integer, Optional ByVal reason As String = "")

        <OperationContract()> _
        <WebInvoke(Method:="PUT", UriTemplate:="/orders/{id}/status?notify={notify}")> _
        Function UpdateStatus(ByVal id As String, ByVal status As String, ByVal notify As Boolean) As Boolean

        Function NotAnOperation() As String

    End Interface

End Namespace
