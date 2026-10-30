Namespace Rules

    ' CA5351: MD5 is a broken hash algorithm.
    Public Class WeakHash

        Public Shared Function Digest(text As String) As String
            Using md5 = System.Security.Cryptography.MD5.Create()
                Dim bytes = md5.ComputeHash(System.Text.Encoding.UTF8.GetBytes(text))
                Return Convert.ToBase64String(bytes)
            End Using
        End Function

    End Class

End Namespace
