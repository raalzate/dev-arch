Imports System.Runtime.Serialization

Namespace LegacyShop.Services

    <DataContract()> _
    Public Class OrderDto

        <DataMember()> _
        Public Property Id As String

        <DataMember()> _
        Public Property Status As String

    End Class

End Namespace
