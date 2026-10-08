# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-4 @P2
Feature: Application configuration and secrets of VB legacy projects
  As the person responsible for the security of the migration
  I want to know which VB components read app.config/web.config entries and which depend on plaintext credentials
  So that I can plan their externalization before extracting services

  @TS-030 @FR-030 @FR-031 @FR-032 @FR-033 @acceptance
  Scenario: Connection strings and application settings referenced from code
    Given a VB legacy project with the file "app.config":
      """
      <?xml version="1.0" encoding="utf-8"?>
      <configuration>
        <connectionStrings>
          <add name="MainDb" connectionString="Server=db.example.invalid;Database=Main;User Id=app;Password=Synthetic-Pw-1" />
          <add name="ReadOnlyDb" connectionString="Server=db.example.invalid;Database=Main;Integrated Security=SSPI" />
        </connectionStrings>
        <appSettings>
          <add key="ServiceApiKey" value="Synthetic-Key-2" />
          <add key="PageSize" value="25" />
          <add key="ArchiveConnectionString" value="Server=db.example.invalid;Trusted_Connection=True" />
        </appSettings>
      </configuration>
      """
    And the project file "Gateway.vb":
      """
      Imports System.Configuration

      Namespace Sample
          Public Class Gateway
              Public Function Main() As String
                  Return ConfigurationManager.ConnectionStrings("MainDb").ConnectionString
              End Function

              Public Function ReadOnlyDb() As String
                  Return ConfigurationManager.ConnectionStrings("ReadOnlyDb").ConnectionString
              End Function
          End Class

          Public Class Client
              Public Function Key() As String
                  Return ConfigurationManager.AppSettings("ServiceApiKey")
              End Function
          End Class

          Public Class Pager
              Public Function Size() As String
                  Dim archive As String = ConfigurationManager.AppSettings.Get("ArchiveConnectionString")
                  Return ConfigurationManager.AppSettings("PageSize")
              End Function
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.Gateway" has exactly the secrets references "ConfigurationManager, config:ConnectionStrings:MainDb, config:ConnectionStrings:ReadOnlyDb"
    And the component "Sample.Gateway" is marked as handling sensitive data
    And the component "Sample.Gateway" has the code issues "PLAINTEXT_SECRET_IN_CONFIG" exactly at lines "6"
    And every "PLAINTEXT_SECRET_IN_CONFIG" issue of the component "Sample.Gateway" has type "SECURITY" and severity "CRITICAL"
    And the component "Sample.Client" has exactly the secrets references "ConfigurationManager, config:ServiceApiKey"
    And the component "Sample.Client" is marked as handling sensitive data
    And the component "Sample.Client" has the code issues "PLAINTEXT_SECRET_IN_CONFIG" exactly at lines "16"
    And the component "Sample.Pager" has exactly the secrets references "ConfigurationManager, config:ArchiveConnectionString, config:PageSize"
    And the component "Sample.Pager" is not marked as handling sensitive data
    And the component "Sample.Pager" has no code issue "PLAINTEXT_SECRET_IN_CONFIG"

  @TS-031 @FR-030 @FR-031 @FR-032 @FR-033 @acceptance
  Scenario: Typed project settings and web.config entries
    Given a VB legacy project with the file "Web.config":
      """
      <?xml version="1.0" encoding="utf-8"?>
      <configuration>
        <appSettings>
          <add key="PartnerToken" value="Synthetic-Token-3" />
        </appSettings>
        <applicationSettings>
          <Sample.My.MySettings>
            <setting name="ReportsPath" serializeAs="String">
              <value>C:\Reports</value>
            </setting>
            <setting name="SmtpPassword" serializeAs="String">
              <value>Synthetic-Smtp-4</value>
            </setting>
          </Sample.My.MySettings>
        </applicationSettings>
      </configuration>
      """
    And the project file "Mailer.vb":
      """
      Namespace Sample
          Public Class Mailer
              Public Function Folder() As String
                  Return My.Settings.ReportsPath
              End Function

              Public Function Credential() As String
                  Return My.Settings.SmtpPassword
              End Function

              Public Function Partner() As String
                  Return System.Configuration.ConfigurationManager.AppSettings.Item("PartnerToken")
              End Function
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.Mailer" has exactly the secrets references "ConfigurationManager, config:PartnerToken, config:ReportsPath, config:SmtpPassword"
    And the component "Sample.Mailer" is marked as handling sensitive data
    And the component "Sample.Mailer" has the code issues "PLAINTEXT_SECRET_IN_CONFIG" exactly at lines "8, 12"

  @TS-032 @FR-035 @FR-083 @validation
  Scenario: A malformed configuration file does not abort the analysis
    Given a VB legacy project with the file "app.config":
      """
      <?xml version="1.0" encoding="utf-8"?>
      <configuration>
        <appSettings>
          <add key="ApiKey" value="Synthetic-Key-5"
      """
    And the project file "Reader.vb":
      """
      Imports System.Configuration

      Namespace Sample
          Public Class Reader
              Public Function Key() As String
                  Return ConfigurationManager.AppSettings("ApiKey")
              End Function
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.Reader" has exactly the secrets references "ConfigurationManager, config:ApiKey"
    And the component "Sample.Reader" is not marked as handling sensitive data
    And the component "Sample.Reader" has no code issue "PLAINTEXT_SECRET_IN_CONFIG"
    And reading the configuration of the project reports a diagnostic naming "app.config"

  @TS-033 @FR-031 @validation
  Scenario: References without a configuration file are still recorded
    Given a VB legacy project with the file "Reader.vb":
      """
      Imports System.Configuration

      Namespace Sample
          Public Class Reader
              Public Function Db() As String
                  Return ConfigurationManager.ConnectionStrings("Main").ConnectionString
              End Function
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.Reader" has exactly the secrets references "ConfigurationManager, config:ConnectionStrings:Main"
    And the component "Sample.Reader" is not marked as handling sensitive data

  @TS-034 @FR-031 @FR-033 @acceptance
  Scenario: Configuration references of the synthetic desktop corpus
    Given the synthetic VB project "SyntheticDesktop"
    When the project is analyzed
    Then the components have these secrets references and sensitivity:
      | component                                | references                                                               | sensitive |
      | LegacyShop.DataAccess.CustomerDataAccess | ConfigurationManager, config:ConnectionStrings:ShopDb                    | true      |
      | LegacyShop.Modules.DbMaintenance         | ConfigurationManager, config:ConnectionStrings:ShopDb                    | true      |
      | LegacyShop.Modules.AppGlobals            | config:UpdateServiceToken                                                | true      |
      | LegacyShop.Reports.MonthlySalesReport    | ConfigurationManager, config:ConnectionStrings:ReportsDb, config:ReportsFolder | false |
      | LegacyShop.Forms.CustomerForm            |                                                                          | false     |
      | LegacyShop.Business.CustomerController   |                                                                          | false     |

  @TS-035 @FR-030 @FR-031 @FR-033 @acceptance
  Scenario: Configuration references of the synthetic web services corpus read from web.config
    Given the synthetic VB project "SyntheticWebServices"
    When the project is analyzed
    Then the components have these secrets references and sensitivity:
      | component                              | references                                              | sensitive |
      | LegacyShop.Services.CustomerWebService | ConfigurationManager, config:PartnerApiToken            | true      |
      | LegacyShop.Services.OrderService       | ConfigurationManager, config:ConnectionStrings:OrdersDb | true      |
      | LegacyShop.Services.OrderDto           |                                                         | false     |

  @TS-036 @FR-034 @validation
  Scenario Outline: Configuration values never appear in the output
    Given the synthetic VB project "<project>"
    When the project is analyzed
    Then the serialized output does not contain "<value>"

    Examples:
      | project              | value                     |
      | SyntheticDesktop     | Synthetic-Pass-123        |
      | SyntheticDesktop     | Synthetic-ApiKey-0000     |
      | SyntheticDesktop     | Synthetic-Token-9999      |
      | SyntheticDesktop     | Synthetic-Admin-1         |
      | SyntheticWebServices | Synthetic-Orders-42       |
      | SyntheticWebServices | Synthetic-Partner-Token-7 |
