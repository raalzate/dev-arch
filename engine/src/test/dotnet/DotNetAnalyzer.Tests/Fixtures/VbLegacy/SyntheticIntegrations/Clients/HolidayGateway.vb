Namespace Clients

    ' Fictitious gateway over the generated ASMX proxy of the Holiday web reference.
    Public Class HolidayGateway

        Public Function IsHoliday(ByVal day As Date) As Boolean
            Dim service As New Holiday.HolidayService()
            Return service.IsHoliday(day)
        End Function

    End Class

End Namespace
