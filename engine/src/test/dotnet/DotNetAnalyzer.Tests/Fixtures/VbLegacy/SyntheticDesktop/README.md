# SyntheticDesktop (synthetic VB.NET legacy fixture)

Synthetic, redistributable fixture written for feature 009-vb-legacy-completion. It imitates the
*profile* of a .NET Framework 4.8 desktop application in Visual Basic (WinForms forms, modules,
ADO.NET data access with literal SQL and a typed DataSet, `app.config`, a report class and a business
facade). All names, hosts and credentials are fictitious (`*.example.invalid`, `Synthetic-*`).
It is not a real system and is not derived from any real code base.

Feature 020-stored-procedures: the stored procedure invocations live in the sibling fixture `SyntheticProcedures`;
`Modules/DbMaintenance.vb` runs its maintenance procedure through a text command (`EXEC …`) so the tables of this
corpus stay those of 009.
Since feature 021 the project compiles with `Option Strict On` (the file-level `Option Strict Off` of
`Forms/CustomerForm.vb` remains): the project-level rule is exercised by `SyntheticLegacyDebt`.
