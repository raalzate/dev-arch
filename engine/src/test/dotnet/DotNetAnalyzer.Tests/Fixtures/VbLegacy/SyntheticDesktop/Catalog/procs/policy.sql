-- Synthetic, fictitious procedures of the SyntheticDesktop fixture (feature 020).
CREATE PROCEDURE [dbo].[usp_Policy_Read] @Id INT AS
BEGIN
    SELECT p.Id, p.Number, h.Name FROM dbo.Policies p INNER JOIN PolicyHolders h ON h.Id = p.HolderId WHERE p.Id = @Id;
END
GO
CREATE PROCEDURE dbo.usp_Policy_List AS
    SELECT Id, Number FROM Policies WHERE Active = 1
GO
CREATE OR ALTER PROCEDURE usp_Policy_Count AS
    SELECT COUNT(*) FROM Policies
GO
CREATE PROCEDURE usp_Policy_Save @Id INT, @Number NVARCHAR(20) AS
BEGIN
    UPDATE Policies SET Number = @Number WHERE Id = @Id;
    EXEC dbo.usp_Audit_Write @Id;
END
GO
ALTER PROCEDURE usp_Policy_Archive @Id INT AS
BEGIN
    INSERT INTO PolicyArchive SELECT * FROM Policies WHERE Id = @Id;
    DELETE FROM Policies WHERE Id = @Id;
END
