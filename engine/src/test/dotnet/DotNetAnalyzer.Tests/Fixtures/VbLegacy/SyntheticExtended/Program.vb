Imports Acme.Extended.Dead
Imports Acme.Extended.Dup
Imports Acme.Extended.Rules

Module Program

    Sub Main()
        Dim orphans As New Orphans()
        orphans.Used()
        Console.WriteLine(Helpers.FormatAmount(10))
        Dim copyA As New CopyA()
        Dim copyB As New CopyB()
        Dim unique As New Unique()
        Console.WriteLine(copyA.Total(3) + copyB.Total(4) + unique.Total(5))
        Rethrow.Run()
        WeakHash.Digest("x")
        CatchAll.Run()
        Culture.Run()
        Wasteful.Run()
        Console.WriteLine(BusyController.Classify(3))
    End Sub

End Module
