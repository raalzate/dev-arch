using System.Data;

namespace LegacyEntLib.DataAccess
{
    /// <summary>Synthetic C# data access through stored procedures (feature 020). Fictitious names.</summary>
    public class PolicyAdapter
    {
        private readonly dynamic _db;

        public PolicyAdapter(dynamic db) { _db = db; }

        public object Read(int id)
        {
            var cmd = _db.GetStoredProcCommand("usp_Policy_Read");
            return _db.ExecuteDataSet(cmd);
        }

        public object List() => _db.ExecuteDataSet(_db, "usp_Policy_" + "List");

        public void Save(IDbCommand cmd)
        {
            cmd.CommandType = CommandType.StoredProcedure;
            cmd.CommandText = "dbo.usp_Policy_Save";
            cmd.ExecuteNonQuery();
        }

        public void Touch(dynamic conn) =>
            conn.Execute("usp_Policy_Touch", commandType: CommandType.StoredProcedure);
    }
}
