# SyntheticProcedures (synthetic VB.NET legacy fixture)

Synthetic, redistributable fixture written for feature 020-stored-procedures. It imitates the data access of a
.NET Framework desktop application through stored procedures: Enterprise Library (`GetStoredProcCommand`,
`ExecuteDataSet`/`ExecuteScalar` with the procedure name), ADO.NET `CommandType.StoredProcedure` and a Dapper-style
call, one non-literal name (line 34 of `DataAccess/PolicyAdapter.vb`) and one text command. `Catalog/procs/*.sql`
and `Catalog/procs.csv` are equivalent procedure catalogs (`usp_Policy_Touch` is deliberately absent).
All names are fictitious; it is not a real system and is not derived from any real code base.
