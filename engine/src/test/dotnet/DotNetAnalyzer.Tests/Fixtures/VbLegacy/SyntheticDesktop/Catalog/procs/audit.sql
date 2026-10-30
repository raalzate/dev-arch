-- Synthetic, fictitious audit procedure (feature 020).
CREATE PROCEDURE usp_Audit_Write @PolicyId INT AS
    INSERT INTO AuditLog (PolicyId, At) VALUES (@PolicyId, GETDATE())
